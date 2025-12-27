import jsPDF from "jspdf";
import type { DTCGTokenGroup, DesignToken } from "@/lib/store";

interface StyleData {
  name: string;
  description: string;
  tokens: DTCGTokenGroup;
  metadataTags?: {
    mood?: string[];
    colorFamily?: string[];
  };
}

function isToken(n: unknown): n is DesignToken {
  return n !== null && typeof n === "object" && "$value" in n && "$type" in n;
}

function oklchToRgb(oklch: string): { r: number; g: number; b: number } {
  const match = oklch.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
  if (!match) return { r: 128, g: 128, b: 128 };
  
  const [, L, C, H] = match.map(Number);
  const l = L;
  const c = C;
  const h = (H * Math.PI) / 180;
  
  const a_ = c * Math.cos(h);
  const b_ = c * Math.sin(h);
  
  const L_ = l + 0.3963377774 * a_ + 0.2158037573 * b_;
  const M_ = l - 0.1055613458 * a_ - 0.0638541728 * b_;
  const S_ = l - 0.0894841775 * a_ - 1.2914855480 * b_;
  
  const L3 = L_ * L_ * L_;
  const M3 = M_ * M_ * M_;
  const S3 = S_ * S_ * S_;
  
  let r = +4.0767416621 * L3 - 3.3077115913 * M3 + 0.2309699292 * S3;
  let g = -1.2684380046 * L3 + 2.6097574011 * M3 - 0.3413193965 * S3;
  let b = -0.0041960863 * L3 - 0.7034186147 * M3 + 1.7076147010 * S3;
  
  const toSrgb = (x: number) => {
    if (x <= 0.0031308) return x * 12.92;
    return 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
  };
  
  return {
    r: Math.round(Math.max(0, Math.min(1, toSrgb(r))) * 255),
    g: Math.round(Math.max(0, Math.min(1, toSrgb(g))) * 255),
    b: Math.round(Math.max(0, Math.min(1, toSrgb(b))) * 255),
  };
}

function resolveAlias(aliasValue: string, tokens: DTCGTokenGroup, maxDepth = 10): string | null {
  if (maxDepth <= 0) return null;
  
  const match = aliasValue.match(/^\{(.+)\}$/);
  if (!match) return null;
  
  const path = match[1].split(".");
  let current: unknown = tokens;
  
  for (const segment of path) {
    if (current && typeof current === "object" && segment in current) {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return null;
    }
  }
  
  if (isToken(current)) {
    const value = String(current.$value);
    if (value.startsWith("{")) {
      return resolveAlias(value, tokens, maxDepth - 1);
    }
    return value;
  }
  return null;
}

