// src/app/core/models/auth.model.ts

export interface IUser {
  id: string;
  email: string;
  fullName?: string;
  displayName?: string;
}

export interface IMembership {
  id: string;           // membershipId - основной идентификатор в компании
  userId: string;       // глобальный userId (для справки)
  email: string;
  fullName?: string;
  displayName?: string;
  role: string;
}

export interface CompanyInfo {
  companyId: string;
  name: string;
  code: string;
  role: string;
  displayName: string;
  membershipId: string;
}

export interface AuthMeResponse {
  membership: IMembership;
  company: CompanyInfo;
  permissions: string[];
}

export interface UserCompaniesResponse {
  userId: string;
  email: string;
  fullName?: string;
  companies: CompanyInfo[];
}

export interface IUser extends IMembership {}
