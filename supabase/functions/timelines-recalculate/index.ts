import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import {
  addMonths, subMonths, addDays, subDays, differenceInCalendarDays,
  startOfWeek, isBefore, isAfter, max as maxDate, min as minDate, parseISO
} from 'npm:date-fns@4.1.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

type Distribution = 'frontload' | 'balanced' | 'even';

interface Task {
  id: string;
  block_id: string;
  title: string;
  is_skeleton: boolean;
  weight: number;
  locked?: boolean;
  due_date?: string;
  depends_on_task_ids?: string[];
}

interface Block {
  id: string;
  title: string;
  key: string;
  order: number;
  tasks?: Task[];
}

interface TemplateBlock {
  months_before_start: number;
  months_before_end: number;
}

interface RecalcResult {
  updated: number;
  skippedLocked: number;
  scaleFactor: number;
  notes: string[];
}

const CANONICAL_BLOCKS: Record<string, { start: number; end: number }> = {
  '12m': { start: 12, end: 10 },
  '8-10m': { start: 10, end: 8 },
  '6-8m': { start: 8, end: 6 },
  '4-6m': { start: 6, end: 4 },
  '3-4m': { start: 4, end: 3 },
  '1-2m': { start: 2, end: 1 },
  '2w': { start: 0.5, end: 0 },
};

function getCanonicalOffsets(blockKey: string): { start: number; end: number } | null {
  for (const [key, offsets] of Object.entries(CANONICAL_BLOCKS)) {
    if (blockKey.includes(key) || blockKey.toLowerCase().includes(key.toLowerCase())) {
      return offsets;
    }
  }

  const match = blockKey.match(/(\d+)(?:-(\d+))?([mw])/i);
  if (match) {
    const num1 = parseInt(match[1]);
    const num2 = match[2] ? parseInt(match[2]) : num1;
    const unit = match[3].toLowerCase();

    if (unit === 'm') {
      return { start: Math.max(num1, num2), end: Math.min(num1, num2) };
    } else if (unit === 'w') {
      return { start: Math.max(num1, num2) / 4, end: Math.min(num1, num2) / 4 };
    }
  }

  return null;
}

function recalcTimelineDates(opts: {
  eventDateISO: string;
  todayISO?: string;
  blocks: Array<Block & { monthsBeforeStart: number; monthsBeforeEnd: number }>;
  tasks: Task[];
  distribution?: Distribution;
  respectLocks?: boolean;
  graceDays?: number;
}): { tasks: Array<{ id: string; due_date: string; overdue_on_original_plan?: boolean }>; blocks: Array<{ id: string; start_date: string; end_date: string }>; result: RecalcResult } {
  const {
    eventDateISO,
    todayISO = new Date().toISOString(),
    blocks,
    tasks: inputTasks,
    distribution = 'frontload',
    respectLocks = true,
    graceDays = 2,
  } = opts;

  const eventDate = parseISO(eventDateISO);
  const today = parseISO(todayISO);

  const ltDays = Math.max(differenceInCalendarDays(eventDate, today), 0);
  const LTmonths = ltDays / 30.437;
  const S = Math.min(Math.max(LTmonths / 12, 0), 2);

  const notes: string[] = [];
  if (LTmonths < 2) notes.push('Compressed schedule: weekly mode suggested');

  const scaledWindows = blocks.map(b => {
    const start = startOfWeek(subMonths(eventDate, Math.round(b.monthsBeforeStart * S)), { weekStartsOn: 1 });
    const endRaw = subMonths(eventDate, Math.round(b.monthsBeforeEnd * S));
    const end = startOfWeek(endRaw, { weekStartsOn: 1 });
    const safeEnd = !isBefore(end, start) ? end : addDays(start, 7);
    return {
      blockId: b.id,
      start,
      end: safeEnd,
      start_date: toISODate(start),
      end_date: toISODate(safeEnd)
    };
  });

  const byBlock = new Map<string, Task[]>();
  inputTasks.forEach(t => {
    const arr = byBlock.get(t.block_id) || [];
    arr.push(t);
    byBlock.set(t.block_id, arr);
  });

  let updated = 0;
  let skippedLocked = 0;
  const idToTask = new Map(inputTasks.map(t => [t.id, t]));
  const updatedTasks: Array<{ id: string; due_date: string; overdue_on_original_plan?: boolean }> = [];

  scaledWindows.forEach(win => {
    const blockTasks = (byBlock.get(win.blockId) || []).slice();

    const lockedTasks = blockTasks.filter(t => t.locked && t.due_date);
    const unlockedTasks = blockTasks.filter(t => !(respectLocks && t.locked));

    unlockedTasks.sort((a, b) =>
      (Number(b.is_skeleton) - Number(a.is_skeleton)) ||
      (b.weight - a.weight) ||
      a.title.localeCompare(b.title)
    );

    const anchors = lockedTasks
      .map(t => ({ t, d: parseISO(t.due_date!) }))
      .sort((a, b) => a.d.getTime() - b.d.getTime());

    type Span = { start: Date; end: Date; tasks: Task[] };
    const spans: Span[] = [];
    let cursorStart = win.start;

    anchors.forEach((a, idx) => {
      const prevEnd = subDays(a.d, 1);
      if (!isBefore(prevEnd, cursorStart)) {
        spans.push({ start: cursorStart, end: prevEnd, tasks: [] });
      }
      cursorStart = addDays(a.d, 1);
    });
    if (!isBefore(win.end, cursorStart)) {
      spans.push({ start: cursorStart, end: win.end, tasks: [] });
    }

    let idx = 0;
    unlockedTasks.forEach(t => {
      if (spans.length === 0) return;
      spans[idx % spans.length].tasks.push(t);
      idx++;
    });

    spans.forEach(span => {
      const spanDays = Math.max(differenceInCalendarDays(span.end, span.start), 1);
      if (span.tasks.length === 0) return;

      const N = span.tasks.length;

      const positionForIndex = (i: number): number => {
        if (distribution === 'even' || distribution === 'balanced') {
          return Math.round((i / Math.max(N - 1, 1)) * spanDays);
        } else {
          const firstHalf = Math.ceil(N / 2);
          if (i < firstHalf) {
            const subDaysRange = Math.max(Math.round(0.25 * spanDays), 1);
            return Math.round((i / Math.max(firstHalf - 1, 1)) * subDaysRange);
          } else {
            const j = i - firstHalf;
            const secondN = N - firstHalf;
            const startOffset = Math.max(Math.round(0.25 * spanDays), 1);
            const range = Math.max(spanDays - startOffset, 1);
            return startOffset + Math.round((j / Math.max(secondN - 1, 1)) * range);
          }
        }
      };

      span.tasks.forEach((t, i) => {
        const base = addDays(span.start, positionForIndex(i));

        let due = base;
        const deps = (t.depends_on_task_ids || []).map(id => {
          const dep = idToTask.get(id);
          return dep?.due_date ? parseISO(dep.due_date) : null;
        }).filter(Boolean) as Date[];
        if (deps.length) {
          const minDue = addDays(deps.reduce((acc, d) => maxDate(acc, d), deps[0]), 1);
          due = maxDate(due, minDue);
        }

        due = minDate(maxDate(due, span.start), span.end);

        let overdueOnOriginalPlan = false;
        if (isBefore(due, today)) {
          due = addDays(today, graceDays);
          overdueOnOriginalPlan = true;
        }

        const prevISO = t.due_date;
        if (!(respectLocks && t.locked)) {
          const newDue = toISODate(due);
          updatedTasks.push({
            id: t.id,
            due_date: newDue,
            ...(overdueOnOriginalPlan && { overdue_on_original_plan: true })
          });
          if (newDue !== prevISO) updated++;
        } else {
          skippedLocked++;
          if (t.due_date) {
            updatedTasks.push({ id: t.id, due_date: t.due_date });
          }
        }
      });
    });

    lockedTasks.forEach(t => {
      if (t.due_date && !updatedTasks.find(ut => ut.id === t.id)) {
        updatedTasks.push({ id: t.id, due_date: t.due_date });
      }
    });
  });

  return {
    tasks: updatedTasks,
    blocks: scaledWindows.map(w => ({ id: w.blockId, start_date: w.start_date, end_date: w.end_date })),
    result: { updated, skippedLocked, scaleFactor: Number(S.toFixed(2)), notes }
  };
}

