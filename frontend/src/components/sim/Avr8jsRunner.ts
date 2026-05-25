// @ts-nocheck
import { CPU, avrInstruction, AVRIOPort, portAConfig, portBConfig, portCConfig, portDConfig, portEConfig, portFConfig, portGConfig, portHConfig, portJConfig, portKConfig, portLConfig, AVRTimer, timer0Config, AVRUSART, usart0Config } from 'avr8js';

// ??$$$ Newer code for browser-safe Intel HEX parser
export function parseIntelHex(hexString) {
  const mem = new Uint8Array(256 * 1024); // Mega has 256KB
  for (const line of hexString.split('\n')) {
    const l = line.trim();
    if (!l.startsWith(':')) continue;
    const byteCount = parseInt(l.substring(1, 3), 16);
    const address = parseInt(l.substring(3, 7), 16);
    const recType = parseInt(l.substring(7, 9), 16);
    if (recType === 0) {
      for (let i = 0; i < byteCount; i++) {
        mem[address + i] = parseInt(l.substring(9 + i * 2, 11 + i * 2), 16);
      }
    }
  }
  return mem;
}

export function startAvr8jsRun(opts) {
  const { hex, diagram, onPartStateBatch, onSerialLine, onLog } = opts;

  const bytes = parseIntelHex(hex);
  const program = new Uint16Array(128 * 1024); // Mega has 128K words
  for (let i = 0; i < bytes.length; i += 2) program[i >> 1] = bytes[i] | (bytes[i + 1] << 8);
  const cpu = new CPU(program);

  new AVRTimer(cpu, timer0Config);
  const portA = new AVRIOPort(cpu, portAConfig);
  const portB = new AVRIOPort(cpu, portBConfig);
  const portC = new AVRIOPort(cpu, portCConfig);
  const portD = new AVRIOPort(cpu, portDConfig);
  const portE = new AVRIOPort(cpu, portEConfig);
  const portF = new AVRIOPort(cpu, portFConfig);
  const portG = new AVRIOPort(cpu, portGConfig);
  const portH = new AVRIOPort(cpu, portHConfig);
  const portJ = new AVRIOPort(cpu, portJConfig);
  const portK = new AVRIOPort(cpu, portKConfig);
  const portL = new AVRIOPort(cpu, portLConfig);

  // ??$$$ Expanded Mega pin mapping (partial for now)
  const megaPins = {
    '13': { port: portB, bit: 7 }, // Mega Pin 13 is PB7
    '12': { port: portB, bit: 6 },
    '11': { port: portB, bit: 5 },
    '10': { port: portB, bit: 4 },
    '9': { port: portH, bit: 6 }, // Simplified, portH not yet defined
    '8': { port: portH, bit: 5 },
    'A0': { port: portF, bit: 0 }, // Simplified, portF not yet defined
    'A1': { port: portF, bit: 1 },
  };

  // For now, let's stick to a basic mapping that works with the existing avr8js configs
  // We'll map 'mega:13' to PB7, etc.
  const pinMapping = {
    '13': { port: portB, bit: 7 },
    '12': { port: portB, bit: 6 },
    '11': { port: portB, bit: 5 },
    '10': { port: portB, bit: 4 },
    '9': { port: portH, bit: 6 },
    '8': { port: portH, bit: 5 },
    '7': { port: portH, bit: 4 },
    '6': { port: portH, bit: 3 },
    '5': { port: portE, bit: 3 },
    '4': { port: portG, bit: 5 },
    '3': { port: portE, bit: 5 },
    '2': { port: portE, bit: 4 },
    '1': { port: portE, bit: 1 },
    '0': { port: portE, bit: 0 },
    'A0': { port: portF, bit: 0 },
    'A1': { port: portF, bit: 1 },
    'A2': { port: portF, bit: 2 },
    'A3': { port: portF, bit: 3 },
  };

  const portAListeners = [];
  const portBListeners = [];
  const portCListeners = [];
  const portDListeners = [];
  const portEListeners = [];
  const portFListeners = [];
  const portGListeners = [];
  const portHListeners = [];
  const portJListeners = [];
  const portKListeners = [];
  const portLListeners = [];

  const stateUpdates = {};
  let stateChanged = false;
  const updatePartState = (partId, updates) => {
    stateUpdates[partId] = { ...(stateUpdates[partId] || {}), ...updates };
    stateChanged = true;
  };

  diagram.connections.forEach(conn => {
    const [p1, p2] = conn;
    // Handle both 'mega:13' and 'uno:13' for compatibility
    const megaSrc = (p1.startsWith('mega:') || p1.startsWith('uno:')) ? p1.split(':')[1] : 
                   ((p2.startsWith('mega:') || p2.startsWith('uno:')) ? p2.split(':')[1] : null);
    const dest = (p1.startsWith('mega:') || p1.startsWith('uno:')) ? p2 : 
                 ((p2.startsWith('mega:') || p2.startsWith('uno:')) ? p1 : null);

    if (megaSrc && dest) {
      const [destId, destPin] = dest.split(':');
      const pinDef = pinMapping[megaSrc];
      if (pinDef) {
        if (destPin === 'A' || destPin === '1' || destPin === 'SIG') {
          const listener = () => {
            const val = pinDef.port.pinState(pinDef.bit) === 1;
            updatePartState(destId, { value: val });
          };
          if (pinDef.port === portA) portAListeners.push(listener);
          if (pinDef.port === portB) portBListeners.push(listener);
          if (pinDef.port === portC) portCListeners.push(listener);
          if (pinDef.port === portD) portDListeners.push(listener);
          if (pinDef.port === portE) portEListeners.push(listener);
          if (pinDef.port === portF) portFListeners.push(listener);
          if (pinDef.port === portG) portGListeners.push(listener);
          if (pinDef.port === portH) portHListeners.push(listener);
          if (pinDef.port === portJ) portJListeners.push(listener);
          if (pinDef.port === portK) portKListeners.push(listener);
          if (pinDef.port === portL) portLListeners.push(listener);
        }
      }
    }
  });

  portA.addListener(() => portAListeners.forEach(fn => fn()));
  portB.addListener(() => portBListeners.forEach(fn => fn()));
  portC.addListener(() => portCListeners.forEach(fn => fn()));
  portD.addListener(() => portDListeners.forEach(fn => fn()));
  portE.addListener(() => portEListeners.forEach(fn => fn()));
  portF.addListener(() => portFListeners.forEach(fn => fn()));
  portG.addListener(() => portGListeners.forEach(fn => fn()));
  portH.addListener(() => portHListeners.forEach(fn => fn()));
  portJ.addListener(() => portJListeners.forEach(fn => fn()));
  portK.addListener(() => portKListeners.forEach(fn => fn()));
  portL.addListener(() => portLListeners.forEach(fn => fn()));

  const serialBuf = { current: '' };
  let serialIdx = 0;

  const usart = new AVRUSART(cpu, usart0Config, 16e6);
  usart.onByteTransmit = (byte) => {
    const ch = String.fromCharCode(byte);
    if (ch === '\n') {
      const line = serialBuf.current;
      serialBuf.current = '';
      const now = new Date();
      const ts = now.toLocaleTimeString('en-US', { hour12: false }) + '.' + String(now.getMilliseconds()).padStart(3, '0');
      onSerialLine({ text: line, timestamp: ts, idx: serialIdx++ });
    } else if (ch !== '\r') {
      serialBuf.current += ch;
    }
  };

  onLog('Simulation running (Mega mode)...');

  let stopped = false;
  let rafId = null;

  const tick = () => {
    if (stopped) return;
    for (let i = 0; i < 50000; i++) {
      avrInstruction(cpu);
      cpu.tick();
    }

    if (stateChanged) {
      onPartStateBatch({ ...stateUpdates });
      for (const key in stateUpdates) delete stateUpdates[key];
      stateChanged = false;
    }

    rafId = requestAnimationFrame(tick);
  };

  rafId = requestAnimationFrame(tick);

  return {
    stop: () => {
      stopped = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      onLog('Simulation stopped.');
    },
  };
}

