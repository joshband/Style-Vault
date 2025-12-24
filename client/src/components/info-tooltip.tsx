import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface InfoTooltipProps {
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
  testId?: string;
}

export function InfoTooltip({ children, side = "top", className, testId }: InfoTooltipProps) {
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors ${className}`}
          aria-label="More information"
          data-testid={testId || "button-info-tooltip"}
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs text-sm">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

export const FEATURE_EXPLANATIONS = {
  designTokens: "Design tokens are the visual DNA of a style - colors, typography, spacing, and effects stored in a portable W3C standard format that can be used across any design tool or codebase.",
  
  canonicalPreviews: "Three standardized preview images (portrait, landscape, still-life) generated using the same subjects. This makes it easy to compare different styles side-by-side.",
  
  moodBoard: "An AI-generated collection of images that showcase how this style applies to different subjects - from everyday objects to grand landscapes. New images are added over time.",
  
  uiConcepts: "Mockups showing how this visual style might look when applied to user interface designs like dashboards, cards, and buttons.",
  
  promptScaffolding: "Pre-built prompt templates derived from the style's tokens. Use these as starting points when generating new images to maintain consistent style application.",
  
  referenceImage: "Upload an image that inspires your style. Our AI will analyze it to extract colors, mood, and visual characteristics to build your design tokens.",
  
  styleCreation: "Creating a style involves: 1) Upload a reference image, 2) AI extracts design tokens, 3) Canonical previews are generated, 4) Style is saved to your vault.",
  
  enrichment: "Our AI analyzes styles to extract searchable tags like mood, era, art period, and similar artists. This happens automatically in the background.",
  
  visualDNA: "Deep subjective qualities that capture a style's essence - its emotional tone, cultural resonance, and the feelings it evokes in viewers.",
  
  generation: "Create new images by combining a style's visual characteristics with your own subject descriptions. The style's tokens guide the AI to maintain visual consistency.",
};
