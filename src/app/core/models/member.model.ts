export interface IMemberVO {
  email: string;
  displayName: string;
}

export interface IMemberResponse {
  userId: string;
  membershipId: string;  // ✅ добавить это поле
  email: string;
  displayName: string;
  roleName: string;
  departmentName?: string;
  status: string;
}
