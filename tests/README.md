# Visual DNA Studio - Testing Guide

## Test Structure

```
tests/
├── unit/                    # Unit tests with Vitest
│   ├── client/              # React component tests
│   └── server/              # Server logic tests
├── integration/             # API integration tests
├── e2e/                     # Playwright end-to-end tests
├── visual/                  # Visual regression baselines
├── performance/             # k6 load tests & Lighthouse config
└── fixtures/                # Shared test data
```

## Running Tests

### Unit & Integration Tests (Vitest)

```bash
# Run all unit and integration tests
npx vitest run

# Run tests in watch mode
npx vitest

# Run with coverage
npx vitest run --coverage

# Run specific test file
npx vitest run tests/unit/client/token-visualization.test.tsx
```

### End-to-End Tests (Playwright)

```bash
# Install browsers first (one-time)
npx playwright install

# Run all e2e tests
npx playwright test

# Run in headed mode (visible browser)
npx playwright test --headed

# Run with UI mode for debugging
npx playwright test --ui

# Run specific test file
npx playwright test tests/e2e/gallery.spec.ts
```

### Visual Regression Tests

```bash
# Run visual regression tests
npx playwright test tests/e2e/visual-regression.spec.ts

# Update baselines after intentional changes
npx playwright test tests/e2e/visual-regression.spec.ts --update-snapshots
```

### Performance Tests

#### Load Testing with k6

```bash
# Install k6 (https://k6.io/docs/get-started/installation/)
# Then run:
k6 run tests/performance/k6-load-test.js
```

#### Lighthouse CI

```bash
# Install Lighthouse CI
npm install -g @lhci/cli

# Run Lighthouse tests
lhci autorun --config tests/performance/lighthouse.config.js
```

## Test Frameworks

| Type | Framework | Config File |
|------|-----------|-------------|
| Unit/Integration | Vitest | vitest.config.ts |
| E2E | Playwright | playwright.config.ts |
| Visual Regression | Playwright Screenshots | playwright.config.ts |
| Load Testing | k6 | tests/performance/k6-load-test.js |
| Performance | Lighthouse CI | tests/performance/lighthouse.config.js |

## Writing Tests

### Unit Tests (Vitest + React Testing Library)

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MyComponent } from '@/components/my-component';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### E2E Tests (Playwright)

```typescript
import { test, expect } from '@playwright/test';

test('should navigate to style page', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-testid="card-style-1"]');
  await expect(page).toHaveURL(/\/style\//);
});
```

### Visual Regression Tests

```typescript
import { test, expect } from '@playwright/test';

test('gallery page screenshot', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveScreenshot('gallery.png');
});
```

## Test Fixtures

Use fixtures in `tests/fixtures/` for consistent test data:

```typescript
import { mockDTCGTokens, mockStyleSummary } from '../fixtures/mock-tokens';
```

## CI Integration

Tests can be integrated into CI pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Unit Tests
  run: npx vitest run

- name: Run E2E Tests
  run: npx playwright test

- name: Run Performance Tests
  run: lhci autorun
```
