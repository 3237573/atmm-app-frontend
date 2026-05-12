export interface DepartmentRO {
  id: string;
  companyId: string;
  parentDepartmentId: string | null;
  headMembershipId: string | null;
  name: string;
  status: string;
  // Можно добавить для удобства фронта
  childDepartments?: DepartmentRO[];
  employeeCount?: number;
}

export interface CreateDepartmentRequest {
  name: string;
  parentDepartmentId?: string | null;
  headMembershipId?: string | null;
}

export interface UpdateDepartmentRequest {
  name: string;
}

export interface SetDepartmentHeadRequest {
  headMembershipId: string;
}

export interface AssignEmployeeRequest {
  membershipId: string;
}

export interface DepartmentAffiliation {
  departmentId: string;
  departmentName: string;
  role: string; // Строка, никаких енамов
}
