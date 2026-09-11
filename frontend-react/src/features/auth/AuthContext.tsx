/* eslint-disable react-refresh/only-export-components */
/* eslint-disable react-hooks/set-state-in-effect */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { AuthUser, LoginResponse } from '../auth/types';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_TOKEN = 'access_token';
const STORAGE_USER = 'auth_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Rehydrate from localStorage on mount
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_USER);
    if (raw) {
      try {
        setUser(JSON.parse(raw));
      } catch {
        localStorage.removeItem(STORAGE_USER);
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post<LoginResponse>('/api/auth/login', { email, password });
    const { token, userId, email: mail, fullName, role } = res.data;

    localStorage.setItem(STORAGE_TOKEN, token);
    const u: AuthUser = { userId, email: mail, fullName, role };
    localStorage.setItem(STORAGE_USER, JSON.stringify(u));
    setUser(u);
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_TOKEN);
    localStorage.removeItem(STORAGE_USER);
    setUser(null);
  };

  const hasRole = (...roles: string[]) =>
    !!user && roles.map((r) => r.toLowerCase()).includes(user.role.toLowerCase());

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};