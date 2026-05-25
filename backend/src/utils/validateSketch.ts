// @ts-nocheck
// ??$$$ FORGE: validateSketch.js — Arduino sketch integrity checker

/**
 * validateSketch(sketchCode)
 * Hard requirements for a valid Arduino sketch.
 * @param {string} sketchCode
 * @returns {{ valid: boolean, errors: string[] }}
 */
export const validateSketch = (sketchCode) => {
  const errors = [];

  if (sketchCode === undefined || sketchCode === null || typeof sketchCode !== 'string') {
    return { valid: false, errors: ['Sketch is missing or not a string'] };
  }

  const code = sketchCode.trim();

  if (!code) {
    // ??$$$ Allow empty sketches for saving, but they are not "ready" for build stage 'done'
    return { valid: true, errors: [], warnings: ['Sketch is empty'] };
  }


  // Must have setup()
  if (!/void\s+setup\s*\(\s*\)/.test(code)) {
    errors.push('Missing void setup() function');
  }

  // Must have loop()
  if (!/void\s+loop\s*\(\s*\)/.test(code)) {
    errors.push('Missing void loop() function');
  }

  // Warn on common issues (not errors, but logged)
  const warnings = [];
  if (!/#include/.test(code) && code.length < 100) {
    warnings.push('Sketch is very short — may be incomplete');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
};

export default { validateSketch };
