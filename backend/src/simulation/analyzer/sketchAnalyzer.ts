// ??$$$ newer code - SketchAnalyzer for simulation v2
export interface AnalyzedSketch {
  protocols: {
    bluetooth: boolean;
    wifi: boolean;
    sdCard: boolean;
    display: boolean;
  };
  wifiRoutes: string[];
  serialLines: string[];
}

export function analyzeSketch(sketch: string): AnalyzedSketch {
  const code = sketch || '';

  // 1. Detect protocols
  const bluetooth = /SerialBT\b|BluetoothSerial\b/i.test(code);
  const wifi = /WiFi\b|WiFiServer\b|server\.on\b/i.test(code);
  const sdCard = /SD\.begin\b|SD\.open\b|#include\s*<SD\.h>/i.test(code);
  const display = /display\.print\b|LiquidCrystal_I2C\b|#include\s*<Adafruit_SSD1306\.h>/i.test(code);

  // Extract WiFi routes if server.on is present
  const wifiRoutes: string[] = [];
  const routeRegex = /server\.on\s*\(\s*"([^"]+)"/g;
  let rMatch;
  while ((rMatch = routeRegex.exec(code)) !== null) {
    if (rMatch[1]) {
      wifiRoutes.push(rMatch[1]);
    }
  }

  // 2. Extract Serial.print / Serial.println strings
  const serialLines: string[] = [];
  const serialRegex = /Serial\.print(?:ln)?\s*\(\s*(?:F\s*\(\s*)?"([^"]*)"/g;
  let match;
  while ((match = serialRegex.exec(code)) !== null) {
    if (match[1]) {
      serialLines.push(match[1]);
    }
  }

  return {
    protocols: {
      bluetooth,
      wifi,
      sdCard,
      display,
    },
    wifiRoutes,
    serialLines,
  };
}
