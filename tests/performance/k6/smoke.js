// TC-PERF-001 — Smoke test: 1 user for 30 s.
// Proves the script, accounts and endpoints work before applying real load.
//   k6 run smoke.js

import { READ_THRESHOLDS } from './lib/config.js';
import { setupAccounts, userJourney } from './lib/workload.js';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: { ...READ_THRESHOLDS, http_req_failed: ['rate==0'] },
};

export const setup = setupAccounts;
export default userJourney;
