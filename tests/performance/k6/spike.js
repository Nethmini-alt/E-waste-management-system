// TC-PERF-004 — Spike test: a sudden burst (e.g. everyone opens the app at 9 am).
// 5 users -> 150 users in 10 s, hold 1 min, drop back to 5 and check recovery.
//   k6 run spike.js

import { setupAccounts, userJourney } from './lib/workload.js';

export const options = {
  stages: [
    { duration: '30s', target: 5 },
    { duration: '10s', target: 150 }, // spike
    { duration: '1m', target: 150 },
    { duration: '10s', target: 5 },   // drop
    { duration: '1m', target: 5 },    // recovery period
  ],
  thresholds: {
    http_req_failed: [{ threshold: 'rate<0.05', abortOnFail: false }],
    'http_req_duration{type:read}': [{ threshold: 'p(95)<2000', abortOnFail: false }],
  },
};

export const setup = setupAccounts;
export default userJourney;
