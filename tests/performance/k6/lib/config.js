// Shared settings for every k6 test. Override on the command line, e.g.
//   k6 run -e BASE_URL=http://localhost:5180 load.js

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:5180';

// The bootstrap admin created by the E2E suite (frontend-react/project/e2e/env.ts).
export const ADMIN = {
  email: __ENV.ADMIN_EMAIL || 'e2e.admin@ewaste.test',
  password: __ENV.ADMIN_PASSWORD || 'E2eAdmin#2026',
};

export const PASSWORD = 'Passw0rd!perf';

// Pass/fail rules (k6 "thresholds"). A run that breaks one is marked failed.
//  - reads: 95% of requests faster than 500 ms
//  - login: slower on purpose (BCrypt password hashing), so 95% under 1000 ms
//  - errors: under 1% of all requests
export const READ_THRESHOLDS = {
  http_req_failed: ['rate<0.01'],
  'http_req_duration{type:read}': ['p(95)<500'],
  'http_req_duration{type:login}': ['p(95)<1000'],
  checks: ['rate>0.99'],
};
