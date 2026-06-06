// ??$$$ newer code
import { getRegistry } from "./registry.services";

export interface IValidationIssue {
  type: "error" | "warning";
  subsystem: string;
  message: string;
  fixSuggestion?: string;
}

export interface IValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  issues: IValidationIssue[];
}

/**
 * Validates the Bill of Materials (BOM) against the Component Registry.
 */
export function validateBOM(bom: any[]): IValidationResult {
  const issues: IValidationIssue[] = [];
  const registry = getRegistry();

  if (!bom || !Array.isArray(bom) || bom.length === 0) {
    issues.push({
      type: "error",
      subsystem: "BOM",
      message: "BOM is empty or invalid.",
      fixSuggestion: "Add at least one controller and peripheral to the project."
    });
  } else {
    // Check if at least one controller is present
    const hasController = bom.some(item => {
      const regItem = registry[String(item.mpn || item.partId || "").toUpperCase()];
      return regItem && regItem.category === "controller";
    });

    if (!hasController) {
      issues.push({
        type: "warning",
        subsystem: "BOM",
        message: "No microcontroller found in the BOM.",
        fixSuggestion: "Ensure a controller (e.g. ESP32 or Arduino) is added to drive the peripherals."
      });
    }

    bom.forEach((item, index) => {
      const itemKey = item.mpn || item.partId || "";
      const regKey = String(itemKey).toUpperCase();
      const regItem = registry[regKey] || Object.values(registry).find((val: any) => 
        String(val.wokwiType || "").toUpperCase() === regKey || 
        String(val.wokwiType || "").toLowerCase().includes(String(item.name || "").toLowerCase())
      );

      if (!regItem) {
        issues.push({
          type: "warning",
          subsystem: "BOM",
          message: `Component '${item.displayName || itemKey}' [index ${index}] is not found in component registry.`,
          fixSuggestion: `Check registry mappings or use a fallback generic model.`
        });
      } else {
        // Check interface capabilities
        const pins = regItem.pins || [];
        const hasInterfaces = pins.some((p: any) => Array.isArray(p.signals) && p.signals.length > 0);
        if (!hasInterfaces && regItem.category !== "passive") {
          issues.push({
            type: "warning",
            subsystem: "BOM",
            message: `Component '${item.displayName || itemKey}' has no pin interfaces defined in the registry.`,
            fixSuggestion: `Verify the registry definition for '${regKey}' signal metadata.`
          });
        }
      }
    });
  }

  const errors = issues.filter(i => i.type === "error").map(i => i.message);
  const warnings = issues.filter(i => i.type === "warning").map(i => i.message);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    issues
  };
}

/**
 * Validates the Wiring connections against component registry pin lists and signal rules.
 */
