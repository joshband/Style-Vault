
const { execSync } = require('child_process');

const files = [
  "client/src/lib/token-importers.ts",
  "client/src/lib/token-exporters.ts",
  "client/src/lib/exporters/index.ts",
  "client/src/lib/exporters/figma-variables.ts",
  "client/src/components/token-viewer.tsx",
  "client/src/pages/SavedStyles.tsx",
  "client/src/components/style-filters.tsx",
  "client/src/components/style-card.tsx",
  "client/src/components/style-card-skeleton.tsx",
  "client/src/components/lazy-image.tsx",
  "client/src/pages/Inspect.tsx",
  "client/src/components/layout.tsx",
  "client/src/components/export-dialog.tsx",
  "client/src/components/deploy-dialog.tsx",
  "client/src/components/color-palette-swatches.tsx",
  "client/src/pages/Explore.tsx",
  "client/src/pages/Author.tsx",
  "server/token-cache.ts",
  "server/remix.ts",
  "server/preview-generation.ts",
  "server/metadata-enrichment.ts",
  "server/object-image-service.ts",
  "server/mood-board-generation.ts",
  "server/job-runner.ts",
  "server/image-service.ts",
  "server/cv-bridge.ts",
  "server/background-worker.ts",
  "uv.lock",
  "pyproject.toml"
];

files.forEach(file => {
  try {
    console.log(`Restoring ${file}...`);
    // Check if file exists in HEAD first to avoid errors if it's a new file in 'theirs'
    // But these are "both added" or "both modified", so they should exist in HEAD.
    execSync(`git show HEAD:"${file}" > "${file}"`);
  } catch (err) {
    console.error(`Error restoring ${file}:`, err.message);
  }
});
