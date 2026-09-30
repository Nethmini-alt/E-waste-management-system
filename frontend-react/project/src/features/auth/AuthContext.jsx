/* eslint-disable react-refresh/only-export-components */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable no-unused-vars */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../../api/client';

const AuthContext = createContext(null);
const STORAGE_TOKEN = 'access_token';
const STORAGE_USER = 'auth_user';

// Worker staff use only the Flutter warehouse app; the web is for management staff, admins and customers.
export const WORKER_WEB_MESSAGE = 'Worker staff accounts sign in to the warehouse mobile app, not the website.';
const isWorker = (role) => typeof role === 'string' && role.toLowerCase() === 'worker';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Rehydrate from localStorage on mount
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_USER);
    if (raw) {
      try {
        const stored = JSON.parse(raw);
        if (isWorker(stored?.role)) {
          localStorage.removeItem(STORAGE_TOKEN);
          localStorage.removeItem(STORAGE_USER);
        } else {
          setUser(stored);
        }
      } catch {
        localStorage.removeItem(STORAGE_USER);
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/api/auth/login', { email, password });
    const { token, userId, email: mail, fullName, role, staffType } = res.data;
    if (isWorker(role)) {
      const err = new Error(WORKER_WEB_MESSAGE);
      err.response = { data: { message: WORKER_WEB_MESSAGE } };
      throw err;
    }
    localStorage.setItem(STORAGE_TOKEN, token);
    const u = { userId, email: mail, fullName, role, staffType: staffType ?? null };
    localStorage.setItem(STORAGE_USER, JSON.stringify(u));
    setUser(u);
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_TOKEN);
    localStorage.removeItem(STORAGE_USER);
    setUser(null);
  };

  const hasRole = (...roles) =>
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
