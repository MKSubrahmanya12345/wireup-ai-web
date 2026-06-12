// ??$$$ group 2 - Ideation Stage (Phase 1)
// ??$$$ NEW FLOW
import mongoose, { Schema, Document, Types } from "mongoose";

export interface IQaHistory {
  question: string;
  options: string[];
  answer: string;
  timestamp: Date;
}

// context is now a free-form Mixed object; requirementsDoc (Markdown PRD) is the primary source of truth from Agent 1

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
  // ??$$$ newer code
  type: "thinking" | "tool_call" | "decision" | "error" | "context_received" | "rate_limit";
  name?: string;
  status?: "running" | "done" | "failed";
  input?: any;
  output?: any;
  text?: string;
  usage?: any;
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
  // ??$$$ newer code
  type?: string;
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
  requirementsDoc: string;
  bomMeta?: IArtifactMeta;
  wiringMeta?: IArtifactMeta;
  sketchMeta?: IArtifactMeta;
  qaHistory: IQaHistory[];
  context: any;
  phase1Complete: boolean;
  agentLog: IAgentLog[];
  bom: INewFlowBomItem[];
  wiring: INewFlowWiring[];
  milestones: INewFlowMilestone[];
  diagram?: any;
  phase2Complete: boolean;
  projectId: Types.ObjectId | null;
  createdAt: Date;
  finalSketch?: string;
  pipelineStages?: any;
  // ??$$$ newer code
  blueprint?: any;
  pipelineFailures?: any[];
  derivedDependencies?: any;
  // ??$$$ newer code
  chatHistory?: any[];
}

const qaHistorySchema = new Schema<IQaHistory>({
  question: { type: String, required: true },
  options: [{ type: String }],
  answer: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

// context is schema-free; requirementsDoc is the primary Agent 1 output (Markdown PRD)

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
  // ??$$$ newer code
  type: { type: String, enum: ["thinking", "tool_call", "decision", "error", "context_received", "rate_limit"], required: true },
  name: { type: String },
  status: { type: String, enum: ["running", "done", "failed"] },
  input: { type: Schema.Types.Mixed },
  output: { type: Schema.Types.Mixed },
  text: { type: String },
  usage: { type: Schema.Types.Mixed }, // ??$$$ newer code
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
  // ??$$$ newer code
  type: { type: String, default: "module" },
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
  // ??$$$ newer code
  requiredLibraries: { type: [requiredLibrarySchema], default: [] }
}, { _id: false });

// ??$$$ newer code
export interface IArtifactMeta {
  version: number;
  lastModifiedBy: "user" | "ai";
  locked: boolean;
  staleReason: string;
  bomVersionUsed?: number;
  wiringVersionUsed?: number;
}

const artifactMetaSchema = new Schema<IArtifactMeta>(
  {
    version: { type: Number, default: 1 },
    lastModifiedBy: { type: String, enum: ["user", "ai"], default: "ai" },
    locked: { type: Boolean, default: false },
    staleReason: { type: String, default: "" },
    bomVersionUsed: { type: Number, default: 1 },
    wiringVersionUsed: { type: Number, default: 1 }
  },
  { _id: false }
);

const newFlowSessionSchema = new Schema<INewFlowSession>({
  owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
  bomMeta: { type: artifactMetaSchema, default: () => ({}) },
  wiringMeta: { type: artifactMetaSchema, default: () => ({}) },
  sketchMeta: { type: artifactMetaSchema, default: () => ({}) },
  selectedModel: { type: String, default: "qwen/qwen3-32b" },
  idea: { type: String, required: true },
  requirementsDoc: { type: String, default: "" },
  qaHistory: { type: [qaHistorySchema], default: [] },
  context: { type: Schema.Types.Mixed, default: () => ({}) },
  phase1Complete: { type: Boolean, default: false },
  agentLog: { type: [agentLogSchema], default: [] },
  bom: { type: [bomItemSchema], default: [] },
  wiring: { type: [wiringSchema], default: [] },
  milestones: { type: [milestoneSchema], default: [] },
  diagram: { type: Schema.Types.Mixed, default: () => ({}) },
  phase2Complete: { type: Boolean, default: false },
  projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null },
  createdAt: { type: Date, default: Date.now },
  finalSketch: { type: String, default: "" },
  pipelineStages: { type: Schema.Types.Mixed, default: () => ({}) },
  // ??$$$ newer code
  blueprint: { type: Schema.Types.Mixed, default: null },
  derivedDependencies: { type: Schema.Types.Mixed, default: () => ({}) },
  pipelineFailures: { type: [Schema.Types.Mixed], default: [] },
  // ??$$$ newer code
  chatHistory: { type: [Schema.Types.Mixed], default: [] }
});

const NewFlowSession = mongoose.model<INewFlowSession>("NewFlowSession", newFlowSessionSchema);
export default NewFlowSession;
