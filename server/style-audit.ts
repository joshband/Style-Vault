import { GoogleGenAI } from "@google/genai";
import vision from "@google-cloud/vision";
import type { Style } from "@shared/schema";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

export interface ColorInconsistency {
  detected: string;
  expected: string;
  location: string;
  severity: "low" | "medium" | "high";
  suggestion: string;
}

export interface TypographyInconsistency {
  detected: string;
  expected: string;
  location: string;
  severity: "low" | "medium" | "high";
  suggestion: string;
}

export interface SpacingInconsistency {
  detected: string;
  expected: string;
  location: string;
  severity: "low" | "medium" | "high";
  suggestion: string;
}

export interface ComponentInconsistency {
  component: string;
  issue: string;
  severity: "low" | "medium" | "high";
  suggestion: string;
}

export interface AuditResult {
  overallScore: number;
  colorScore: number;
  typographyScore: number;
  spacingScore: number;
  consistencyScore: number;
  colorInconsistencies: ColorInconsistency[];
  typographyInconsistencies: TypographyInconsistency[];
  spacingInconsistencies: SpacingInconsistency[];
  componentInconsistencies: ComponentInconsistency[];
  suggestions: string[];
  summary: string;
  detectedColors: string[];
  detectedFonts: string[];
  analyzedAt: string;
}

export interface CodebaseAuditResult {
  overallScore: number;
  tokenUsage: {
    used: string[];
    unused: string[];
    undefined: string[];
  };
  hardcodedValues: {
    type: "color" | "spacing" | "typography";
    value: string;
    file: string;
    line: number;
    suggestion: string;
  }[];
  inconsistencies: {
    type: string;
    description: string;
    files: string[];
    suggestion: string;
  }[];
  summary: string;
}

function extractColorsFromTokens(tokens: Record<string, any>): string[] {
  const colors: string[] = [];
  
  function traverse(obj: any, path: string = "") {
    if (!obj || typeof obj !== "object") return;
    
    if (obj.$type === "color" && obj.$value) {
      colors.push(obj.$value);
    } else {
      for (const [key, value] of Object.entries(obj)) {
        if (key.startsWith("$")) continue;
        traverse(value, path ? `${path}.${key}` : key);
      }
    }
  }
  
  traverse(tokens);
  return colors;
}

function extractTypographyFromTokens(tokens: Record<string, any>): { fonts: string[]; sizes: string[]; weights: string[] } {
  const fonts: string[] = [];
  const sizes: string[] = [];
  const weights: string[] = [];
  
  function traverse(obj: any) {
    if (!obj || typeof obj !== "object") return;
    
    if (obj.$type === "fontFamily" && obj.$value) {
      fonts.push(obj.$value);
    } else if (obj.$type === "fontSize" || obj.$type === "dimension") {
      if (obj.$value) sizes.push(String(obj.$value));
    } else if (obj.$type === "fontWeight") {
      if (obj.$value) weights.push(String(obj.$value));
    } else {
      for (const [key, value] of Object.entries(obj)) {
        if (key.startsWith("$")) continue;
        traverse(value);
      }
    }
  }
  
  traverse(tokens);
  return { fonts, sizes, weights };
}

function colorDistance(color1: string, color2: string): number {
  const hex2rgb = (hex: string): [number, number, number] => {
    const clean = hex.replace("#", "");
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return [r, g, b];
  };
  
  try {
    const [r1, g1, b1] = hex2rgb(color1);
    const [r2, g2, b2] = hex2rgb(color2);
    return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
  } catch {
    return 999;
  }
}

function findClosestTokenColor(color: string, tokenColors: string[]): { color: string; distance: number } | null {
  if (tokenColors.length === 0) return null;
  
  let closest = tokenColors[0];
  let minDistance = colorDistance(color, tokenColors[0]);
  
  for (const tokenColor of tokenColors.slice(1)) {
    const dist = colorDistance(color, tokenColor);
    if (dist < minDistance) {
      minDistance = dist;
      closest = tokenColor;
    }
  }
  
  return { color: closest, distance: minDistance };
}

