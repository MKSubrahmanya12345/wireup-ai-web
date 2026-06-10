// ??$$$ newer code - OLED drawing peripheral for behavior playground
/* old code
import { SimState } from '../SimState';
*/
// ??$$$ newer code
import type { SimState } from '../SimState';

export function drawOLED(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  hasFiles: boolean,
  archetype: string,
  projectName: string
) {
  // Clear the screen (dark background)
  ctx.fillStyle = '#0a1a0a';
  ctx.fillRect(0, 0, 128, 64);

  ctx.fillStyle = '#00ff88'; // green phosphor
  ctx.font = '8px monospace';

  if (archetype === 'audio-device') {
    if (!hasFiles) {
      // Gap 8: show insert card message
      ctx.fillText('INSERT SD CARD', 16, 24);
      ctx.fillText('Upload files ➔', 16, 40);
      return;
    }

    // Line 1: Track Name (truncate to 21 chars)
    const track = state.trackName || (state.playing ? 'Playing...' : 'No Track');
    const truncatedTrack = track.length > 21 ? track.substring(0, 18) + '...' : track;
    ctx.fillText(truncatedTrack, 4, 16);

    // Line 2: Progress Bar & Volume
    const barWidth = 70;
    const progressX = 4;
    const progressY = 24;
    ctx.strokeStyle = '#00ff88';
    ctx.strokeRect(progressX, progressY, barWidth, 6);
    ctx.fillRect(progressX + 1, progressY + 1, Math.floor((barWidth - 2) * state.progress), 4);

    // Volume text
    ctx.fillText(`VOL:${state.volume}%`, 80, 30);

    // Bottom left: State indicator
    const stateStr = state.playing ? '▶ PLAYING' : '‖ PAUSED';
    ctx.fillText(stateStr, 4, 48);

    // Bottom right: Battery %
    ctx.fillText(`BAT:${Math.round(state.batteryPct)}%`, 80, 48);

    // Top right: Bluetooth icon if connected
    if (state.btConnected) {
      ctx.fillText('⚡ BT', 96, 8);
    }
  } else if (state.sensorValues && Object.keys(state.sensorValues).length > 0) {
    // ??$$$ newer code
    ctx.fillText('ENVIRONMENT SIM', 4, 12);
    let y = 24;
    for (const [key, val] of Object.entries(state.sensorValues)) {
      ctx.fillText(`${key}: ${val}`, 4, y);
      y += 12;
      if (y > 52) break;
    }
    ctx.fillText(`BAT: ${Math.round(state.batteryPct)}%`, 80, 56);
  } else {
    // Generic fallback — show output pin states if available
    ctx.fillText(projectName.substring(0, 21), 4, 12);
    const outputs = (state as any).outputStates as Record<string, boolean> | undefined;
    if (outputs && Object.keys(outputs).length > 0) {
      let y = 24;
      for (const [label, on] of Object.entries(outputs)) {
        ctx.fillStyle = on ? '#00ff88' : '#3a5a3a';
        ctx.fillText(`${label}: ${on ? 'ON ' : 'OFF'}`, 4, y);
        y += 12;
        if (y > 52) break;
      }
      ctx.fillStyle = '#00ff88';
    } else if (archetype === 'sensor-logger') {
      ctx.fillText(`VAL: ${state.mode || 'N/A'}`, 4, 32);
    } else {
      ctx.fillText('RUNNING', 4, 32);
    }
    ctx.fillStyle = '#00ff88';
    ctx.fillText(`BAT: ${Math.round(state.batteryPct)}%`, 4, 56);
  }
}
