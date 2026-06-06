import {
  AVRIOPort,
  AVRTWI,
  AVRTimer,
  AVRUSART,
  CPU,
  avrInstruction,
  portBConfig,
  portCConfig,
  portDConfig,
  timer0Config,
  timer1Config,
  timer2Config,
  twiConfig,
  usart0Config,
  type TWIEventHandler
} from 'avr8js';

const CLOCK_HZ = 16_000_000;
const CYCLES_PER_SLICE = 50_000;
const LCD_ADDRESS = 0x27;
const LCD_WIDTH = 16;

const PCF8574_BACKLIGHT = 0x08;
const PCF8574_ENABLE = 0x04;
const PCF8574_RW = 0x02;
const PCF8574_RS = 0x01;

type WorkerStartMessage = {
  type: 'start';
  hex: string;
  buttonPins?: string[];
};

type WorkerButtonMessage = {
  type: 'button';
  pin: string;
  state: boolean;
};

type WorkerStopMessage = {
  type: 'stop';
};

type WorkerMessage = WorkerStartMessage | WorkerButtonMessage | WorkerStopMessage;

type PinDescriptor = {
  bit: number;
  key: string;
  port: AVRIOPort;
};

type RunnerState = {
  cpu: CPU;
  portB: AVRIOPort;
  portC: AVRIOPort;
  portD: AVRIOPort;
  pinMap: Record<string, PinDescriptor>;
  snapshotKeys: string[];
  lastPins: Record<string, boolean>;
  tickHandle: number;
};

class LCDController {
  private emit: (line1: string, line2: string, backlight: boolean) => void;
  private ddram = new Map<number, string>();
  private displayEnabled = true;
  private increment = true;
  private cursorAddress = 0;
  private backlight = false;
  private lastExpanderByte = 0;
  private pendingNibble: number | null = null;
  private pendingRs = false;
  private lastRenderedLine1 = ''.padEnd(LCD_WIDTH, ' ');
  private lastRenderedLine2 = ''.padEnd(LCD_WIDTH, ' ');
  private lastRenderedBacklight = false;

  constructor(emit: (line1: string, line2: string, backlight: boolean) => void) {
    this.emit = emit;
  }

  writeExpanderByte(value: number) {
    const nextBacklight = Boolean(value & PCF8574_BACKLIGHT);
    if (nextBacklight !== this.backlight) {
      this.backlight = nextBacklight;
      this.flush();
    }

    const fallingEdge =
      Boolean(this.lastExpanderByte & PCF8574_ENABLE) &&
      !Boolean(value & PCF8574_ENABLE);

    if (fallingEdge) {
      this.latchNibble(value);
    }

    this.lastExpanderByte = value;
  }

  private latchNibble(value: number) {
    if (value & PCF8574_RW) {
      return;
    }

    const nibble = (value >> 4) & 0x0f;
    const rs = Boolean(value & PCF8574_RS);

    if (this.pendingNibble === null) {
      this.pendingNibble = nibble;
      this.pendingRs = rs;
      return;
    }

    const byte = (this.pendingNibble << 4) | nibble;
    const byteRs = this.pendingRs;

    this.pendingNibble = null;
    this.pendingRs = false;

    if (byteRs) {
      this.writeData(byte);
    } else {
      this.executeCommand(byte);
    }
  }

  private executeCommand(value: number) {
    if (value === 0x01) {
      this.ddram.clear();
      this.cursorAddress = 0;
      this.flush();
      return;
    }

    if (value === 0x02) {
      this.cursorAddress = 0;
      this.flush();
      return;
    }

    if ((value & 0x80) === 0x80) {
      this.cursorAddress = value & 0x7f;
      return;
    }

    if ((value & 0x08) === 0x08) {
      this.displayEnabled = Boolean(value & 0x04);
      this.flush();
      return;
    }

    if ((value & 0x04) === 0x04) {
      this.increment = Boolean(value & 0x02);
      return;
    }
  }

  private writeData(value: number) {
    this.ddram.set(this.cursorAddress, this.toDisplayChar(value));
    this.advanceCursor();
    this.flush();
  }

  private advanceCursor() {
    if (this.increment) {
      if (this.cursorAddress === 0x0f) {
        this.cursorAddress = 0x40;
      } else if (this.cursorAddress === 0x4f) {
        this.cursorAddress = 0x00;
      } else {
        this.cursorAddress += 1;
      }
      return;
    }

    if (this.cursorAddress === 0x40) {
      this.cursorAddress = 0x0f;
    } else if (this.cursorAddress === 0x00) {
      this.cursorAddress = 0x4f;
    } else {
      this.cursorAddress -= 1;
    }
  }

