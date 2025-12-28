export const mockDTCGTokens = {
  color: {
    primary: {
      base: {
        $type: "color",
        $value: "oklch(0.65 0.18 250)",
        $description: "Primary brand color",
      },
      light: {
        $type: "color",
        $value: "oklch(0.85 0.12 250)",
        $description: "Light variant of primary",
      },
      dark: {
        $type: "color",
        $value: "oklch(0.45 0.18 250)",
        $description: "Dark variant of primary",
      },
    },
    secondary: {
      base: {
        $type: "color",
        $value: "oklch(0.70 0.15 120)",
        $description: "Secondary brand color",
      },
    },
    neutral: {
      "50": {
        $type: "color",
        $value: "oklch(0.98 0.01 250)",
        $description: "Lightest neutral",
      },
      "100": {
        $type: "color",
        $value: "oklch(0.95 0.01 250)",
        $description: "Very light neutral",
      },
      "900": {
        $type: "color",
        $value: "oklch(0.15 0.02 250)",
        $description: "Darkest neutral",
      },
    },
    semantic: {
      background: {
        $type: "color",
        $value: "{color.neutral.50}",
        $description: "Page background",
      },
      text: {
        $type: "color",
        $value: "{color.neutral.900}",
        $description: "Primary text color",
      },
    },
  },
  spacing: {
    xs: {
      $type: "dimension",
      $value: "4px",
      $description: "Extra small spacing",
    },
    sm: {
      $type: "dimension",
      $value: "8px",
      $description: "Small spacing",
    },
    md: {
      $type: "dimension",
      $value: "16px",
      $description: "Medium spacing",
    },
    lg: {
      $type: "dimension",
      $value: "24px",
      $description: "Large spacing",
    },
    xl: {
      $type: "dimension",
      $value: "32px",
      $description: "Extra large spacing",
    },
  },
  typography: {
    fontFamily: {
      heading: {
        $type: "fontFamily",
        $value: ["Inter", "system-ui", "sans-serif"],
        $description: "Heading font family",
      },
      body: {
        $type: "fontFamily",
        $value: ["Inter", "system-ui", "sans-serif"],
        $description: "Body text font family",
      },
    },
    fontSize: {
      xs: {
        $type: "dimension",
        $value: "12px",
      },
      sm: {
        $type: "dimension",
        $value: "14px",
      },
      base: {
        $type: "dimension",
        $value: "16px",
      },
      lg: {
        $type: "dimension",
        $value: "18px",
      },
      xl: {
        $type: "dimension",
        $value: "20px",
      },
      "2xl": {
        $type: "dimension",
        $value: "24px",
      },
    },
    fontWeight: {
      normal: {
        $type: "fontWeight",
        $value: 400,
      },
      medium: {
        $type: "fontWeight",
        $value: 500,
      },
      bold: {
        $type: "fontWeight",
        $value: 700,
      },
    },
  },
  radius: {
    sm: {
      $type: "dimension",
      $value: "4px",
    },
    md: {
      $type: "dimension",
      $value: "8px",
    },
    lg: {
      $type: "dimension",
      $value: "12px",
    },
    full: {
      $type: "dimension",
      $value: "9999px",
    },
  },
  shadow: {
    sm: {
      $type: "shadow",
      $value: {
        offsetX: "0px",
        offsetY: "1px",
        blur: "2px",
        spread: "0px",
        color: "rgba(0, 0, 0, 0.05)",
      },
    },
    md: {
      $type: "shadow",
      $value: {
        offsetX: "0px",
        offsetY: "4px",
        blur: "6px",
        spread: "-1px",
        color: "rgba(0, 0, 0, 0.1)",
      },
    },
  },
};

export const mockStyleSummary = {
  id: "test-style-123",
  name: "Test Style",
  description: "A test style for unit testing",
  createdAt: new Date().toISOString(),
  tokens: mockDTCGTokens,
  referenceImages: [],
  metadataTags: {
    mood: ["modern", "professional"],
    colorFamily: ["blue"],
  },
  promptScaffolding: {
    positivePrompt: "modern, professional, blue tones",
    negativePrompt: "",
    styleModifiers: [],
  },
  shareCode: "ABC123",
  moodBoardStatus: "completed",
  uiConceptsStatus: "pending",
  styleSpec: null,
  updatedAt: null,
};
