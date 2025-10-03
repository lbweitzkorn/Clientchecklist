import type { Block, Task, ProgressStats } from '../types';

export function calculateBlockProgress(tasks: Task[]): ProgressStats {
  const totalWeight = tasks.reduce((sum, task) => sum + task.weight, 0);
  const completedWeight = tasks.reduce(
    (sum, task) => sum + (task.done ? task.weight : 0),
    0
  );
  const completedTasks = tasks.filter((task) => task.done).length;

  return {
    totalTasks: tasks.length,
    completedTasks,
    totalWeight,
    completedWeight,
    percentage: totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0,
  };
}

export function calculateTimelineProgress(blocks: Block[], includeGeneral = true): ProgressStats {
  const filteredBlocks = includeGeneral ? blocks : blocks.filter(b => !b.is_general);
  const allTasks = filteredBlocks.flatMap((block) => block.tasks || []);
  return calculateBlockProgress(allTasks);
}

export function getProgressColor(percentage: number): string {
  if (percentage >= 75) return '#10b981';
  if (percentage >= 50) return '#3b82f6';
  if (percentage >= 25) return '#f59e0b';
  return '#6b7280';
}

export function calculateProgressByAssignee(tasks: Task[]): {
  client: ProgressStats;
  js: ProgressStats;
  joint: ProgressStats;
} {
  const clientTasks = tasks.filter(t => t.assignee === 'client' || t.assignee === 'joint');
  const jsTasks = tasks.filter(t => t.assignee === 'js' || t.assignee === 'joint');
  const jointTasks = tasks.filter(t => t.assignee === 'joint');

  return {
    client: calculateBlockProgress(clientTasks),
    js: calculateBlockProgress(jsTasks),
    joint: calculateBlockProgress(jointTasks),
  };
}