  private toDisplayChar(value: number) {
    if (value < 32 || value > 126) {
      return ' ';
    }

    return String.fromCharCode(value);
  }

  private flush() {
    const [line1, line2] = this.renderLines();
    if (
      line1 === this.lastRenderedLine1 &&
      line2 === this.lastRenderedLine2 &&
      this.backlight === this.lastRenderedBacklight
    ) {
      return;
    }

    this.lastRenderedLine1 = line1;
    this.lastRenderedLine2 = line2;
    this.lastRenderedBacklight = this.backlight;
    this.emit(line1, line2, this.backlight);
  }

  private renderLines() {
    if (!this.displayEnabled) {
      return [''.padEnd(LCD_WIDTH, ' '), ''.padEnd(LCD_WIDTH, ' ')];
    }

    const line1 = Array.from({ length: LCD_WIDTH }, (_, index) => this.ddram.get(index) || ' ').join('');
    const line2 = Array.from(
      { length: LCD_WIDTH },
      (_, index) => this.ddram.get(0x40 + index) || ' '
    ).join('');

    return [line1, line2] as const;
  }
}

class LCDTWIHandler implements TWIEventHandler {
  private twi: AVRTWI;
  private lcd: LCDController;
  private activeAddress: number | null = null;
  private writeMode = true;

  constructor(twi: AVRTWI, lcd: LCDController) {
    this.twi = twi;
    this.lcd = lcd;
  }

  start() {
    this.twi.completeStart();
  }

  stop() {
    this.activeAddress = null;
    this.twi.completeStop();
  }

  connectToSlave(addr: number, write: boolean) {
    this.activeAddress = addr;
    this.writeMode = write;
    this.twi.completeConnect(addr === LCD_ADDRESS);
  }

  writeByte(value: number) {
    if (this.activeAddress === LCD_ADDRESS && this.writeMode) {
      this.lcd.writeExpanderByte(value);
      this.twi.completeWrite(true);
      return;
    }

    this.twi.completeWrite(false);
  }

  readByte() {
    this.twi.completeRead(0xff);
  }
}

const normalizePin = (value: string) => {
  let pin = String(value || '').trim().toUpperCase();
  if (!pin) {
    return '';
  }

  if (pin === 'RX') {
    return 'D0';
  }

  if (pin === 'TX') {
    return 'D1';
  }

  if (pin === 'SDA') {
    return 'A4';
  }

  if (pin === 'SCL') {
    return 'A5';
  }

  if (/^GPIO\d+$/.test(pin)) {
    pin = `D${pin.slice(4)}`;
  }

  if (/^\d+$/.test(pin)) {
    pin = `D${pin}`;
  }

  return pin;
};

const parseIntelHex = (hex: string) => {
  const bytes = new Uint8Array(0x8000);
  let upperAddress = 0;

  for (const rawLine of String(hex || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith(':')) {
      continue;
    }

    const byteCount = Number.parseInt(line.slice(1, 3), 16);
    const address = Number.parseInt(line.slice(3, 7), 16);
    const recordType = Number.parseInt(line.slice(7, 9), 16);

    if (recordType === 0x04) {
      upperAddress = Number.parseInt(line.slice(9, 13), 16) << 16;
      continue;
    }

    if (recordType !== 0x00) {
      continue;
    }

    for (let index = 0; index < byteCount; index += 1) {
      const byte = Number.parseInt(line.slice(9 + index * 2, 11 + index * 2), 16);
      const target = upperAddress + address + index;
      if (target < bytes.length) {
        bytes[target] = byte;
      }
    }
  }

  const program = new Uint16Array(bytes.length / 2);
  for (let index = 0; index < bytes.length; index += 2) {
    program[index / 2] = bytes[index] | (bytes[index + 1] << 8);
  }

  return program;
};

const buildPinMap = (portB: AVRIOPort, portC: AVRIOPort, portD: AVRIOPort) => {
  const pinMap: Record<string, PinDescriptor> = {};

  for (let bit = 0; bit <= 7; bit += 1) {
    pinMap[`D${bit}`] = { key: `D${bit}`, port: portD, bit };
  }

  for (let bit = 0; bit <= 5; bit += 1) {
    pinMap[`D${bit + 8}`] = { key: `D${bit + 8}`, port: portB, bit };
  }

  for (let bit = 0; bit <= 5; bit += 1) {
    pinMap[`A${bit}`] = { key: `A${bit}`, port: portC, bit };
  }

  pinMap.SDA = pinMap.A4;
  pinMap.SCL = pinMap.A5;
  return pinMap;
};

