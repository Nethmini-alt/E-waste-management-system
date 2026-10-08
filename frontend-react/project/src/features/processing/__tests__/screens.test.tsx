// TC-C-R04 / R06 / R08 / R12 / R13 / R14 — Component C screens against a fake API (MSW).
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '../../../test/server';
import { renderPage, type TestRole } from '../../../test/render';
import { ProtectedRoute } from '../../../components/ProtectedRoute';
import JobReceiveForm from '../Receive/JobReceiveForm';
import InventoryListPage from '../Inventory/InventoryListPage';
import MaterialStockPage from '../Materials/MaterialStockPage';
import MarkPaidModal from '../Payments/MarkPaidModal';

const receivableJob = (jobId: string, collectorId: string, collectorName: string) => ({
  jobId, collectorId, collectorName, collectorVehicleType: 'Lorry', pickupAddress: `${jobId} Galle Road`,
  reportedWeightKg: 11.8, estimatedDistanceKm: 3.5, completedAt: '2026-10-08T05:00:00Z',
  submissionCategory: 'IT Equipment', suggestedItemType: 'Laptop',
  items: [{ submissionItemId: `${jobId}-i`, itemName: 'Old laptop', description: null, quantity: 1, expectedWeightKg: null, suggestedItemType: 'Laptop', suggestionSource: 'name' }],
});

const page = <T,>(items: T[]) => ({ items, page: 1, pageSize: 20, totalCount: items.length, totalPages: items.length ? 1 : 0 });

const inventoryItem = (id: string, itemType: string, status = 'Received') => ({
  id, itemType, status, originType: 'JobCollection', kind: 'Unit', verifiedWeightKg: 11.5, quantity: 1,
  currentLocationId: 'loc-receiving', currentLocationName: 'Receiving Bay', parentInventoryItemId: null, category: null,
  receivedAt: '2026-10-08T05:00:00Z',
});

// ---------------------------------------------------------------- Receive (job deliveries)

