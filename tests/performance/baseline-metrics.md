# Performance Baseline Metrics

## Phase 1 Minimal MVP - December 2024

This document tracks baseline performance metrics for regression testing.

## Page Load Metrics

| Metric | Target | Baseline |
|--------|--------|----------|
| First Contentful Paint (FCP) | < 1.5s | TBD |
| Largest Contentful Paint (LCP) | < 2.5s | TBD |
| Time to Interactive (TTI) | < 3.0s | TBD |
| Total Blocking Time (TBT) | < 200ms | TBD |
| Cumulative Layout Shift (CLS) | < 0.1 | TBD |

## API Response Times

| Endpoint | Method | Target (p95) | Baseline |
|----------|--------|--------------|----------|
| /api/styles | GET | < 250ms | TBD |
| /api/styles (paginated) | GET | < 250ms | TBD |
| /api/auth/user | GET | < 100ms | TBD |

## Bundle Size

| Bundle | Target | Baseline |
|--------|--------|----------|
| Main JS | < 300KB | TBD |
| Main CSS | < 50KB | TBD |
| Total Initial Load | < 500KB | TBD |

## Feature Flag Snapshot

### Phase 1 Enabled Flags (5 total)
- vault.enabled: true
- auth.enabled: true
- nav.basic: true
- nav.explore: true
- api.styles.list: true

### All Other Flags: false

## Test Fixture

- **Primary Test Image**: `tests/fixtures/retro-audio-plugin.png`
- **Image Description**: Retro audio plugin UI with vintage industrial interface
- **File Size**: ~500KB (approximate)

## Notes

- Metrics should be captured on a clean browser profile
- Run 3 times and take median values
- Test on both development and production builds
- Update this document as features are enabled
