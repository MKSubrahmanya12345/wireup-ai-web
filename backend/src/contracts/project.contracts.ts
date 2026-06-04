// ??$$$
export interface IBomComponent {
  partId: string;
  name: string;
  qty: number;
  price: number;
  mpn?: string;
  manufacturer?: string;
  wokwiPartType?: string;
}

export interface IWiringConnection {
  id: string;
  from: string;
  to: string;
  net?: string;
  color?: string;
  description?: string;
}

export interface IMilestone {
  id: string;
  order: number;
  title: string;
  objective: string;
  subsystem: string;
  partsInvolved: string[];
  wiringInstructions: string;
  code: string;
  explanation: string;
  expectedOutput: string;
  passCondition: string;
  commonProblems: string[];
  simulatable: boolean;
  requiredLibraries?: string[];
}
