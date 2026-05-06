import {types} from 'sass';
import List = types.List;

export interface IMemberVO {
  email: string;
  displayName: string;
}

export interface DepartmentAffiliation {
  departmentId: string;
  departmentName: string;
  role: string; // Строка, никаких енамов
}

export interface MemberResponse {
  id: string;
  email: string;
  displayName: string;
  roleName: string;
  affiliations: DepartmentAffiliation[]; // Массив связей (Трио)
  status: string;
}
