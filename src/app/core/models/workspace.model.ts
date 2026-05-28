import {IMemberVO} from './member.model';

export interface IWorkspace {
  workspaceId?: string;
  name: string;
  code: string;
  owner: IMemberVO;
  status?: string;
}
