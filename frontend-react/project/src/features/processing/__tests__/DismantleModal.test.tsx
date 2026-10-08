// TC-C-R10 — Dismantle modal: weight conservation, validation, hazard warning, API errors.
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../../test/server';
import DismantleModal from '../Inventory/DismantleModal';
import type { InventoryDetail } from '../Inventory/types';

const item = { id: 'item-1', itemType: 'Laptop', status: 'Sorting', verifiedWeightKg: 11.5 } as InventoryDetail;

let posted: any[];
beforeEach(() => {
  posted = [];
  server.use(
    http.post('*/api/v1/inventory/:id/dismantle-log', async ({ request }) => {
      posted.push(await request.json());
      return HttpResponse.json({ inventoryItemId: 'item-1', updatedWeightKg: 9, lossKg: 0, childInventoryItemIds: [], materialInventoryItemIds: ['m-1'] });
    }),
  );
});

function setup() {
  const onDone = vi.fn();
  const user = userEvent.setup();
  render(<DismantleModal open item={item} onClose={vi.fn()} onDone={onDone} />);
  return { user, onDone };
}

async function addMaterial(user: ReturnType<typeof userEvent.setup>, name: string, kg: string) {
  await user.click(screen.getByRole('button', { name: /add material/i }));
  const combo = await screen.findByPlaceholderText(/Material 1 — type to search/);
  await user.type(combo, name.slice(0, 3));
  fireEvent.mouseDown(await screen.findByRole('option', { name }));
  await user.type(screen.getByLabelText('Material 1 weight in kg'), kg);
}

describe('TC-C-R10 dismantle modal', () => {
  it('shows the item and warns that the first step moves it to Dismantling', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Add dismantle step' })).toBeInTheDocument();
    expect(screen.getByText(/moves this item from Sorting to Dismantling/)).toBeInTheDocument();
  });

  it('blocks submit without a description and sends nothing', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Log step' }));

    expect(await screen.findByText('Describe what was done in this step.')).toBeInTheDocument();
    expect(posted).toHaveLength(0);
  });

  it('blocks outputs heavier than the item (12 kg from an 11.5 kg laptop)', async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText('What was done'), 'Stripped copper');
    await addMaterial(user, 'Copper', '12');

    expect(screen.getByText(/are more than this item's current 11.5 kg/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Log step' }));
    expect(posted).toHaveLength(0);
  });

  it('a valid step previews the new weight and sends the material', async () => {
    const { user, onDone } = setup();
    await user.type(screen.getByLabelText('What was done'), 'Stripped copper');
    await addMaterial(user, 'Copper', '2.5');

    expect(screen.getByText(/go from 11.5 kg to 9 kg/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Log step' }));

    await waitFor(() => expect(onDone).toHaveBeenCalledWith('Dismantle step logged — 1 material recorded.'));
    expect(posted[0]).toEqual({
      description: 'Stripped copper',
      remainingWeightKg: null,
      childItems: [],
      materials: [{ materialType: 'Copper', weightKg: 2.5, hazardous: false }],
    });
  });

  it('warns that a known hazardous material will be put on hold', async () => {
    const { user } = setup();
    await addMaterial(user, 'Lithium Battery', '1');
    expect(screen.getByText(/Known hazardous material — it will be put On hold/)).toBeInTheDocument();
  });

  it('shows the server message when the API refuses the step', async () => {
    server.use(
      http.post('*/api/v1/inventory/:id/dismantle-log', () =>
        HttpResponse.json({ title: 'Invalid request', detail: "'Gold' is not a material type Sales prices." }, { status: 400 })),
    );
    const { user, onDone } = setup();
    await user.type(screen.getByLabelText('What was done'), 'x');
    await addMaterial(user, 'Copper', '1');
    await user.click(screen.getByRole('button', { name: 'Log step' }));

    expect(await screen.findByText("'Gold' is not a material type Sales prices.")).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });
});
