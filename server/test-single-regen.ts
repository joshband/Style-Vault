import { storage } from "./storage";
import { generateCanonicalPreviewsWithProdia, generateMoodBoardWithProdia, generateUiConceptsWithProdia } from "./prodia-generation";
import { extractTokensWithCV } from "./cv-bridge";
import { enrichStyleMetadata } from "./metadata-enrichment";

async function regenerateSingleStyle() {
  console.log("[Test] Starting single style regeneration...\n");
  
  const allStyleIds = await storage.getAllStyleIds();
  const styles = await storage.getStylesByIds([allStyleIds[0]]);
  const style = styles[0];
  
  if (!style || !style.referenceImages || (style.referenceImages as string[]).length === 0) {
    console.log("No eligible style found");
    return;
  }
  
  console.log(`Style: ${style.name}`);
  console.log(`ID: ${style.id}`);
  const refImage = (style.referenceImages as string[])[0];
  const description = style.description || style.name;
  
  console.log("\n--- Step 1: Token Extraction (CV) ---");
  const startTokens = Date.now();
  const tokenResult = await extractTokensWithCV(refImage, false);
  if (tokenResult.success && tokenResult.tokens) {
    await storage.updateStyleFull(style.id, { tokens: tokenResult.tokens as any });
    console.log(`✓ Tokens extracted in ${Date.now() - startTokens}ms`);
    console.log(`  Colors: ${tokenResult.tokens.colors?.length || 0} extracted`);
  } else {
    console.log(`✗ Token extraction failed: ${tokenResult.error}`);
  }
  
  console.log("\n--- Step 2: Preview Generation (Prodia) ---");
  const startPreviews = Date.now();
  const previewResult = await generateCanonicalPreviewsWithProdia({ 
    styleName: style.name, 
    styleDescription: description,
    tokens: style.tokens as any 
  });
  
  const previews = {
    portrait: previewResult.portrait ? `data:image/png;base64,${previewResult.portrait}` : undefined,
    landscape: previewResult.landscape ? `data:image/png;base64,${previewResult.landscape}` : undefined,
    stillLife: previewResult.stillLife ? `data:image/png;base64,${previewResult.stillLife}` : undefined,
  };
  await storage.updateStyleFull(style.id, { previews: previews as any });
  console.log(`✓ Previews generated in ${Date.now() - startPreviews}ms`);
  console.log(`  Portrait: ${previewResult.portrait ? 'OK' : 'FAILED'}`);
  console.log(`  Landscape: ${previewResult.landscape ? 'OK' : 'FAILED'}`);
  console.log(`  Still Life: ${previewResult.stillLife ? 'OK' : 'FAILED'}`);
  
  console.log("\n--- Step 3: Mood Board Generation (Prodia) ---");
  const startMood = Date.now();
  const moodResult = await generateMoodBoardWithProdia({ 
    styleName: style.name, 
    styleDescription: description,
    tokens: style.tokens as any 
  });
  console.log(`✓ Mood board generated in ${Date.now() - startMood}ms`);
  console.log(`  Collage: ${moodResult.collage ? 'OK' : 'FAILED'}`);
  
  console.log("\n--- Step 4: UI Concepts Generation (Prodia) ---");
  const startUI = Date.now();
  const uiResult = await generateUiConceptsWithProdia({ 
    styleName: style.name, 
    styleDescription: description,
    tokens: style.tokens as any 
  });
  
  const moodBoardAssets = { collage: moodResult.collage ? `data:image/png;base64,${moodResult.collage}` : undefined };
  const uiConceptAssets = {
    softwareApp: uiResult.softwareApp ? `data:image/png;base64,${uiResult.softwareApp}` : undefined,
    audioPlugin: uiResult.audioPlugin ? `data:image/png;base64,${uiResult.audioPlugin}` : undefined,
    dashboard: uiResult.dashboard ? `data:image/png;base64,${uiResult.dashboard}` : undefined,
  };
  
  await storage.updateStyleMoodBoard(style.id, moodBoardAssets as any, uiConceptAssets as any);
  console.log(`✓ UI concepts generated in ${Date.now() - startUI}ms`);
  console.log(`  Software App: ${uiResult.softwareApp ? 'OK' : 'FAILED'}`);
  console.log(`  Audio Plugin: ${uiResult.audioPlugin ? 'OK' : 'FAILED'}`);
  console.log(`  Dashboard: ${uiResult.dashboard ? 'OK' : 'FAILED'}`);
  
  console.log("\n--- Step 5: Metadata Enrichment (Gemini AI) ---");
  const startEnrich = Date.now();
  const enrichSuccess = await enrichStyleMetadata(style.id);
  console.log(`${enrichSuccess ? '✓' : '✗'} Metadata enrichment ${enrichSuccess ? 'complete' : 'failed'} in ${Date.now() - startEnrich}ms`);
  
  console.log("\n========================================");
  console.log(`✓ Single style regeneration complete!`);
  console.log(`  Style: ${style.name}`);
  console.log("========================================");
}

regenerateSingleStyle().catch(console.error);
