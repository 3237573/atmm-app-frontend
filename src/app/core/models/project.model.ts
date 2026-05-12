export interface ProjectMemberRO {
  membershipId: string;
  roleInProject?: string;
  joinedAt?: string;
}

export interface ProjectRO {
  id: string;
  companyId: string;
  title: string;
  description?: string;
  creatorMembershipId?: string;
  status: 'ACTIVE' | 'ARCHIVED' | 'DRAFT';
  parentProjectId?: string | null;
  members: ProjectMemberRO[];
  subProjects: ProjectRO[];
  createdAt?: string;
  version: number;
}

export interface CreateProjectRO {
  title: string;
  description?: string;
  parentProjectId?: string | null;
}

export interface UpdateProjectRO {
  title: string;
  description?: string;
  parentProjectId?: string | null;
  status: string;
  version: number;
}

export interface ProjectAffiliation {
  projectId: string;
  projectName: string;
  role: string;
}
