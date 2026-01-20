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
  status?: string; // 'ongoing', 'completed', 'on hold', 'delayed'
  priority?: string; // 'Low', 'Medium', 'High'
  progress: number;
  projectHead: { id: number; name: string; email: string };
  projectMembers: ProjectMember[];
  createdAt?: string; // Format: yyyy-mm-ddThh:mm:ss
  createdBySuperAdmin?: {
    userId: number;
    name: string;
    email: string;
    createdAt: string;
    role: { roleName: string };
  };
}
