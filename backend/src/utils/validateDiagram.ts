// @ts-nocheck
// ??$$$ FORGE: validateDiagram.js — Wokwi diagram.json integrity checker

/**
 * validateDiagram(diagramJson)
 * Checks that a Wokwi diagram is structurally valid before accepting as a build artifact.
 * @param {object} diagramJson
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export const validateDiagram = (diagramJson) => {
  const errors = [];
  const warnings = [];

  if (!diagramJson || typeof diagramJson !== 'object') {
    return { valid: false, errors: ['Diagram is null or not an object'], warnings: [] };
  }

  // Must have parts[]
  if (!Array.isArray(diagramJson.parts) || diagramJson.parts.length === 0) {
    // ??$$$ Check if they used 'components' instead of 'parts'
    if (Array.isArray(diagramJson.components)) {
      errors.push('Diagram uses "components" instead of "parts". Wokwi requires "parts".');
    } else {
      warnings.push('Diagram has no parts — must include at least a board for simulation');
    }
  }


  // Must have connections[]
  if (!Array.isArray(diagramJson.connections)) {
    errors.push('Diagram is missing "connections" array at the root.');
  } else if (diagramJson.connections.length === 0) {
    warnings.push('Diagram has no connections — components are not wired');
  }

  // Must have at least one board/controller part
  const boardTypes = ['wokwi-arduino-uno', 'wokwi-arduino-mega', 'wokwi-arduino-nano',
    'wokwi-esp32-devkit-v1', 'wokwi-raspberry-pi-pico'];
  const hasBoardPart = (diagramJson.parts || []).some(p =>
    boardTypes.some(bt => String(p.type || '').toLowerCase().includes(bt.replace('wokwi-', '')))
  );

  if (!hasBoardPart) {
    warnings.push('Diagram does not contain a recognized board/controller part');
  }

  // Each connection should be an array with at least 2 endpoints
  const badConnections = (diagramJson.connections || []).filter(c =>
    !Array.isArray(c) || c.length < 2
  );
  if (badConnections.length > 0) {
    warnings.push(`${badConnections.length} connection(s) have invalid format`);
  }


  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
};

export default { validateDiagram };
