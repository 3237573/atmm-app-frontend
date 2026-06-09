export interface ProjectMemberRO {
  memberId: string;
  roleInProject?: string;
  joinedAt?: string;
}

export interface ProjectRO {
  id: string;
  workspaceId: string;
  title: string;
  description?: string;
  creatorMemberId?: string;
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
  projectTitle: string;
  role: string;
}
