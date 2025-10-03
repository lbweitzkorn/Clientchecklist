import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface TemplateTask {
  title: string;
  assignee: 'client' | 'js' | 'joint';
  isSkeleton?: boolean;
  weight?: number;
  order: number;
  description?: string;
}

interface TemplateBlock {
  key: string;
  title: string;
  order: number;
  tasks: TemplateTask[];
}

interface Template {
  templateKey: string;
  title: string;
  description?: string;
  backgroundUrl?: string;
  blocks: TemplateBlock[];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { templates }: { templates: Template[] } = await req.json();

    if (!templates || !Array.isArray(templates)) {
      return new Response(
        JSON.stringify({ error: 'Invalid templates data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let templatesCount = 0;
    let blocksCount = 0;
    let tasksCount = 0;

    for (const template of templates) {
      const { data: existingTemplate } = await supabase
        .from('templates')
        .select('template_key')
        .eq('template_key', template.templateKey)
        .maybeSingle();

      if (existingTemplate) {
        await supabase
          .from('template_tasks')
          .delete()
          .in(
            'block_id',
            supabase
              .from('template_blocks')
              .select('id')
              .eq('template_id', (
                await supabase
                  .from('templates')
                  .select('id')
                  .eq('template_key', template.templateKey)
                  .single()
              ).data?.id)
          );

        await supabase
          .from('template_blocks')
          .delete()
          .eq(
            'template_id',
            (
              await supabase
                .from('templates')
                .select('id')
                .eq('template_key', template.templateKey)
                .single()
            ).data?.id
          );
      }

      const { data: templateData, error: templateError } = await supabase
        .from('templates')
        .upsert({
          template_key: template.templateKey,
          title: template.title,
          description: template.description,
          theme_background_url: template.backgroundUrl,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (templateError) {
        console.error('Template error:', templateError);
        continue;
      }

      templatesCount++;

      for (const block of template.blocks) {
        const { data: blockData, error: blockError } = await supabase
          .from('template_blocks')
          .insert({
            template_id: templateData.id,
            key: block.key,
            title: block.title,
            order: block.order,
          })
          .select()
          .single();

        if (blockError) {
          console.error('Block error:', blockError);
          continue;
        }

        blocksCount++;

        for (const task of block.tasks) {
          const { error: taskError } = await supabase
            .from('template_tasks')
            .insert({
              template_block_id: blockData.id,
              title: task.title,
              description: task.description,
              assignee: task.assignee,
              weight: task.weight ?? (task.isSkeleton ? 3 : 1),
              is_skeleton: task.isSkeleton ?? false,
              order: task.order,
            });

          if (taskError) {
            console.error('Task error:', taskError);
            continue;
          }

          tasksCount++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        counts: {
          templates: templatesCount,
          blocks: blocksCount,
          tasks: tasksCount,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});