const readPinLevel = (runner: RunnerState, key: string) => {
  const descriptor = runner.pinMap[key];
  if (!descriptor) {
    return false;
  }

  const { port, bit } = descriptor;
  // ??$$$ newer code — AVR architecture: DDR=1 means OUTPUT (write to PORT register),
  // DDR=0 means INPUT (read from PIN register). Using PORT for output pins is correct
  // because digitalWrite() writes to PORT, not PIN. Reading PIN for an output pin
  // reflects external input, not what the MCU is driving — so D13 LED always read false.
  const ddrRegister = port.portConfig.DDR;
  const isOutput = Boolean(runner.cpu.data[ddrRegister] & (1 << bit));
  const reg = isOutput ? port.portConfig.PORT : port.portConfig.PIN;
  return Boolean(runner.cpu.data[reg] & (1 << bit));
};

const capturePins = (runner: RunnerState) => {
  const nextPins: Record<string, boolean> = {};
  let changed = false;

  for (const key of runner.snapshotKeys) {
    const value = readPinLevel(runner, key);
    nextPins[key] = value;
    if (runner.lastPins[key] !== value) {
      changed = true;
    }
  }

  if (!changed) {
    return null;
  }

  runner.lastPins = nextPins;
  return nextPins;
};

const postPins = (runner: RunnerState, force = false) => {
  const pins = force
    ? Object.fromEntries(runner.snapshotKeys.map((key) => [key, readPinLevel(runner, key)]))
    : capturePins(runner);

  if (!pins) {
    return;
  }

  if (force) {
    runner.lastPins = { ...pins };
  }

  self.postMessage({ type: 'gpio', pins });
};

const stopRunner = (runner: RunnerState | null) => {
  if (!runner) {
    return null;
  }

  clearInterval(runner.tickHandle);
  return null;
};

let runner: RunnerState | null = null;

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  if (message.type === 'stop') {
    runner = stopRunner(runner);
    return;
  }

  if (message.type === 'button') {
    if (!runner) {
      return;
    }

    const normalized = normalizePin(message.pin);
    const descriptor = runner.pinMap[normalized];
    if (!descriptor) {
      return;
    }

    descriptor.port.setPin(descriptor.bit, message.state);
    postPins(runner, true);
    return;
  }

  if (message.type !== 'start') {
    return;
  }

  try {
    runner = stopRunner(runner);

    const cpu = new CPU(parseIntelHex(message.hex));
    const portB = new AVRIOPort(cpu, portBConfig);
    const portC = new AVRIOPort(cpu, portCConfig);
    const portD = new AVRIOPort(cpu, portDConfig);

    new AVRTimer(cpu, timer0Config);
    new AVRTimer(cpu, timer1Config);
    new AVRTimer(cpu, timer2Config);

    const usart = new AVRUSART(cpu, usart0Config, CLOCK_HZ);
    usart.onLineTransmit = (text) => {
      self.postMessage({ type: 'serial', text });
    };

    const lcd = new LCDController((line1, line2, backlight) => {
      self.postMessage({ type: 'lcd', line1, line2, backlight });
    });

    const twi = new AVRTWI(cpu, twiConfig, CLOCK_HZ);
    twi.eventHandler = new LCDTWIHandler(twi, lcd);

    const pinMap = buildPinMap(portB, portC, portD);
    const snapshotKeys = [
      'D0',
      'D1',
      'D2',
      'D3',
      'D4',
      'D5',
      'D6',
      'D7',
      'D8',
      'D9',
      'D10',
      'D11',
      'D12',
      'D13',
      'A0',
      'A1',
      'A2',
      'A3',
      'A4',
      'A5'
    ];

    const nextRunner: RunnerState = {
      cpu,
      portB,
      portC,
      portD,
      pinMap,
      snapshotKeys,
      lastPins: {},
      tickHandle: 0
    };

    for (const pin of message.buttonPins || []) {
      const descriptor = pinMap[normalizePin(pin)];
      descriptor?.port.setPin(descriptor.bit, true);
    }

    nextRunner.tickHandle = self.setInterval(() => {
      try {
        for (let index = 0; index < CYCLES_PER_SLICE; index += 1) {
          avrInstruction(cpu);
          cpu.tick();
        }

        postPins(nextRunner);
      } catch (error: any) {
        self.postMessage({
          type: 'error',
          error: error?.message || 'CPU execution failed'
        });
        runner = stopRunner(nextRunner);
      }
    }, 0);

    runner = nextRunner;
    postPins(nextRunner, true);
    self.postMessage({ type: 'ready' });
  } catch (error: any) {
    self.postMessage({
      type: 'error',
      error: error?.message || 'Failed to start AVR simulation'
    });
  }
};
