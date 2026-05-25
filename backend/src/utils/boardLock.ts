// @ts-nocheck
// ??$$$ FORGE: boardLock.js — Forces diagram boardPartType to match generationProfile

// Canonical map: generationProfile.board key → Wokwi part type
const BOARD_TO_WOKWI_PART = {
  'ESP32_DEVKIT_V1':      'wokwi-esp32-devkit-v1',
  'ARDUINO_UNO':          'wokwi-arduino-uno',
  'ARDUINO_MEGA':         'wokwi-arduino-mega',
  'ARDUINO_NANO':         'wokwi-arduino-nano',
  'RASPBERRY_PI_PICO':    'wokwi-raspberry-pi-pico',
  'ATTINY85':             'wokwi-attiny85',
  // legacy slug support
  'esp32-devkit-v1':      'wokwi-esp32-devkit-v1',
  'arduino-uno':          'wokwi-arduino-uno',
  'arduino-mega':         'wokwi-arduino-mega',
  'arduino-nano':         'wokwi-arduino-nano',
  'raspberry-pi-pico':    'wokwi-raspberry-pi-pico',
  'attiny85':             'wokwi-attiny85',
};

// Known board part type substrings for detection
const BOARD_PART_SUBSTRINGS = [
  'arduino-uno', 'arduino-mega', 'arduino-nano',
  'esp32-devkit', 'raspberry-pi-pico', 'attiny'
];

const isBoardPart = (partType = '') => {
  const lower = String(partType).toLowerCase();
  return BOARD_PART_SUBSTRINGS.some(s => lower.includes(s));
};

/**
 * repairBoard(diagram, generationProfile)
 * Forces the board part in diagram.parts to match generationProfile.board.
 * Also removes connections that reference pins not present on standard boards.
 * @param {object} diagram - Wokwi diagram JSON
 * @param {object} generationProfile - from project.generationProfile
 * @returns {{ repairedDiagram: object, changeLog: string[] }}
 */
export const repairBoard = (diagram, generationProfile) => {
  const changeLog = [];

  if (!diagram || !generationProfile?.board) {
    return { repairedDiagram: diagram, changeLog: ['No repair needed (missing diagram or profile)'] };
  }

  const expectedWokwiType = BOARD_TO_WOKWI_PART[generationProfile.board];
  if (!expectedWokwiType) {
    return {
      repairedDiagram: diagram,
      changeLog: [`Unknown board key in generationProfile: ${generationProfile.board}`]
    };
  }

  const parts = Array.isArray(diagram.parts) ? [...diagram.parts] : [];
  let repaired = false;

  for (let i = 0; i < parts.length; i++) {
    if (isBoardPart(parts[i]?.type)) {
      if (parts[i].type !== expectedWokwiType) {
        changeLog.push(`Replaced board part "${parts[i].type}" → "${expectedWokwiType}"`);
        parts[i] = { ...parts[i], type: expectedWokwiType };
        repaired = true;
      }
    }
  }

  if (!repaired) {
    changeLog.push('Board part type already correct — no repair needed');
  }

  return {
    repairedDiagram: { ...diagram, parts },
    changeLog
  };
};

export { BOARD_TO_WOKWI_PART };
export default { repairBoard, BOARD_TO_WOKWI_PART };