describe('TC-C-R04 / R06 receive job deliveries', () => {
  it('lists the completed jobs waiting, grouped by the collector who brought them', async () => {
    server.use(http.get('*/api/v1/inventory/job-collection/receivable', () => HttpResponse.json([
      receivableJob('job-1', 'col-1', 'Kamal Perera'),
      receivableJob('job-2', 'col-1', 'Kamal Perera'),
      receivableJob('job-3', 'col-2', 'Nimal Silva'),
    ])));
    renderPage(<JobReceiveForm />, { route: '/processing/receive' });

    expect(await screen.findByText('Kamal Perera')).toBeInTheDocument();
    expect(screen.getByText('Nimal Silva')).toBeInTheDocument();
  });

  it('shows a friendly empty state when nothing is waiting', async () => {
    server.use(http.get('*/api/v1/inventory/job-collection/receivable', () => HttpResponse.json([])));
    renderPage(<JobReceiveForm />, { route: '/processing/receive' });

    await waitFor(() => expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument());
    expect(screen.queryByText('Kamal Perera')).not.toBeInTheDocument();
    expect(screen.getByText(/no (completed )?jobs|nothing/i)).toBeInTheDocument();
  });

  it('shows the error and recovers on "Try again" when the API fails', async () => {
    let calls = 0;
    server.use(http.get('*/api/v1/inventory/job-collection/receivable', () => {
      calls += 1;
      return calls === 1
        ? HttpResponse.json({ title: 'An unexpected error occurred' }, { status: 500 })
        : HttpResponse.json([receivableJob('job-1', 'col-1', 'Kamal Perera')]);
    }));
    const user = userEvent.setup();
    renderPage(<JobReceiveForm />, { route: '/processing/receive' });

    expect(await screen.findByText('An unexpected error occurred')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('Kamal Perera')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------- Inventory list

describe('TC-C-R08 inventory list', () => {
  it('shows the items returned by the API', async () => {
    server.use(http.get('*/api/v1/inventory', () => HttpResponse.json(page([inventoryItem('i-1', 'Laptop'), inventoryItem('i-2', 'Battery', 'Sorting')]))));
    renderPage(<InventoryListPage />, { route: '/processing/inventory' });

    expect(await screen.findByText('Laptop')).toBeInTheDocument();
    expect(screen.getByText('Battery')).toBeInTheDocument();
  });

  it('shows an empty state when there is no inventory', async () => {
    server.use(http.get('*/api/v1/inventory', () => HttpResponse.json(page([]))));
    renderPage(<InventoryListPage />, { route: '/processing/inventory' });

    expect(await screen.findByText('No inventory yet')).toBeInTheDocument();
  });

  it('filtering by status asks the API for that status and says when nothing matches', async () => {
    const statuses: (string | null)[] = [];
    server.use(http.get('*/api/v1/inventory', ({ request }) => {
      const status = new URL(request.url).searchParams.get('status');
      statuses.push(status);
      return HttpResponse.json(page(status ? [] : [inventoryItem('i-1', 'Laptop')]));
    }));
    const user = userEvent.setup();
    renderPage(<InventoryListPage />, { route: '/processing/inventory' });
    await screen.findByText('Laptop');

    await user.selectOptions(screen.getByLabelText('Status'), 'ReadyForSale');

    expect(await screen.findByText('No items match your filters')).toBeInTheDocument();
    expect(statuses).toContain('ReadyForSale');
  });

  it('shows the API error message', async () => {
    server.use(http.get('*/api/v1/inventory', () => HttpResponse.json({ title: 'An unexpected error occurred' }, { status: 500 })));
    renderPage(<InventoryListPage />, { route: '/processing/inventory' });

    expect(await screen.findByText('An unexpected error occurred')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------- Material stock

describe('TC-C-R12 material stock', () => {
  const groups = [
    { materialType: 'Copper', totalWeightKg: 2.5, availableWeightKg: 0.5, itemCount: 1, items: [] },
    { materialType: 'Aluminium', totalWeightKg: 10, availableWeightKg: 10, itemCount: 2, items: [] },
  ];

  it('totals the stock per material and overall', async () => {
    server.use(http.get('*/api/v1/inventory/recovered-materials', () => HttpResponse.json(groups)));
    renderPage(<MaterialStockPage />, { route: '/processing/material-stock' });

    expect(await screen.findByText('Copper')).toBeInTheDocument();
    expect(screen.getByText('Aluminium')).toBeInTheDocument();
    expect(screen.getByText('12.5 kg')).toBeInTheDocument();  // total of all materials
    expect(screen.getByText('10.5 kg')).toBeInTheDocument();  // available (not reserved by orders)
  });

  it('search narrows the list and says when nothing matches', async () => {
    server.use(http.get('*/api/v1/inventory/recovered-materials', () => HttpResponse.json(groups)));
    const user = userEvent.setup();
    renderPage(<MaterialStockPage />, { route: '/processing/material-stock' });
    await screen.findByText('Copper');

    await user.type(screen.getByLabelText('Search material'), 'alu');
    expect(screen.queryByText('Copper')).not.toBeInTheDocument();
    expect(screen.getByText('Aluminium')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Search material'));
    await user.type(screen.getByLabelText('Search material'), 'gold');
    expect(screen.getByText('No material matches your search')).toBeInTheDocument();
  });

  it('shows an empty state when no materials have been recovered', async () => {
    server.use(http.get('*/api/v1/inventory/recovered-materials', () => HttpResponse.json([])));
    renderPage(<MaterialStockPage />, { route: '/processing/material-stock' });

    expect(await screen.findByText('No recovered materials yet')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------- Collector payments

describe('TC-C-R13 mark a collector payment as paid', () => {
  const payment = {
    id: 'pay-1', amount: 482.5, collectorId: 'col-1', collectorName: 'Kamal Perera', collectorVehicleType: 'Lorry',
    sourceType: 'Job', createdAt: '2026-10-08T05:00:00Z',
  } as any;

  it('confirms the payment and reports the amount and collector', async () => {
    server.use(http.put('*/api/v1/payments/pay-1/pay', () => HttpResponse.json({ id: 'pay-1', status: 'Paid' })));
    const onDone = vi.fn();
    const user = userEvent.setup();
    render(<MarkPaidModal payment={payment} onClose={vi.fn()} onDone={onDone} onStale={vi.fn()} />);

    expect(screen.getByText('Rs. 482.50')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirm paid' }));

    await waitFor(() => expect(onDone).toHaveBeenCalledWith('Rs. 482.50 marked as paid to Kamal Perera.'));
  });

  it('an already-paid payment (409) shows the reason and asks the list to refresh', async () => {
    server.use(http.put('*/api/v1/payments/pay-1/pay', () =>
      HttpResponse.json({ title: 'Payment already paid', detail: 'This payment has already been paid.' }, { status: 409 })));
    const onDone = vi.fn();
    const onStale = vi.fn();
    const user = userEvent.setup();
    render(<MarkPaidModal payment={payment} onClose={vi.fn()} onDone={onDone} onStale={onStale} />);

    await user.click(screen.getByRole('button', { name: 'Confirm paid' }));

    expect(await screen.findByText('This payment has already been paid.')).toBeInTheDocument();
    expect(onStale).toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------- Access to the Processing area

describe('TC-C-R14 only management staff and admins can open the Processing pages', () => {
  const guarded = (
    <ProtectedRoute roles={['staff', 'admin']}>
      <div>Processing area</div>
    </ProtectedRoute>
  );

  it.each<[TestRole, string]>([
    ['Staff', 'Processing area'],
    ['Admin', 'Processing area'],
    ['Household', 'Home page'],     // signed in but wrong role -> sent home
    ['Collector', 'Home page'],
    ['Worker', 'Login page'],       // workers use the Flutter app; the web drops their session
    [null, 'Login page'],           // not signed in
  ])('%s sees "%s"', async (role, expected) => {
    renderPage(guarded, { route: '/processing', path: '/processing', role });
    expect(await screen.findByText(expected)).toBeInTheDocument();
  });
});