export function validateWiring(connections: any[], bom: any[], mcuType: string): IValidationResult {
  const issues: IValidationIssue[] = [];
  const registry = getRegistry();

  if (!connections || !Array.isArray(connections)) {
    return {
      valid: false,
      errors: ["Wiring connection list is missing or invalid."],
      warnings: [],
      issues: [{ type: "error", subsystem: "Wiring", message: "Wiring connection list is missing or invalid." }]
    };
  }

  // 1. Resolve MCU definition
  const normMcu = String(mcuType || "esp32-devkit-v1").toUpperCase();
  let mcuDef = registry[normMcu] || Object.entries(registry).find(([k]) => k.includes(normMcu) || normMcu.includes(k))?.[1];
  if (!mcuDef) {
    // Default fallback to esp32-devkit-v1 if not found
    mcuDef = registry["ESP32-DEVKIT-V1"] || registry["ARDUINO_UNO"];
  }

  const mcuPinNames = mcuDef ? mcuDef.pins.map((p: any) => String(p.name).toUpperCase()) : [];

  // Track pin usages to detect GPIO conflicts
  const mcuPinUsage: Record<string, string[]> = {};
  const connectedPinsMap: Record<string, Set<string>> = {};

  // Initialize helper to track connections per component key
  const componentConnections: Record<string, Set<string>> = {};
  if (bom && Array.isArray(bom)) {
    bom.forEach(item => {
      componentConnections[String(item.key)] = new Set<string>();
    });
  }

  connections.forEach((conn, index) => {
    const fromStr = String(conn.from || "");
    const toStr = String(conn.to || "");
    const net = String(conn.net || "").toUpperCase();

    const [fromComp, fromPin] = fromStr.split(".");
    const [toComp, toPin] = toStr.split(".");

    if (!fromComp || !fromPin || !toComp || !toPin) {
      issues.push({
        type: "error",
        subsystem: "Wiring",
        message: `Connection at index ${index} has invalid format: '${fromStr} -> ${toStr}'.`,
        fixSuggestion: "Connections must be in 'componentKey.pinName' format."
      });
      return;
    }

    // Register connections on each component for disconnected pins check
    if (componentConnections[fromComp]) componentConnections[fromComp].add(fromPin.toUpperCase());
    if (componentConnections[toComp]) componentConnections[toComp].add(toPin.toUpperCase());

    // 2. Short Circuit Detection (VCC directly to GND)
    const isFromPower = fromPin.toUpperCase().includes("VCC") || fromPin.toUpperCase().includes("5V") || fromPin.toUpperCase().includes("3V3") || fromPin.toUpperCase().includes("3.3V") || fromPin.toUpperCase().includes("VDD") || fromPin.toUpperCase().includes("V+");
    const isToPower = toPin.toUpperCase().includes("VCC") || toPin.toUpperCase().includes("5V") || toPin.toUpperCase().includes("3V3") || toPin.toUpperCase().includes("3.3V") || toPin.toUpperCase().includes("VDD") || toPin.toUpperCase().includes("V+");
    const isFromGnd = fromPin.toUpperCase().includes("GND") || fromPin.toUpperCase().includes("V-") || fromPin.toUpperCase().includes("COM");
    const isToGnd = toPin.toUpperCase().includes("GND") || toPin.toUpperCase().includes("V-") || toPin.toUpperCase().includes("COM");

    if ((isFromPower && isToGnd) || (isFromGnd && isToPower)) {
      if (fromComp === toComp || fromComp === "mcu" || toComp === "mcu") {
        issues.push({
          type: "error",
          subsystem: "Wiring",
          message: `Short circuit risk! Direct power-to-ground connection detected: '${fromStr} -> ${toStr}'.`,
          fixSuggestion: "Remove direct connection between power rails and ground lines."
        });
      }
    }

    // 3. MCU Pin Validity Check
    if (fromComp === "mcu" && mcuDef) {
      const pinUpper = fromPin.toUpperCase();
      const isValidMcuPin = mcuPinNames.some((p: string) => p === pinUpper || p.replace(".", "_") === pinUpper || p.replace("-", "_") === pinUpper);
      if (!isValidMcuPin && mcuPinNames.length > 0) {
        issues.push({
          type: "error",
          subsystem: "Wiring",
          message: `MCU pin '${fromPin}' does not exist on target board '${mcuType}'.`,
          fixSuggestion: `Choose a valid pin from the MCU's pins: ${mcuPinNames.slice(0, 10).join(", ")}...`
        });
      }

      // Track MCU pin usage
      if (!mcuPinUsage[pinUpper]) mcuPinUsage[pinUpper] = [];
      mcuPinUsage[pinUpper].push(`${toComp}.${toPin}`);
    }

    if (toComp === "mcu" && mcuDef) {
      const pinUpper = toPin.toUpperCase();
      const isValidMcuPin = mcuPinNames.some((p: string) => p === pinUpper || p.replace(".", "_") === pinUpper || p.replace("-", "_") === pinUpper);
      if (!isValidMcuPin && mcuPinNames.length > 0) {
        issues.push({
          type: "error",
          subsystem: "Wiring",
          message: `MCU pin '${toPin}' does not exist on target board '${mcuType}'.`,
          fixSuggestion: `Choose a valid pin from the MCU's pins: ${mcuPinNames.slice(0, 10).join(", ")}...`
        });
      }

      // Track MCU pin usage
      if (!mcuPinUsage[pinUpper]) mcuPinUsage[pinUpper] = [];
      mcuPinUsage[pinUpper].push(`${fromComp}.${fromPin}`);
    }

    // 4. Interface Compatibility Check
    // Determine from registry what interface capabilities these pins have
    const getPinSignals = (compKey: string, pinName: string) => {
      if (compKey === "mcu") {
        if (!mcuDef) return [];
        const pinDef = mcuDef.pins.find((p: any) => String(p.name).toUpperCase() === pinName.toUpperCase());
        return pinDef?.signals || [];
      }
      const bomItem = bom?.find(b => b.key === compKey);
      if (!bomItem) return [];
      const itemKey = bomItem.mpn || bomItem.partId || "";
      const regItem = registry[String(itemKey).toUpperCase()];
      if (!regItem) return [];
      const pinDef = regItem.pins.find((p: any) => String(p.name).toUpperCase() === pinName.toUpperCase());
      return pinDef?.signals || [];
    };

    const fromSignals = getPinSignals(fromComp, fromPin);
    const toSignals = getPinSignals(toComp, toPin);

    if (fromSignals.length > 0 && toSignals.length > 0) {
      // Check if there's any matching signal type, or if one is generic/GPIO and the other matches standard types
      const fromTypes = fromSignals.map((s: any) => String(s.type).toLowerCase());
      const toTypes = toSignals.map((s: any) => String(s.type).toLowerCase());

      const hasCommonSignal = fromTypes.some((t: string) => toTypes.includes(t)) || 
                             fromTypes.includes("power") || toTypes.includes("power") ||
                             fromTypes.includes("digital") || toTypes.includes("digital") ||
                             fromPin.toUpperCase() === "SIG" || toPin.toUpperCase() === "SIG";

      if (!hasCommonSignal) {
        issues.push({
          type: "warning",
          subsystem: "Wiring",
          message: `Protocol mismatch warning: Pin '${fromStr}' (signals: ${fromTypes.join(", ")}) connected to '${toStr}' (signals: ${toTypes.join(", ")}).`,
          fixSuggestion: "Ensure connections match protocols (e.g. I2C SDA connects to MCU SDA, and SPI MISO to MCU MISO)."
        });
      }
    }
  });

  // 5. Duplicate GPIO Conflicts Check
  for (const [mcuPin, users] of Object.entries(mcuPinUsage)) {
    if (users.length > 1) {
      const pinNameUpper = mcuPin.toUpperCase();
      const isPower = pinNameUpper.includes("GND") || pinNameUpper.includes("VCC") || pinNameUpper.includes("5V") || pinNameUpper.includes("3V3") || pinNameUpper.includes("3.3V") || pinNameUpper.includes("VDD");
      // I2C bus sharing is valid
      const isI2c = users.every(u => u.toUpperCase().includes("SDA") || u.toUpperCase().includes("SCL") || u.toUpperCase().includes("I2C"));

      if (!isPower && !isI2c) {
        issues.push({
          type: "error",
          subsystem: "Wiring",
          message: `GPIO Conflict! MCU pin '${mcuPin}' is connected to multiple peripherals: ${users.join(", ")}.`,
          fixSuggestion: `Reassign one peripheral to another available MCU pin.`
        });
      }
    }
  }

  // 6. Disconnected Required Pins Check (VCC / GND)
  if (bom && Array.isArray(bom)) {
    bom.forEach(item => {
      if (item.role === "controller") return;
      const regItem = registry[String(item.mpn || item.partId || "").toUpperCase()];
      if (!regItem) return;

      const powerPins = regItem.pins.filter((p: any) => 
        p.signals?.some((s: any) => s.type === "power") || 
        ["VCC", "GND", "VDD", "V+", "V-", "5V", "3V3"].includes(String(p.name).toUpperCase())
      );

      const connected = componentConnections[item.key] || new Set();

      powerPins.forEach((p: any) => {
        const pinNameUpper = String(p.name).toUpperCase();
        if (!connected.has(pinNameUpper)) {
          issues.push({
            type: "warning",
            subsystem: "Wiring",
            message: `Required power/ground pin '${item.key}.${p.name}' is disconnected.`,
            fixSuggestion: `Connect '${item.key}.${p.name}' to the MCU's corresponding power/ground rail.`
          });
        }
      });
    });
  }

  const errors = issues.filter(i => i.type === "error").map(i => i.message);
  const warnings = issues.filter(i => i.type === "warning").map(i => i.message);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    issues
  };
}

