
// ??$$$ newer code
export interface SimState {
  trackName: string;
  progress: number;
  volume: number;
  batteryPct: number;
  btConnected: boolean;
  playing: boolean;
  mode: string;
  sensorValues?: Record<string, any>;
  outputStates?: Record<string, boolean>; // label -> on/off for LEDs
}
