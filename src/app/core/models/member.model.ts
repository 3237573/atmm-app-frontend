export interface IMemberVO {
  email: string;
  fullName: string;
}

export interface IMemberResponse {
  userId: string;
  email: string;
  fullName: string | null;
  roleName: string;
  departmentName: string | null;
  status: string;
}