// ??$$$ newer code
/**
 * Automatically derives dependencies (libraries, board packages, telemetry, communication, and simulator)
 * for a generated project based on its BOM, sketch, and MCU.
 */
export function deriveDependencies(bom: any[], sketch: string, mcu: string): any {
  const libraries = new Set<string>();
  const boardPackages = new Set<string>();
  const platformPackages = new Set<string>();
  const mobileApps = new Set<string>();
  const telemetry = new Set<string>();
  const communication = new Set<string>();
  const simulator = new Set<string>();

  // 1. Parse sketch #include lines
  if (sketch) {
    const includeRegex = /#include\s*[<"]([^>"]+)[>"]/g;
    let match;
    while ((match = includeRegex.exec(sketch)) !== null) {
      const header = match[1];
      libraries.add(header);
    }
  }

  // 2. Scan BOM to add libraries
  const normMcu = String(mcu || "").toLowerCase();
  const hasEsp32 = normMcu.includes("esp32");
  const hasWifi = bom && bom.some((p: any) => String(p.name || p.mpn || "").toLowerCase().includes("wifi") || String(p.name || p.mpn || "").toLowerCase().includes("esp32") || String(p.name || p.mpn || "").toLowerCase().includes("esp-12e"));
  const hasMpu = bom && bom.some((p: any) => String(p.name || p.mpn || "").toLowerCase().includes("mpu6050") || String(p.name || p.mpn || "").toLowerCase().includes("mpu9250") || String(p.name || p.mpn || "").toLowerCase().includes("gyro"));
  const hasDht = bom && bom.some((p: any) => String(p.name || p.mpn || "").toLowerCase().includes("dht"));
  const hasLiquidCrystal = bom && bom.some((p: any) => String(p.name || p.mpn || "").toLowerCase().includes("lcd") || String(p.name || p.mpn || "").toLowerCase().includes("liquidcrystal"));
  const hasServo = bom && bom.some((p: any) => String(p.name || p.mpn || "").toLowerCase().includes("servo"));

  // Add libraries based on components
  if (hasMpu) {
    libraries.add("Adafruit MPU6050");
    libraries.add("Adafruit Unified Sensor");
    libraries.add("Wire.h");
    telemetry.add("MPU6050 IMU Sensor Fusion Protocol");
    telemetry.add("Gyroscope & Accelerometer Telemetry Node");
  }
  if (hasDht) {
    libraries.add("DHT sensor library");
    libraries.add("Adafruit Unified Sensor");
  }
  if (hasLiquidCrystal) {
    libraries.add("LiquidCrystal_I2C");
    libraries.add("Wire.h");
  }
  if (hasServo) {
    libraries.add("Servo");
  }
  if (hasWifi || hasEsp32) {
    libraries.add("WiFi.h");
    communication.add("WebSocket Control Protocol");
    communication.add("WiFi Web Controller Protocol");
  }

  // 3. Board packages
  if (hasEsp32) {
    boardPackages.add("esp32 board package by Espressif Systems");
    platformPackages.add("espressif32 platform");
    simulator.add("Wokwi-ESP32 Board Runner");
  } else if (normMcu.includes("rp2040") || normMcu.includes("pico")) {
    boardPackages.add("Raspberry Pi Pico/RP2040 board package by Earle F. Philhower");
    platformPackages.add("raspberrypi platform");
    simulator.add("Wokwi RP2040 Simulator");
  } else if (normMcu.includes("teensy")) {
    boardPackages.add("Teensy board package by PJRC");
    platformPackages.add("teensy platform");
  } else {
    boardPackages.add("Arduino AVR Boards core package");
    platformPackages.add("avr platform");
    simulator.add("Wokwi Arduino Uno Simulator");
  }

  // 4. Mobile App, Telemetry, Comm, Simulator
  if (hasWifi) {
    mobileApps.add("Custom Mobile Web Controller (HTML5/WebSocket)");
    mobileApps.add("Blynk App dashboard connector");
    communication.add("WebSocket protocol (ws://)");
    communication.add("ESP-NOW peer protocol");
  }
  if (bom && bom.some((p: any) => String(p.name || "").toLowerCase().includes("drone") || String(p.name || "").toLowerCase().includes("flight") || String(p.name || "").toLowerCase().includes("imu"))) {
    telemetry.add("Pitch/Roll/Yaw Pose Est.");
    telemetry.add("Motor Mix Telemetry Feedback");
  }

  simulator.add("Wokwi Simulator Engine (diagram.json)");

  return {
    libraries: Array.from(libraries),
    boardPackages: Array.from(boardPackages),
    platformPackages: Array.from(platformPackages),
    mobileApps: Array.from(mobileApps),
    telemetry: Array.from(telemetry),
    communication: Array.from(communication),
    simulator: Array.from(simulator)
  };
}

