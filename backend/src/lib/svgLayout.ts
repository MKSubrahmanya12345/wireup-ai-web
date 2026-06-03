// ??$$$ group 6 - Physical Enclosure & 3D Modeling (Phase 5)
// @ts-nocheck
// ??$$$ FORGE: svgLayout.js — Generates print-ready SVG layout for the enclosure
// Uses red for cut lines, blue for valley folds, green for mountain folds.
// Embeds component footprints and a QR code placeholder.

export const generateEnclosureSVG = (width, height, depth, placements, projectId) => {
  // SVG Canvas dimensions (add padding)
  const pad = 20;
  
  // Total dimensions of the cross pattern:
  // Total width = depth + width + depth = w + 2d
  // Total height = depth + height + depth = h + 2d
  // (We'll do a simple 5-sided open box for the print, or 6-sided if we add a lid. Let's do 5-sided + flaps)
  
  const flap = 15; // Glue flaps
  const svgWidth = width + 2 * depth + 2 * flap + 2 * pad;
  const svgHeight = height + 2 * depth + 2 * pad;

  // Center offsets for the base panel
  const bx = pad + flap + depth;
  const by = pad + depth;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}mm" height="${svgHeight}mm">`;
  
  // Styles
  svg += `
    <style>
      .cut { fill: none; stroke: #ef4444; stroke-width: 1; }
      .valley { fill: none; stroke: #3b82f6; stroke-width: 1; stroke-dasharray: 4,4; }
      .mountain { fill: none; stroke: #22c55e; stroke-width: 1; stroke-dasharray: 4,4; }
      .comp { fill: rgba(0,0,0,0.05); stroke: #555; stroke-width: 0.5; }
      .comp-text { font-family: monospace; font-size: 4px; fill: #555; }
      .label { font-family: sans-serif; font-size: 6px; fill: #888; }
    </style>
  `;

  // --- Draw the Box Pattern ---
  
  // Base panel (W x H)
  // Valley folds around the base
  svg += `<rect x="${bx}" y="${by}" width="${width}" height="${height}" class="valley" />`;
  svg += `<text x="${bx + width/2}" y="${by - 2}" text-anchor="middle" class="label">Base (${width}x${height}mm)</text>`;

  // Top side panel (W x D)
  svg += `<rect x="${bx}" y="${by - depth}" width="${width}" height="${depth}" class="cut" />`;
  svg += `<line x="${bx}" y="${by}" x2="${bx + width}" y2="${by}" class="valley" />`; // Redraw fold

  // Bottom side panel (W x D)
  svg += `<rect x="${bx}" y="${by + height}" width="${width}" height="${depth}" class="cut" />`;
  svg += `<line x="${bx}" y="${by + height}" x2="${bx + width}" y2="${by + height}" class="valley" />`;

  // Left side panel (D x H)
  svg += `<rect x="${bx - depth}" y="${by}" width="${depth}" height="${height}" class="cut" />`;
  svg += `<line x="${bx}" y="${by}" x2="${bx}" y2="${by + height}" class="valley" />`;

  // Right side panel (D x H)
  svg += `<rect x="${bx + width}" y="${by}" width="${depth}" height="${height}" class="cut" />`;
  svg += `<line x="${bx + width}" y="${by}" x2="${bx + width}" y2="${by + height}" class="valley" />`;

  // Flaps (on Left and Right panels)
  // Left top flap
  svg += `<polygon points="${bx - depth},${by} ${bx - depth},${by - flap} ${bx - depth + flap},${by - flap} ${bx},${by}" class="cut" />`;
  svg += `<line x="${bx - depth}" y="${by}" x2="${bx}" y2="${by}" class="valley" />`;
  
  // Left bottom flap
  svg += `<polygon points="${bx - depth},${by + height} ${bx - depth},${by + height + flap} ${bx - depth + flap},${by + height + flap} ${bx},${by + height}" class="cut" />`;
  svg += `<line x="${bx - depth}" y="${by + height}" x2="${bx}" y2="${by + height}" class="valley" />`;

  // Right top flap
  svg += `<polygon points="${bx + width + depth},${by} ${bx + width + depth},${by - flap} ${bx + width + depth - flap},${by - flap} ${bx + width},${by}" class="cut" />`;
  svg += `<line x="${bx + width}" y="${by}" x2="${bx + width + depth}" y2="${by}" class="valley" />`;

  // Right bottom flap
  svg += `<polygon points="${bx + width + depth},${by + height} ${bx + width + depth},${by + height + flap} ${bx + width + depth - flap},${by + height + flap} ${bx + width},${by + height}" class="cut" />`;
  svg += `<line x="${bx + width}" y="${by + height}" x2="${bx + width + depth}" y2="${by + height}" class="valley" />`;

  // --- Place Components on Base Panel ---
  for (const comp of placements) {
    const cx = bx + comp.x;
    const cy = by + comp.y;
    svg += `<rect x="${cx}" y="${cy}" width="${comp.width}" height="${comp.height}" class="comp" />`;
    // Truncate label to fit
    const label = comp.name.length > 10 ? comp.name.substring(0, 8) + '..' : comp.name;
    svg += `<text x="${cx + 2}" y="${cy + 6}" class="comp-text">${label}</text>`;
  }

  // --- Add QR Code Placeholder (linking to project build) ---
  // We place it on the top side panel
  const qrSize = Math.min(depth - 4, 30);
  if (qrSize > 10) {
    const qrx = bx + width - qrSize - 2;
    const qry = by - depth + 2;
    svg += `<rect x="${qrx}" y="${qry}" width="${qrSize}" height="${qrSize}" fill="#eee" stroke="#ccc" />`;
    svg += `<text x="${qrx + qrSize/2}" y="${qry + qrSize/2}" text-anchor="middle" dominant-baseline="middle" font-size="4" font-family="sans-serif" fill="#666">QR CODE</text>`;
    svg += `<text x="${qrx + qrSize/2}" y="${qry + qrSize/2 + 5}" text-anchor="middle" font-size="3" font-family="sans-serif" fill="#666">${projectId.slice(-6)}</text>`;
  }

  svg += `</svg>`;
  return svg;
};

export default { generateEnclosureSVG };
