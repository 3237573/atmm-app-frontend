export interface IMemberVO {
  email: string;
  displayName: string;
}

export interface IMemberResponse {
  userId: string;
  email: string;
  displayName: string;
  roleName: string;
  departmentName: string | null;
  status: string;
}