// ??$$$ newer code
/**
 * Logs inputs, processes, outputs, and consumers for a pipeline stage.
 */
export async function logPipelineStage(
  targetId: string,
  stage: "ideation" | "bom" | "wiring" | "diagram" | "milestones" | "firmware" | "compilation" | "simulation" | "physicalBuild",
  status: "pending" | "running" | "done" | "failed",
  data: {
    inputs?: any;
    process?: string[];
    outputs?: any;
    consumers?: string[];
    validationStatus?: { valid: boolean; errors: string[]; warnings: string[] };
  }
) {
  try {
    const NewFlowSession = require("../models/newFlowSession.model").default;
    const Project = require("../models/project.model").default;

    let doc: any = await NewFlowSession.findById(targetId);
    if (!doc) {
      doc = await Project.findById(targetId);
    }
    if (!doc) return;

    if (!doc.pipelineStages) doc.pipelineStages = {};
    const currentStage = doc.pipelineStages[stage] || {};

    doc.pipelineStages[stage] = {
      status,
      inputs: data.inputs !== undefined ? data.inputs : currentStage.inputs,
      process: data.process !== undefined ? data.process : currentStage.process || [],
      outputs: data.outputs !== undefined ? data.outputs : currentStage.outputs,
      consumers: data.consumers !== undefined ? data.consumers : currentStage.consumers || [],
      validationStatus: data.validationStatus !== undefined ? data.validationStatus : currentStage.validationStatus || { valid: true, errors: [], warnings: [] },
      updatedAt: new Date()
    };

    doc.markModified("pipelineStages");
    await doc.save();

    const io = (global as any).io;
    if (io) {
      io.to(targetId).emit("pipeline:stage_update", {
        stage,
        stageData: doc.pipelineStages[stage]
      });
    }
  } catch (err) {
    console.error(`[logPipelineStage] Failed to log stage ${stage}:`, err);
  }
}

/**
 * Logs a pipeline execution failure (subsystem error, self-correction attempt, results).
 */
export async function logPipelineFailure(
  targetId: string,
  subsystem: string,
  input: any,
  error: string,
  reason: string,
  fixApplied: string = "",
  status: "failed" | "retry_successful" | "retrying" = "failed"
) {
  try {
    const NewFlowSession = require("../models/newFlowSession.model").default;
    const Project = require("../models/project.model").default;

    let doc: any = await NewFlowSession.findById(targetId);
    if (!doc) {
      doc = await Project.findById(targetId);
    }
    if (!doc) return;

    if (!doc.pipelineFailures) doc.pipelineFailures = [];

    doc.pipelineFailures.push({
      subsystem,
      input,
      error,
      reason,
      attemptCount: 1,
      fixApplied,
      status,
      timestamp: new Date()
    });

    doc.markModified("pipelineFailures");
    await doc.save();

    const io = (global as any).io;
    if (io) {
      io.to(targetId).emit("pipeline:failure_update", {
        failures: doc.pipelineFailures
      });
    }
  } catch (err) {
    console.error(`[logPipelineFailure] Failed to log failure:`, err);
  }
}
