// TC-PERF-002 — Load test: normal busy-day traffic.
// Ramp to 50 concurrent users, hold for 5 minutes, ramp down.
// Passes only if every threshold in lib/config.js holds.
//   k6 run load.js

import { READ_THRESHOLDS } from './lib/config.js';
import { setupAccounts, userJourney } from './lib/workload.js';

export const options = {
  stages: [
    { duration: '1m', target: 50 },  // ramp up
    { duration: '5m', target: 50 },  // steady load
    { duration: '30s', target: 0 },  // ramp down
  ],
  thresholds: READ_THRESHOLDS,
};

export const setup = setupAccounts;
export default userJourney;
