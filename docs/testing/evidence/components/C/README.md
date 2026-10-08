# Component C — Processing & Inventory: test evidence (Manodya)

Run on 8 Oct 2026. Backend xUnit tests for Component C already existed (Processing folder of
`backend/EWasteManagement.Tests`) and are not repeated here. These are the new tests for the
other three layers.

## Summary

| Layer | Tool | New tests | Result | Defects found |
|---|---|---|---|---|
| Validator AI agent | pytest + FastAPI TestClient | 36 | 36 passed | DEF-C-01 (fixed) |
| React web app | Vitest + React Testing Library + MSW | 74 | 74 passed | DEF-C-02 (fixed) |
| Flutter warehouse app | flutter_test + mocktail | 18 (+ 23 existing = 41) | 41 passed | — |

## Test cases

### Validator agent — `agentic-ai/Processing/tests/`
| ID | What | Type |
|---|---|---|
| TC-C-A01 | All values inside the limits → auto-approved, no reasons | Normal |
| TC-C-A02 | Hazard above the ceiling (High, Critical) → human approval; Low/Medium allowed | Business rule |
| TC-C-A03 | Confidence 0.59 → human; exactly 0.60 → allowed; 0.0 and 1.0 | Boundary |
| TC-C-A04 | Value Rs 150,000.01 → human; exactly 150,000 → allowed | Boundary |
| TC-C-A05 | Empty or "Uncategorized" category → human approval | Invalid |
| TC-C-A06 | Unknown hazard level → treated as Critical; unknown ceiling → Medium | Safe default |
| TC-C-A07 | Every broken rule reported; thresholds from the backend respected | Normal |
| TC-C-A08 | `/run` returns the exact contract; decision sent back and logged; `/health` | Structured output |
| TC-C-A09 | Bad request → 422; backend down when saving → 500; **rules unavailable → never auto-approve** | Failure / safe failure |
| TC-C-A10 | Prompt-injection text in the category cannot change the decision | Prompt injection |

### React — `frontend-react/project/src/features/processing/__tests__/`
| ID | What | Type |
|---|---|---|
| TC-C-R01 | Money, kg, signed kg, ids, dates (missing/invalid → "—", zone-less = UTC) | Normal / boundary |
| TC-C-R02 | API errors → readable messages (validation, 409, 5xx hidden, offline, 401/403/404) | Invalid / failure |
| TC-C-R03 | Enum numbers match the backend; unknown status names rejected | Normal |
| TC-C-R04 | Receive page lists waiting jobs grouped by collector; delivery request body | Normal |
| TC-C-R05 | Receiving rules: quantity 0..expected, whole numbers, weight > 0, type required, blank refused | Invalid / boundary |
| TC-C-R06 | Receive page empty state; API error + "Try again" recovers | UI state / failure |
| TC-C-R07 | Extra-waste request trims types, only rejected lines keep a reason; reserved type | Normal |
| TC-C-R08 | Inventory list: rows, empty, error, status filter sent to the API | UI state |
| TC-C-R09 | Status actions offered per status; final statuses offer none | Boundary |
| TC-C-R10 | Dismantle modal: description required, outputs > item weight blocked, valid step sent, hazard warning, API error | Boundary / invalid |
| TC-C-R11 | Classification outcome per category; status/category sent as numbers | Normal |
| TC-C-R12 | Material stock totals, search, empty state | Normal |
| TC-C-R13 | Mark payment paid; already paid (409) shows reason and refreshes | Normal / failure |
| TC-C-R14 | Processing pages: Staff/Admin allowed; Household/Collector → home; Worker/signed-out → login | Security |

### Flutter — `mobile_flutter/test/warehouse/`
| ID | What | Type |
|---|---|---|
| TC-C-F01 | Model parsing, enums, status actions, QR, formats (existing `widget_test.dart`, 23 tests) | Normal / boundary |
| TC-C-F02 | API client: status as number, list filters, delivery, extra waste trimming, dismantle body, 409 → message | Normal / failure |
| TC-C-F03 | Receive screen: collectors listed, empty state, error + "Try again" | UI state |
| TC-C-F06 | Inventory list: items shown; "Materials" kind filter asks the API for materials only | Normal |
| TC-C-F08 | Material stock: per-material list, totals, empty state | Normal |
| TC-C-F09 | Bottom bar switches Home / Receive / Inventory / Scan | Navigation |
| TC-C-F10 | Only Worker accounts land on the warehouse; Staff/Admin → web; others → own apps | Security |

Not automated (time): the delivery sheet and extra-waste form validation on Flutter (F04, F05)
and the item action sheets (F07). Their rules match the web rules tested in TC-C-R05/R07/R10,
and the receiving/dismantling flow is covered end to end by `e2e/steps/c-inventory.ts`.

## Defects

| ID | Defect | Severity | Found by | Fix | Retest |
|---|---|---|---|---|---|
| DEF-C-01 | When the business rules could not be loaded from the backend, the Validator fell back to the normal default thresholds and could **auto-approve** a submission, although the code comment promised it would never approve on missing information | High | TC-C-A09 | `BusinessRules.loaded_from_backend`; fallback marked `False`; `validate_node` then always requires human review (`schemas.py`, `tools/processing_tools.py`, `graph/nodes.py`) | 36/36 passed (`A-validator-agent-pytest-after-fix.txt`) |
| DEF-C-02 | On the web Receive form, a **cleared "received" box was read as 0** ("not brought"), silently leaving that item out of inventory and out of the collector's payment | Medium | TC-C-R05 | Blank quantity is now refused with a message (`Receive/JobItemsReceiver.tsx`) | 15/15 passed (`R-receiving-rules-after-fix.txt`) |

## Evidence files
- `A-validator-agent-pytest-before-fix.txt` / `-after-fix.txt`
- `R-receiving-rules-before-fix.txt` / `-after-fix.txt`
- `R-react-vitest-results.txt` (all React tests + coverage)
- `F-flutter-warehouse-tests.txt`

## Run
```bash
# Validator agent
cd agentic-ai/Processing && venv/Scripts/python -m pip install pytest && venv/Scripts/python -m pytest

# React
cd frontend-react/project && npm test            # or: npm run test:coverage

# Flutter
cd mobile_flutter && flutter test
```
