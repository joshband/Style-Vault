import * as fs from 'fs';
import * as path from 'path';

interface TestResult {
  suites: TestSuite[];
  config: any;
  stats: {
    expected: number;
    unexpected: number;
    flaky: number;
    skipped: number;
    duration: number;
  };
}

interface TestSuite {
  title: string;
  file: string;
  specs: TestSpec[];
  suites?: TestSuite[];
}

interface TestSpec {
  title: string;
  ok: boolean;
  tests: {
    projectName: string;
    status: string;
    duration: number;
    errors?: string[];
  }[];
}

interface ReportSection {
  title: string;
  tests: {
    name: string;
    status: 'pass' | 'fail' | 'skip';
    duration: number;
    error?: string;
  }[];
}

function flattenSuites(suites: TestSuite[], depth = 0): ReportSection[] {
  const sections: ReportSection[] = [];
  
  for (const suite of suites) {
    const section: ReportSection = {
      title: suite.title,
      tests: [],
    };
    
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        section.tests.push({
          name: spec.title,
          status: test.status === 'passed' ? 'pass' : test.status === 'skipped' ? 'skip' : 'fail',
          duration: test.duration,
          error: test.errors?.join('\n'),
        });
      }
    }
    
    if (section.tests.length > 0) {
      sections.push(section);
    }
    
    if (suite.suites) {
      sections.push(...flattenSuites(suite.suites, depth + 1));
    }
  }
  
  return sections;
}

function generateMarkdownReport(results: TestResult): string {
  const sections = flattenSuites(results.suites);
  const now = new Date().toISOString();
  
  let md = `# Visual DNA Comprehensive Test Report\n\n`;
  md += `**Generated:** ${now}\n\n`;
  md += `## Summary\n\n`;
  md += `| Metric | Value |\n`;
  md += `|--------|-------|\n`;
  md += `| Total Tests | ${results.stats.expected + results.stats.unexpected + results.stats.skipped} |\n`;
  md += `| Passed | ${results.stats.expected} |\n`;
  md += `| Failed | ${results.stats.unexpected} |\n`;
  md += `| Skipped | ${results.stats.skipped} |\n`;
  md += `| Duration | ${(results.stats.duration / 1000).toFixed(2)}s |\n\n`;
  
  const passRate = results.stats.expected / (results.stats.expected + results.stats.unexpected) * 100;
  md += `**Pass Rate:** ${passRate.toFixed(1)}%\n\n`;
  
  md += `---\n\n`;
  md += `## Test Results by Feature\n\n`;
  
  for (const section of sections) {
    const passed = section.tests.filter(t => t.status === 'pass').length;
    const total = section.tests.length;
    const sectionStatus = passed === total ? '✅' : '⚠️';
    
    md += `### ${sectionStatus} ${section.title}\n\n`;
    md += `| Test | Status | Duration |\n`;
    md += `|------|--------|----------|\n`;
    
    for (const test of section.tests) {
      const statusIcon = test.status === 'pass' ? '✅' : test.status === 'skip' ? '⏭️' : '❌';
      md += `| ${test.name} | ${statusIcon} ${test.status} | ${test.duration}ms |\n`;
    }
    
    md += `\n`;
    
    const failures = section.tests.filter(t => t.status === 'fail');
    if (failures.length > 0) {
      md += `**Failures:**\n\n`;
      for (const fail of failures) {
        md += `- **${fail.name}**: ${fail.error?.substring(0, 200) || 'Unknown error'}...\n`;
      }
      md += `\n`;
    }
  }
  
  md += `---\n\n`;
  md += `## Performance Metrics\n\n`;
  md += `| Page | Load Time Target | Status |\n`;
  md += `|------|-----------------|--------|\n`;
  md += `| Home Page | < 10s | TBD |\n`;
  md += `| Style Detail | < 15s | TBD |\n\n`;
  
  md += `---\n\n`;
  md += `## Areas for Improvement\n\n`;
  
  const failedTests = sections.flatMap(s => s.tests.filter(t => t.status === 'fail'));
  if (failedTests.length > 0) {
    md += `### Failed Tests (${failedTests.length})\n\n`;
    for (const test of failedTests) {
      md += `- ${test.name}\n`;
    }
    md += `\n`;
  } else {
    md += `All tests passed! No immediate issues detected.\n\n`;
  }
  
  md += `### Recommendations\n\n`;
  md += `1. **Performance**: Monitor page load times regularly\n`;
  md += `2. **Accessibility**: Add ARIA labels to interactive elements\n`;
  md += `3. **Error Handling**: Ensure graceful degradation for failed API calls\n`;
  md += `4. **Mobile UX**: Test touch interactions on mobile devices\n\n`;
  
  md += `---\n\n`;
  md += `## Technical Notes\n\n`;
  md += `- Tests run on Chromium browser\n`;
  md += `- Base URL: ${results.config?.projects?.[0]?.use?.baseURL || 'localhost:5000'}\n`;
  md += `- Screenshots captured on failure\n\n`;
  
  return md;
}

async function main() {
  const resultsPath = path.join(__dirname, '../test-reports/results.json');
  
  if (!fs.existsSync(resultsPath)) {
    console.log('No test results found. Run tests first with: npx playwright test -c tests/playwright.config.ts');
    process.exit(1);
  }
  
  const results: TestResult = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
  const report = generateMarkdownReport(results);
  
  const reportPath = path.join(__dirname, '../test-reports/COMPREHENSIVE_TEST_REPORT.md');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, report);
  
  console.log(`Report generated: ${reportPath}`);
}

main().catch(console.error);
