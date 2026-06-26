// k6 load test for the activity feed (SC-005 / SC-007):
// sustain ~100 concurrent users and assert p95 < 2s on GET /api/feed.
//
// Run:
//   1. Start the API (and its Postgres/Redis) reachable at BASE_URL.
//   2. Obtain a valid signed session cookie for an authenticated user and pass
//      it in (the feed requires auth). For local runs you can sign in via the
//      browser and copy the `dml_session` cookie value.
//
//   BASE_URL=http://localhost:8080 \
//   SESSION_COOKIE='dml_session=<signed-value>' \
//   k6 run backend/tests/load/feed-load.js
//
// Install k6: https://grafana.com/docs/k6/latest/set-up/install-k6/

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const SESSION_COOKIE = __ENV.SESSION_COOKIE || '';

export const options = {
  scenarios: {
    feed_browse: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100 }, // ramp to ~100 concurrent users
        { duration: '2m', target: 100 }, // hold at target load
        { duration: '30s', target: 0 }, // ramp down
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    // SC-005/SC-007: initial feed page within 2s at p95.
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/api/feed?limit=20`, {
    headers: SESSION_COOKIE ? { Cookie: SESSION_COOKIE } : {},
    tags: { endpoint: 'GET /api/feed' },
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'has items array': (r) => {
      try {
        return Array.isArray(r.json('items'));
      } catch {
        return false;
      }
    },
  });

  // Simulate brief read time between feed loads.
  sleep(1);
}
