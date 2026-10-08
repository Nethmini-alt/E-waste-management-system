# G4 — Accessibility tests (axe-core + Playwright)

**Tool:** `@axe-core/playwright` (axe-core 4.13) driven by Playwright · **Run:** `npm run a11y`

## What is tested

The main page of every component is opened in a real Chrome browser, signed in as the role that
uses it, and scanned by **axe-core** against **WCAG 2.1 level A and AA** rules.

| ID | Component | Page | Signed in as |
|---|---|---|---|
| TC-A11Y-001 | Public | Landing `/welcome` | — |
| TC-A11Y-002 | Public | Sign in `/login` | — |
| TC-A11Y-003 | Public | Register `/register` | — |
| TC-A11Y-004 | A | Submit e-waste `/submissions/new` | Household |
| TC-A11Y-005 | A | My submissions `/submissions/mine` | Household |
| TC-A11Y-006 | A | Submission review `/submissions/review` | Staff |
| TC-A11Y-007 | B | Collection jobs `/collection/jobs` | Staff |
| TC-A11Y-008 | B | Collectors `/collection/collectors` | Staff |
| TC-A11Y-009 | C | Receive waste `/processing/receive` | Staff |
| TC-A11Y-010 | C | Inventory `/processing/inventory` | Staff |
| TC-A11Y-011 | D | Pricing `/pricing` | Staff |
| TC-A11Y-012 | D | Sales orders `/sales-orders` | Staff |
| TC-A11Y-013 | D | Revenue `/revenue` | Staff |
| TC-A11Y-014 | Admin | Staff management `/admin/staff` | Admin |
| TC-A11Y-015 | Public | Sign-in completed with the **keyboard only** (Tab, type, Enter) | — |

**Pass rule:** no `serious` or `critical` violations. These are the impact levels that block
screen-reader or keyboard users. Every finding, including minor ones, is attached to the report
as `axe-summary.json` and `axe-full.json`, together with a full-page screenshot.

## Run

Uses the same G0 environment as the E2E suite (stubs, test API on 5180, React app on 5174).
Playwright starts everything itself.

```bash
cd frontend-react/project
npm run a11y           # about 2 minutes
npm run a11y:report    # open the HTML report: each test has the axe results attached
```

## Evidence

`docs/testing/evidence/accessibility/before/` holds the first run (13 failed) and `after/` holds
the retest after the fixes (16 passed), with the terminal output, HTML report, JUnit XML and axe
JSON per page.
