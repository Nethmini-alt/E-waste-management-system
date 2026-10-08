## 6.1 Performance and Load Testing (G2 — Nethmini)

### 6.1.1 Objective
To measure the response time, throughput and error rate of the E-Waste API under normal,
heavy and sudden load, and to find the point at which performance degrades.

### 6.1.2 Tool and justification
**k6** (Grafana k6, version ___). Tests are written as JavaScript code, so they are repeatable
and version-controlled. Pass/fail rules are built in (thresholds), and k6 produces an HTML
dashboard report used as evidence.

### 6.1.3 Test environment
| Item | Value |
|---|---|
| Machine | CPU ___ · RAM ___ GB · Windows ___ |
| API under test | Release build, `http://localhost:5180`, database `SmartEWasteDB_E2E` (same as §4) |
| Data | Created by the E2E suite plus the k6 setup step |
| Note | k6 and the API run on the same machine, so the results show relative behaviour, not production capacity |

### 6.1.4 Workload
Each virtual user repeatedly calls the main screens of all four components (submissions,
collector jobs, inventory, recovered materials, available stock, sales orders, revenue summary),
signs in again about once every 10 iterations, and waits 1 s between iterations.

### 6.1.5 Test cases and results
| ID | Profile | Pass criteria | Reads p95 | Login p95 | Error rate | Req/s | Result |
|---|---|---|---|---|---|---|---|
| TC-PERF-001 Smoke | 1 user, 30 s | 0 errors, reads p95 < 500 ms | ___ ms | ___ ms | ___ % | ___ | Pass / Fail |
| TC-PERF-002 Load | 50 users, 5 min | errors < 1%, reads p95 < 500 ms, login p95 < 1000 ms | ___ ms | ___ ms | ___ % | ___ | Pass / Fail |
| TC-PERF-003 Stress | 50→300 users | Find breaking point | ___ ms | ___ ms | ___ % | ___ | Breaking point: ___ users |
| TC-PERF-004 Spike | 5→150 users in 10 s | errors < 5%, recovers | ___ ms | ___ ms | ___ % | ___ | Pass / Fail |

> 📷 Figure 6.1 — k6 terminal summary, load test (THRESHOLDS block)
> 📷 Figure 6.2 — k6 HTML report, stress test response-time graph (breaking point marked)
> 📷 Figure 6.3 — k6 HTML report, spike test (spike and recovery)

### 6.1.6 Interpretation
- Under normal load (50 users) the API ___ (met / did not meet) all thresholds. Reads p95 was ___ ms.
- Login is slower than the other requests (p95 ___ ms) because passwords are verified with
  BCrypt, which is deliberately slow to resist password guessing.
- In the stress test, response times stayed under 2 s up to ___ users. At ___ users p95 reached
  ___ ms / errors reached ___ %. The slowest endpoint was ___. Likely cause: ___.
- After load dropped, the system ___ (recovered / did not recover) within ___ s.
- In the spike test ___.

### 6.1.7 Defects and retesting
| ID | Finding | Fix | Before | After (retest) |
|---|---|---|---|---|
| DEF-PERF-01 | ___ (or "No performance defects found under the defined thresholds") | ___ | ___ | ___ |
