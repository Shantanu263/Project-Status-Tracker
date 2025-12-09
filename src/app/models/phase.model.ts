export interface Task {
  taskId?: number;
  taskName: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  status?: 'TO_DO' | 'IN_PROGRESS' | 'DONE' | 'REVIEW';
  priority?: 'Low' | 'Medium' | 'High';
  assignedTo?: number;
  assignedToName?: string;
  completedAt?: string;
  subTasks?: any[];
  comments?: any[];
}

export interface Phase {
  phaseId?: number;
  phaseName: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  status?: 'TO_DO' | 'IN_PROGRESS' | 'DONE' | 'REVIEW';
  tasks?: Task[];
  projectMemberId?: number;
  completedAt?: string;
  progress?: number;
  updatedAt?: string;
}