export async function auditScreenshot(
  imageBase64: string,
  styleTokens: Record<string, any>,
  styleName: string
): Promise<AuditResult> {
  const tokenColors = extractColorsFromTokens(styleTokens);
  const tokenTypography = extractTypographyFromTokens(styleTokens);
  
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: "image/png",
              data: imageBase64.replace(/^data:image\/\w+;base64,/, ""),
            },
          },
          {
            text: `You are a design system auditor. Analyze this UI screenshot against the "${styleName}" style guide.

The style guide defines these colors: ${tokenColors.slice(0, 10).join(", ")}
The style guide defines these fonts: ${tokenTypography.fonts.join(", ") || "system-ui"}

Analyze the screenshot for:
1. Color consistency - Are the colors used matching the style guide?
2. Typography consistency - Are fonts, sizes, and weights consistent?
3. Spacing consistency - Is spacing uniform and following a system?
4. Component consistency - Do similar elements look the same?

Return ONLY valid JSON (no markdown, no code blocks):
{
  "detectedColors": ["#hex1", "#hex2", ...],
  "detectedFonts": ["Font Name 1", "Font Name 2"],
  "colorInconsistencies": [
    {
      "detected": "#hexcolor",
      "expected": "#hexcolor",
      "location": "Header background",
      "severity": "high|medium|low",
      "suggestion": "Use the primary color from the style guide"
    }
  ],
  "typographyInconsistencies": [
    {
      "detected": "14px Arial",
      "expected": "16px Inter",
      "location": "Body text",
      "severity": "medium",
      "suggestion": "Use the body font from the style guide"
    }
  ],
  "spacingInconsistencies": [
    {
      "detected": "12px",
      "expected": "16px (4px base unit)",
      "location": "Card padding",
      "severity": "low",
      "suggestion": "Use consistent 4px-based spacing"
    }
  ],
  "componentInconsistencies": [
    {
      "component": "Button",
      "issue": "Different border radius on similar buttons",
      "severity": "medium",
      "suggestion": "Standardize button border radius to 8px"
    }
  ],
  "suggestions": [
    "Overall improvement suggestion 1",
    "Overall improvement suggestion 2"
  ],
  "summary": "2-3 sentence summary of the audit findings",
  "colorScore": 85,
  "typographyScore": 90,
  "spacingScore": 75,
  "consistencyScore": 80
}

Be specific about locations and provide actionable suggestions. Scores are 0-100.`,
          },
        ],
      },
    ],
  });

  let responseText = "";
  const candidates = response.candidates;
  if (candidates && candidates.length > 0) {
    const parts = candidates[0]?.content?.parts;
    if (parts && parts.length > 0) {
      responseText = (parts[0] as { text?: string })?.text || "";
    }
  }

  const cleanedJson = responseText
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  let parsed: any;
  try {
    parsed = JSON.parse(cleanedJson);
  } catch (parseError) {
    console.error("[StyleAudit] JSON parse error:", parseError);
    console.error("[StyleAudit] Raw response:", responseText.slice(0, 500));
    parsed = {
      colorScore: 50,
      typographyScore: 50,
      spacingScore: 50,
      consistencyScore: 50,
      colorInconsistencies: [],
      typographyInconsistencies: [],
      spacingInconsistencies: [],
      componentInconsistencies: [],
      suggestions: ["Unable to fully parse AI response. Please try again."],
      summary: "Analysis completed with limited results due to parsing issues.",
      detectedColors: [],
      detectedFonts: [],
    };
  }
  
  const overallScore = Math.round(
    ((parsed.colorScore || 50) + (parsed.typographyScore || 50) + (parsed.spacingScore || 50) + (parsed.consistencyScore || 50)) / 4
  );

  return {
    overallScore,
    colorScore: parsed.colorScore || 50,
    typographyScore: parsed.typographyScore || 50,
    spacingScore: parsed.spacingScore || 50,
    consistencyScore: parsed.consistencyScore || 50,
    colorInconsistencies: Array.isArray(parsed.colorInconsistencies) ? parsed.colorInconsistencies : [],
    typographyInconsistencies: Array.isArray(parsed.typographyInconsistencies) ? parsed.typographyInconsistencies : [],
    spacingInconsistencies: Array.isArray(parsed.spacingInconsistencies) ? parsed.spacingInconsistencies : [],
    componentInconsistencies: Array.isArray(parsed.componentInconsistencies) ? parsed.componentInconsistencies : [],
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
    summary: parsed.summary || "Audit completed.",
    detectedColors: Array.isArray(parsed.detectedColors) ? parsed.detectedColors : [],
    detectedFonts: Array.isArray(parsed.detectedFonts) ? parsed.detectedFonts : [],
    analyzedAt: new Date().toISOString(),
  };
}

