export interface StyleHero {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt?: string;
  shareCode: string | null;
  moodBoardStatus: string;
  uiConceptsStatus: string;
  creatorId: string | null;
  creatorName: string | null;
  isPublic: boolean;
}

export interface StyleTokens {
  tokens: Record<string, any>;
}

export interface StyleMetadata {
  metadataTags: Record<string, any>;
  promptScaffolding: {
    base: string;
    negative: string;
    modifiers: string[];
  };
  spec?: {
    updatedAt?: string;
    designNotes?: string;
    usageGuidelines?: string;
  };
}

export interface StyleAssetRefs {
  objectAssets: Record<string, string>;
  statuses: {
    moodBoard: string;
    uiConcepts: string;
    previews: string;
  };
  hasLegacyData: {
    moodBoard: boolean;
    uiConcepts: boolean;
    previews: boolean;
  };
}

export interface ImageDimensions {
  width: number | null;
  height: number | null;
}

export interface StyleImageIds {
  reference?: string;
  preview_landscape?: string;
  preview_portrait?: string;
  preview_still_life?: string;
  ui_audio_plugin?: string;
  ui_software_app?: string;
  ui_dashboard?: string;
  mood_board?: string;
  _dimensions?: Record<string, ImageDimensions>;
  _reference?: {
    id: string;
    width: number | null;
    height: number | null;
  } | null;
}
