export interface MemberResponse {
  userId: string;
  email: string;
  fullName: string | null;
  roleName: string;
  departmentName: string | null;
  status: string;
}
