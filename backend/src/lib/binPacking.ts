// ??$$$ group 6 - Physical Enclosure & 3D Modeling (Phase 5)
// @ts-nocheck
// ??$$$ FORGE: binPacking.js — Guillotine 2D bin packing algorithm
// Assigns x, y coordinates to components within a given 2D area.
// Returns placed components and any that failed to fit.

/**
 * Basic Shelf Bin Packing
 * Packs rectangles into a bin of given width and height.
 * 
 * @param {Array} components - Array of objects with width, height (mm)
 * @param {number} binWidth - Enclosure width (mm)
 * @param {number} binHeight - Enclosure height (mm)
 * @returns {Object} { placements: [{...comp, x, y}], unplaced: [...] }
 */
export const packComponents = (components, binWidth, binHeight) => {
  // Sort components by height descending, then width descending
  const sorted = [...components].sort((a, b) => {
    if (b.height !== a.height) return b.height - a.height;
    return b.width - a.width;
  });

  const placements = [];
  const unplaced = [];

  let currentX = 0;
  let currentY = 0;
  let maxShelfHeight = 0;

  for (const comp of sorted) {
    // If component is wider than the bin, it can't fit
    if (comp.width > binWidth || comp.height > binHeight) {
      unplaced.push(comp);
      continue;
    }

    // Check if it fits on the current shelf
    if (currentX + comp.width > binWidth) {
      // Move to next shelf
      currentX = 0;
      currentY += maxShelfHeight;
      maxShelfHeight = 0;
    }

    // Check if it exceeds bin height
    if (currentY + comp.height > binHeight) {
      // Cannot fit this component
      unplaced.push(comp);
      continue;
    }

    // Place component
    placements.push({
      ...comp,
      x: currentX,
      y: currentY
    });

    // Update shelf state
    currentX += comp.width;
    maxShelfHeight = Math.max(maxShelfHeight, comp.height);
  }

  return { placements, unplaced };
};

export default { packComponents };
