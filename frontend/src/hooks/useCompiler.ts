// ??$$$ group 4 - Build & Firmware Compilation (Phase 3)
// @ts-nocheck
import { useState } from 'react';

/**
 * Parses stderr from Hexi compiler into structured error objects.
 * Format: sketch.ino:LINE:COL: TYPE: MESSAGE
 */
const parseHexiErrors = (stderr) => {
  if (!stderr) return [];
  const lines = stderr.split('\n');
  const errors = [];
  lines.forEach(line => {
    const match = line.match(/sketch\.ino:(\d+):(\d+):\s+(error|warning|note):\s+(.*)/i);
    if (match) {
      errors.push({
        line: parseInt(match[1]),
        column: parseInt(match[2]),
        type: match[3].toLowerCase(),
        message: match[4].trim()
      });
    } else if (line.includes('error:')) {
      // Fallback for other error formats
      errors.push({
        line: 0,
        column: 0,
        type: 'error',
        message: line.trim()
      });
    }
  });
  return errors;
};

export const useCompiler = () => {
  const [compiling, setCompiling] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  // ??$$$ - Support dynamic board detection based on diagram parts and sketch code imports
  const compile = async (sketchCode, diagram = null) => {
    setCompiling(true);
    setLastResult(null);

    // ??$$$ - Board auto-detection logic: default to 'uno', use 'esp32' if WiFi.h is included or ESP32 exists in diagram, etc.
    let board = 'uno';
    if (sketchCode.includes('WiFi.h') || sketchCode.includes('WiFiClient') || sketchCode.includes('WiFiServer')) {
      board = 'esp32';
    } else if (diagram && Array.isArray(diagram.parts)) {
      const hasEsp32 = diagram.parts.some(p => p.type && p.type.toLowerCase().includes('esp32'));
      const hasMega = diagram.parts.some(p => p.type && p.type.toLowerCase().includes('mega'));
      const hasNano = diagram.parts.some(p => p.type && p.type.toLowerCase().includes('nano'));
      
      if (hasEsp32) {
        board = 'esp32';
      } else if (hasMega) {
        board = 'mega';
      } else if (hasNano) {
        board = 'nano';
      }
    }

    try {
      // ??$$$ - Send board type in request payload
      const res = await fetch('https://hexi.wokwi.com/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sketch: sketchCode, board: board })
      });

      if (!res.ok) {
        throw new Error(`Compiler API returned ${res.status}`);
      }

      const data = await res.json(); // { hex, stdout, stderr }
      const errors = parseHexiErrors(data.stderr);
      
      const result = {
        success: !!data.hex,
        hex: data.hex || null,
        stdout: data.stdout || '',
        stderr: data.stderr || '',
        errors,
        board // ??$$$ - Include board in the compile result
      };
      
      setLastResult(result);
      return result;
    } catch (err) {
      const result = {
        success: false,
        hex: null,
        stdout: '',
        stderr: err.message,
        errors: [{ line: 0, column: 0, type: 'error', message: err.message }],
        board // ??$$$
      };
      setLastResult(result);
      return result;
    } finally {
      setCompiling(false);
    }
  };

  return { compile, compiling, lastResult };
};
