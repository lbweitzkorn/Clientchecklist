import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface Task {
  id: string;
  title: string;
  weight: number;
  is_skeleton: boolean;
  locked?: boolean;
  due_date?: string;
  done?: boolean;
  depends_on_task_ids?: string[];
  order: number;
}

interface Block {
  id: string;
  key: string;
  title: string;
  order: number;
  start_date?: string;
  end_date?: string;
  tasks?: Task[];
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

function calculateLeadTimeMonths(eventDate: Date, today: Date = new Date()): number {
  const daysBetween = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(Math.ceil(daysBetween / 30), 0);
}

function calculateScaleFactor(leadTimeMonths: number, canonicalMonths: number = 12): number {
  return leadTimeMonths / canonicalMonths;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() - months);
  return result;
}

function roundToWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? 0 : day;
  result.setDate(result.getDate() - diff);
  return result;
}

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

function recalculateBlockDates(
  eventDate: Date,
  blocks: Block[],
  scaleFactor: number,
  today: Date = new Date()
): Array<{ id: string; start_date: string; end_date: string }> {
  const result: Array<{ id: string; start_date: string; end_date: string }> = [];
  let previousEnd: Date | null = null;

  for (const block of blocks) {
    const offsets = getCanonicalOffsets(block.key);
    if (!offsets) {
      continue;
    }

    let startDate = roundToWeek(addMonths(eventDate, offsets.start * scaleFactor));
    let endDate = roundToWeek(addMonths(eventDate, offsets.end * scaleFactor));

    if (startDate < today) {
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() + 2);
    }

    if (endDate < today) {
      endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 3);
    }

    if (endDate > eventDate) {
      endDate = new Date(eventDate);
      endDate.setDate(endDate.getDate() - 1);
    }

    if (startDate >= endDate) {
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
    }

    if (previousEnd && startDate < previousEnd) {
      startDate = new Date(previousEnd);
    }

    if (startDate >= endDate) {
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
    }

    result.push({
      id: block.id,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
    });

    previousEnd = endDate;
  }

  return result;
}

function sortTasksForDistribution(tasks: Task[], distribution: string): Task[] {
  const sorted = [...tasks];

  if (distribution === 'frontload') {
    sorted.sort((a, b) => {
      if (a.is_skeleton !== b.is_skeleton) return a.is_skeleton ? -1 : 1;
      if (a.weight !== b.weight) return b.weight - a.weight;
      return a.title.localeCompare(b.title);
    });
  } else if (distribution === 'even') {
    sorted.sort((a, b) => a.title.localeCompare(b.title));
  } else {
    sorted.sort((a, b) => {
      if (a.is_skeleton !== b.is_skeleton) return a.is_skeleton ? -1 : 1;
      if (a.weight !== b.weight) return b.weight - a.weight;
      return a.title.localeCompare(b.title);
    });
  }

  return sorted;
}

function distributeTasksInBlock(
  tasks: Task[],
  blockStartDate: Date,
  blockEndDate: Date,
  distribution: string,
  respectLocks: boolean
): Array<{ id: string; due_date: string }> {
  const result: Array<{ id: string; due_date: string }> = [];

  const unlocked = tasks.filter(t => !respectLocks || !t.locked);
  const locked = tasks.filter(t => respectLocks && t.locked);

  for (const task of locked) {
    if (task.due_date) {
      result.push({ id: task.id, due_date: task.due_date });
    }
  }

  if (unlocked.length === 0) {
    return result;
  }

  const sorted = sortTasksForDistribution(unlocked, distribution);

  const totalDays = Math.ceil((blockEndDate.getTime() - blockStartDate.getTime()) / (1000 * 60 * 60 * 24));

  if (totalDays <= 1) {
    for (const task of sorted) {
      result.push({
        id: task.id,
        due_date: blockStartDate.toISOString().split('T')[0],
      });
    }
    return result;
  }

  const stride = totalDays / sorted.length;

  sorted.forEach((task, index) => {
    const offset = distribution === 'frontload' && task.is_skeleton
      ? Math.floor(stride * index * 0.7)
      : Math.floor(stride * index);

    const dueDate = new Date(blockStartDate);
    dueDate.setDate(dueDate.getDate() + offset);

    if (dueDate > blockEndDate) {
      dueDate.setTime(blockEndDate.getTime());
    }

    result.push({
      id: task.id,
      due_date: dueDate.toISOString().split('T')[0],
    });
  });

  return result;
}

