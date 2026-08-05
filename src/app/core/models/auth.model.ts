// src/app/core/models/auth.model.ts

import {WorkspaceInfoRO} from '@core/models/workspace.model';

// auth.model.ts

/** DTO для запроса аутентификации */
export interface AuthRequestRO {
  email: string;
  password: string;
}

/** DTO для выбора воркспейса */
export interface SelectWorkspaceRO {
  workspaceId: string;
  memberId: string;
}

export interface IMember {
  id: string;           // memberId - основной идентификатор в пространства
  userId: string;       // глобальный userId (для справки)
  email: string;
  fullName?: string;
  displayName?: string;
  role: string;
}

export interface AuthMeResponse {
  member: IMember;
  workspace: WorkspaceInfoRO;
  permissions: string[];
}

export interface UserWorkspacesResponse {
  userId: string;
  email: string;
  fullName?: string;
  workspaces: WorkspaceInfoRO[];
}

