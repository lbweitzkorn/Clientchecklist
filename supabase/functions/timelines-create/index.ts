import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface EventData {
  id?: string;
  code: string;
  title: string;
  date?: string;
  venue?: string;
  type: 'wedding' | 'bar_mitzvah' | 'bat_mitzvah' | 'party';
}

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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const { event, eventCode, templateKey } = body;

    let eventId: string;
    let actualTemplateKey: string;
    let eventData: EventData | null = null;

    if (eventCode && templateKey) {
      const { data: existingEvent, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('code', eventCode)
        .maybeSingle();

      if (eventError) throw eventError;

      if (!existingEvent) {
        return new Response(
          JSON.stringify({ error: `Event not found with code: ${eventCode}` }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      eventId = existingEvent.id;
      actualTemplateKey = templateKey;
      eventData = existingEvent;
    } else if (event) {
      if (!event.code || !event.title || !event.type) {
        return new Response(
          JSON.stringify({ error: 'Missing required event fields' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: existingEvent } = await supabase
        .from('events')
        .select('id')
        .eq('code', event.code)
        .maybeSingle();

      if (existingEvent) {
        const { data: updatedEvent, error: updateError } = await supabase
          .from('events')
          .update({
            title: event.title,
            date: event.date,
            venue: event.venue,
            type: event.type,
          })
          .eq('id', existingEvent.id)
          .select()
          .single();

        if (updateError) throw updateError;
        eventId = updatedEvent.id;
        eventData = updatedEvent;
      } else {
        const { data: newEvent, error: insertError } = await supabase
          .from('events')
          .insert({
            id: event.id,
            code: event.code,
            title: event.title,
            date: event.date,
            venue: event.venue,
            type: event.type,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        eventId = newEvent.id;
        eventData = newEvent;
      }

      actualTemplateKey = event.type;
      if (!eventData) eventData = event;
    } else {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: eventCode and templateKey, or event object' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: template } = await supabase
      .from('templates')
      .select('*, template_blocks(*, template_tasks(*))')
      .eq('template_key', actualTemplateKey)
      .maybeSingle();

    if (!template) {
      return new Response(
        JSON.stringify({ error: `Template not found for type: ${actualTemplateKey}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: timeline, error: timelineError } = await supabase
      .from('timelines')
      .insert({
        event_id: eventId,
        template_key: actualTemplateKey,
        theme_key: actualTemplateKey,
        background_url: template.theme_background_url,
      })
      .select()
      .single();

    if (timelineError) throw timelineError;

    for (const templateBlock of template.template_blocks) {
      const { data: block, error: blockError } = await supabase
        .from('blocks')
        .insert({
          timeline_id: timeline.id,
          key: templateBlock.key,
          title: templateBlock.title,
          order: templateBlock.order,
        })
        .select()
        .single();

      if (blockError) throw blockError;

      for (const templateTask of templateBlock.template_tasks) {
        await supabase.from('tasks').insert({
          timeline_id: timeline.id,
          block_id: block.id,
          title: templateTask.title,
          description: templateTask.description,
          assignee: templateTask.assignee,
          weight: templateTask.weight,
          is_skeleton: templateTask.is_skeleton,
          done: false,
          order: templateTask.order,
        });
      }
    }

    await supabase.from('blocks').insert({
      timeline_id: timeline.id,
      key: 'general',
      title: 'General Tasks',
      order: 999,
      is_general: true,
    });

    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    const { data: shareLink, error: shareLinkError } = await supabase
      .from('share_links')
      .insert({
        timeline_id: timeline.id,
        token,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (shareLinkError) throw shareLinkError;

    if (eventData?.date) {
      try {
        const recalcUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/timelines-recalculate/${timeline.id}`;
        await fetch(recalcUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
          },
          body: JSON.stringify({
            respectLocks: false,
            distribution: 'frontload',
          }),
        });
      } catch (recalcError) {
        console.error('Auto-recalculation failed:', recalcError);
      }
    }

    const baseUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/$/g, '') || '';
    const shareUrl = `${baseUrl.replace('https://', 'https://').replace('.supabase.co', '')}/timeline?token=${token}`;

    return new Response(
      JSON.stringify({
        timelineId: timeline.id,
        shareUrl,
        token,
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