export async function auditCodeSnippet(
  code: string,
  styleTokens: Record<string, any>,
  styleName: string,
  fileType: "css" | "tailwind" | "jsx" | "tsx"
): Promise<CodebaseAuditResult> {
  const tokenColors = extractColorsFromTokens(styleTokens);
  
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `You are a code auditor checking for design token usage consistency.

Analyze this ${fileType} code against the "${styleName}" style guide:

\`\`\`${fileType}
${code.slice(0, 5000)}
\`\`\`

The style guide defines these color tokens: ${tokenColors.slice(0, 10).join(", ")}

Find:
1. Hardcoded color values that should use tokens
2. Hardcoded spacing values that could use a spacing scale
3. Hardcoded font values that should use typography tokens
4. Inconsistent patterns or values

Return ONLY valid JSON:
{
  "tokenUsage": {
    "used": ["--color-primary", "text-primary"],
    "unused": ["--color-accent"],
    "undefined": ["#ff0000 (line 15)"]
  },
  "hardcodedValues": [
    {
      "type": "color",
      "value": "#ff0000",
      "file": "component.tsx",
      "line": 15,
      "suggestion": "Use var(--color-primary) or the primary color token"
    }
  ],
  "inconsistencies": [
    {
      "type": "spacing",
      "description": "Mixed spacing values: 12px, 15px, 18px",
      "files": ["component.tsx"],
      "suggestion": "Use 8px base spacing: 8px, 16px, 24px"
    }
  ],
  "overallScore": 75,
  "summary": "Brief summary of code audit findings"
}`,
          },
        ],
      },
    ],
  });

  let responseText = "";
  const candidates = response.candidates;
  if (candidates && candidates.length > 0) {
    const parts = candidates[0]?.content?.parts;
    if (parts && parts.length > 0) {
      responseText = (parts[0] as { text?: string })?.text || "";
    }
  }

  const cleanedJson = responseText
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  let parsed: any;
  try {
    parsed = JSON.parse(cleanedJson);
  } catch (parseError) {
    console.error("[StyleAudit] Code audit JSON parse error:", parseError);
    console.error("[StyleAudit] Raw response:", responseText.slice(0, 500));
    parsed = {
      overallScore: 50,
      tokenUsage: { used: [], unused: [], undefined: [] },
      hardcodedValues: [],
      inconsistencies: [],
      summary: "Code analysis completed with limited results due to parsing issues.",
    };
  }

  return {
    overallScore: parsed.overallScore || 50,
    tokenUsage: parsed.tokenUsage || { used: [], unused: [], undefined: [] },
    hardcodedValues: Array.isArray(parsed.hardcodedValues) ? parsed.hardcodedValues : [],
    inconsistencies: Array.isArray(parsed.inconsistencies) ? parsed.inconsistencies : [],
    summary: parsed.summary || "Code audit completed.",
  };
}

export async function generateAuditReport(
  auditResult: AuditResult,
  styleName: string
): Promise<string> {
  const totalIssues = 
    auditResult.colorInconsistencies.length +
    auditResult.typographyInconsistencies.length +
    auditResult.spacingInconsistencies.length +
    auditResult.componentInconsistencies.length;

  const highSeverityCount = [
    ...auditResult.colorInconsistencies,
    ...auditResult.typographyInconsistencies,
    ...auditResult.spacingInconsistencies,
    ...auditResult.componentInconsistencies,
  ].filter(i => i.severity === "high").length;

  return `# Style Audit Report: ${styleName}

## Overview
- **Overall Score:** ${auditResult.overallScore}/100
- **Total Issues Found:** ${totalIssues}
- **High Severity Issues:** ${highSeverityCount}
- **Analyzed:** ${new Date(auditResult.analyzedAt).toLocaleString()}

## Scores Breakdown
| Category | Score |
|----------|-------|
| Colors | ${auditResult.colorScore}/100 |
| Typography | ${auditResult.typographyScore}/100 |
| Spacing | ${auditResult.spacingScore}/100 |
| Consistency | ${auditResult.consistencyScore}/100 |

## Summary
${auditResult.summary}

## Color Issues (${auditResult.colorInconsistencies.length})
${auditResult.colorInconsistencies.map(i => 
  `- **${i.severity.toUpperCase()}** at ${i.location}: Found ${i.detected}, expected ${i.expected}\n  - ${i.suggestion}`
).join("\n") || "No color issues found."}

## Typography Issues (${auditResult.typographyInconsistencies.length})
${auditResult.typographyInconsistencies.map(i => 
  `- **${i.severity.toUpperCase()}** at ${i.location}: Found ${i.detected}, expected ${i.expected}\n  - ${i.suggestion}`
).join("\n") || "No typography issues found."}

## Spacing Issues (${auditResult.spacingInconsistencies.length})
${auditResult.spacingInconsistencies.map(i => 
  `- **${i.severity.toUpperCase()}** at ${i.location}: Found ${i.detected}, expected ${i.expected}\n  - ${i.suggestion}`
).join("\n") || "No spacing issues found."}

## Component Issues (${auditResult.componentInconsistencies.length})
${auditResult.componentInconsistencies.map(i => 
  `- **${i.severity.toUpperCase()}** ${i.component}: ${i.issue}\n  - ${i.suggestion}`
).join("\n") || "No component issues found."}

## Recommendations
${auditResult.suggestions.map((s, i) => `${i + 1}. ${s}`).join("\n")}

---
*Generated by Visual DNA Style Audit*
`;
}

export function calculateAuditScore(result: AuditResult): { grade: string; label: string; color: string } {
  const score = result.overallScore;
  
  if (score >= 90) return { grade: "A", label: "Excellent", color: "#22c55e" };
  if (score >= 80) return { grade: "B", label: "Good", color: "#84cc16" };
  if (score >= 70) return { grade: "C", label: "Fair", color: "#eab308" };
  if (score >= 60) return { grade: "D", label: "Needs Work", color: "#f97316" };
  return { grade: "F", label: "Poor", color: "#ef4444" };
}
