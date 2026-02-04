
export enum SectionId {
  MONTH = 'month',
  NEXT_WEEK = 'nextWeek',
  THIS_WEEK = 'thisWeek',
  TOMORROW = 'tomorrow',
  TODAY = 'today',
  DONE = 'done',
}

export interface Subtask {
  id: string;
  title: string;
  isCompleted: boolean;
}

export interface Task {
  id: string;
  title: string;
  section: SectionId;
  createdAt: number;
  updatedAt: number; // For fading logic (stagnation)
  lastTitleEditAt: number; // For Focus discipline timer (72h lock)
  dateAddedToToday?: number; // For "Visual Pain" (red if overdue in Today section)
  dueDate?: number; // User set due date
  isFocus: boolean; // Only relevant for SectionId.TODAY
  tags: string[]; // e.g. ['#trading']
  subtasks: Subtask[];
}

export interface SectionConfig {
  id: SectionId;
  title: string;
  limit: number;
}

export interface SyncPayload {
  updatedAt: number;
  tasks: Task[];
  appTitle: string;
  focusStartTime: string | null;
}
