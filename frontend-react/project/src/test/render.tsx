import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../features/auth/AuthContext';

export type TestRole = 'Admin' | 'Staff' | 'Worker' | 'Household' | 'Collector' | null;

/** Signs a user in the way the app does (localStorage), so AuthProvider picks them up. */
export function signInAs(role: TestRole) {
  if (!role) return;
  localStorage.setItem('access_token', 'test-token');
  localStorage.setItem('auth_user', JSON.stringify({ userId: 'u-1', email: 'u@test.com', fullName: `Test ${role}`, role, staffType: null }));
}

/** Renders a screen inside the real AuthProvider and a router at the given URL. */
export function renderPage(ui: React.ReactElement, { route = '/', path = '*', role = 'Staff' as TestRole } = {}) {
  signInAs(role);
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={path} element={ui} />
          <Route path="/login" element={<div>Login page</div>} />
          <Route path="/" element={<div>Home page</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}
