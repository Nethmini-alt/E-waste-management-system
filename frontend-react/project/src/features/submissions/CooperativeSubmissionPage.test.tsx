// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

import CooperativeSubmissionPage from './CooperativeSubmissionPage';

afterEach(() => {
  cleanup();
});

describe('CooperativeSubmissionPage', () => {
  it('adds a new participant when the Add member button is clicked', () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Sam Silva');

    render(
      <MemoryRouter>
        <CooperativeSubmissionPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /add member/i }));

    expect(screen.getByText('Sam Silva')).toBeInTheDocument();
  });

  it('shows a CSV upload control and loads names from a CSV file', async () => {
    render(
      <MemoryRouter>
        <CooperativeSubmissionPage />
      </MemoryRouter>,
    );

    const input = screen.getByLabelText(/upload csv/i);
    const file = new File(['Name\nAisha Perera\nNimal Silva\n'], 'participants.csv', { type: 'text/csv' });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/selected csv: participants\.csv/i)).toBeInTheDocument();
      expect(screen.getByText('Aisha Perera')).toBeInTheDocument();
      expect(screen.getByText('Nimal Silva')).toBeInTheDocument();
    });
  });
});
