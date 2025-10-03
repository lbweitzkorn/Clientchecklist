import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);

    if (req.method === 'GET') {
      if (pathParts.length === 2) {
        const timelineId = pathParts[1];
        
        const { data: timeline, error } = await supabase
          .from('timelines')
          .select(`
            *,
            event:events(*),
            blocks(
              *,
              tasks(
                *
              )
            )
          `)
          .eq('id', timelineId)
          .single();

        if (error) throw error;

        if (timeline.blocks) {
          timeline.blocks.sort((a, b) => a.order - b.order);
          timeline.blocks.forEach(block => {
            if (block.tasks) {
              block.tasks.sort((a, b) => a.order - b.order);
            }
          });
        }

        const totalWeight = timeline.blocks?.reduce((sum, block) =>
          sum + (block.tasks?.reduce((taskSum, task) => taskSum + task.weight, 0) || 0), 0
        ) || 0;

        const completedWeight = timeline.blocks?.reduce((sum, block) =>
          sum + (block.tasks?.reduce((taskSum, task) =>
            taskSum + (task.done ? task.weight : 0), 0) || 0), 0
        ) || 0;

        const progress = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;

        return new Response(
          JSON.stringify({ ...timeline, progress }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        const query = url.searchParams.get('query') || '';
        let dbQuery = supabase
          .from('timelines')
          .select(`
            *,
            event:events(*)
          `);

        if (query) {
          dbQuery = dbQuery.or(`event.code.ilike.%${query}%,event.title.ilike.%${query}%`);
        }

        const { data: timelines, error } = await dbQuery;

        if (error) throw error;

        return new Response(
          JSON.stringify(timelines || []),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (req.method === 'PUT' && pathParts.length === 4 && pathParts[2] === 'tasks') {
      const timelineId = pathParts[1];
      const taskId = pathParts[3];
      const updates = await req.json();

      const { data: task, error: fetchError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .eq('timeline_id', timelineId)
        .single();

      if (fetchError) throw fetchError;

      const changes: any = {};
      const updateData: any = {};

      if (updates.done !== undefined && updates.done !== task.done) {
        changes.done = { from: task.done, to: updates.done };
        updateData.done = updates.done;
        updateData.done_at = updates.done ? new Date().toISOString() : null;
        updateData.done_by = updates.done ? (updates.actor || 'admin') : null;
      }

      if (updates.assignee !== undefined && updates.assignee !== task.assignee) {
        changes.assignee = { from: task.assignee, to: updates.assignee };
        updateData.assignee = updates.assignee;
      }

      if (updates.due_date !== undefined && updates.due_date !== task.due_date) {
        changes.due_date = { from: task.due_date, to: updates.due_date };
        updateData.due_date = updates.due_date;
      }

      if (updates.weight !== undefined && updates.weight !== task.weight) {
        changes.weight = { from: task.weight, to: updates.weight };
        updateData.weight = updates.weight;
      }

      const { data: updatedTask, error: updateError } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', taskId)
        .select()
        .single();

      if (updateError) throw updateError;

      let action = 'edit';
      if (changes.done) {
        action = changes.done.to ? 'check' : 'uncheck';
      }

      await supabase.from('audit_entries').insert({
        timeline_id: timelineId,
        task_id: taskId,
        action,
        actor: updates.actor || 'admin',
        changes,
      });

      return new Response(
        JSON.stringify(updatedTask),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'POST' && pathParts.length === 3 && pathParts[2] === 'share') {
      const timelineId = pathParts[1];
      const { expiresInDays = 90 } = await req.json();

      await supabase
        .from('share_links')
        .delete()
        .eq('timeline_id', timelineId);

      const token = generateToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      const { data: shareLink, error } = await supabase
        .from('share_links')
        .insert({
          timeline_id: timelineId,
          token,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      const baseUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/$/g, '') || '';
      const shareUrl = `${baseUrl}/timeline?token=${token}`;

      return new Response(
        JSON.stringify({
          url: shareUrl,
          token,
          expiresAt: shareLink.expires_at,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});