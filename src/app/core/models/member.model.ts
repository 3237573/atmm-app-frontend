import {types} from 'sass';
import List = types.List;
import {DepartmentAffiliation} from './departament.model';
import {ProjectAffiliation} from './project.model';

export interface IMemberVO {
  email: string;
  displayName: string;
}





export interface MemberResponse {
  id: string;
  email: string;
  displayName: string;
  roleName: string;
  departments: DepartmentAffiliation[];
  projects: ProjectAffiliation[]
  status: string;
}
