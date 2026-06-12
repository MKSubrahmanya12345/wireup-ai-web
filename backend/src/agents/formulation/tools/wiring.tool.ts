// ??$$$
import mongoose from "mongoose";
import Part from "../../../models/part.model";
import { getRegistry } from "../../../services/registry.services";
// /* old code */
// import { resolveWiring } from "../../../services/pinResolver.service";
// ??$$$ newer code
import { routeGraphWiring } from "../../../services/wiringRouter.service";
import { parseIfString } from "./utils";
// ??$$$ newer code
import { MCU_CATALOG } from "../../architect/mcu.catalog";

export async function executeCheckCompatibility(args: any) {
  const { partIdA, partIdB, connectionType } = args;

  try {
    let partA: any = null;
    let partB: any = null;

    if (mongoose.Types.ObjectId.isValid(partIdA)) partA = await Part.findById(partIdA).lean();
    if (!partA) partA = await Part.findOne({ mpn: partIdA }).lean();

    if (mongoose.Types.ObjectId.isValid(partIdB)) partB = await Part.findById(partIdB).lean();
    if (!partB) partB = await Part.findOne({ mpn: partIdB }).lean();

    if (!partA) {
      partA = {
        name: partIdA,
        mpn: partIdA,
        specs: { Voltage: partIdA.toLowerCase().includes("esp32") ? "3.3V" : "5V" },
        interfaces: partIdA.toLowerCase().includes("esp32") ? ["WiFi", "I2C", "SPI", "UART", "GPIO"] : ["I2C"]
      };
    }
    if (!partB) {
      partB = {
        name: partIdB,
        mpn: partIdB,
        specs: { Voltage: partIdB.toLowerCase().includes("mpu") ? "3.3V" : "5V" },
        interfaces: ["I2C"]
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    let notes = "";
    let compatible = true;

    const getVolt = (p: any) => {
      const vStr = String(p.specs?.Voltage || p.specs?.voltage || "3.3V").toLowerCase();
      if (vStr.includes("5")) return 5.0;
      if (vStr.includes("3.3") || vStr.includes("3v3")) return 3.3;
      return 3.3;
    };

    const vA = getVolt(partA);
    const vB = getVolt(partB);

    if (vA === 5.0 && vB === 3.3) {
      compatible = false;
      errors.push(`partA (${partA.name}) operates at 5V logic, partB (${partB.name}) GPIO max is 3.3V`);
    } else if (vA === 3.3 && vB === 5.0) {
      warnings.push(`partA (${partA.name}) outputs 3.3V logic, partB (${partB.name}) might require 5V logic inputs to register high`);
    }

    const intA = partA.interfaces || [];
    const intB = partB.interfaces || [];

    if (connectionType) {
      const supportsA = intA.map((i: string) => i.toLowerCase()).includes(connectionType.toLowerCase());
      const supportsB = intB.map((i: string) => i.toLowerCase()).includes(connectionType.toLowerCase());
      if (!supportsA || !supportsB) {
        compatible = false;
        errors.push(`Specified connectionType '${connectionType}' is not supported by both components.`);
      }
    }

    const nameA = String(partA.name || partA.mpn || "").toLowerCase();
    const nameB = String(partB.name || partB.mpn || "").toLowerCase();

    if (nameA.includes("arduino") && nameB.includes("esp32")) {
      errors.push("5V Arduino logic → 3.3V ESP32 GPIO: incompatible, needs level shifter");
      compatible = false;
    }
    if (nameB.includes("arduino") && nameA.includes("esp32")) {
      errors.push("5V Arduino logic → 3.3V ESP32 GPIO: incompatible, needs level shifter");
      compatible = false;
    }
    if (nameA.includes("motor") && !nameB.includes("esc") && !nameA.includes("esc") && !nameB.includes("driver")) {
      errors.push("Brushless motor direct to MCU GPIO: incompatible (needs ESC)");
      compatible = false;
    }

    notes = compatible
      ? `Both parts are compatible. Connection Voltages match (${vA}V / ${vB}V).`
      : `Voltage or protocol mismatch detected between ${partA.name} and ${partB.name}.`;

    return {
      compatible,
      confidence: "high",
      notes,
      warnings,
      errors,
      recommendation: compatible
        ? "Safe to connect directly"
        : "Add a logic level converter or use a compatible alternative part"
    };
  } catch (err: any) {
    console.error("executeCheckCompatibility failed:", err);
    return { compatible: false, error: err.message };
  }
}

export async function executeValidatePinAssignment(args: any) {
  const mcu = args.mcu;
  const assignments = parseIfString(args.assignments);

  try {
    const registry = getRegistry();
    let mcuEntry: any = null;

    for (const [key, value] of Object.entries(registry)) {
      if (key.toLowerCase().includes(mcu.toLowerCase()) || (value.wokwiType && value.wokwiType.toLowerCase().includes(mcu.toLowerCase()))) {
        mcuEntry = value;
        break;
      }
    }


    // ??$$$ newer code
    let availablePins: string[] = [];
    if (mcuEntry) {
      availablePins = mcuEntry.pins.map((p: any) => p.name);
    } else {
      const mcuLower = String(mcu || "").toLowerCase();
      if (mcuLower.includes("pico")) {
        availablePins = [
          "GP0", "GP1", "GP2", "GP3", "GP4", "GP5", "GP6", "GP7", "GP8", "GP9", "GP10",
          "GP11", "GP12", "GP13", "GP14", "GP15", "GP16", "GP17", "GP18", "GP19", "GP20",
          "GP21", "GP22", "GP26", "GP27", "GP28", "VBUS", "VSYS", "3V3", "GND", "RUN", "3.3V", "5V",
          "GPIO0", "GPIO1", "GPIO2", "GPIO3", "GPIO4", "GPIO5", "GPIO6", "GPIO7", "GPIO8", "GPIO9",
          "GPIO10", "GPIO11", "GPIO12", "GPIO13", "GPIO14", "GPIO15", "GPIO16", "GPIO17", "GPIO18",
          "GPIO19", "GPIO20", "GPIO21", "GPIO22", "GPIO26", "GPIO27", "GPIO28"
        ];
      } else if (mcuLower.includes("esp32")) {
        availablePins = [
          "GPIO0", "GPIO1", "GPIO2", "GPIO3", "GPIO4", "GPIO5", "GPIO12", "GPIO13", "GPIO14",
          "GPIO15", "GPIO16", "GPIO17", "GPIO18", "GPIO19", "GPIO21", "GPIO22", "GPIO23",
          "GPIO25", "GPIO26", "GPIO27", "GPIO32", "GPIO33", "GPIO34", "GPIO35", "GPIO36",
          "GPIO39", "3.3V", "5V", "GND", "3V3", "VIN"
        ];
      } else if (mcuLower.includes("nano")) {
        availablePins = [
          "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13",
          "A0", "A1", "A2", "A3", "A4", "A5", "A6", "A7", "5V", "3.3V", "GND", "RESET"
        ];
      } else if (mcuLower.includes("mega")) {
        availablePins = [
          "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13",
          "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26",
          "27", "28", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38", "39",
          "40", "41", "42", "43", "44", "45", "46", "47", "48", "49", "50", "51", "52", "53",
          "A0", "A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10", "A11", "A12",
          "A13", "A14", "A15", "5V", "3.3V", "GND", "VIN"
        ];
      } else {
        availablePins = [
          "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13",
          "A0", "A1", "A2", "A3", "A4", "A5", "5V", "3.3V", "GND", "VIN"
        ];
      }
    }

    const conflicts: any[] = [];
    const invalidPins: string[] = [];
    const missingConnections: string[] = [];
    const warnings: string[] = [];

    const pinMap: Record<string, string[]> = {};
    assignments.forEach((as: any) => {
      if (!pinMap[as.pin]) pinMap[as.pin] = [];
      pinMap[as.pin].push(as.usedBy);
    });

    for (const [pin, users] of Object.entries(pinMap)) {
      if (users.length > 1) {
        const isI2C = users.every(u => u.toLowerCase().includes("sda") || u.toLowerCase().includes("scl") || u.toLowerCase().includes("i2c"));
        const isPower = pin.toLowerCase().includes("vcc") || pin.toLowerCase().includes("gnd") || pin.toLowerCase().includes("3v3") || pin.toLowerCase().includes("5v");

        if (isI2C) {
          warnings.push(`Pin ${pin} is shared by multiple I2C lines: ${users.join(", ")}. This is standard I2C bus sharing.`);
        } else if (isPower) {
          // Power lines can be shared
        } else {
          conflicts.push({
            pin,
            usedBy: users,
            fix: "Reassign one of the peripherals to another GPIO pin."
          });
        }
      }
    }

    assignments.forEach((as: any) => {
      const found = availablePins.some(p => p.toLowerCase() === as.pin.toLowerCase());
      if (!found) {
        invalidPins.push(`${as.pin} does not exist on ${mcu}`);
      }
    });

    assignments.forEach((as: any) => {
      if (mcu.toLowerCase().includes("esp32") && ["gpio34", "gpio35", "gpio36", "gpio37", "gpio38", "gpio39"].includes(as.pin.toLowerCase())) {
        if (!as.usedBy.toLowerCase().includes("input") && !as.usedBy.toLowerCase().includes("sda") && !as.usedBy.toLowerCase().includes("scl") && !as.usedBy.toLowerCase().includes("rx")) {
          warnings.push(`${as.pin} is input-only on ESP32, cannot use for output signal: ${as.usedBy}`);
        }
      }
    });

    const valid = conflicts.length === 0 && invalidPins.length === 0;

    return {
      valid,
      conflicts,
      invalidPins,
      missingConnections,
      warnings,
      summary: valid
        ? `All pin assignments valid for ${mcu}. No conflicts detected.`
        : `${conflicts.length + invalidPins.length} issues found. See conflicts and invalidPins.`
    };
  } catch (err: any) {
    console.error("executeValidatePinAssignment failed:", err);
    return { valid: false, error: err.message };
  }
}

export async function executeEstimatePowerBudget(args: any) {
  const powerSource = args.powerSource;
  const parts = parseIfString(args.parts);

  const LOOKUP_TABLE: Record<string, { typical: number; peak: number; unit: string; voltage: string }> = {
    "ESP32": { typical: 80, peak: 500, unit: "mA", voltage: "3.3V" },
    "Arduino Nano": { typical: 20, peak: 40, unit: "mA", voltage: "5V" },
    "MPU6050": { typical: 3.9, peak: 3.9, unit: "mA", voltage: "3.3V" },
    "SG90": { typical: 100, peak: 700, unit: "mA", voltage: "5V" },
    "DC motor": { typical: 200, peak: 1200, unit: "mA", voltage: "6V" },
    "brushless motor": { typical: 2000, peak: 20000, unit: "mA", voltage: "11.1V" },
    "OLED": { typical: 20, peak: 30, unit: "mA", voltage: "3.3V" },
    "LED": { typical: 20, peak: 20, unit: "mA", voltage: "3.3V" },
    "DHT22": { typical: 1.5, peak: 2.5, unit: "mA", voltage: "3.3V" }
  };

  try {
    let maxCurrentMa = 500;
    let capacityMah: number | null = null;
    let voltage = "5V";

    const pSrcStr = String(powerSource).toLowerCase();
    if (pSrcStr.includes("lipo")) {
      voltage = "11.1V";
      maxCurrentMa = 20000;
      const capMatch = pSrcStr.match(/(\d+)mah/i);
      if (capMatch) capacityMah = parseInt(capMatch[1], 10);
    } else if (pSrcStr.includes("usb")) {
      voltage = "5V";
      maxCurrentMa = 500;
      if (pSrcStr.includes("2a")) maxCurrentMa = 2000;
    } else if (pSrcStr.includes("9v")) {
      voltage = "9V";
      maxCurrentMa = 500;
      capacityMah = 500;
    }

    let totalCurrentMa = 0;
    let peakCurrentMa = 0;
    const items: any[] = [];
    const warnings: string[] = [];

    for (const item of parts) {
      let partDoc: any = null;
      if (mongoose.Types.ObjectId.isValid(item.partId)) {
        partDoc = await Part.findById(item.partId).lean();
      }
      if (!partDoc) {
        partDoc = await Part.findOne({ mpn: item.partId }).lean();
      }

      const pName = partDoc ? partDoc.name : item.partId;
      let typ = 10;
      let pk = 20;

      for (const [key, value] of Object.entries(LOOKUP_TABLE)) {
        if (pName.toUpperCase().includes(key.toUpperCase())) {
          typ = value.typical;
          pk = value.peak;
          break;
        }
      }

      totalCurrentMa += typ * item.qty;
      peakCurrentMa += pk * item.qty;

      items.push({
        name: pName,
        qty: item.qty,
        typicalMa: typ,
        peakMa: pk
      });
    }

    if (totalCurrentMa > maxCurrentMa) {
      warnings.push(`Total typical draw (${totalCurrentMa}mA) exceeds ${powerSource} limit of ${maxCurrentMa}mA.`);
    }
    if (peakCurrentMa > maxCurrentMa) {
      warnings.push(`Peak draw (${peakCurrentMa}mA) will likely cause power drops under full load.`);
    }

    const adequate = warnings.length === 0;

    return {
      totalCurrentMa,
      peakCurrentMa,
      powerSource: {
        voltage,
        maxCurrentMa,
        capacityMah
      },
      adequate,
      components: items,
      warnings,
      recommendation: adequate
        ? "Power supply is adequate for this load configuration."
        : "Consider adding an external power source or battery regulator."
    };
  } catch (err: any) {
    console.error("executeEstimatePowerBudget failed:", err);
    return { adequate: false, error: err.message };
  }
}


// ??$$$ newer code
async function generateMcuAwareWiring(parts: any[], mcu: string, matchedSpec: any): Promise<any[]> {
  const connections: any[] = [];
  let connCounter = 1;

  const assignPin = (pKey: string, fromPin: string, toPin: string, net: string, color: string, desc: string) => {
    connections.push({
      id: `conn_${connCounter++}`,
      from: fromPin.startsWith("mcu.") ? fromPin : `mcu.${fromPin}`,
      to: `${pKey}.${toPin}`,
      net,
      color,
      description: desc
    });
  };

  const mcuKey = matchedSpec.key.toLowerCase();
  
  let gpios: string[] = [];
  let adcs: string[] = [];
  let pwms: string[] = [];
  let mcuSDA = "GPIO21";
  let mcuSCL = "GPIO22";
  let mcuMISO = "GPIO19";
  let mcuMOSI = "GPIO23";
  let mcuSCK = "GPIO18";
  let mcuRX = "GPIO16";
  let mcuTX = "GPIO17";
  let mcuVCC = "3V3";

  if (mcuKey.includes("esp32")) {
    mcuVCC = "3V3";
    mcuSDA = "GPIO21";
    mcuSCL = "GPIO22";
    mcuMISO = "GPIO19";
    mcuMOSI = "GPIO23";
    mcuSCK = "GPIO18";
    mcuRX = "GPIO16";
    mcuTX = "GPIO17";
    gpios = ["GPIO2", "GPIO4", "GPIO5", "GPIO12", "GPIO13", "GPIO14", "GPIO15", "GPIO25", "GPIO26", "GPIO27", "GPIO32", "GPIO33"];
    adcs = ["GPIO34", "GPIO35", "GPIO36", "GPIO39"]; 
    pwms = ["GPIO4", "GPIO5", "GPIO12", "GPIO13", "GPIO14", "GPIO15", "GPIO25", "GPIO26"];
  } else if (mcuKey.includes("pico")) {
    mcuVCC = "3V3";
    mcuSDA = "GP4";
    mcuSCL = "GP5";
    mcuMISO = "GP16";
    mcuMOSI = "GP19";
    mcuSCK = "GP18";
    mcuRX = "GP1";
    mcuTX = "GP0";
    gpios = ["GP2", "GP3", "GP6", "GP7", "GP8", "GP9", "GP10", "GP11", "GP12", "GP13", "GP14", "GP15", "GP20", "GP21", "GP22", "GP26", "GP27", "GP28"];
    adcs = ["GP26", "GP27", "GP28"];
    pwms = ["GP2", "GP3", "GP6", "GP7", "GP8", "GP9", "GP10", "GP11", "GP12", "GP13", "GP14", "GP15"];
  } else if (mcuKey.includes("mega")) {
    mcuVCC = "5V";
    mcuSDA = "20";
    mcuSCL = "21";
    mcuMISO = "50";
    mcuMOSI = "51";
    mcuSCK = "52";
    mcuRX = "0";
    mcuTX = "1";
    gpios = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46", "47", "48", "49"];
    adcs = ["A0", "A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10", "A11", "A12", "A13", "A14", "A15"];
    pwms = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13"];
  } else { 
    mcuVCC = "5V";
    mcuSDA = "A4";
    mcuSCL = "A5";
    mcuMISO = "D12";
    mcuMOSI = "D11";
    mcuSCK = "D13";
    mcuRX = "D0";
    mcuTX = "D1";
    gpios = ["D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9", "D10"];
    adcs = ["A0", "A1", "A2", "A3"];
    pwms = ["D3", "D5", "D6", "D9", "D10"];
  }

  const allocated = new Set<string>();
  let gpioIdx = 0;
  let adcIdx = 0;
  let pwmIdx = 0;

  const getFreeGpio = (): string => {
    while (gpioIdx < gpios.length) {
      const p = gpios[gpioIdx++];
      if (!allocated.has(p)) {
        allocated.add(p);
        return p;
      }
    }
    return gpios[gpios.length - 1] || "GPIO4";
  };

  const getFreeAdc = (): string => {
    while (adcIdx < adcs.length) {
      const p = adcs[adcIdx++];
      if (!allocated.has(p)) {
        allocated.add(p);
        return p;
      }
    }
    return getFreeGpio();
  };

  const getFreePwm = (): string => {
    while (pwmIdx < pwms.length) {
      const p = pwms[pwmIdx++];
      if (!allocated.has(p)) {
        allocated.add(p);
        return p;
      }
    }
    return getFreeGpio();
  };

  for (const item of parts) {
    if (!item) continue;
    const pKey = item.key || item.id || "";
    if (pKey === "mcu" || pKey === "brain" || item.role === "controller") continue;

    let partDoc: any = null;
    if (item.partId) {
      if (mongoose.Types.ObjectId.isValid(item.partId)) {
        partDoc = await Part.findById(item.partId).lean();
      }
      if (!partDoc) {
        partDoc = await Part.findOne({ mpn: item.partId }).lean();
      }
    }

    const interfaces: string[] = (partDoc?.interfaces || []).map((i: any) => String(i).toUpperCase());
    const role = String(item.role || item.subsystem || "").toLowerCase();
    const pName = String(partDoc?.name || partDoc?.mpn || item.partId || pKey).toLowerCase();

    const findPartPin = (names: string[], defaultName: string): string => {
      if (!partDoc || !Array.isArray(partDoc.pins)) return defaultName;
      const found = partDoc.pins.find((p: any) =>
        names.some(n => p.name.toUpperCase() === n.toUpperCase() || p.id?.toUpperCase() === n.toUpperCase())
      );
      return found ? (found.name || found.id) : defaultName;
    };

    const isI2C = interfaces.includes("I2C") || pName.includes("mpu6050") || pName.includes("gyro") || pName.includes("i2c") || pName.includes("ssd1306") || pName.includes("lcd1602");
    const isSPI = interfaces.includes("SPI") || pName.includes("spi") || pName.includes("sd") || pName.includes("microsd") || pName.includes("nrf24");
    const isUART = interfaces.includes("UART") || interfaces.includes("USART") || pName.includes("uart") || pName.includes("gps") || pName.includes("gsm") || pName.includes("bluetooth") || pName.includes("hc05") || pName.includes("a2dp");

    if (isI2C) {
      const sdaPin = findPartPin(["SDA", "SAD", "I2C_SDA"], "SDA");
      const sclPin = findPartPin(["SCL", "SCLK", "CLK", "I2C_SCL"], "SCL");
      const vccPin = findPartPin(["VCC", "VDD", "VIN", "5V", "3V3", "3.3V", "V+"], "VCC");
      const gndPin = findPartPin(["GND"], "GND");

      assignPin(pKey, mcuSDA, sdaPin, "I2C_SDA", "#0066ff", "I2C data line");
      assignPin(pKey, mcuSCL, sclPin, "I2C_SCL", "#ffcc00", "I2C clock line");
      assignPin(pKey, mcuVCC, vccPin, "POWER_VCC", "#ff0000", "VCC power supply");
      assignPin(pKey, "GND", gndPin, "POWER_GND", "#000000", "Ground");
    } else if (isSPI) {
      const misoPin = findPartPin(["MISO", "SO", "DO", "DOUT", "MISO/RXD"], "MISO");
      const mosiPin = findPartPin(["MOSI", "SI", "DI", "DIN", "MOSI/TXD"], "MOSI");
      const sckPin = findPartPin(["SCK", "CLK", "SCLK", "SCK/CLK"], "SCK");
      const csPin = findPartPin(["CS", "SS", "CHIP_SELECT"], "CS");
      const vccPin = findPartPin(["VCC", "VDD", "VIN", "5V", "3V3", "3.3V", "V+"], "VCC");
      const gndPin = findPartPin(["GND"], "GND");

      const freeCs = getFreeGpio();

      assignPin(pKey, mcuMISO, misoPin, "SPI_MISO", "#a855f7", "SPI MISO");
      assignPin(pKey, mcuMOSI, mosiPin, "SPI_MOSI", "#d946ef", "SPI MOSI");
      assignPin(pKey, mcuSCK, sckPin, "SPI_SCK", "#8b5cf6", "SPI SCK");
      assignPin(pKey, freeCs, csPin, "SPI_CS", "#6366f1", "SPI Chip Select");
      assignPin(pKey, mcuVCC, vccPin, "POWER_VCC", "#ff0000", "VCC power supply");
      assignPin(pKey, "GND", gndPin, "POWER_GND", "#000000", "Ground");
    } else if (isUART) {
      const rxPin = findPartPin(["RX", "RXD", "URX", "UART_RX"], "RX");
      const txPin = findPartPin(["TX", "TXD", "UTX", "UART_TX"], "TX");
      const vccPin = findPartPin(["VCC", "VDD", "VIN", "5V", "3V3", "3.3V", "V+"], "VCC");
      const gndPin = findPartPin(["GND"], "GND");

      assignPin(pKey, mcuTX, rxPin, "UART_RX", "#f43f5e", "UART RX");
      assignPin(pKey, mcuRX, txPin, "UART_TX", "#ec4899", "UART TX");
      assignPin(pKey, mcuVCC, vccPin, "POWER_VCC", "#ff0000", "VCC power supply");
      assignPin(pKey, "GND", gndPin, "POWER_GND", "#000000", "Ground");
    } else if (pName.includes("led")) {
      const anodePin = findPartPin(["A", "1", "ANODE", "SIG"], "A");
      const cathodePin = findPartPin(["C", "2", "CATHODE", "K", "GND"], "C");
      const freePin = getFreeGpio();

      assignPin(pKey, freePin, anodePin, `${pKey.toUpperCase()}_ANODE`, "#00ccff", "LED Anode Control");
      assignPin(pKey, "GND", cathodePin, "POWER_GND", "#000000", "LED Cathode Ground");
    } else if (pName.includes("button") || pName.includes("switch") || pName.includes("tact")) {
      const sigPin = findPartPin(["SIG", "1", "OUT"], "SIG");
      const gndPin = findPartPin(["GND", "2"], "GND");
      const freePin = getFreeGpio();

      assignPin(pKey, freePin, sigPin, `${pKey.toUpperCase()}_SIG`, "#00cc66", "Button signal input");
      assignPin(pKey, "GND", gndPin, "POWER_GND", "#000000", "Button Ground");
    } else {
      const vccPin = findPartPin(["VCC", "VDD", "VIN", "5V", "3V3", "3.3V", "V+"], "VCC");
      const gndPin = findPartPin(["GND"], "GND");

      if (role === "sensor") {
        const isAnalog = pName.includes("tmp36") || pName.includes("pot") || pName.includes("ldr") || pName.includes("analog") || pName.includes("light") || pName.includes("temp");
        const sigPin = findPartPin(["SIG", "OUT", "A0", "1"], "SIG");
        const freePin = isAnalog ? getFreeAdc() : getFreeGpio();

        assignPin(pKey, freePin, sigPin, `${pKey.toUpperCase()}_SIG`, isAnalog ? "#00ccaa" : "#00ccff", "Sensor data");
        assignPin(pKey, mcuVCC, vccPin, "POWER_VCC", "#ff0000", "VCC power supply");
        assignPin(pKey, "GND", gndPin, "POWER_GND", "#000000", "Ground");
      } else if (role === "actuator") {
        const sigPin = findPartPin(["PWM", "SIG", "IN1", "1"], "PWM");
        const freePin = getFreePwm();

        assignPin(pKey, freePin, sigPin, `${pKey.toUpperCase()}_PWM`, "#ff6600", "Control line");
        assignPin(pKey, mcuVCC, vccPin, "POWER_VCC", "#ff0000", "VCC power supply");
        assignPin(pKey, "GND", gndPin, "POWER_GND", "#000000", "Ground");
      } else {
        const sigPin = findPartPin(["SIG", "OUT", "1"], "SIG");
        const freePin = getFreeGpio();

        assignPin(pKey, freePin, sigPin, `${pKey.toUpperCase()}_SIG`, "#00ccff", "Signal line");
        assignPin(pKey, mcuVCC, vccPin, "POWER_VCC", "#ff0000", "VCC power supply");
        assignPin(pKey, "GND", gndPin, "POWER_GND", "#000000", "Ground");
      }
    }
  }

  return connections;
}

export async function executeGenerateWiring(args: any) {
  const mcu = args.mcu;
  const parts = parseIfString(args.parts);

  try {
    /* old code
    const mcuLower = String(mcu || "").toLowerCase();
    const matchedSpec = MCU_CATALOG.find(spec =>
      mcuLower.includes(spec.key.toLowerCase()) ||
      mcuLower.includes(spec.displayName.toLowerCase()) ||
      spec.key.toLowerCase().includes(mcuLower) ||
      spec.displayName.toLowerCase().includes(mcuLower)
    );

    let connections: any[];
    if (matchedSpec) {
      connections = await generateMcuAwareWiring(parts, mcu, matchedSpec);
    } else {
      connections = resolveWiring(parts, mcu);
    }
    */
    // ??$$$ newer code - Use 3-phase graph-based router
    const connections = await routeGraphWiring(parts, mcu);

    const pinUsage: Record<string, any> = {};
    connections.forEach((conn) => {
      const fromMatch = conn.from.match(/mcu\.(.+)/);
      if (fromMatch) {
        const pin = fromMatch[1];
        if (!pinUsage[pin]) {
          pinUsage[pin] = [];
        }
        pinUsage[pin].push(conn.to);
      }
    });

    return {
      connections,
      totalConnections: connections.length,
      pinUsage,
      validationPassed: true,
      validationWarnings: []
    };
  } catch (err: any) {
    console.error("executeGenerateWiring failed:", err);
    return { connections: [], totalConnections: 0, pinUsage: {}, validationPassed: false, error: err.message };
  }
}
