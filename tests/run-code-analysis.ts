import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');

interface CodeMetrics {
  totalFiles: number;
  totalLines: number;
  filesByType: Record<string, number>;
  linesByType: Record<string, number>;
  largestFiles: { path: string; lines: number }[];
  unusedExports: string[];
  duplicateCode: string[];
  bundleMetrics: {
    estimatedSize: string;
    dependencies: number;
    devDependencies: number;
  };
  codeQuality: {
    score: number;
    issues: string[];
    strengths: string[];
  };
}

function countLines(filePath: string): number {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.split('\n').length;
  } catch {
    return 0;
  }
}

function walkDir(dir: string, extensions: string[], ignore: string[] = []): string[] {
  const results: string[] = [];
  
  try {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const relativePath = path.relative(ROOT_DIR, fullPath);
      
      if (ignore.some(pattern => relativePath.includes(pattern))) {
        continue;
      }
      
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        results.push(...walkDir(fullPath, extensions, ignore));
      } else if (extensions.some(ext => item.endsWith(ext))) {
        results.push(fullPath);
      }
    }
  } catch {
    // Ignore permission errors
  }
  
  return results;
}

function findUnusedExports(): string[] {
  const unused: string[] = [];
  
  try {
    const result = execSync(
      'grep -r "export " --include="*.ts" --include="*.tsx" client/src server shared | head -50',
      { cwd: ROOT_DIR, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    ).toString();
    
    const exports = result.split('\n').filter(Boolean);
    
    for (const line of exports.slice(0, 20)) {
      const match = line.match(/export\s+(const|function|class|interface|type)\s+(\w+)/);
      if (match) {
        const exportName = match[2];
        
        try {
          const usageResult = execSync(
            `grep -r "${exportName}" --include="*.ts" --include="*.tsx" client/src server | grep -v "export" | head -1`,
            { cwd: ROOT_DIR, encoding: 'utf-8', maxBuffer: 1024 * 1024 }
          ).toString();
          
          if (!usageResult.trim()) {
            unused.push(`${exportName} (from ${line.split(':')[0]})`);
          }
        } catch {
          // No usage found
          if (!['default', 'App', 'main'].includes(exportName)) {
            unused.push(`${exportName} (possibly unused)`);
          }
        }
      }
    }
  } catch {
    // Grep command failed
  }
  
  return unused.slice(0, 10);
}

function getDependencyCount(): { dependencies: number; devDependencies: number } {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf-8'));
    return {
      dependencies: Object.keys(pkg.dependencies || {}).length,
      devDependencies: Object.keys(pkg.devDependencies || {}).length,
    };
  } catch {
    return { dependencies: 0, devDependencies: 0 };
  }
}

function estimateBundleSize(): string {
  try {
    const result = execSync('du -sh node_modules 2>/dev/null || echo "Unknown"', { 
      cwd: ROOT_DIR, 
      encoding: 'utf-8' 
    });
    return result.split('\t')[0] || 'Unknown';
  } catch {
    return 'Unknown';
  }
}

function analyzeCodeQuality(files: string[]): { score: number; issues: string[]; strengths: string[] } {
  const issues: string[] = [];
  const strengths: string[] = [];
  let score = 100;
  
  const tsxFiles = files.filter(f => f.endsWith('.tsx'));
  const tsFiles = files.filter(f => f.endsWith('.ts'));
  
  if (tsxFiles.length > 0) {
    strengths.push(`TypeScript used for ${tsxFiles.length} React components`);
  }
  
  if (tsFiles.length > 0) {
    strengths.push(`TypeScript used for ${tsFiles.length} modules`);
  }
  
  // Check for proper file organization
  const clientFiles = files.filter(f => f.includes('/client/'));
  const serverFiles = files.filter(f => f.includes('/server/'));
  const sharedFiles = files.filter(f => f.includes('/shared/'));
  
  if (clientFiles.length > 0 && serverFiles.length > 0 && sharedFiles.length > 0) {
    strengths.push('Good separation of client, server, and shared code');
  }
  
  // Check for large files
  const largeFiles = files.filter(f => countLines(f) > 500);
  if (largeFiles.length > 5) {
    issues.push(`${largeFiles.length} files exceed 500 lines - consider splitting`);
    score -= 10;
  }
  
  // Check for test files
  const testFiles = files.filter(f => f.includes('.test.') || f.includes('.spec.') || f.includes('/tests/'));
  if (testFiles.length > 0) {
    strengths.push(`${testFiles.length} test files found`);
  } else {
    issues.push('Limited test coverage detected');
    score -= 5;
  }
  
  // Check for proper typing
  try {
    const anyUsage = execSync(
      'grep -r ": any" --include="*.ts" --include="*.tsx" client/src server | wc -l',
      { cwd: ROOT_DIR, encoding: 'utf-8' }
    );
    const anyCount = parseInt(anyUsage.trim()) || 0;
    if (anyCount > 50) {
      issues.push(`${anyCount} usages of 'any' type - consider stricter typing`);
      score -= 5;
    }
  } catch {
    // Ignore
  }
  
  // Check for console.log usage
  try {
    const consoleUsage = execSync(
      'grep -r "console.log" --include="*.ts" --include="*.tsx" client/src server | wc -l',
      { cwd: ROOT_DIR, encoding: 'utf-8' }
    );
    const consoleCount = parseInt(consoleUsage.trim()) || 0;
    if (consoleCount > 20) {
      issues.push(`${consoleCount} console.log statements found - consider removing for production`);
      score -= 3;
    }
  } catch {
    // Ignore
  }
  
  return { score: Math.max(0, score), issues, strengths };
}

