// src/app/core/models/auth.model.ts

export interface User {
  id: number;
  email: string;
  fullName: string;
  companyId?: number;
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