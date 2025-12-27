import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const stylesFetchDuration = new Trend('styles_fetch_duration');
const styleDetailDuration = new Trend('style_detail_duration');
const exportDuration = new Trend('export_duration');

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 100 },
    { duration: '1m', target: 100 },
    { duration: '30s', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    errors: ['rate<0.1'],
    styles_fetch_duration: ['p(95)<1000'],
    style_detail_duration: ['p(95)<1500'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

export default function () {
  group('Gallery Load', () => {
    const stylesRes = http.get(`${BASE_URL}/api/styles`);
    stylesFetchDuration.add(stylesRes.timings.duration);

    const stylesCheck = check(stylesRes, {
      'styles status is 200': (r) => r.status === 200,
      'styles response has body': (r) => r.body && r.body.length > 0,
      'styles response is JSON': (r) => {
        try {
          JSON.parse(r.body);
          return true;
        } catch (e) {
          return false;
        }
      },
    });

    errorRate.add(!stylesCheck);

    if (stylesRes.status === 200) {
      try {
        const styles = JSON.parse(stylesRes.body);
        if (styles.length > 0) {
          const randomStyle = styles[Math.floor(Math.random() * styles.length)];

          const detailRes = http.get(`${BASE_URL}/api/styles/${randomStyle.id}`);
          styleDetailDuration.add(detailRes.timings.duration);

          const detailCheck = check(detailRes, {
            'style detail status is 200': (r) => r.status === 200,
            'style detail has tokens': (r) => {
              try {
                const data = JSON.parse(r.body);
                return data.tokens !== undefined;
              } catch (e) {
                return false;
              }
            },
          });

          errorRate.add(!detailCheck);
        }
      } catch (e) {
        errorRate.add(true);
      }
    }
  });

  sleep(1);

  group('API Health', () => {
    const healthRes = http.get(`${BASE_URL}/api/health`);

    check(healthRes, {
      'health check returns 200 or 404': (r) => r.status === 200 || r.status === 404,
    });
  });

  sleep(0.5);

  group('Jobs Polling', () => {
    const jobsRes = http.get(`${BASE_URL}/api/jobs`);

    check(jobsRes, {
      'jobs endpoint returns 200': (r) => r.status === 200,
    });
  });

  sleep(0.5);
}

export function teardown(data) {
  console.log('Load test completed');
  console.log(`Total requests made: ${data ? data.iterations : 'unknown'}`);
}
