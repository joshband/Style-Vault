import { storage } from "./storage";
import { generateCanonicalPreviewsWithProdia, generateMoodBoardWithProdia, generateUiConceptsWithProdia } from "./prodia-generation";
import { extractTokensWithCV } from "./cv-bridge";
import { enrichStyleMetadata } from "./metadata-enrichment";

async function regenerateAllStyles() {
  console.log("[Regeneration] Starting bulk regeneration of all styles...");
  
  const allStyleIds = await storage.getAllStyleIds();
  console.log(`[Regeneration] Found ${allStyleIds.length} styles to process`);
  
  const styles = await storage.getStylesByIds(allStyleIds);
  const eligibleStyles = styles.filter(s => s.referenceImages && (s.referenceImages as string[]).length > 0);
  
  console.log(`[Regeneration] ${eligibleStyles.length} styles have reference images`);
  
  for (let i = 0; i < eligibleStyles.length; i++) {
    const style = eligibleStyles[i];
    console.log(`\n[Regeneration] Processing ${i + 1}/${eligibleStyles.length}: ${style.name}`);
    
    try {
      const refImage = (style.referenceImages as string[])[0];
      const description = style.description || style.name;
      
      // 1. Token extraction
      console.log(`  - Extracting tokens...`);
      const tokenResult = await extractTokensWithCV(refImage, false);
      if (tokenResult.success && tokenResult.tokens) {
        await storage.updateStyleFull(style.id, { tokens: tokenResult.tokens as any });
        console.log(`  - Tokens extracted (${tokenResult.processingTimeMs}ms)`);
      }
      
      // 2. Generate previews (portrait, landscape, still life)
      console.log(`  - Generating previews...`);
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
      console.log(`  - Previews generated (${previewResult.processingTimeMs}ms)`);
      
      // 3. Generate mood board
      console.log(`  - Generating mood board...`);
      const moodResult = await generateMoodBoardWithProdia({ 
        styleName: style.name, 
        styleDescription: description,
        tokens: style.tokens as any 
      });
      
      // 4. Generate UI concepts
      console.log(`  - Generating UI concepts...`);
      const uiResult = await generateUiConceptsWithProdia({ 
        styleName: style.name, 
        styleDescription: description,
        tokens: style.tokens as any 
      });
      
      // Update mood board and UI concepts together
      const moodBoardAssets = { collage: moodResult.collage ? `data:image/png;base64,${moodResult.collage}` : undefined };
      const uiConceptAssets = {
        softwareApp: uiResult.softwareApp ? `data:image/png;base64,${uiResult.softwareApp}` : undefined,
        audioPlugin: uiResult.audioPlugin ? `data:image/png;base64,${uiResult.audioPlugin}` : undefined,
        dashboard: uiResult.dashboard ? `data:image/png;base64,${uiResult.dashboard}` : undefined,
      };
      
      await storage.updateStyleMoodBoard(style.id, moodBoardAssets as any, uiConceptAssets as any);
      console.log(`  - Mood board and UI concepts generated`);
      
      // 5. Metadata enrichment
      console.log(`  - Enriching metadata...`);
      await enrichStyleMetadata(style.id);
      console.log(`  - Metadata enriched`);
      
      console.log(`  ✓ Style "${style.name}" complete`);
      
    } catch (error) {
      console.error(`  ✗ Error processing style ${style.name}:`, error);
    }
    
    // Small delay between styles to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`\n[Regeneration] Bulk regeneration complete!`);
}

regenerateAllStyles().catch(console.error);
