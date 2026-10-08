// Deterministic stand-ins for the external services the API calls during the
// intake workflow, so the E2E run gives the same result every time:
//
//   Planner   (POST /plan, /finalize)  — Agent:PlannerBaseUrl
//   Analyzer  (POST /run)              — Agent:AnalyzerBaseUrl
//   Validator (POST /run)              — Agent:ValidatorBaseUrl
//   Matcher   (POST /run)              — Agent:MatcherBaseUrl
//   Sales     (any)                    — Agent:BaseUrl (answers 503: not used by these tests)
//   Photon geocoding + OSRM routing    — OpenStreetMap:PhotonBaseUrl / OsrmBaseUrl
//
// The response shapes mirror the backend's agent clients
// (Infrastructure/ExternalServices/*AgentClient.cs) and GeoDtos.cs exactly.
// Real LLM quality is tested separately in each member's agent tests (pytest);
// this file only replaces the agents so the *integration* can be tested.
//
// A control server lets a test choose behaviour and read back what was called:
//   POST /__control   { analyzer: 'ok'|'fail', validator: 'approval'|'auto', matcherCollectorId }
//   POST /__reset     back to defaults, clears the call log
//   GET  /__calls     every call received, in order: [{ service, path, body, at }]
//   GET  /__health

import http from 'node:http';

const port = (name, fallback) => Number(process.env[name] ?? fallback);
const PORTS = {
  control: port('E2E_STUB_CONTROL_PORT', 18090),
  planner: port('E2E_STUB_PLANNER_PORT', 18002),
  analyzer: port('E2E_STUB_ANALYZER_PORT', 18003),
  validator: port('E2E_STUB_VALIDATOR_PORT', 18004),
  matcher: port('E2E_STUB_MATCHER_PORT', 18005),
  sales: port('E2E_STUB_SALES_PORT', 18001),
  geo: port('E2E_STUB_GEO_PORT', 18099),
};

// Colombo 03 — the pickup address and the test collector both resolve here.
const PICKUP = { lat: 6.9271, lng: 79.8612 };

const defaults = () => ({
  analyzer: 'ok',          // 'fail' -> HTTP 500, to test safe failure
  validator: 'approval',   // 'auto' -> no human approval needed
  matcherCollectorId: null,
});

let config = defaults();
let calls = [];

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({ raw }); }
    });
  });
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function serve(name, handler) {
  http
    .createServer(async (req, res) => {
      const body = req.method === 'GET' ? {} : await readBody(req);
      const url = new URL(req.url, 'http://stub');
      if (name !== 'control') calls.push({ service: name, path: url.pathname, body, at: new Date().toISOString() });
      try {
        await handler(req, res, url, body);
      } catch (err) {
        send(res, 500, { error: String(err) });
      }
    })
    .listen(PORTS[name], () => console.log(`[stub] ${name} listening on ${PORTS[name]}`));
}

// ---- Planner ----
serve('planner', (req, res, url, body) => {
  if (url.pathname === '/plan') {
    return send(res, 200, {
      workflowId: body.workflowId,
      steps: [
        { stepNumber: 1, agentName: 'Analyzer', reason: 'E2E stub: classify the items' },
        { stepNumber: 2, agentName: 'Validator', reason: 'E2E stub: check business rules' },
        { stepNumber: 3, agentName: 'Matcher', reason: 'E2E stub: pick a collector' },
      ],
      skipMatcher: false,
      reasoning: 'E2E stub plan',
    });
  }
  if (url.pathname === '/finalize') {
    return send(res, 200, {
      workflowId: body.workflowId,
      finalReasoningSummary: 'E2E stub: ready for job creation',
      readyForJobCreation: true,
    });
  }
  send(res, 404, { error: 'unknown planner route' });
});

// ---- Analyzer ----
serve('analyzer', (req, res, url, body) => {
  if (config.analyzer === 'fail') return send(res, 500, { error: 'E2E stub: analyzer down' });
  send(res, 200, {
    workflowId: body.workflowId,
    wasteCategory: 'IT Equipment',
    hazardLevel: 'Low',
    estimatedVolumeKg: 12,
    estimatedValueLkr: 20000,
    confidenceScore: 0.92,
    items: [],
  });
});

// ---- Validator ----
serve('validator', (req, res, url, body) => {
  const needsApproval = config.validator === 'approval';
  send(res, 200, {
    workflowId: body.workflowId,
    approvedForAutoAssignment: !needsApproval,
    requiresHumanApproval: needsApproval,
    reasons: needsApproval ? ['E2E stub: human approval path'] : ['E2E stub: within auto limits'],
  });
});

// ---- Matcher ----
serve('matcher', (req, res, url, body) => {
  send(res, 200, {
    workflowId: body.workflowId,
    recommendedCollectorId: config.matcherCollectorId,
    autoAssign: config.matcherCollectorId !== null,
    ambiguous: false,
    reasoning: 'E2E stub: nearest available collector',
  });
});

// ---- Sales agent (unused here) ----
serve('sales', (req, res) => send(res, 503, { error: 'E2E stub: sales agent not used' }));

// ---- Photon + OSRM ----
serve('geo', (req, res, url) => {
  if (url.pathname.startsWith('/api')) {
    return send(res, 200, {
      features: [{ geometry: { coordinates: [PICKUP.lng, PICKUP.lat] } }],
    });
  }
  if (url.pathname.startsWith('/route/v1/driving/')) {
    return send(res, 200, {
      code: 'Ok',
      routes: [{
        distance: 3500,
        duration: 600,
        geometry: { coordinates: [[PICKUP.lng, PICKUP.lat], [PICKUP.lng + 0.01, PICKUP.lat + 0.01]] },
      }],
    });
  }
  send(res, 404, { error: 'unknown geo route' });
});

// ---- Control ----
serve('control', (req, res, url, body) => {
  if (url.pathname === '/__health') return send(res, 200, { ok: true });
  if (url.pathname === '/__calls') return send(res, 200, calls);
  if (url.pathname === '/__reset') {
    config = defaults();
    calls = [];
    return send(res, 200, config);
  }
  if (url.pathname === '/__control') {
    config = { ...config, ...body };
    return send(res, 200, config);
  }
  send(res, 404, { error: 'unknown control route' });
});
