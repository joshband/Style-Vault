/**
 * Exporter Registry
 * 
 * All exporters are registered here and can be discovered by the export UI.
 * Each exporter follows the pipeline architecture.
 */

import { registerExporter } from '../token-pipeline';
import { exportDTCGJson } from './dtcg-json';
import { exportCSS } from './css';
import { exportSCSS } from './scss';
import { exportReactTS } from './react-ts';
import { exportTailwind } from './tailwind';
import { exportFlutter } from './flutter';
import { exportFigmaVariables } from './figma-variables';
import { exportReactNative } from './react-native';
import { exportSwiftUI } from './swift-ui';
import { exportMaterialUI } from './material-ui';
import { exportJUCE } from './juce';
import { exportUnity } from './unity';
import { exportWebComponents } from './web-components';

export function initializeExporters(): void {
  registerExporter(exportDTCGJson);
  registerExporter(exportCSS);
  registerExporter(exportSCSS);
  registerExporter(exportReactTS);
  registerExporter(exportTailwind);
  registerExporter(exportFlutter);
  registerExporter(exportFigmaVariables);
  registerExporter(exportReactNative);
  registerExporter(exportSwiftUI);
  registerExporter(exportMaterialUI);
  registerExporter(exportJUCE);
  registerExporter(exportUnity);
  registerExporter(exportWebComponents);
}

export * from './dtcg-json';
export * from './css';
export * from './scss';
export * from './react-ts';
export * from './tailwind';
export * from './flutter';
export * from './figma-variables';
export * from './react-native';
export * from './swift-ui';
export * from './material-ui';
export * from './juce';
export * from './unity';
export * from './web-components';
