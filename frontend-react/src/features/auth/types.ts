export interface AuthUser {
  userId: string;
  email: string;
  fullName: string;
  role: string; // 'household' | 'corporate' | 'collector' | 'staff' | 'admin'
}

export interface LoginResponse {
  token: string;
  userId: string;
  email: string;
  fullName: string;
  role: string;
}