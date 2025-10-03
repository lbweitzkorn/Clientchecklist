import {
  addMonths, subMonths, addDays, subDays, differenceInCalendarDays,
  startOfWeek, isBefore, isAfter, max as maxDate, min as minDate, parseISO
} from 'date-fns';

type Distribution = 'frontload' | 'balanced' | 'even';

interface Task {
  id: string;
  blockId: string;
  title: string;
  isSkeleton: boolean;
  weight: number;
  locked: boolean;
  dueDate?: string;
  dependsOnTaskIds?: string[];
}

interface Block {
  id: string;
  title: string;
  monthsBeforeStart: number;
  monthsBeforeEnd: number;
}

interface RecalcResult {
  updated: number;
  skippedLocked: number;
  scaleFactor: number;
  notes: string[];
}

export function recalcTimelineDates(opts: {
  eventDateISO: string;
  todayISO?: string;
  blocks: Block[];
  tasks: Task[];
  distribution?: Distribution;
  respectLocks?: boolean;
  graceDays?: number;
}): { tasks: Task[]; result: RecalcResult } {
  const {
    eventDateISO,
    todayISO = new Date().toISOString(),
    blocks,
    tasks,
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
    return { blockId: b.id, start, end: safeEnd };
  });

  const byBlock = new Map<string, Task[]>();
  tasks.forEach(t => {
    const arr = byBlock.get(t.blockId) || [];
    arr.push(t);
    byBlock.set(t.blockId, arr);
  });

  let updated = 0;
  let skippedLocked = 0;
  const idToTask = new Map(tasks.map(t => [t.id, t]));

  scaledWindows.forEach(win => {
    const blockTasks = (byBlock.get(win.blockId) || []).slice();

    const lockedTasks = blockTasks.filter(t => t.locked && t.dueDate);
    const unlockedTasks = blockTasks.filter(t => !(respectLocks && t.locked));

    unlockedTasks.sort((a, b) =>
      (Number(b.isSkeleton) - Number(a.isSkeleton)) ||
      (b.weight - a.weight) ||
      a.title.localeCompare(b.title)
    );

    const anchors = lockedTasks
      .map(t => ({ t, d: parseISO(t.dueDate!) }))
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
      if (idx === anchors.length - 1 && !isAfter(win.end, cursorStart)) {
      }
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
        const deps = (t.dependsOnTaskIds || []).map(id => {
          const dep = idToTask.get(id);
          return dep?.dueDate ? parseISO(dep.dueDate) : null;
        }).filter(Boolean) as Date[];
        if (deps.length) {
          const minDue = addDays(deps.reduce((acc, d) => maxDate(acc, d), deps[0]), 1);
          due = maxDate(due, minDue);
        }

        due = minDate(maxDate(due, span.start), span.end);

        if (isBefore(due, today)) {
          due = addDays(today, graceDays);
        }

        const prevISO = t.dueDate;
        if (!(respectLocks && t.locked)) {
          t.dueDate = toISODate(due);
          if (t.dueDate !== prevISO) updated++;
        } else {
          skippedLocked++;
        }
      });
    });
  });

  return {
    tasks,
    result: { updated, skippedLocked, scaleFactor: Number(S.toFixed(2)), notes }
  };
}

function toISODate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
