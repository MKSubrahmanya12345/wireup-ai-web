// ??$$$ newer code
import { MCU_CATALOG, IMcuSpec } from "../../architect/mcu.catalog";
// ??$$$ newer code
export async function executeSelectCompute(args: any): Promise<any> {
  const req = args?.computeRequirements;
  if (!req) {
    return { error: "Missing computeRequirements in arguments." };
  }
  
  // Normalize blueprint requirements
  const requiredGpio = req.estPinCount || 0;
  const reqI2c = req.peripherals?.i2c || 0;
  const reqSpi = req.peripherals?.spi || 0;
  const reqUart = req.peripherals?.uart || 0;
  const reqPwm = req.peripherals?.pwm || 0;
  const reqAdc = req.peripherals?.adc || 0;
  const minFlash = req.minFlashKB || 0;
  const minRam = req.minRamKB || 0;
  const realtimeRequired = req.realtime || false;
  
  // Option A connectivity requirements
  const reqWifi = req.connectivity?.wifi || false;
  const reqBluetooth = req.connectivity?.bluetooth || false;

  const candidates: IMcuSpec[] = [];
  const rejected: { key: string; why: string }[] = [];

  for (const mcu of MCU_CATALOG) {
    const reasons: string[] = [];

    if (mcu.usableGpio < requiredGpio) {
      reasons.push(`Insufficient GPIO (has ${mcu.usableGpio}, requires ${requiredGpio})`);
    }
    if (mcu.peripherals.i2c < reqI2c) {
      reasons.push(`Insufficient I2C (has ${mcu.peripherals.i2c}, requires ${reqI2c})`);
    }
    if (mcu.peripherals.spi < reqSpi) {
      reasons.push(`Insufficient SPI (has ${mcu.peripherals.spi}, requires ${reqSpi})`);
    }
    if (mcu.peripherals.uart < reqUart) {
      reasons.push(`Insufficient UART (has ${mcu.peripherals.uart}, requires ${reqUart})`);
    }
    if (mcu.peripherals.pwm < reqPwm) {
      reasons.push(`Insufficient PWM (has ${mcu.peripherals.pwm}, requires ${reqPwm})`);
    }
    if (mcu.peripherals.adc < reqAdc) {
      reasons.push(`Insufficient ADC (has ${mcu.peripherals.adc}, requires ${reqAdc})`);
    }
    if (mcu.flashKB < minFlash) {
      reasons.push(`Insufficient Flash memory (has ${mcu.flashKB}KB, requires ${minFlash}KB)`);
    }
    if (mcu.ramKB < minRam) {
      reasons.push(`Insufficient RAM (has ${mcu.ramKB}KB, requires ${minRam}KB)`);
    }
    if (realtimeRequired && !mcu.realtimeCapable) {
      reasons.push(`Not real-time capable`);
    }
    if (reqWifi && !mcu.connectivity.wifi) {
      reasons.push(`Missing WiFi connectivity`);
    }
    if (reqBluetooth && !mcu.connectivity.bluetooth) {
      reasons.push(`Missing Bluetooth connectivity`);
    }

    if (reasons.length > 0) {
      rejected.push({
        key: mcu.key,
        why: reasons.join(", ")
      });
    } else {
      candidates.push(mcu);
    }
  }

  // Sort candidates by costRank ascending (most optimal/cheapest first)
  candidates.sort((a, b) => a.costRank - b.costRank);

  // ??$$$ newer code
  let recommended = candidates[0] || null;
  let warning = null;

  if (candidates.length === 0 && rejected.length > 0) {
    // If no boards fully qualify, find the one with the fewest failure reasons
    const sortedRejections = [...rejected].sort((a, b) => {
      const countA = a.why.split(",").length;
      const countB = b.why.split(",").length;
      return countA - countB;
    });
    
    const closestMcuKey = sortedRejections[0].key;
    const closestMcu = MCU_CATALOG.find(m => m.key === closestMcuKey);
    if (closestMcu) {
      recommended = closestMcu;
      warning = `WARNING: No microcontroller in the catalog fully satisfies your requirements. Recommending the closest match "${closestMcu.displayName}", but note it fails the following requirements: ${sortedRejections[0].why}`;
    }
  }

  return {
    recommended: recommended ? {
      key: recommended.key,
      displayName: recommended.displayName,
      wokwiPartType: recommended.wokwiPartType,
      usableGpio: recommended.usableGpio,
      peripherals: recommended.peripherals,
      flashKB: recommended.flashKB,
      ramKB: recommended.ramKB,
      voltage: recommended.voltage,
      realtimeCapable: recommended.realtimeCapable,
      connectivity: recommended.connectivity,
      clockMHz: recommended.clockMHz,
      note: recommended.note
    } : null,
    warning,
    candidates: candidates.map(c => ({
      key: c.key,
      displayName: c.displayName,
      wokwiPartType: c.wokwiPartType,
      note: c.note
    })),
    rejected
  };
}
