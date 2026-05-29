// ??$$$
export interface Pin {
  id: string;
  x: number;
  y: number;
  z: number;
  type: string;
}

export interface ComponentItem {
  key: string;
  displayName: string;
  type: string;
  glbUrl: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  pins: Pin[];
}

export interface Wiring {
  from: string;
  to: string;
  color: string;
}

export interface EditableJson {
  simulationSpeed: number;
  ledInitialState: boolean;
  buttonInitialState: boolean;
}

export interface ProjectData {
  id: string;
  name: string;
  description: string;
  author: string;
  createdAt: string;
  bom: ComponentItem[];
  wiring: Wiring[];
  editableJson: EditableJson;
  sketch: string;
  context?: {
    mcu?: string;
    powerSource?: string;
    connectivity?: string;
    constraints?: string[];
  };
  phases?: string[];
  milestones?: Array<{
    id?: string;
    order?: number;
    title?: string;
    objective?: string;
    expectedOutput?: string;
    passCondition?: string;
  }>;
  additionalTools?: string[];
}
