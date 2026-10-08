// TC-PERF-003 — Stress test: keep adding users to find the breaking point.
// Not expected to pass every threshold: the goal is to see AT WHICH STAGE
// response times or errors climb. Read that off the HTML dashboard graph.
//   k6 run stress.js

import { setupAccounts, userJourney } from './lib/workload.js';

export const options = {
  stages: [
    { duration: '1m', target: 50 },
    { duration: '2m', target: 50 },
    { duration: '1m', target: 100 },
    { duration: '2m', target: 100 },
    { duration: '1m', target: 200 },
    { duration: '2m', target: 200 },
    { duration: '1m', target: 300 },
    { duration: '2m', target: 300 },
    { duration: '1m', target: 0 },   // recovery: does it come back to normal?
  ],
  // Recorded, not used to pass/fail: these show where the system degrades.
  thresholds: {
    http_req_failed: [{ threshold: 'rate<0.05', abortOnFail: false }],
    'http_req_duration{type:read}': [{ threshold: 'p(95)<2000', abortOnFail: false }],
  },
};

export const setup = setupAccounts;
export default userJourney;
