// ??$$$ group 5 - Circuit Simulation (Phase 4)
// @ts-nocheck
// ??$$$ Default diagram for Mega mode
export const DEFAULT_DIAGRAM = {
  version: 1,
  parts: [
    { type: 'wokwi-arduino-mega', id: 'mega', top: 0, left: 0, attrs: {} },
    { type: 'wokwi-led', id: 'led1', top: -110, left: 260, attrs: { color: 'blue' } },
  ],
  connections: [
    ['mega:13', 'led1:A', '#22c55e', []],
    ['mega:GND.1', 'led1:C', '#6b7280', []],
  ],
};

const STORAGE_KEY = 'nova-diagram-mega-v1';
const LIBRARIES_KEY = 'nova-libraries-mega-v1';
const SKETCH_KEY = 'nova-sketch-mega-v1';

export function loadDiagram() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) return JSON.parse(s);
  } catch {
    // ignore
  }
  return DEFAULT_DIAGRAM;
}

export function saveDiagram(diagram) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(diagram));
}

export function loadLibraries() {
  try {
    const s = localStorage.getItem(LIBRARIES_KEY);
    if (!s) return [];
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function saveLibraries(libraries) {
  localStorage.setItem(LIBRARIES_KEY, JSON.stringify(libraries));
}

export function loadSketch() {
  try {
    return localStorage.getItem(SKETCH_KEY);
  } catch {
    return null;
  }
}

export function saveSketch(sketch) {
  localStorage.setItem(SKETCH_KEY, sketch);
}

export function resetDiagramStorage() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LIBRARIES_KEY);
  localStorage.removeItem(SKETCH_KEY);
}

