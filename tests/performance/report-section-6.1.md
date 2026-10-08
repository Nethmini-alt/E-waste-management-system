## 6.1 Performance and Load Testing (G2 — Nethmini)

### 6.1.1 Objective
To measure the response time, throughput and error rate of the E-Waste API under normal,
heavy and sudden load, and to find the point at which performance degrades.

### 6.1.2 Tool and justification
**k6** (Grafana k6, version v2.3.0). Tests are written as JavaScript code, so they are repeatable
and version-controlled. Pass/fail rules are built in (thresholds), and k6 produces an HTML
dashboard report used as evidence.

### 6.1.3 Test environment
| Item | Value |
|---|---|
| Machine | AMD Ryzen 5 PRO 5650U (6 cores / 12 threads) · RAM 14 GB · Fedora Linux 44 (kernel 7.2.7) |
| Runtime | .NET 8.0.131 · PostgreSQL 18.6 (local) · k6 v2.3.0 |
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
| TC-PERF-001 Smoke | 1 user, 30 s | 0 errors, reads p95 < 500 ms | 5.77 ms | 231 ms | 0.00 % (0/215) | 6.7 | **Pass** |
| TC-PERF-002 Load | 50 users, 5 min | errors < 1%, reads p95 < 500 ms, login p95 < 1000 ms | 4.34 ms | 246 ms | 0.00 % (0/117,409) | 299.6 | **Pass** |
| TC-PERF-003 Stress | 50→300 users | Find breaking point | 16.13 ms | not recorded¹ | 0.00 % (0/785,505) | 1004.2 | No breaking point up to 300 users |
| TC-PERF-004 Spike | 5→150 users in 10 s | errors < 5%, recovers | 3.60 ms | not recorded¹ | 0.00 % (0/75,754) | 438.4 | **Pass** |

¹ The stress and spike scripts have no login threshold, so k6 does not report login separately; overall p95 (reads + login) was 18.37 ms (stress) and 3.86 ms (spike).

> 📷 Figure 6.1 — k6 terminal summary, load test (THRESHOLDS block)
> 📷 Figure 6.2 — k6 HTML report, stress test response-time graph (breaking point marked)
> 📷 Figure 6.3 — k6 HTML report, spike test (spike and recovery)

### 6.1.6 Interpretation
- Under normal load (50 users) the API met all thresholds. Reads p95 was 4.34 ms, far below the 500 ms target, with 0 errors in 117,409 requests.
- Login is slower than the other requests (p95 246 ms under load) because passwords are verified with
  BCrypt, which is deliberately slow to resist password guessing.
- In the stress test, response times stayed under 2 s at every stage up to 300 users (~1,000 requests/s);
  reads p95 was 16 ms and no request failed. **No breaking point was reached** in the tested range.
  The highest single response was 779 ms. Requests per second grew with the user count, which
  means the API was still keeping up and had not saturated.
- No request failed at any stage, including the final ramp-down, so the system did not need to recover from errors. (Confirm the response-time line in `stress-report.html` flattens again during the last stage and add the screenshot as Figure 6.2.)
- In the spike test (5 → 150 users in 10 s) there were 0 errors and reads p95 stayed at 3.6 ms; the
  sudden burst caused no visible degradation.
- **Limitation:** the test database contains only the data created by the E2E suite, so most lists are
  small (the k6 household and collector have no submissions or jobs of their own). The results show the
  cost of authentication, routing and queries on a small dataset, not on a production-sized one.
  k6 and the API also share the same laptop. A larger seeded dataset is the next step to find a
  realistic breaking point.

### 6.1.7 Defects and retesting
| ID | Finding | Fix | Before | After (retest) |
|---|---|---|---|---|
| — | No performance defects found under the defined thresholds | — | — | — |

Evidence: `docs/testing/evidence/performance/` (`*-report.html` dashboards, `*-summary.json`, `*-terminal.txt`).
