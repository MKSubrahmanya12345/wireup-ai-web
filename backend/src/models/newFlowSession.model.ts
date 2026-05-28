// ??$$$ NEW FLOW
import mongoose, { Schema, Document, Types } from "mongoose";

export interface IQaHistory {
  question: string;
  options: string[];
  answer: string;
  timestamp: Date;
}

export interface IProjectContext {
  corePurpose: string;
  mcu: string;
  subsystems: string[];
  constraints: string[];
  powerSource: string;
  connectivity: string;
  openQuestions: string[];
}

// ??$$$
// export interface IAgentLog {
//   type: "thinking" | "tool_call" | "decision" | "error";
//   name?: string;
//   status?: "running" | "done" | "failed";
//   input?: any;
//   output?: any;
//   text?: string;
//   timestamp: Date;
// }

// ??$$$ NEW FLOW
export interface IAgentLog {
  // ??$$$ old code
  // type: "thinking" | "tool_call" | "decision" | "error" | "context_received";
  // ??$$$ newer code
  type: "thinking" | "tool_call" | "decision" | "error" | "context_received" | "rate_limit";
  name?: string;
  status?: "running" | "done" | "failed";
  input?: any;
  output?: any;
  text?: string;
  timestamp: Date;
}


export interface INewFlowBomItem {
  key: string;
  partId: string;
  mpn: string;
  displayName: string;
  purpose: string;
  qty: number;
  price: number;
  subsystem: string;
  interfaces: string[];
  pinConnections: {
    pin: string;
    connectsTo: string;
  }[];
  // ??$$$ NEW FLOW — SnapEDA 3D fields
  glbUrl: string;
  pins: {
    id: string;
    name: string;
    x_mm: number;
    y_mm: number;
    z_mm: number;
    type: string;
  }[];
}

export interface INewFlowWiring {
  from: string;
  to: string;
  net: string;
  color: string;
}

export interface INewFlowRequiredLibrary {
  name: string;
  type: "core" | "library_manager" | "manual";
  version?: string | null;
  installCommand?: string | null;
}

export interface INewFlowMilestone {
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
  requiredLibraries: INewFlowRequiredLibrary[];
}

export interface INewFlowSession extends Document {
  owner: Types.ObjectId;
  selectedModel: string;
  idea: string;
  qaHistory: IQaHistory[];
  context: IProjectContext;
  phase1Complete: boolean;
  agentLog: IAgentLog[];
  bom: INewFlowBomItem[];
  wiring: INewFlowWiring[];
  milestones: INewFlowMilestone[];
  // ??$$$ newer code
  diagram?: any;
  phase2Complete: boolean;
  projectId: Types.ObjectId | null;
  createdAt: Date;
}

const qaHistorySchema = new Schema<IQaHistory>({
  question: { type: String, required: true },
  options: [{ type: String }],
  answer: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const projectContextSchema = new Schema<IProjectContext>({
  corePurpose: { type: String, default: "" },
  mcu: { type: String, default: "" },
  subsystems: [{ type: String }],
  constraints: [{ type: String }],
  powerSource: { type: String, default: "" },
  connectivity: { type: String, default: "" },
  openQuestions: [{ type: String }]
}, { _id: false });

// ??$$$
// const agentLogSchema = new Schema<IAgentLog>({
//   type: { type: String, enum: ["thinking", "tool_call", "decision", "error"], required: true },
//   name: { type: String },
//   status: { type: String, enum: ["running", "done", "failed"] },
//   input: { type: Schema.Types.Mixed },
//   output: { type: Schema.Types.Mixed },
//   text: { type: String },
//   timestamp: { type: Date, default: Date.now }
// }, { _id: false });

// ??$$$ NEW FLOW
const agentLogSchema = new Schema<IAgentLog>({
  // ??$$$ old code
  // type: { type: String, enum: ["thinking", "tool_call", "decision", "error", "context_received"], required: true },
  // ??$$$ newer code
  type: { type: String, enum: ["thinking", "tool_call", "decision", "error", "context_received", "rate_limit"], required: true },
  name: { type: String },
  status: { type: String, enum: ["running", "done", "failed"] },
  input: { type: Schema.Types.Mixed },
  output: { type: Schema.Types.Mixed },
  text: { type: String },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const bomItemSchema = new Schema<INewFlowBomItem>({
  key: { type: String, required: true },
  partId: { type: String, required: true },
  mpn: { type: String, required: true },
  displayName: { type: String, required: true },
  purpose: { type: String, required: true },
  qty: { type: Number, default: 1 },
  price: { type: Number, default: 0 },
  subsystem: { type: String, required: true },
  interfaces: [{ type: String }],
  pinConnections: [{
    pin: { type: String, required: true },
    connectsTo: { type: String, required: true }
  }],
  // ??$$$ NEW FLOW — SnapEDA 3D fields
  glbUrl: { type: String, default: "" },
  pins: {
    type: [{
      id: { type: String },
      name: { type: String },
      x_mm: { type: Number, default: 0 },
      y_mm: { type: Number, default: 0 },
      z_mm: { type: Number, default: 0 },
      type: { type: String, default: "digital" }
    }],
    default: []
  }
}, { _id: false });

const wiringSchema = new Schema<INewFlowWiring>({
  from: { type: String, required: true },
  to: { type: String, required: true },
  net: { type: String, required: true },
  color: { type: String, default: "#888888" }
}, { _id: false });

const requiredLibrarySchema = new Schema<INewFlowRequiredLibrary>({
  name: { type: String, required: true },
  type: { type: String, enum: ["core", "library_manager", "manual"], default: "core" },
  version: { type: String, default: null },
  installCommand: { type: String, default: null }
}, { _id: false });

const milestoneSchema = new Schema<INewFlowMilestone>({
  id: { type: String, required: true },
  order: { type: Number, required: true },
  title: { type: String, default: "" },
  objective: { type: String, default: "" },
  subsystem: { type: String, default: "" },
  partsInvolved: [{ type: String }],
  wiringInstructions: { type: String, default: "" },
  code: { type: String, default: "" },
  explanation: { type: String, default: "" },
  expectedOutput: { type: String, default: "" },
  passCondition: { type: String, default: "" },
  commonProblems: [{ type: String }],
  simulatable: { type: Boolean, default: true },
  requiredLibraries: [{ type: requiredLibrarySchema, default: [] }]
}, { _id: false });

const newFlowSessionSchema = new Schema<INewFlowSession>({
  owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
  selectedModel: { type: String, default: "qwen/qwen3-32b" },
  idea: { type: String, required: true },
  qaHistory: { type: [qaHistorySchema], default: [] },
  context: { type: projectContextSchema, default: () => ({}) },
  phase1Complete: { type: Boolean, default: false },
  agentLog: { type: [agentLogSchema], default: [] },
  bom: { type: [bomItemSchema], default: [] },
  wiring: { type: [wiringSchema], default: [] },
  milestones: { type: [milestoneSchema], default: [] },
  // ??$$$ newer code
  diagram: { type: Schema.Types.Mixed, default: () => ({}) },
  phase2Complete: { type: Boolean, default: false },
  projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null },
  createdAt: { type: Date, default: Date.now }
});

const NewFlowSession = mongoose.model<INewFlowSession>("NewFlowSession", newFlowSessionSchema);
export default NewFlowSession;
