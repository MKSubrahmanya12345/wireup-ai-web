// ??$$$ newer code - VirtualFSPeripheral for simulated SD card filesystem
export interface FileEntry {
  name: string;
  buffer: ArrayBuffer;
  mimeType: string;
}

export class VirtualFSPeripheral {
  private files = new Map<string, FileEntry>();
  private changeListeners = new Set<(files: string[]) => void>();
  private addListeners = new Set<(name: string, buffer: ArrayBuffer) => void>();

  uploadFile(name: string, buffer: ArrayBuffer, mimeType: string) {
    this.files.set(name, { name, buffer, mimeType });
    this.notify();
    for (const listener of this.addListeners) {
      listener(name, buffer);
    }
  }

  deleteFile(name: string) {
    this.files.delete(name);
    this.notify();
  }

  listFiles(): string[] {
    return Array.from(this.files.keys());
  }

  readFile(name: string): ArrayBuffer | null {
    return this.files.get(name)?.buffer ?? null;
  }

  onFilesChanged(cb: (files: string[]) => void) {
    this.changeListeners.add(cb);
    return () => this.changeListeners.delete(cb);
  }

  onFileAdded(cb: (name: string, buffer: ArrayBuffer) => void) {
    this.addListeners.add(cb);
    return () => this.addListeners.delete(cb);
  }

  private notify() {
    const list = this.listFiles();
    for (const cb of this.changeListeners) {
      cb(list);
    }
  }

  clear() {
    this.files.clear();
    this.notify();
  }
}
