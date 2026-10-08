import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// A fake API for component tests. Each test adds the handlers it needs with server.use(...).
// The lookups below are the reference data every Processing screen loads.
export const LOCATIONS = [
  { id: 'loc-receiving', name: 'Receiving Bay', description: null },
  { id: 'loc-sorting', name: 'Sorting Area', description: null },
];

export const server = setupServer(
  http.get('*/api/v1/inventory/lookups/warehouse-locations', () => HttpResponse.json(LOCATIONS)),
  http.get('*/api/v1/inventory/lookups/item-types', () => HttpResponse.json(['Battery', 'Laptop', 'Mobile Phone'])),
  http.get('*/api/v1/inventory/lookups/material-types', () => HttpResponse.json(['Aluminium', 'Copper', 'Lithium Battery'])),
  http.get('*/api/v1/inventory/lookups/collectors', () => HttpResponse.json([])),
  http.get('*/api/v1/inventory/lookups/rate-policies', () => HttpResponse.json([])),
);
