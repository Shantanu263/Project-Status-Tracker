export interface ProjectMember {
  memberId: string | number;
  user: string;
  email: string;
  project: string;
  role: string;
  memberStatus: string;
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
  progress: number;
  projectHead: { id: number; name: string; email: string };
  projectMembers: ProjectMember[];
}
