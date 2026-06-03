// ??$$$ group 6 - Physical Enclosure & 3D Modeling (Phase 5)
// @ts-nocheck
// ??$$$ FORGE: assembly.service.js — Handles enclosure layout generation logic
import { resolveDimensionKey } from '../lib/wokwiDimensionKeyMap';
import { getDimensions } from '../lib/componentDimensions';
import { packComponents } from '../lib/binPacking';
import { generateEnclosureSVG } from '../lib/svgLayout';

const PRESET_DIMS = {
  pocket: { w: 100, h: 80, d: 40 },
  desk:   { w: 200, h: 150, d: 60 },
  wall:   { w: 300, h: 200, d: 50 },
};

/**
 * generateLayout
 * @param {Object} project - The project doc (needs bom, generationProfile, _id)
 * @param {string} sizePreference - 'pocket', 'desk', 'wall', or 'custom'
 * @param {Object} overrides - { w, h, d } if custom
 */
export const generateLayout = async (project, sizePreference, overrides) => {
  const warnings = [];

  // Determine container dims
  let containerWidth, containerHeight, containerDepth;
  if (sizePreference === 'custom' && overrides) {
    containerWidth = overrides.w;
    containerHeight = overrides.h;
    containerDepth = overrides.d;
  } else {
    const preset = PRESET_DIMS[sizePreference] || PRESET_DIMS.pocket;
    containerWidth = preset.w;
    containerHeight = preset.h;
    containerDepth = preset.d;
  }

  // Gather components to place
  // 1. The main board
  // Old code:
  // const boardType = project.generationProfile?.board || project.extractedContext?.board || 'ARDUINO_UNO';
  // ??$$$ newer code
  const boardType = project.generationProfile?.board || project.ideation?.snapshot?.computeCore || 'ARDUINO_UNO';
  const boardKey = resolveDimensionKey(boardType, null);
  const boardDims = getDimensions(boardKey);
  
  const blocksToPlace = [{
    id: 'board',
    name: boardType.replace('wokwi-', ''),
    key: boardKey,
    width: boardDims.width_mm + boardDims.clearance_mm * 2,
    height: boardDims.height_mm + boardDims.clearance_mm * 2,
    originalDims: boardDims
  }];

  // 2. The BOM items
  if (project.bom && project.bom.length > 0) {
    project.bom.forEach((item, index) => {
      // Exclude simple passives like resistors that don't need dedicated layout space
      // For this simple version, we'll map them
      const dimKey = resolveDimensionKey(null, item.key);
      const dims = getDimensions(dimKey);
      
      // Skip very small things to save space? Or just try to pack them.
      if (dims.category === 'passive' && dims.width_mm < 10) return;

      const qty = item.qty || 1;
      for (let i = 0; i < qty; i++) {
        blocksToPlace.push({
          id: `item_${index}_${i}`,
          name: item.displayName || item.key,
          key: dimKey,
          width: dims.width_mm + dims.clearance_mm * 2,
          height: dims.height_mm + dims.clearance_mm * 2,
          originalDims: dims
        });
      }
    });
  }

  // Check depths: components must not exceed enclosure depth
  for (const b of blocksToPlace) {
    if (b.originalDims.depth_mm > containerDepth) {
      warnings.push(`Component ${b.name} depth (${b.originalDims.depth_mm}mm) exceeds enclosure depth (${containerDepth}mm)`);
    }
  }

  // Pack components into the base panel
  const { placements, unplaced } = packComponents(blocksToPlace, containerWidth, containerHeight);

  if (unplaced.length > 0) {
    warnings.push(`Could not fit ${unplaced.length} component(s) on the base panel. Try a larger size.`);
  }

  // Generate SVG
  const svgString = generateEnclosureSVG(containerWidth, containerHeight, containerDepth, placements, project._id.toString());

  return {
    svgString,
    dimensions: { width_mm: containerWidth, height_mm: containerHeight, depth_mm: containerDepth },
    placements,
    unplaced,
    warnings
  };
};

export default { generateLayout };
