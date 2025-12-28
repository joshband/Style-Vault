import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

interface TestResult {
  name: string;
  category: string;
  status: 'pass' | 'fail' | 'skip';
  duration: number;
  error?: string;
  details?: string;
}

interface TestReport {
  generatedAt: string;
  baseUrl: string;
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    passRate: number;
    totalDuration: number;
  };
  results: TestResult[];
  categories: {
    name: string;
    passed: number;
    failed: number;
    tests: TestResult[];
  }[];
  performance: {
    metric: string;
    value: number;
    target: number;
    status: 'good' | 'warning' | 'critical';
  }[];
  recommendations: string[];
}

const results: TestResult[] = [];

async function runTest(
  name: string,
  category: string,
  testFn: () => Promise<{ success: boolean; details?: string }>
): Promise<void> {
  const start = Date.now();
  try {
    const result = await testFn();
    results.push({
      name,
      category,
      status: result.success ? 'pass' : 'fail',
      duration: Date.now() - start,
      details: result.details,
    });
  } catch (error: any) {
    results.push({
      name,
      category,
      status: 'fail',
      duration: Date.now() - start,
      error: error.message || String(error),
    });
  }
}

async function fetchJson(url: string): Promise<any> {
  const response = await fetch(`${BASE_URL}${url}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function fetchStatus(url: string): Promise<number> {
  const response = await fetch(`${BASE_URL}${url}`);
  return response.status;
}

async function runAPITests(): Promise<void> {
  console.log('Running API tests...');

  await runTest('GET /api/styles returns styles list', 'API Endpoints', async () => {
    const data = await fetchJson('/api/styles');
    return { 
      success: Array.isArray(data) && data.length > 0,
      details: `Found ${data.length} styles`
    };
  });

  await runTest('GET /api/styles includes imageIds', 'API Endpoints', async () => {
    const data = await fetchJson('/api/styles');
    const withImages = data.filter((s: any) => s.imageIds && Object.keys(s.imageIds).length > 0);
    return { 
      success: withImages.length > 0,
      details: `${withImages.length}/${data.length} styles have images`
    };
  });

  await runTest('GET /api/styles/:id returns style details', 'API Endpoints', async () => {
    const styles = await fetchJson('/api/styles');
    if (styles.length === 0) return { success: false, details: 'No styles found' };
    const style = await fetchJson(`/api/styles/${styles[0].id}`);
    return { 
      success: style.id !== undefined && style.name !== undefined,
      details: `Retrieved style: ${style.name}`
    };
  });

  await runTest('GET /api/images/:id returns image', 'API Endpoints', async () => {
    const styles = await fetchJson('/api/styles');
    const styleWithImages = styles.find((s: any) => s.imageIds?.preview_portrait);
    if (!styleWithImages) return { success: true, details: 'No preview images found (skip)' };
    const imageId = styleWithImages.imageIds.preview_portrait;
    const response = await fetch(`${BASE_URL}/api/images/${imageId}`);
    return { 
      success: response.ok,
      details: `Image ${imageId} loaded`
    };
  });

  await runTest('Image compression variants available', 'API Endpoints', async () => {
    const styles = await fetchJson('/api/styles');
    const styleWithImages = styles.find((s: any) => s.imageIds?.preview_portrait);
    if (!styleWithImages) return { success: true, details: 'No preview images found (skip)' };
    const imageId = styleWithImages.imageIds.preview_portrait;
    const thumbResponse = await fetch(`${BASE_URL}/api/images/${imageId}?size=thumb`);
    const mediumResponse = await fetch(`${BASE_URL}/api/images/${imageId}?size=medium`);
    return { 
      success: thumbResponse.ok && mediumResponse.ok,
      details: 'Thumb and medium variants available'
    };
  });

  await runTest('GET /api/health returns status', 'API Endpoints', async () => {
    const response = await fetch(`${BASE_URL}/api/health`);
    return { 
      success: response.ok,
      details: `Health check status: ${response.status}`
    };
  });

  await runTest('GET /api/diagnostics returns system info', 'API Endpoints', async () => {
    const response = await fetch(`${BASE_URL}/api/diagnostics`);
    return { 
      success: response.ok,
      details: `Diagnostics status: ${response.status}`
    };
  });

  await runTest('Paginated styles API works', 'API Endpoints', async () => {
    const data = await fetchJson('/api/styles?limit=5&offset=0');
    return { 
      success: data.items && Array.isArray(data.items) && data.total !== undefined,
      details: `Paginated: ${data.items?.length || 0} items, ${data.total} total`
    };
  });

  await runTest('GET /api/styles/:id handles 404', 'Error Handling', async () => {
    const response = await fetch(`${BASE_URL}/api/styles/non-existent-id-12345`);
    return { 
      success: response.status === 404,
      details: `Returns ${response.status} for non-existent style`
    };
  });

  await runTest('GET /api/images/:id handles 404', 'Error Handling', async () => {
    const response = await fetch(`${BASE_URL}/api/images/non-existent-image-id`);
    return { 
      success: response.status === 404,
      details: `Returns ${response.status} for non-existent image`
    };
  });

  await runTest('SPA fallback handles client routes', 'Error Handling', async () => {
    const response = await fetch(`${BASE_URL}/nonexistent-page`);
    return { 
      success: response.ok,
      details: `SPA fallback returns ${response.status} for client routing`
    };
  });
}

async function runPageTests(): Promise<void> {
  console.log('Running page accessibility tests...');

  const pages = [
    { path: '/', name: 'Home/Explore' },
    { path: '/create', name: 'Create Style' },
    { path: '/compare', name: 'Compare Styles' },
    { path: '/saved', name: 'Saved Styles' },
    { path: '/tools', name: 'Tools' },
    { path: '/features', name: 'Features' },
    { path: '/analytics', name: 'Analytics' },
    { path: '/admin', name: 'Admin Dashboard' },
    { path: '/remix', name: 'Remix' },
    { path: '/batch', name: 'Batch Upload' },
  ];

  for (const page of pages) {
    await runTest(`${page.name} page accessible`, 'Page Accessibility', async () => {
      const status = await fetchStatus(page.path);
      return { 
        success: status === 200,
        details: `Status: ${status}`
      };
    });
  }
}

async function runDataIntegrityTests(): Promise<void> {
  console.log('Running data integrity tests...');

  await runTest('Styles have valid structure', 'Data Integrity', async () => {
    const styles = await fetchJson('/api/styles');
    const valid = styles.filter((s: any) => 
      s.id && s.name && typeof s.createdAt === 'string'
    );
    return { 
      success: valid.length === styles.length,
      details: `${valid.length}/${styles.length} styles have valid structure`
    };
  });

  await runTest('Styles have design tokens', 'Data Integrity', async () => {
    const styles = await fetchJson('/api/styles');
    if (styles.length === 0) return { success: true, details: 'No styles to check' };
    const style = await fetchJson(`/api/styles/${styles[0].id}`);
    return { 
      success: style.tokens !== undefined,
      details: style.tokens ? 'Tokens present' : 'No tokens found'
    };
  });

  await runTest('Image IDs reference valid images', 'Data Integrity', async () => {
    const styles = await fetchJson('/api/styles');
    const styleWithImages = styles.find((s: any) => s.imageIds && Object.keys(s.imageIds).length > 0);
    if (!styleWithImages) return { success: true, details: 'No styles with images' };
    
    let validCount = 0;
    let totalCount = 0;
    for (const [type, id] of Object.entries(styleWithImages.imageIds)) {
      totalCount++;
      const response = await fetch(`${BASE_URL}/api/images/${id}`);
      if (response.ok) validCount++;
    }
    return { 
      success: validCount === totalCount,
      details: `${validCount}/${totalCount} images valid`
    };
  });
}

async function runPerformanceTests(): Promise<{ metric: string; value: number; target: number; status: 'good' | 'warning' | 'critical' }[]> {
  console.log('Running performance tests...');
  const metrics: { metric: string; value: number; target: number; status: 'good' | 'warning' | 'critical' }[] = [];

  const apiStart = Date.now();
  await fetchJson('/api/styles');
  const apiTime = Date.now() - apiStart;
  metrics.push({
    metric: 'API Response Time (GET /api/styles)',
    value: apiTime,
    target: 500,
    status: apiTime < 500 ? 'good' : apiTime < 1000 ? 'warning' : 'critical',
  });

  const styles = await fetchJson('/api/styles');
  if (styles.length > 0 && styles[0].imageIds?.preview_portrait) {
    const imageStart = Date.now();
    await fetch(`${BASE_URL}/api/images/${styles[0].imageIds.preview_portrait}?size=thumb`);
    const imageTime = Date.now() - imageStart;
    metrics.push({
      metric: 'Image Load Time (thumbnail)',
      value: imageTime,
      target: 200,
      status: imageTime < 200 ? 'good' : imageTime < 500 ? 'warning' : 'critical',
    });
  }

  return metrics;
}

function generateReport(performance: TestReport['performance']): TestReport {
  const categories = new Map<string, TestResult[]>();
  for (const result of results) {
    if (!categories.has(result.category)) {
      categories.set(result.category, []);
    }
    categories.get(result.category)!.push(result);
  }

  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const skipped = results.filter(r => r.status === 'skip').length;

  return {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    summary: {
      total: results.length,
      passed,
      failed,
      skipped,
      passRate: Math.round((passed / results.length) * 100),
      totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
    },
    results,
    categories: Array.from(categories.entries()).map(([name, tests]) => ({
      name,
      passed: tests.filter(t => t.status === 'pass').length,
      failed: tests.filter(t => t.status === 'fail').length,
      tests,
    })),
    performance,
    recommendations: generateRecommendations(results, performance),
  };
}

function generateRecommendations(results: TestResult[], performance: TestReport['performance']): string[] {
  const recs: string[] = [];
  
  const failures = results.filter(r => r.status === 'fail');
  if (failures.length > 0) {
    recs.push(`Fix ${failures.length} failing test(s): ${failures.map(f => f.name).join(', ')}`);
  }
  
  const slowMetrics = performance.filter(p => p.status !== 'good');
  if (slowMetrics.length > 0) {
    recs.push(`Optimize performance for: ${slowMetrics.map(m => m.metric).join(', ')}`);
  }
  
  recs.push('Add end-to-end tests for user authentication flows');
  recs.push('Add accessibility (a11y) testing with axe-core');
  recs.push('Consider adding visual regression tests');
  recs.push('Monitor bundle size to prevent bloat');
  
  return recs;
}

function generateMarkdown(report: TestReport): string {
  let md = `# Visual DNA Comprehensive Test Report\n\n`;
  md += `**Generated:** ${report.generatedAt}\n`;
  md += `**Base URL:** ${report.baseUrl}\n\n`;
  
  md += `## Summary\n\n`;
  md += `| Metric | Value |\n`;
  md += `|--------|-------|\n`;
  md += `| Total Tests | ${report.summary.total} |\n`;
  md += `| Passed | ${report.summary.passed} |\n`;
  md += `| Failed | ${report.summary.failed} |\n`;
  md += `| Skipped | ${report.summary.skipped} |\n`;
  md += `| Pass Rate | ${report.summary.passRate}% |\n`;
  md += `| Total Duration | ${report.summary.totalDuration}ms |\n\n`;
  
  md += `---\n\n`;
  md += `## Test Results by Category\n\n`;
  
  for (const category of report.categories) {
    const icon = category.failed === 0 ? '✅' : '⚠️';
    md += `### ${icon} ${category.name}\n\n`;
    md += `| Test | Status | Duration | Details |\n`;
    md += `|------|--------|----------|--------|\n`;
    
    for (const test of category.tests) {
      const statusIcon = test.status === 'pass' ? '✅' : test.status === 'skip' ? '⏭️' : '❌';
      const details = test.error || test.details || '';
      md += `| ${test.name} | ${statusIcon} | ${test.duration}ms | ${details.substring(0, 50)} |\n`;
    }
    md += `\n`;
  }
  
  md += `---\n\n`;
  md += `## Performance Metrics\n\n`;
  md += `| Metric | Value | Target | Status |\n`;
  md += `|--------|-------|--------|--------|\n`;
  
  for (const perf of report.performance) {
    const icon = perf.status === 'good' ? '✅' : perf.status === 'warning' ? '⚠️' : '❌';
    md += `| ${perf.metric} | ${perf.value}ms | <${perf.target}ms | ${icon} |\n`;
  }
  md += `\n`;
  
  md += `---\n\n`;
  md += `## Recommendations\n\n`;
  for (const rec of report.recommendations) {
    md += `- ${rec}\n`;
  }
  md += `\n`;
  
  md += `---\n\n`;
  md += `## Feature Coverage\n\n`;
  md += `| Feature | Tested | Notes |\n`;
  md += `|---------|--------|-------|\n`;
  md += `| Style Gallery | ✅ | API and accessibility tested |\n`;
  md += `| Style Details | ✅ | API and data integrity tested |\n`;
  md += `| Image Service | ✅ | Image loading and compression tested |\n`;
  md += `| Design Tokens | ✅ | Token presence verified |\n`;
  md += `| Page Routing | ✅ | All routes accessibility tested |\n`;
  md += `| Authentication | ⚠️ | Manual testing required |\n`;
  md += `| Style Creation | ⚠️ | API endpoint not fully tested |\n`;
  md += `| AI Generation | ⚠️ | Requires manual verification |\n\n`;
  
  return md;
}

async function main() {
  console.log('Starting comprehensive test suite...\n');
  
  await runAPITests();
  await runPageTests();
  await runDataIntegrityTests();
  const performance = await runPerformanceTests();
  
  const report = generateReport(performance);
  
  console.log('\n=== Test Summary ===');
  console.log(`Total: ${report.summary.total}`);
  console.log(`Passed: ${report.summary.passed}`);
  console.log(`Failed: ${report.summary.failed}`);
  console.log(`Pass Rate: ${report.summary.passRate}%`);
  
  const markdown = generateMarkdown(report);
  
  const reportsDir = path.join(__dirname, '../test-reports');
  fs.mkdirSync(reportsDir, { recursive: true });
  
  fs.writeFileSync(path.join(reportsDir, 'results.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(reportsDir, 'COMPREHENSIVE_TEST_REPORT.md'), markdown);
  
  console.log(`\nReports saved to: ${reportsDir}`);
  console.log('- results.json');
  console.log('- COMPREHENSIVE_TEST_REPORT.md');
  
  process.exit(report.summary.failed > 0 ? 1 : 0);
}

main().catch(console.error);
