// src/app/core/models/auth.model.ts

export interface IUser {
  id: string;
  email: string;
  fullName?: string;
}

export interface CompanyInfo {
  companyId: string;
  name: string;
  code: string;
  role: string;
  displayName: string;
}

export interface UserCompaniesResponse {
  userId: string;
  email: string;
  fullName?: string;
  companies: CompanyInfo[];
}

export interface AuthMeResponse {
  user: IUser;
  company: CompanyInfo;
  permissions: string[];
}
