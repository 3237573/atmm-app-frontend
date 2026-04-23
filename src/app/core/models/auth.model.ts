// src/app/core/models/auth.model.ts

export interface IUser {
  id: string;
  email: string;
}

export interface AuthMeResponse {
  user: IUser;
  companyId: string;
  permissions: string[];
}

export interface AuthResponse {
  token: string;
  user: IUser;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  companyName: string;
}