function enforceDependencies(
  tasks: Array<{ id: string; due_date: string }>,
  allTasks: Task[]
): Array<{ id: string; due_date: string }> {
  const taskMap = new Map(tasks.map(t => [t.id, new Date(t.due_date)]));
  const taskDetailsMap = new Map(allTasks.map(t => [t.id, t]));
  let changed = true;
  let iterations = 0;
  const maxIterations = 100;

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    for (const task of tasks) {
      const taskDetails = taskDetailsMap.get(task.id);
      if (!taskDetails || !taskDetails.depends_on_task_ids) continue;

      const taskDate = taskMap.get(task.id)!;

      for (const depId of taskDetails.depends_on_task_ids) {
        const depDate = taskMap.get(depId);
        if (!depDate) continue;

        const minDate = new Date(depDate);
        minDate.setDate(minDate.getDate() + 1);

        if (taskDate < minDate) {
          taskMap.set(task.id, minDate);
          changed = true;
        }
      }
    }
  }

  return Array.from(taskMap.entries()).map(([id, date]) => ({
    id,
    due_date: date.toISOString().split('T')[0],
  }));
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

    const eventDate = new Date(timeline.events.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const leadTimeMonths = calculateLeadTimeMonths(eventDate, today);
    const scaleFactor = calculateScaleFactor(leadTimeMonths);

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

    const blocksWithTasks = blocks.map(block => ({
      ...block,
      tasks: tasks.filter(t => t.block_id === block.id),
    }));

    const recalculatedBlocks = recalculateBlockDates(eventDate, blocksWithTasks, scaleFactor, today);

    let allTaskUpdates: Array<{ id: string; due_date: string }> = [];

    for (const block of blocksWithTasks) {
      const blockResult = recalculatedBlocks.find(b => b.id === block.id);
      if (!blockResult || !block.tasks || block.tasks.length === 0) continue;

      const blockStart = new Date(blockResult.start_date);
      const blockEnd = new Date(blockResult.end_date);

      const distributedTasks = distributeTasksInBlock(
        block.tasks,
        blockStart,
        blockEnd,
        distribution,
        respectLocks
      );

      allTaskUpdates.push(...distributedTasks);
    }

    allTaskUpdates = enforceDependencies(allTaskUpdates, tasks);

    for (const blockUpdate of recalculatedBlocks) {
      await supabase
        .from('blocks')
        .update({
          start_date: blockUpdate.start_date,
          end_date: blockUpdate.end_date,
        })
        .eq('id', blockUpdate.id);
    }

    for (const taskUpdate of allTaskUpdates) {
      await supabase
        .from('tasks')
        .update({
          due_date: taskUpdate.due_date,
        })
        .eq('id', taskUpdate.id);
    }

    await supabase
      .from('timelines')
      .update({
        last_recalculated_at: new Date().toISOString(),
        scale_factor: scaleFactor,
      })
      .eq('id', timelineId);

    await supabase.from('audit_entries').insert({
      timeline_id: timelineId,
      task_id: null,
      action: 'edit',
      actor: 'admin',
      changes: {
        type: 'recalculation',
        lead_time_months: leadTimeMonths,
        scale_factor: scaleFactor,
        distribution,
        respect_locks: respectLocks,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        blocks: recalculatedBlocks,
        tasks: allTaskUpdates,
        scale_factor: scaleFactor,
        lead_time_months: leadTimeMonths,
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