function generateAnalysisReport(metrics: CodeMetrics): string {
  let md = `# Code Analysis Report\n\n`;
  md += `**Generated:** ${new Date().toISOString()}\n\n`;
  
  md += `## Code Metrics\n\n`;
  md += `| Metric | Value |\n`;
  md += `|--------|-------|\n`;
  md += `| Total Files | ${metrics.totalFiles} |\n`;
  md += `| Total Lines | ${metrics.totalLines.toLocaleString()} |\n`;
  md += `| Dependencies | ${metrics.bundleMetrics.dependencies} |\n`;
  md += `| Dev Dependencies | ${metrics.bundleMetrics.devDependencies} |\n`;
  md += `| node_modules Size | ${metrics.bundleMetrics.estimatedSize} |\n\n`;
  
  md += `### Files by Type\n\n`;
  md += `| Type | Count | Lines |\n`;
  md += `|------|-------|-------|\n`;
  for (const [type, count] of Object.entries(metrics.filesByType)) {
    md += `| ${type} | ${count} | ${metrics.linesByType[type]?.toLocaleString() || 0} |\n`;
  }
  md += `\n`;
  
  md += `### Largest Files\n\n`;
  md += `| File | Lines |\n`;
  md += `|------|-------|\n`;
  for (const file of metrics.largestFiles) {
    md += `| ${file.path} | ${file.lines} |\n`;
  }
  md += `\n`;
  
  md += `---\n\n`;
  md += `## Code Quality Score: ${metrics.codeQuality.score}/100\n\n`;
  
  if (metrics.codeQuality.strengths.length > 0) {
    md += `### Strengths\n\n`;
    for (const strength of metrics.codeQuality.strengths) {
      md += `- ✅ ${strength}\n`;
    }
    md += `\n`;
  }
  
  if (metrics.codeQuality.issues.length > 0) {
    md += `### Issues to Address\n\n`;
    for (const issue of metrics.codeQuality.issues) {
      md += `- ⚠️ ${issue}\n`;
    }
    md += `\n`;
  }
  
  md += `---\n\n`;
  md += `## Potentially Unused Exports\n\n`;
  if (metrics.unusedExports.length > 0) {
    for (const unused of metrics.unusedExports) {
      md += `- ${unused}\n`;
    }
  } else {
    md += `No obviously unused exports detected.\n`;
  }
  md += `\n`;
  
  md += `---\n\n`;
  md += `## Recommendations\n\n`;
  md += `1. **Bundle Optimization**: Consider code splitting for large components\n`;
  md += `2. **Type Safety**: Reduce usage of 'any' types where possible\n`;
  md += `3. **Performance**: Implement lazy loading for less-used pages\n`;
  md += `4. **Maintenance**: Split files larger than 500 lines\n`;
  md += `5. **Testing**: Expand test coverage to include more components\n`;
  
  return md;
}

async function main() {
  console.log('Running code analysis...\n');
  
  const extensions = ['.ts', '.tsx', '.js', '.jsx'];
  const ignore = ['node_modules', 'dist', '.git', 'test-reports', '.cache'];
  
  const files = walkDir(ROOT_DIR, extensions, ignore);
  
  const filesByType: Record<string, number> = {};
  const linesByType: Record<string, number> = {};
  let totalLines = 0;
  const fileLinesMap: { path: string; lines: number }[] = [];
  
  for (const file of files) {
    const ext = path.extname(file);
    const lines = countLines(file);
    totalLines += lines;
    
    filesByType[ext] = (filesByType[ext] || 0) + 1;
    linesByType[ext] = (linesByType[ext] || 0) + lines;
    fileLinesMap.push({ path: path.relative(ROOT_DIR, file), lines });
  }
  
  fileLinesMap.sort((a, b) => b.lines - a.lines);
  
  const deps = getDependencyCount();
  const unusedExports = findUnusedExports();
  const quality = analyzeCodeQuality(files);
  
  const metrics: CodeMetrics = {
    totalFiles: files.length,
    totalLines,
    filesByType,
    linesByType,
    largestFiles: fileLinesMap.slice(0, 10),
    unusedExports,
    duplicateCode: [],
    bundleMetrics: {
      estimatedSize: estimateBundleSize(),
      ...deps,
    },
    codeQuality: quality,
  };
  
  console.log('=== Code Analysis Summary ===');
  console.log(`Total Files: ${metrics.totalFiles}`);
  console.log(`Total Lines: ${metrics.totalLines.toLocaleString()}`);
  console.log(`Code Quality Score: ${metrics.codeQuality.score}/100`);
  console.log(`Dependencies: ${deps.dependencies} + ${deps.devDependencies} dev`);
  
  const report = generateAnalysisReport(metrics);
  
  const reportsDir = path.join(__dirname, '../test-reports');
  fs.mkdirSync(reportsDir, { recursive: true });
  
  fs.writeFileSync(path.join(reportsDir, 'code-analysis.json'), JSON.stringify(metrics, null, 2));
  fs.writeFileSync(path.join(reportsDir, 'CODE_ANALYSIS_REPORT.md'), report);
  
  console.log(`\nReports saved to: ${reportsDir}`);
  console.log('- code-analysis.json');
  console.log('- CODE_ANALYSIS_REPORT.md');
}

main().catch(console.error);
