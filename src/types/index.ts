export type EventType = 'wedding' | 'bar_mitzvah' | 'bat_mitzvah' | 'party';
export type Assignee = 'client' | 'js' | 'joint';
export type AuditAction = 'check' | 'uncheck' | 'edit' | 'create';

export interface Event {
  id: string;
  code: string;
  title: string;
  date?: string;
  venue?: string;
  type: EventType;
  created_at: string;
  updated_at: string;
}

export interface Timeline {
  id: string;
  event_id: string;
  template_key: string;
  theme_key?: string;
  background_url?: string;
  created_at: string;
  updated_at: string;
  last_recalculated_at?: string;
  scale_factor?: string;
  allow_client_task_create?: boolean;
  include_general_in_totals?: boolean;
  event?: Event;
  blocks?: Block[];
  progress?: number;
}

export interface Block {
  id: string;
  timeline_id: string;
  key: string;
  title: string;
  order: number;
  start_date?: string;
  end_date?: string;
  created_at: string;
  is_general?: boolean;
  tasks?: Task[];
}

export interface Task {
  id: string;
  timeline_id: string;
  block_id: string;
  title: string;
  description?: string;
  assignee: Assignee;
  weight: number;
  is_skeleton: boolean;
  due_date?: string;
  done: boolean;
  done_by?: string;
  done_at?: string;
  locked?: boolean;
  depends_on_task_ids?: string[];
  overdue_on_original_plan?: boolean;
  order: number;
  created_at: string;
  updated_at: string;
}

export interface ShareLink {
  id: string;
  timeline_id: string;
  token: string;
  expires_at: string;
  created_at: string;
}

export interface AuditEntry {
  id: string;
  timeline_id: string;
  task_id?: string;
  action: AuditAction;
  actor: string;
  changes?: any;
  timestamp: string;
}

export interface ProgressStats {
  totalTasks: number;
  completedTasks: number;
  totalWeight: number;
  completedWeight: number;
  percentage: number;
}
