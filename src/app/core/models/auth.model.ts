// src/app/core/models/auth.model.ts

export interface IUser {
  id: string;
  email: string;
  fullName?: string;
  displayName?: string;
}

export interface IMember {
  id: string;           // memberId - основной идентификатор в пространства
  userId: string;       // глобальный userId (для справки)
  email: string;
  fullName?: string;
  displayName?: string;
  role: string;
}

export interface WorkspaceInfo {
  workspaceId: string;
  name: string;
  code: string;
  role: string;
  displayName: string;
  memberId: string;
}

export interface AuthMeResponse {
  member: IMember;
  workspace: WorkspaceInfo;
  permissions: string[];
}

export interface UserWorkspacesResponse {
  userId: string;
  email: string;
  fullName?: string;
  workspaces: WorkspaceInfo[];
}

export interface IUser extends IMember {}
