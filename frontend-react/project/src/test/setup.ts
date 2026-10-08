import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './server';
import {
  useCollectors,
  useItemTypes,
  useMaterialTypes,
  useRatePolicies,
  useWarehouseLocations,
} from '../features/processing/hooks/useLookups';

// Any request without a handler is a test bug, so fail loudly instead of hitting a real server.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
  localStorage.clear();
  // Lookups are cached per browser session; start every test with an empty cache.
  [useCollectors, useItemTypes, useMaterialTypes, useRatePolicies, useWarehouseLocations].forEach((h) => h.invalidate());
});

afterAll(() => server.close());