function colorToRgb(color: string, tokens?: DTCGTokenGroup): { r: number; g: number; b: number } {
  if (color.startsWith("{") && tokens) {
    const resolved = resolveAlias(color, tokens);
    if (resolved) {
      return colorToRgb(resolved, tokens);
    }
  }
  if (color.startsWith("oklch")) {
    return oklchToRgb(color);
  }
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    return {
      r: parseInt(hex.substring(0, 2), 16),
      g: parseInt(hex.substring(2, 4), 16),
      b: parseInt(hex.substring(4, 6), 16),
    };
  }
  return { r: 128, g: 128, b: 128 };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`.toUpperCase();
}

function extractColors(tokens: DTCGTokenGroup): { name: string; value: string; rgb: { r: number; g: number; b: number } }[] {
  const colors: { name: string; value: string; rgb: { r: number; g: number; b: number } }[] = [];
  const colorGroup = tokens.color;
  if (!colorGroup || typeof colorGroup !== "object") return colors;
  
  const processEntry = (key: string, value: unknown, prefix = "") => {
    const fullName = prefix ? `${prefix}.${key}` : key;
    if (isToken(value) && value.$type === "color") {
      const colorValue = String(value.$value);
      const rgb = colorToRgb(colorValue, tokens);
      colors.push({ name: fullName, value: colorValue, rgb });
    } else if (typeof value === "object" && value !== null && !isToken(value)) {
      for (const [subKey, subValue] of Object.entries(value)) {
        processEntry(subKey, subValue, fullName);
      }
    }
  };
  
  for (const [key, value] of Object.entries(colorGroup)) {
    processEntry(key, value);
  }
  
  return colors;
}

function extractTypography(tokens: DTCGTokenGroup): { fontFamily: string; sizes: { name: string; value: string }[] } {
  const typography = tokens.typography;
  if (!typography || typeof typography !== "object") {
    return { fontFamily: "Helvetica", sizes: [] };
  }
  
  let fontFamily = "Helvetica";
  const sizes: { name: string; value: string }[] = [];
  
  const fontFamilyGroup = (typography as Record<string, unknown>).fontFamily;
  if (fontFamilyGroup && typeof fontFamilyGroup === "object") {
    const sans = (fontFamilyGroup as Record<string, unknown>).sans;
    if (isToken(sans) && sans.$type === "fontFamily") {
      fontFamily = String(sans.$value).split(",")[0].trim().replace(/["']/g, "");
    }
  }
  
  const fontSizeGroup = (typography as Record<string, unknown>).fontSize;
  if (fontSizeGroup && typeof fontSizeGroup === "object") {
    for (const [key, value] of Object.entries(fontSizeGroup)) {
      if (isToken(value) && value.$type === "dimension") {
        sizes.push({ name: key, value: String(value.$value) });
      }
    }
  }
  
  return { fontFamily, sizes };
}

function extractSpacing(tokens: DTCGTokenGroup): { name: string; value: string }[] {
  const spacing = tokens.spacing;
  if (!spacing || typeof spacing !== "object") return [];
  
  const values: { name: string; value: string; numKey: number }[] = [];
  
  for (const [key, value] of Object.entries(spacing)) {
    if (isToken(value) && value.$type === "dimension") {
      const numKey = parseInt(key, 10);
      values.push({ name: key, value: String(value.$value), numKey: isNaN(numKey) ? 999 : numKey });
    }
  }
  
  return values.sort((a, b) => a.numKey - b.numKey);
}

function extractBorderRadius(tokens: DTCGTokenGroup): { name: string; value: string }[] {
  const borderRadius = tokens.borderRadius;
  if (!borderRadius || typeof borderRadius !== "object") return [];
  
  const values: { name: string; value: string }[] = [];
  
  for (const [key, value] of Object.entries(borderRadius)) {
    if (isToken(value) && value.$type === "dimension") {
      values.push({ name: key, value: String(value.$value) });
    }
  }
  
  return values;
}

export async function generateBrandKitPDF(style: StyleData): Promise<void> {
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });
  
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;
  
  const colors = extractColors(style.tokens);
  const typography = extractTypography(style.tokens);
  const spacing = extractSpacing(style.tokens);
  const borderRadius = extractBorderRadius(style.tokens);
  
  const primaryColor = colors.find(c => c.name === "primary")?.rgb || { r: 59, g: 130, b: 246 };
  const secondaryColor = colors.find(c => c.name === "secondary")?.rgb || { r: 100, g: 116, b: 139 };
  
  pdf.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
  pdf.rect(0, 0, pageWidth, 45, "F");
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(28);
  pdf.setFont("helvetica", "bold");
  pdf.text(style.name, margin, 25);
  
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "normal");
  const descLines = pdf.splitTextToSize(style.description, contentWidth);
  pdf.text(descLines.slice(0, 2), margin, 35);
  
  y = 55;
  
  pdf.setFontSize(8);
  pdf.setTextColor(150, 150, 150);
  pdf.text("BRAND KIT", margin, y);
  pdf.text(`Generated ${new Date().toLocaleDateString()}`, pageWidth - margin, y, { align: "right" });
  y += 10;
  
  pdf.setTextColor(30, 30, 30);
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text("Color Palette", margin, y);
  y += 8;
  
  const swatchSize = 18;
  const swatchGap = 4;
  const swatchesPerRow = Math.floor((contentWidth + swatchGap) / (swatchSize + swatchGap));
  
  colors.slice(0, 12).forEach((color, i) => {
    const col = i % swatchesPerRow;
    const row = Math.floor(i / swatchesPerRow);
    const x = margin + col * (swatchSize + swatchGap);
    const swatchY = y + row * (swatchSize + 14);
    
    pdf.setFillColor(color.rgb.r, color.rgb.g, color.rgb.b);
    pdf.roundedRect(x, swatchY, swatchSize, swatchSize, 2, 2, "F");
    
    pdf.setFontSize(7);
    pdf.setTextColor(80, 80, 80);
    pdf.text(color.name.split(".").pop() || color.name, x, swatchY + swatchSize + 4);
    
    pdf.setFontSize(6);
    pdf.setTextColor(120, 120, 120);
    const hex = rgbToHex(color.rgb.r, color.rgb.g, color.rgb.b);
    pdf.text(hex, x, swatchY + swatchSize + 8);
  });
  
  const colorRows = Math.ceil(Math.min(colors.length, 12) / swatchesPerRow);
  y += colorRows * (swatchSize + 14) + 10;
  
  if (y > pageHeight - 80) {
    pdf.addPage();
    y = margin;
  }
  
  pdf.setTextColor(30, 30, 30);
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text("Typography", margin, y);
  y += 10;
  
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(80, 80, 80);
  pdf.text(`Font Family: ${typography.fontFamily}`, margin, y);
  y += 8;
  
  const typeSamples = [
    { label: "Heading 1", size: 24, weight: "bold" },
    { label: "Heading 2", size: 18, weight: "bold" },
    { label: "Body Text", size: 12, weight: "normal" },
    { label: "Caption", size: 9, weight: "normal" },
  ];
  
  typeSamples.forEach(sample => {
    pdf.setFontSize(sample.size);
    pdf.setFont("helvetica", sample.weight as "normal" | "bold");
    pdf.setTextColor(30, 30, 30);
    pdf.text(sample.label, margin, y);
    
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(120, 120, 120);
    pdf.text(`${sample.size}pt`, margin + 60, y);
    
    y += sample.size * 0.5 + 6;
  });
  
  y += 10;
  
  if (y > pageHeight - 60) {
    pdf.addPage();
    y = margin;
  }
  
  pdf.setTextColor(30, 30, 30);
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text("Spacing Scale", margin, y);
  y += 10;
  
  const maxSpacingWidth = 60;
  spacing.slice(0, 8).forEach((sp) => {
    const numValue = parseInt(sp.value) || 4;
    const barWidth = Math.min(numValue * 1.5, maxSpacingWidth);
    
    pdf.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b, 0.3);
    pdf.setFillColor(
      Math.min(255, primaryColor.r + 100),
      Math.min(255, primaryColor.g + 100),
      Math.min(255, primaryColor.b + 100)
    );
    pdf.rect(margin, y, barWidth, 6, "F");
    
    pdf.setFontSize(8);
    pdf.setTextColor(80, 80, 80);
    pdf.text(sp.name, margin + barWidth + 4, y + 4.5);
    pdf.setTextColor(120, 120, 120);
    pdf.text(sp.value, margin + barWidth + 20, y + 4.5);
    
    y += 10;
  });
  
  y += 10;
  
  if (borderRadius.length > 0 && y < pageHeight - 40) {
    pdf.setTextColor(30, 30, 30);
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("Border Radius", margin, y);
    y += 10;
    
    borderRadius.slice(0, 6).forEach((br, i) => {
      const x = margin + i * 28;
      
      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(0.5);
      const radius = Math.min(parseInt(br.value) || 0, 8);
      pdf.roundedRect(x, y, 20, 20, radius, radius, "S");
      
      pdf.setFontSize(6);
      pdf.setTextColor(80, 80, 80);
      pdf.text(br.name, x, y + 26);
      pdf.setTextColor(120, 120, 120);
      pdf.text(br.value, x, y + 30);
    });
    
    y += 40;
  }
  
  pdf.addPage();
  y = margin;
  
  pdf.setTextColor(30, 30, 30);
  pdf.setFontSize(18);
  pdf.setFont("helvetica", "bold");
  pdf.text("Application Examples", margin, y);
  y += 15;
  
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  pdf.text("Business Card", margin, y);
  y += 5;
  
  const cardWidth = 85;
  const cardHeight = 50;
  
  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(220, 220, 220);
  pdf.roundedRect(margin, y, cardWidth, cardHeight, 2, 2, "FD");
  
  pdf.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
  pdf.rect(margin, y, cardWidth, 12, "F");
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.text("Jane Smith", margin + 5, y + 8);
  
  pdf.setTextColor(80, 80, 80);
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.text("Creative Director", margin + 5, y + 20);
  pdf.text("hello@company.com", margin + 5, y + 26);
  pdf.text("+1 (555) 123-4567", margin + 5, y + 32);
  
  pdf.setFillColor(secondaryColor.r, secondaryColor.g, secondaryColor.b);
  pdf.circle(margin + cardWidth - 12, y + cardHeight - 12, 6, "F");
  
  y += cardHeight + 20;
  
  pdf.setTextColor(30, 30, 30);
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  pdf.text("Social Media Post", margin, y);
  y += 5;
  
  const postWidth = 80;
  const postHeight = 80;
  
  pdf.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
  pdf.roundedRect(margin, y, postWidth, postHeight, 3, 3, "F");
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  const postTitle = "Your Brand Story";
  pdf.text(postTitle, margin + postWidth / 2, y + 30, { align: "center" });
  
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.text("Crafted with passion", margin + postWidth / 2, y + 40, { align: "center" });
  
  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(margin + postWidth / 2 - 15, y + 55, 30, 10, 2, 2, "F");
  pdf.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
  pdf.setFontSize(7);
  pdf.text("Learn More", margin + postWidth / 2, y + 61.5, { align: "center" });
  
  const heroX = margin + postWidth + 15;
  
  pdf.setTextColor(30, 30, 30);
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  pdf.text("Website Hero", heroX, y - 5);
  
  const heroWidth = 75;
  const heroHeight = 50;
  
  pdf.setFillColor(245, 245, 245);
  pdf.setDrawColor(220, 220, 220);
  pdf.roundedRect(heroX, y, heroWidth, heroHeight, 2, 2, "FD");
  
  pdf.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
  pdf.rect(heroX, y, heroWidth, 8, "F");
  
  pdf.setFillColor(255, 255, 255);
  [10, 20, 30, 40].forEach(offset => {
    pdf.circle(heroX + offset, y + 4, 2, "F");
  });
  
  pdf.setTextColor(30, 30, 30);
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.text("Welcome to Brand", heroX + 5, y + 20);
  
  pdf.setFontSize(6);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(100, 100, 100);
  pdf.text("Building the future together", heroX + 5, y + 26);
  
  pdf.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
  pdf.roundedRect(heroX + 5, y + 32, 25, 8, 2, 2, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(6);
  pdf.text("Get Started", heroX + 8, y + 37.5);
  
  y += postHeight + 20;
  
  pdf.setTextColor(30, 30, 30);
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  pdf.text("Mobile App UI", margin, y);
  y += 5;
  
  const phoneWidth = 45;
  const phoneHeight = 90;
  
  pdf.setFillColor(30, 30, 30);
  pdf.roundedRect(margin, y, phoneWidth, phoneHeight, 5, 5, "F");
  
  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(margin + 2, y + 2, phoneWidth - 4, phoneHeight - 4, 4, 4, "F");
  
  pdf.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
  pdf.rect(margin + 2, y + 2, phoneWidth - 4, 15, "F");
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "bold");
  pdf.text("Dashboard", margin + phoneWidth / 2, y + 11, { align: "center" });
  
  pdf.setFillColor(245, 245, 245);
  pdf.roundedRect(margin + 5, y + 22, phoneWidth - 10, 12, 2, 2, "F");
  pdf.roundedRect(margin + 5, y + 38, phoneWidth - 10, 12, 2, 2, "F");
  pdf.roundedRect(margin + 5, y + 54, phoneWidth - 10, 12, 2, 2, "F");
  
  pdf.setTextColor(80, 80, 80);
  pdf.setFontSize(6);
  pdf.text("Overview", margin + 8, y + 29);
  pdf.text("Analytics", margin + 8, y + 45);
  pdf.text("Settings", margin + 8, y + 61);
  
  pdf.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
  pdf.roundedRect(margin + 5, y + 72, phoneWidth - 10, 10, 2, 2, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(6);
  pdf.text("Create New", margin + phoneWidth / 2, y + 78.5, { align: "center" });
  
  y += phoneHeight + 15;
  
  pdf.setFontSize(8);
  pdf.setTextColor(150, 150, 150);
  pdf.text(`${style.name} Brand Kit`, margin, pageHeight - 15);
  pdf.text("Generated by Visual DNA Studio", pageWidth - margin, pageHeight - 15, { align: "right" });
  
  pdf.save(`${style.name.replace(/\s+/g, "-").toLowerCase()}-brand-kit.pdf`);
}
