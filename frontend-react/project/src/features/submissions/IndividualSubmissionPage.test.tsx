// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

import IndividualSubmissionPage from './IndividualSubmissionPage';

describe('IndividualSubmissionPage', () => {
  it('opens the file picker and shows the selected file name', () => {
    render(
      <MemoryRouter>
        <IndividualSubmissionPage />
      </MemoryRouter>,
    );

    const uploadButton = screen.getByRole('button', { name: /upload/i });
    expect(uploadButton).toBeInTheDocument();

    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();

    const file = new File(['image-data'], 'battery.png', { type: 'image/png' });
    fireEvent.change(fileInput as HTMLInputElement, { target: { files: [file] } });

    expect(screen.getByText(/battery\.png/i)).toBeInTheDocument();
  });
});