function toISODate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const timelineId = pathParts[pathParts.length - 1];

    if (!timelineId) {
      return new Response(
        JSON.stringify({ error: 'Timeline ID required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { respectLocks = true, distribution = 'frontload' } = body;

    const { data: timeline, error: timelineError } = await supabase
      .from('timelines')
      .select('*, events(*)')
      .eq('id', timelineId)
      .single();

    if (timelineError || !timeline) {
      return new Response(
        JSON.stringify({ error: 'Timeline not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const eventDate = timeline.events.date;
    if (!eventDate) {
      return new Response(
        JSON.stringify({ error: 'Event date not set' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: blocks, error: blocksError } = await supabase
      .from('blocks')
      .select('*')
      .eq('timeline_id', timelineId)
      .order('order');

    if (blocksError || !blocks) {
      return new Response(
        JSON.stringify({ error: 'Failed to load blocks' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .eq('timeline_id', timelineId)
      .order('order');

    if (tasksError || !tasks) {
      return new Response(
        JSON.stringify({ error: 'Failed to load tasks' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const blocksWithOffsets = blocks.map(block => {
      const offsets = getCanonicalOffsets(block.key);
      return {
        ...block,
        monthsBeforeStart: offsets?.start || 0,
        monthsBeforeEnd: offsets?.end || 0,
      };
    });

    const result = recalcTimelineDates({
      eventDateISO: eventDate,
      blocks: blocksWithOffsets,
      tasks,
      distribution: distribution as Distribution,
      respectLocks,
    });

    for (const blockUpdate of result.blocks) {
      await supabase
        .from('blocks')
        .update({
          start_date: blockUpdate.start_date,
          end_date: blockUpdate.end_date,
        })
        .eq('id', blockUpdate.id);
    }

    for (const taskUpdate of result.tasks) {
      await supabase
        .from('tasks')
        .update({
          due_date: taskUpdate.due_date,
          ...(taskUpdate.overdue_on_original_plan !== undefined && {
            overdue_on_original_plan: taskUpdate.overdue_on_original_plan
          })
        })
        .eq('id', taskUpdate.id);
    }

    await supabase
      .from('timelines')
      .update({
        last_recalculated_at: new Date().toISOString(),
        scale_factor: result.result.scaleFactor,
      })
      .eq('id', timelineId);

    await supabase.from('audit_entries').insert({
      timeline_id: timelineId,
      task_id: null,
      action: 'edit',
      actor: 'admin',
      changes: {
        type: 'recalculation',
        scale_factor: result.result.scaleFactor,
        distribution,
        respect_locks: respectLocks,
        updated: result.result.updated,
        skipped_locked: result.result.skippedLocked,
        notes: result.result.notes,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        updated: result.result.updated,
        skipped_locked: result.result.skippedLocked,
        scale_factor: result.result.scaleFactor,
        notes: result.result.notes,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Recalculation error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
