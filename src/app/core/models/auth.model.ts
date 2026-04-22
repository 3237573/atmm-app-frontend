// src/app/core/models/auth.model.ts

export interface User {
  id: string;
  email: string;
}

export interface AuthMeResponse {
  user: User;
  companyId: string;
  permissions: string[];
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  companyName: string;
}
