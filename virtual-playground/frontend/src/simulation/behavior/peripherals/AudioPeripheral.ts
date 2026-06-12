// ??$$$ newer code - AudioPeripheral utilizing Web Audio API and event pins
import { gpioBus } from '../GPIOBus';
// ??$$$ newer code
import type { SimulationManifest } from '../SimulationManifest';

export class AudioPeripheral {
  private ctx: AudioContext | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private activeSource: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private volume = 75; // 0-100
  private playing = false;
  private currentTrack = '';
  private startOffset = 0;
  private startTime = 0;
  private duration = 0;
  
  private trackChangeListeners = new Set<(trackName: string) => void>();
  private progressListeners = new Set<(progress: number) => void>();
  private volumeListeners = new Set<(volume: number) => void>();
  private playStateListeners = new Set<(playing: boolean) => void>();

  private getContext() {
    if (!this.ctx) {
      // @ts-ignore
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  async loadFile(name: string, arrayBuffer: ArrayBuffer) {
    try {
      const context = this.getContext();
      const bufferCopy = arrayBuffer.slice(0);
      const audioBuffer = await context.decodeAudioData(bufferCopy);
      this.buffers.set(name, audioBuffer);
    } catch (e) {
      console.error('Failed to decode audio file:', name, e);
    }
  }

  play(filename: string) {
    if (!filename) return;
    const buffer = this.buffers.get(filename);
    if (!buffer) {
      console.warn(`Buffer not found for file: ${filename}`);
      return;
    }

    this.stopActiveSource();

    const context = this.getContext();
    this.activeSource = context.createBufferSource();
    this.activeSource.buffer = buffer;

    this.gainNode = context.createGain();
    this.setGainVolume();

    this.activeSource.connect(this.gainNode);
    this.gainNode.connect(context.destination);

    this.duration = buffer.duration;
    this.currentTrack = filename;
    this.startTime = context.currentTime - this.startOffset;
    
    this.activeSource.start(0, this.startOffset);
    this.playing = true;

    this.activeSource.onended = () => {
      // Natural track end
      if (this.playing && context.currentTime - this.startTime >= this.duration - 0.15) {
        this.startOffset = 0;
        this.playing = false;
        this.notifyPlayState();
        this.notifyProgress(1);
      }
    };

    this.notifyTrackChange(filename);
    this.notifyPlayState();
  }

  pause() {
    if (!this.playing) return;
    const context = this.getContext();
    this.startOffset = context.currentTime - this.startTime;
    if (this.startOffset >= this.duration) {
      this.startOffset = 0;
    }
    this.stopActiveSource();
    this.playing = false;
    this.notifyPlayState();
  }

  stop() {
    this.startOffset = 0;
    this.stopActiveSource();
    this.playing = false;
    this.notifyPlayState();
    this.notifyProgress(0);
  }

  setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(100, vol));
    this.setGainVolume();
    this.notifyVolume();
  }

  private setGainVolume() {
    if (this.gainNode) {
      this.gainNode.gain.value = this.volume / 100;
    }
  }

  private stopActiveSource() {
    if (this.activeSource) {
      try {
        this.activeSource.stop();
      } catch (e) {
        // Already stopped
      }
      this.activeSource.disconnect();
      this.activeSource = null;
    }
  }

  getProgress(): number {
    if (!this.playing || this.duration === 0) {
      return this.startOffset / (this.duration || 1);
    }
    const context = this.getContext();
    const elapsed = context.currentTime - this.startTime;
    return Math.min(1, Math.max(0, elapsed / this.duration));
  }

  // Callbacks
  onTrackChange(cb: (trackName: string) => void) {
    this.trackChangeListeners.add(cb);
    return () => this.trackChangeListeners.delete(cb);
  }

  onProgress(cb: (progress: number) => void) {
    this.progressListeners.add(cb);
    return () => this.progressListeners.delete(cb);
  }

  onVolumeChange(cb: (vol: number) => void) {
    this.volumeListeners.add(cb);
    return () => this.volumeListeners.delete(cb);
  }

  onPlayStateChange(cb: (playing: boolean) => void) {
    this.playStateListeners.add(cb);
    return () => this.playStateListeners.delete(cb);
  }

  private notifyTrackChange(name: string) {
    for (const cb of this.trackChangeListeners) cb(name);
  }

  private notifyProgress(val: number) {
    for (const cb of this.progressListeners) cb(val);
  }

  private notifyVolume() {
    for (const cb of this.volumeListeners) cb(this.volume);
  }

  private notifyPlayState() {
    for (const cb of this.playStateListeners) cb(this.playing);
  }

  bindButtonPins(manifest: SimulationManifest, onBtnTrigger: (btnKey: string) => void) {
    for (const p of manifest.peripherals) {
      if (p.type === 'ClickButton') {
        const pin = p.config.gpioPin;
        if (!pin) continue;

        gpioBus.on(pin, (val) => {
          if (val === false) {
            onBtnTrigger(p.key);
            this.handleButtonPress(p.key);
          }
        });
      }
    }
  }

  private handleButtonPress(key: string) {
    if (key === 'btnPlay') {
      if (this.playing) this.pause();
      else {
        if (this.currentTrack) {
          this.play(this.currentTrack);
        } else {
          const firstFile = Array.from(this.buffers.keys())[0];
          if (firstFile) this.play(firstFile);
        }
      }
    } else if (key === 'btnVolUp') {
      this.setVolume(this.volume + 5);
    } else if (key === 'btnVolDown') {
      this.setVolume(this.volume - 5);
    }
    // btnNext, btnPrev, btnPair, btnPower are handled by BehaviorConductor via onBtnTrigger
  }

  getVolume() {
    return this.volume;
  }

  getCurrentTrack() {
    return this.currentTrack;
  }

  isPlaying() {
    return this.playing;
  }

  destroy() {
    this.stop();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.buffers.clear();
    this.trackChangeListeners.clear();
    this.progressListeners.clear();
    this.volumeListeners.clear();
    this.playStateListeners.clear();
  }
}
