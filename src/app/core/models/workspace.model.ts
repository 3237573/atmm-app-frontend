import {IMemberVO} from './member.model';

export interface IWorkspace {
  workspaceId?: string;
  name: string;
  code: string;
  owner: IMemberVO;
  status?: string;
}

export interface WorkspaceInfoRO {
  workspaceId: string;
  name: string;
  code: string;
  role: string;
  displayName: string;
  memberId: string;
}
