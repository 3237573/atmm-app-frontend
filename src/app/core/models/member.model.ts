import {DepartmentAffiliation} from './departament.model';
import {ProjectAffiliation} from './project.model';

export interface IMemberVO {
  email: string;
  displayName: string;
}

export interface MemberRO {
  id: string;
  email: string;
  displayName: string;
  roleName: string;
  departments: DepartmentAffiliation[];
  projects: ProjectAffiliation[]
  status: string;
}
