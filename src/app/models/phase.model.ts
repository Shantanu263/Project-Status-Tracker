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
  status: 'OPEN' | 'ONGOING' | 'COMPLETED' | 'ON_HOLD';
  priority: 'Low' | 'Medium' | 'High';
  assignedToProjectMemberId?: number;
  completedOn?: string;
  comments?: Comment[];
  logs?: Log[];
}

export interface Task {
  taskId?: number;
  taskName: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  status?: 'OPEN' | 'ONGOING' | 'COMPLETED' | 'ON_HOLD';
  priority?: 'Low' | 'Medium' | 'High';
  assignedTo?: number;
  assignedToName?: string;
  assignedToProjectMemberId?: number;
  projectPhaseId?: number;
  completedOn?: string;
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
  status?: 'OPEN' | 'ONGOING' | 'COMPLETED' | 'ON_HOLD';
  tasks?: Task[];
  projectMemberId?: number;
  assignedToName?: string;
  completedOn?: string;
  progress?: number;
  updatedAt?: string;
}
