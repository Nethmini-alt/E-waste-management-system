// TC-C-R05 — the rules behind the "Receive delivery" form: what blocks submit, and what is sent.
import { describe, expect, it } from 'vitest';
import { entryFor, jobLine, jobProblems, type JobEntry } from '../Receive/JobItemsReceiver';
import type { ReceivableJob } from '../Receive/types';

const job = (overrides: Partial<ReceivableJob> = {}): ReceivableJob => ({
  jobId: 'job-1',
  collectorId: 'col-1',
  collectorName: 'Kamal',
  collectorVehicleType: 'Lorry',
  pickupAddress: 'No 10, Galle Road, Colombo 03',
  reportedWeightKg: 11.8,
  estimatedDistanceKm: 3.5,
  completedAt: '2026-10-08T05:00:00Z',
  submissionCategory: 'IT Equipment',
  suggestedItemType: 'Laptop',
  items: [
    { submissionItemId: 'item-1', itemName: 'Old laptop', description: null, quantity: 1, expectedWeightKg: null, suggestedItemType: 'Laptop', suggestionSource: 'name' },
  ],
  ...overrides,
} as ReceivableJob);

const twoItemJob = () => job({
  items: [
    { submissionItemId: 'a', itemName: 'Laptops', description: null, quantity: 3, expectedWeightKg: 6, suggestedItemType: 'Laptop', suggestionSource: 'category' },
    { submissionItemId: 'b', itemName: 'Phones', description: null, quantity: 2, expectedWeightKg: 0.4, suggestedItemType: null, suggestionSource: null },
  ],
} as Partial<ReceivableJob>);

describe('TC-C-R05 receiving rules', () => {
  it('pre-fills from the job: full quantity, suggested type, and the reported weight for a one-item job', () => {
    const entry = entryFor(job());
    expect(entry.selected).toBe(false);
    expect(entry.items['item-1']).toEqual({ received: '1', itemType: 'Laptop', weight: '11.8' });
  });

  it('a correctly filled job has no problems and sends one line per item', () => {
    const j = job();
    const entry: JobEntry = { ...entryFor(j), selected: true, items: { 'item-1': { received: '1', itemType: 'Laptop', weight: '11.5' } } };

    expect(jobProblems(j, entry, 'Job 1')).toEqual([]);
    expect(jobLine(j, entry)).toEqual({
      jobId: 'job-1',
      items: [{ submissionItemId: 'item-1', receivedQuantity: 1, itemType: 'Laptop', verifiedWeightKg: 11.5 }],
    });
  });

  it.each([
    ['0', 'Job 1: nothing is marked as received — untick the job instead.'],
    ['', 'Job 1 · Old laptop: received must be a whole number from 0 to 1.'],
    ['-1', 'Job 1 · Old laptop: received must be a whole number from 0 to 1.'],
    ['2', 'Job 1 · Old laptop: received must be a whole number from 0 to 1.'],   // more than expected
    ['0.5', 'Job 1 · Old laptop: received must be a whole number from 0 to 1.'], // not a whole number
  ])('received quantity %j is refused', (received, problem) => {
    const j = job();
    const entry: JobEntry = { ...entryFor(j), items: { 'item-1': { received, itemType: 'Laptop', weight: '11.5' } } };
    expect(jobProblems(j, entry, 'Job 1')).toContain(problem);
  });

  it.each(['0', '-2', '', 'abc'])('verified weight %j is refused for a received item', (weight) => {
    const j = job();
    const entry: JobEntry = { ...entryFor(j), items: { 'item-1': { received: '1', itemType: 'Laptop', weight } } };
    expect(jobProblems(j, entry, 'Job 1')).toEqual(['Job 1 · Old laptop: enter the verified weight.']);
  });

  it('a received item must have an item type', () => {
    const j = job();
    const entry: JobEntry = { ...entryFor(j), items: { 'item-1': { received: '1', itemType: '', weight: '11.5' } } };
    expect(jobProblems(j, entry, 'Job 1')).toEqual(['Job 1 · Old laptop: choose the item type.']);
  });

  it('DEF-C-02: a blank quantity on one item of a delivery is refused, not silently treated as "not brought"', () => {
    const j = twoItemJob();
    const entry: JobEntry = {
      ...entryFor(j),
      items: { a: { received: '3', itemType: 'Laptop', weight: '6' }, b: { received: '', itemType: 'Mobile Phone', weight: '0.4' } },
    };
    expect(jobProblems(j, entry, 'Job 1')).toEqual(['Job 1 · Phones: received must be a whole number from 0 to 2.']);
  });

  it('an item not brought (0) needs no type or weight, and is sent as received 0', () => {
    const j = twoItemJob();
    const entry: JobEntry = {
      ...entryFor(j),
      items: { a: { received: '3', itemType: 'Laptop', weight: '6' }, b: { received: '0', itemType: '', weight: '' } },
    };

    expect(jobProblems(j, entry, 'Job 1')).toEqual([]);
    expect(jobLine(j, entry).items).toEqual([
      { submissionItemId: 'a', receivedQuantity: 3, itemType: 'Laptop', verifiedWeightKg: 6 },
      { submissionItemId: 'b', receivedQuantity: 0, itemType: null, verifiedWeightKg: 0 },
    ]);
  });

  it('a job without submission items is received as a whole: type and weight > 0 required', () => {
    const j = job({ items: [], suggestedItemType: null });
    const empty: JobEntry = { ...entryFor(j), wholeType: '', wholeWeight: '0' };
    expect(jobProblems(j, empty, 'Job 2')).toEqual(['Job 2: choose the item type.', 'Job 2: enter the verified weight.']);

    const filled: JobEntry = { ...entryFor(j), wholeType: 'Battery', wholeWeight: '4.25' };
    expect(jobProblems(j, filled, 'Job 2')).toEqual([]);
    expect(jobLine(j, filled)).toEqual({ jobId: 'job-1', items: [], verifiedWeightKg: 4.25, itemType: 'Battery' });
  });
});
