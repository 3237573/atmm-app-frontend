import {IMemberVO} from './member.model';

export interface ICompany {
  companyId?: string;
  name: string;
  code: string;
  owner: IMemberVO;
  status?: string;
}
