import fs from "fs";
import path from "path";

const targetFile = path.resolve(__dirname, "../services/pinResolver.service.ts");
let content = fs.readFileSync(targetFile, "utf8");

const startMarker = "// ??$$$ newer code — get fallback standard pins for popular components";
const endMarker = "async function resolvePins(";

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error("Markers not found!");
  process.exit(1);
}

const newFallbackPinsCode = `// ??$$$ newer code — get fallback standard pins for popular components
function getFallbackPins(mpn: string): any[] {
  const norm = mpn.toUpperCase();
  
  if (norm.includes("ESP32") || norm.includes("ESP-32") || norm.includes("WROOM")) {
    const pinNames = [
      "3V3", "EN", "GPIO36", "GPIO39", "GPIO34", "GPIO35", "GPIO32", "GPIO33", "GPIO25", "GPIO26", "GPIO27", "GPIO14", "GPIO12", "GPIO13", "GND",
      "VIN", "GPIO23", "GPIO22", "GPIO1", "GPIO3", "GPIO21", "GPIO19", "GPIO18", "GPIO5", "GPIO17", "GPIO16", "GPIO4", "GPIO2", "GPIO15", "GND"
    ];
    return pinNames.map((name, idx) => ({
      id: name,
      name: name,
      x_mm: idx * 2.54,
      y_mm: 0,
      z_mm: 0,
      type: name.includes("GND") ? "gnd" : (name === "3V3" || name === "VIN" || name === "5V" ? "power" : (["GPIO34", "GPIO35", "GPIO36", "GPIO39"].includes(name) ? "analog" : "digital"))
    }));
  }

  if (norm.includes("ARDUINO") || norm.includes("UNO") || norm.includes("ATMEGA328")) {
    const pinNames = [
      "D0", "D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9", "D10", "D11", "D12", "D13",
      "A0", "A1", "A2", "A3", "A4", "A5", "5V", "3V3", "GND", "RESET", "AREF"
    ];
    return pinNames.map((name, idx) => ({
      id: name,
      name: name,
      x_mm: idx * 2.54,
      y_mm: 0,
      z_mm: 0,
      type: name.includes("GND") ? "gnd" : (name.includes("5V") || name.includes("3V3") ? "power" : (name.startsWith("A") ? "analog" : "digital"))
    }));
  }

  if (norm.includes("MAX98357") || norm.includes("PCM5102") || norm.includes("DAC") || norm.includes("I2S-DAC")) {
    return [
      { id: "LRC", name: "LRC", x_mm: 0, y_mm: 0, z_mm: 0, type: "digital" },
      { id: "BCLK", name: "BCLK", x_mm: 2.54, y_mm: 0, z_mm: 0, type: "digital" },
      { id: "DIN", name: "DIN", x_mm: 5.08, y_mm: 0, z_mm: 0, type: "digital" },
      { id: "GAIN", name: "GAIN", x_mm: 7.62, y_mm: 0, z_mm: 0, type: "digital" },
      { id: "SD", name: "SD", x_mm: 10.16, y_mm: 0, z_mm: 0, type: "digital" },
      { id: "VCC", name: "VCC", x_mm: 12.7, y_mm: 0, z_mm: 0, type: "power" },
      { id: "GND", name: "GND", x_mm: 15.24, y_mm: 0, z_mm: 0, type: "gnd" },
      { id: "OUT+", name: "OUT+", x_mm: 17.78, y_mm: 0, z_mm: 0, type: "analog" },
      { id: "OUT-", name: "OUT-", x_mm: 20.32, y_mm: 0, z_mm: 0, type: "analog" }
    ];
  }

  if (norm.includes("PAM8403") || norm.includes("LM386") || norm.includes("AMPLIFIER") || norm.includes("AMP")) {
    return [
      { id: "VCC", name: "VCC", x_mm: 0, y_mm: 0, z_mm: 0, type: "power" },
      { id: "GND", name: "GND", x_mm: 2.54, y_mm: 0, z_mm: 0, type: "gnd" },
      { id: "LIN", name: "LIN", x_mm: 5.08, y_mm: 0, z_mm: 0, type: "analog" },
      { id: "RIN", name: "RIN", x_mm: 7.62, y_mm: 0, z_mm: 0, type: "analog" },
      { id: "GND_AUD", name: "GND_AUD", x_mm: 10.16, y_mm: 0, z_mm: 0, type: "gnd" },
      { id: "L+", name: "L+", x_mm: 12.7, y_mm: 0, z_mm: 0, type: "analog" },
      { id: "L-", name: "L-", x_mm: 15.24, y_mm: 0, z_mm: 0, type: "analog" },
      { id: "R+", name: "R+", x_mm: 17.78, y_mm: 0, z_mm: 0, type: "analog" },
      { id: "R-", name: "R-", x_mm: 20.32, y_mm: 0, z_mm: 0, type: "analog" }
    ];
  }

  if (norm.includes("PJ-32") || norm.includes("JACK") || norm.includes("HEADPHONE") || norm.includes("SPEAKER") || norm.includes("AUDIO_JACK")) {
    return [
      { id: "L", name: "L", x_mm: 0, y_mm: 0, z_mm: 0, type: "analog" },
      { id: "R", name: "R", x_mm: 2.54, y_mm: 0, z_mm: 0, type: "analog" },
      { id: "GND", name: "GND", x_mm: 5.08, y_mm: 0, z_mm: 0, type: "gnd" }
    ];
  }

  if (norm.includes("MICROSD") || norm.includes("SD-CARD") || norm.includes("SDCARD") || norm.includes("STORAGE")) {
    return [
      { id: "CS", name: "CS", x_mm: 0, y_mm: 0, z_mm: 0, type: "digital" },
      { id: "SCK", name: "SCK", x_mm: 2.54, y_mm: 0, z_mm: 0, type: "digital" },
      { id: "MOSI", name: "MOSI", x_mm: 5.08, y_mm: 0, z_mm: 0, type: "digital" },
      { id: "MISO", name: "MISO", x_mm: 7.62, y_mm: 0, z_mm: 0, type: "digital" },
      { id: "VCC", name: "VCC", x_mm: 10.16, y_mm: 0, z_mm: 0, type: "power" },
      { id: "GND", name: "GND", x_mm: 12.7, y_mm: 0, z_mm: 0, type: "gnd" }
    ];
  }

  if (norm.includes("SSD1306") || norm.includes("OLED") || norm.includes("DISPLAY") || norm.includes("LCD") || norm.includes("1602") || norm.includes("16X2")) {
    return [
      { id: "SCL", name: "SCL", x_mm: 0, y_mm: 0, z_mm: 0, type: "digital" },
      { id: "SDA", name: "SDA", x_mm: 2.54, y_mm: 0, z_mm: 0, type: "digital" },
      { id: "VCC", name: "VCC", x_mm: 5.08, y_mm: 0, z_mm: 0, type: "power" },
      { id: "GND", name: "GND", x_mm: 7.62, y_mm: 0, z_mm: 0, type: "gnd" }
    ];
  }

  if (norm.includes("TP4056") || norm.includes("CHARGER")) {
    return [
      { id: "IN+", name: "IN+", x_mm: 0, y_mm: 0, z_mm: 0, type: "power" },
      { id: "IN-", name: "IN-", x_mm: 2.54, y_mm: 0, z_mm: 0, type: "gnd" },
      { id: "BAT+", name: "BAT+", x_mm: 5.08, y_mm: 0, z_mm: 0, type: "power" },
      { id: "BAT-", name: "BAT-", x_mm: 7.62, y_mm: 0, z_mm: 0, type: "gnd" },
      { id: "OUT+", name: "OUT+", x_mm: 10.16, y_mm: 0, z_mm: 0, type: "power" },
      { id: "OUT-", name: "OUT-", x_mm: 12.7, y_mm: 0, z_mm: 0, type: "gnd" }
    ];
  }

  if (norm.includes("LIPO") || norm.includes("BATTERY")) {
    return [
      { id: "BAT+", name: "BAT+", x_mm: 0, y_mm: 0, z_mm: 0, type: "power" },
      { id: "BAT-", name: "BAT-", x_mm: 2.54, y_mm: 0, z_mm: 0, type: "gnd" }
    ];
  }

  if (norm.includes("DHT") || norm.includes("AM2302")) {
    return [
      { id: "VCC", name: "VCC", x_mm: 0, y_mm: 0, z_mm: 0, type: "power" },
      { id: "GND", name: "GND", x_mm: 2.54, y_mm: 0, z_mm: 0, type: "gnd" },
      { id: "SIG", name: "SIG", x_mm: 5.08, y_mm: 0, z_mm: 0, type: "digital" }
    ];
  }

  if (norm.includes("HC-SR04") || norm.includes("SR04") || norm.includes("ULTRASONIC")) {
    return [
      { id: "VCC", name: "VCC", x_mm: 0, y_mm: 0, z_mm: 0, type: "power" },
      { id: "TRIG", name: "TRIG", x_mm: 2.54, y_mm: 0, z_mm: 0, type: "digital" },
      { id: "ECHO", name: "ECHO", x_mm: 5.08, y_mm: 0, z_mm: 0, type: "digital" },
      { id: "GND", name: "GND", x_mm: 7.62, y_mm: 0, z_mm: 0, type: "gnd" }
    ];
  }

  if (norm.includes("SERVO") || norm.includes("SG90") || norm.includes("MOTOR")) {
    const pinNames = ["PWM", "VCC", "GND"];
    return pinNames.map((name, idx) => ({
      id: name,
      name: name,
      x_mm: idx * 2.54,
      y_mm: 0,
      z_mm: 0,
      type: name === "GND" ? "gnd" : (name === "VCC" ? "power" : "digital")
    }));
  }

  if (norm.includes("BUTTON") || norm.includes("SWITCH") || norm.includes("TACTILE")) {
    const pinNames = ["SIG", "GND"];
    return pinNames.map((name, idx) => ({
      id: name,
      name: name,
      x_mm: idx * 2.54,
      y_mm: 0,
      z_mm: 0,
      type: name === "GND" ? "gnd" : "digital"
    }));
  }

  if (norm.includes("ESP8266") || norm.includes("NODEMCU")) {
    const pinNames = [
      "A0", "GND", "VU", "S3", "S2", "S1", "SC", "SO", "SK", "GND", "3V3", "EN", "RST", "GND", "VIN",
      "D0", "D1", "D2", "D3", "D4", "3V3", "GND", "D5", "D6", "D7", "D8", "RX", "TX", "GND", "3V3"
    ];
    return pinNames.map((name, idx) => ({
      id: name,
      name: name,
      x_mm: idx * 2.54,
      y_mm: 0,
      z_mm: 0,
      type: name.includes("GND") ? "gnd" : (name.includes("3V") || name.includes("V") ? "power" : "digital")
    }));
  }
  
  if (norm.includes("TMP36") || norm.includes("TEMPERATURE") || norm.includes("TMP35") || norm.includes("TMP37") || norm.includes("LM35")) {
    const pinNames = ["VCC", "SIG", "GND"];
    return pinNames.map((name, idx) => ({
      id: name,
      name: name,
      x_mm: idx * 2.54,
      y_mm: 0,
      z_mm: 0,
      type: name === "GND" ? "gnd" : (name === "VCC" ? "power" : "analog")
    }));
  }
  
  if (norm.includes("LED")) {
    return [
      { id: "A", name: "A", x_mm: 0, y_mm: 0, z_mm: 0, type: "digital" },
      { id: "C", name: "C", x_mm: 2.54, y_mm: 0, z_mm: 0, type: "gnd" }
    ];
  }
  
  if (norm.includes("RESISTOR") || norm.includes("RES")) {
    return [
      { id: "1", name: "1", x_mm: 0, y_mm: 0, z_mm: 0, type: "digital" },
      { id: "2", name: "2", x_mm: 10, y_mm: 0, z_mm: 0, type: "digital" }
    ];
  }
  
  // Generic fallback: a simple chip with 8 pins
  return [
    { id: "VCC", name: "VCC", x_mm: 0, y_mm: 0, z_mm: 0, type: "power" },
    { id: "GND", name: "GND", x_mm: 2.54, y_mm: 0, z_mm: 0, type: "gnd" },
    { id: "IO1", name: "IO1", x_mm: 5.08, y_mm: 0, z_mm: 0, type: "digital" },
    { id: "IO2", name: "IO2", x_mm: 7.62, y_mm: 0, z_mm: 0, type: "digital" }
  ];
}

`;

const updatedContent = content.substring(0, startIndex) + newFallbackPinsCode + content.substring(endIndex);
fs.writeFileSync(targetFile, updatedContent, "utf8");
console.log("pinResolver patched successfully!");
