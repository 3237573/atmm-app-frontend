export interface DepartmentRO {
  id: string;
  workspaceId: string;
  parentDepartmentId: string | null;
  headMemberId: string | null;
  name: string;
  status: string;
  // Можно добавить для удобства фронта
  childDepartments?: DepartmentRO[];
  employeeCount?: number;
}

export interface CreateDepartmentRequest {
  name: string;
  parentDepartmentId?: string | null;
  headMemberId?: string | null;
}

export interface UpdateDepartmentRequest {
  name: string;
}

export interface SetDepartmentHeadRequest {
  headMemberId: string;
}

export interface AssignEmployeeRequest {
  memberId: string;
}

export interface DepartmentAffiliation {
  departmentId: string;
  departmentName: string;
  role: string; // Строка, никаких енамов
}
