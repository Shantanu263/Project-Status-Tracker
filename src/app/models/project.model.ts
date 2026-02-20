export interface ProjectMember {
  memberId: string | number;
  user: string;
  userId: number;
  email: string;
  project: string;
  role: string;
  memberStatus: string;
  isActive: boolean;
  assignedBy?: {
    userId: number;
    name: string;
    email: string;
    role: { roleName: string };
  };
}

export interface Project {
  projectId: number;
  projectName: string;
  description: string;
  startDate: string;
  endDate: string;
  status?: 'OPEN' | 'ONGOING' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
  priority?: string; // 'Low', 'Medium', 'High'
  client?: string;
  progress: number;
  projectHead: { id: number; name: string; email: string };
  projectMembers: ProjectMember[];
  createdAt?: string; // Format: yyyy-mm-ddThh:mm:ss
  completedOn?: string;
  createdBySuperAdmin?: {
    userId: number;
    name: string;
    email: string;
    createdAt: string;
    role: { roleName: string };
  };
}
