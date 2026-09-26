// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import AIAssessmentPage from './AIAssessmentPage';
import SubmissionReportPage from './SubmissionReportPage';

describe('AIAssessmentPage', () => {
  it('navigates to the draft report page when opened for a new submission', async () => {
    const router = createMemoryRouter(
      [
        { path: '/submissions/assessment/:id', element: <AIAssessmentPage /> },
        { path: '/submissions/report/:id', element: <SubmissionReportPage /> },
      ],
      { initialEntries: ['/submissions/assessment/new'] },
    );

    render(<RouterProvider router={router} />);

    fireEvent.click(screen.getByRole('button', { name: /generate report/i }));

    expect(await screen.findByText(/draft report/i)).toBeInTheDocument();
  });
});
