import { db } from "../server/db";
import { styles } from "../shared/schema";
import { storeImageToObjectStorage } from "../server/object-image-service";
import { eq } from "drizzle-orm";
import * as fs from "fs";

const STYLE_ID = "22076530-40ae-4ab9-affb-2f5ae80be1a8";
const IMAGE_PATH = "attached_assets/flat_retro_audio_plugin_UI_2D_vintage_industrial_interface_to__1766963943625.png";

async function main() {
  console.log("Reading image...");
  const imageBuffer = fs.readFileSync(IMAGE_PATH);
  const base64Data = imageBuffer.toString("base64");
  
  console.log("Storing reference image to object storage...");
  const assetId = await storeImageToObjectStorage(base64Data, "reference", STYLE_ID);
  console.log("Created asset:", assetId);
  
  console.log("Updating style with retro industrial tokens...");
  const retroTokens = {
    color: {
      primary: { "$type": "color", "$value": "#E07B39", "$description": "Warm orange - dominant accent" },
      secondary: { "$type": "color", "$value": "#D4577B", "$description": "Dusty pink - secondary accent" },
      tertiary: { "$type": "color", "$value": "#E8C547", "$description": "Mustard yellow - highlights" },
      background: { "$type": "color", "$value": "#7DBAD0", "$description": "Retro sky blue - background" },
      surface: { "$type": "color", "$value": "#A8C9A3", "$description": "Sage green - panels" },
      accent: { "$type": "color", "$value": "#8B4D6B", "$description": "Plum - buttons" },
      neutral: { "$type": "color", "$value": "#B8956B", "$description": "Brass/bronze - metal accents" }
    },
    spacing: {
      xs: { "$type": "dimension", "$value": "4px" },
      sm: { "$type": "dimension", "$value": "8px" },
      md: { "$type": "dimension", "$value": "16px" },
      lg: { "$type": "dimension", "$value": "24px" },
      xl: { "$type": "dimension", "$value": "40px" }
    },
    typography: {
      fontFamily: { "$type": "fontFamily", "$value": ["Courier New", "monospace"] },
      fontSize: {
        label: { "$type": "dimension", "$value": "10px" },
        body: { "$type": "dimension", "$value": "14px" },
        heading: { "$type": "dimension", "$value": "18px" }
      }
    },
    borderRadius: {
      sm: { "$type": "dimension", "$value": "4px" },
      md: { "$type": "dimension", "$value": "8px" },
      full: { "$type": "dimension", "$value": "50%" }
    },
    effects: {
      metallic: { "$type": "color", "$value": "#8B7355", "$description": "Weathered bronze effect" },
      highlight: { "$type": "color", "$value": "#F5E6C8", "$description": "Cream highlight for gauges" }
    },
    version: "1.0.0",
    "$description": "Retro industrial audio plugin design tokens - vintage machinery aesthetic"
  };

  const retroMetadata = {
    mood: ["playful", "nostalgic", "industrial", "whimsical"],
    colorFamily: ["orange", "pink", "yellow", "teal", "sage"],
    lighting: ["diffused", "flat illustration"],
    texture: ["painted metal", "enamel", "brushed brass"],
    depth: ["flat 2D", "layered panels"],
    shadow: ["soft drop shadows", "subtle"],
    material: ["painted steel", "brass fittings", "bakelite"],
    atmosphere: ["workshop", "vintage factory"],
    environment: ["industrial", "analog studio"],
    era: ["1950s", "mid-century"],
    artPeriod: ["atomic age", "industrial design"],
    historicalInfluences: ["Bauhaus", "Soviet industrial", "Art Deco machinery"],
    similarArtists: ["Wes Anderson palette", "vintage scientific illustration"],
    medium: ["digital illustration", "vector art"],
    subjects: ["audio equipment", "gauges", "dials", "switches"],
    usageExamples: ["audio plugin UI", "music software", "retro games", "vintage apps"],
    narrativeTone: ["quirky", "mechanical", "crafted"],
    sensoryPalette: ["warm", "tactile", "analog"],
    movementRhythm: ["static", "industrial precision"],
    stylisticPrinciples: ["skeuomorphic", "illustrative", "dense layout"],
    signatureMotifs: ["VU meters", "knobs", "pipes", "pressure gauges"],
    contrastDynamics: ["colorful panels against blue"],
    psychologicalEffect: ["nostalgia", "curiosity", "playfulness"],
    culturalResonance: ["vintage audio", "maker culture", "steampunk-lite"],
    audiencePerception: ["creative", "unique", "artisanal"],
    keywords: ["retro", "vintage", "industrial", "audio plugin", "colorful", "analog", "gauges", "knobs"]
  };

  await db.update(styles)
    .set({
      name: "Retro Industrial Audio",
      description: "A vintage industrial aesthetic inspired by mid-century machinery, featuring colorful enamel panels, brass fittings, and analog gauges. Perfect for audio plugin UIs and retro-styled applications.",
      tokens: retroTokens,
      metadataTags: retroMetadata,
      referenceImages: [assetId]
    })
    .where(eq(styles.id, STYLE_ID));

  console.log("Style updated successfully!");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
