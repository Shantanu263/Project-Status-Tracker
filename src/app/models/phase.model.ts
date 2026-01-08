export interface Comment {
  id: number;
  content: string;
  authorName: string;
  userId: number;
  createdAt: string;
}

export interface Log {
  id: number;
  projectId: number;
  userId: number;
  message: string;
  createdAt: string;
  entityId: number;
}

export interface SubTask {
  subTaskId: number;
  subTaskName: string;
  description?: string;
  taskId: number;
  startDate: string;
  endDate: string;
  status: 'TO_DO' | 'IN_PROGRESS' | 'DONE' | 'REVIEW';
  priority: 'Low' | 'Medium' | 'High';
  assignedToProjectMemberId?: number;
  comments?: Comment[];
  logs?: Log[];
}

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
  assignedToProjectMemberId?: number;
  projectPhaseId?: number;
  completedAt?: string;
  progress?: number;
  subTasks?: SubTask[];
  comments?: Comment[];
  logs?: Log[];
  phaseName?: string;
  phaseId?: number;
}


export interface Phase {
  phaseId?: number;
  phaseName: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  status?: 'IN_PROGRESS' | 'COMPLETED' | 'NOT_STARTED' | 'ON_HOLD';
  tasks?: Task[];
  projectMemberId?: number;
  assignedToName?: string;
  completedAt?: string;
  progress?: number;
  updatedAt?: string;
}
