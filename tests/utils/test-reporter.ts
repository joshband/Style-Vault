type TestStatus = "pending" | "running" | "passed" | "failed" | "skipped";
type TestSeverity = "critical" | "major" | "minor" | "info";

interface TestCaseResult {
  name: string;
  suite: string;
  status: TestStatus;
  severity: TestSeverity;
  durationMs: number;
  errorMessage?: string;
  errorStack?: string;
  screenshotPath?: string;
  category: string;
  recommendation?: string;
}

interface TestRunReport {
  name: string;
  browser: string;
  viewport: string;
  environment: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  durationMs: number;
  testCases: TestCaseResult[];
  summary: {
    whatWorks: string[];
    whatFails: string[];
    improvements: string[];
    enhancements: string[];
  };
}

const BASE_URL = process.env.TEST_REPORT_URL || 'http://localhost:5000';

export async function submitTestRun(report: TestRunReport): Promise<{ runId: string } | null> {
  try {
    const response = await fetch(`${BASE_URL}/api/admin/test-runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: report.name,
        browser: report.browser,
        viewport: report.viewport,
        environment: report.environment,
        totalTests: report.totalTests,
        passedTests: report.passedTests,
        failedTests: report.failedTests,
        skippedTests: report.skippedTests,
        durationMs: report.durationMs,
        summary: report.summary,
        testCases: report.testCases,
      }),
    });

    if (response.ok) {
      return await response.json();
    }
    console.error('Failed to submit test run:', await response.text());
    return null;
  } catch (error) {
    console.error('Error submitting test run:', error);
    return null;
  }
}

export async function getTestRunHistory(limit: number = 10): Promise<any[]> {
  try {
    const response = await fetch(`${BASE_URL}/api/admin/test-runs?limit=${limit}`);
    if (response.ok) {
      return await response.json();
    }
    return [];
  } catch (error) {
    console.error('Error fetching test run history:', error);
    return [];
  }
}

export function generateMarkdownReport(report: TestRunReport): string {
  const passRate = report.totalTests > 0 
    ? ((report.passedTests / report.totalTests) * 100).toFixed(1) 
    : '0';
  
  let markdown = `# Test Report: ${report.name}\n\n`;
  markdown += `**Generated:** ${new Date().toISOString()}\n`;
  markdown += `**Browser:** ${report.browser}\n`;
  markdown += `**Viewport:** ${report.viewport}\n`;
  markdown += `**Duration:** ${(report.durationMs / 1000).toFixed(2)}s\n\n`;
  
  markdown += `## Summary\n\n`;
  markdown += `| Metric | Value |\n`;
  markdown += `|--------|-------|\n`;
  markdown += `| Total Tests | ${report.totalTests} |\n`;
  markdown += `| Passed | ${report.passedTests} |\n`;
  markdown += `| Failed | ${report.failedTests} |\n`;
  markdown += `| Skipped | ${report.skippedTests} |\n`;
  markdown += `| Pass Rate | ${passRate}% |\n\n`;
  
  if (report.summary.whatWorks.length > 0) {
    markdown += `## What Works\n\n`;
    report.summary.whatWorks.forEach(item => {
      markdown += `- ${item}\n`;
    });
    markdown += '\n';
  }
  
  if (report.summary.whatFails.length > 0) {
    markdown += `## What Fails\n\n`;
    report.summary.whatFails.forEach(item => {
      markdown += `- ${item}\n`;
    });
    markdown += '\n';
  }
  
  if (report.summary.improvements.length > 0) {
    markdown += `## Improvements Needed\n\n`;
    report.summary.improvements.forEach(item => {
      markdown += `- ${item}\n`;
    });
    markdown += '\n';
  }
  
  if (report.summary.enhancements.length > 0) {
    markdown += `## Enhancement Opportunities\n\n`;
    report.summary.enhancements.forEach(item => {
      markdown += `- ${item}\n`;
    });
    markdown += '\n';
  }
  
  markdown += `## Test Cases\n\n`;
  markdown += `| Suite | Test | Status | Duration |\n`;
  markdown += `|-------|------|--------|----------|\n`;
  
  report.testCases.forEach(tc => {
    const statusEmoji = tc.status === 'passed' ? '✅' : tc.status === 'failed' ? '❌' : '⏭️';
    markdown += `| ${tc.suite} | ${tc.name} | ${statusEmoji} ${tc.status} | ${tc.durationMs}ms |\n`;
  });
  
  return markdown;
}

export function generateHTMLReport(report: TestRunReport): string {
  const passRate = report.totalTests > 0 
    ? ((report.passedTests / report.totalTests) * 100).toFixed(1) 
    : '0';
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test Report: ${report.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #f5f5f5; color: #1a1a1a; padding: 2rem; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #3b82f6; margin-bottom: 1rem; }
    .meta { color: #666; margin-bottom: 2rem; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .stat-card { background: white; border-radius: 8px; padding: 1.5rem; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .stat-value { font-size: 2rem; font-weight: bold; }
    .stat-label { color: #666; font-size: 0.875rem; }
    .passed .stat-value { color: #22c55e; }
    .failed .stat-value { color: #ef4444; }
    .section { background: white; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .section h2 { margin-bottom: 1rem; font-size: 1.25rem; }
    ul { padding-left: 1.5rem; }
    li { margin-bottom: 0.5rem; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #e5e5e5; }
    th { background: #f5f5f5; font-weight: 600; }
    .status-passed { color: #22c55e; }
    .status-failed { color: #ef4444; }
    .status-skipped { color: #f59e0b; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Test Report: ${report.name}</h1>
    <div class="meta">
      <p>Generated: ${new Date().toISOString()}</p>
      <p>Browser: ${report.browser} | Viewport: ${report.viewport} | Duration: ${(report.durationMs / 1000).toFixed(2)}s</p>
    </div>
    
    <div class="summary-grid">
      <div class="stat-card">
        <div class="stat-value">${report.totalTests}</div>
        <div class="stat-label">Total Tests</div>
      </div>
      <div class="stat-card passed">
        <div class="stat-value">${report.passedTests}</div>
        <div class="stat-label">Passed</div>
      </div>
      <div class="stat-card failed">
        <div class="stat-value">${report.failedTests}</div>
        <div class="stat-label">Failed</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${passRate}%</div>
        <div class="stat-label">Pass Rate</div>
      </div>
    </div>
    
    ${report.summary.whatWorks.length > 0 ? `
    <div class="section">
      <h2>✅ What Works</h2>
      <ul>
        ${report.summary.whatWorks.map(item => `<li>${item}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
    
    ${report.summary.whatFails.length > 0 ? `
    <div class="section">
      <h2>❌ What Fails</h2>
      <ul>
        ${report.summary.whatFails.map(item => `<li>${item}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
    
    ${report.summary.improvements.length > 0 ? `
    <div class="section">
      <h2>🔧 Improvements Needed</h2>
      <ul>
        ${report.summary.improvements.map(item => `<li>${item}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
    
    ${report.summary.enhancements.length > 0 ? `
    <div class="section">
      <h2>💡 Enhancement Opportunities</h2>
      <ul>
        ${report.summary.enhancements.map(item => `<li>${item}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
    
    <div class="section">
      <h2>Test Cases</h2>
      <table>
        <thead>
          <tr>
            <th>Suite</th>
            <th>Test</th>
            <th>Status</th>
            <th>Duration</th>
          </tr>
        </thead>
        <tbody>
          ${report.testCases.map(tc => `
          <tr>
            <td>${tc.suite}</td>
            <td>${tc.name}</td>
            <td class="status-${tc.status}">${tc.status}</td>
            <td>${tc.durationMs}ms</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`;
}
