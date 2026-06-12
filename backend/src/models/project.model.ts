// ??$$$ group 8 - Core Platform & Shared Infrastructure
import mongoose, { Schema, Types, HydratedDocument, Model } from "mongoose";
import { getRegistry } from "../services/registry.services";

const STAGE_STATUS_ENUM = [
  "locked",
  "ready",
  "generating",
  "done",
  "stale",
  "error"
] as const;


//might remove i dont know what this is
const LEGACY_BOARD_SLUGS = [
  "arduino-uno",
  "arduino-nano",
  "esp32-devkit-v1",
  "raspberry-pi-pico",
  "attiny85",
] as const;

const getAllowedBoardValues = (): (string | null)[] => {
  const registry = getRegistry();

  const registryBoardKeys = Object.entries(registry || {})
    .filter(([, def]: any) =>
      String(def?.category || "").toLowerCase() === "controller"
    )
    .map(([key]) => key);

  return [...new Set([...LEGACY_BOARD_SLUGS, ...registryBoardKeys, null])];
};

//============================================================
//============================================================
//============================================================
//============================================================


//this is an interface for the message, so like user or model
interface IMessage {
  role: "user" | "model";
  content: string;
}

const messageSchema = new Schema<IMessage>(
  {
    role: {
      type: String,
      enum: ["user", "model"],
      required: true
    },
    content: {
      type: String,
      required: true
    },
  },
  { _id: false }
);

export interface IIdeationMessage {
  role: "user" | "model";
  content: string;
  timestamp: Date;
  // ??$$$ Commented out toolCalls per senior engineer instructions
  // toolCalls: string;
}

//============================================================
//============================================================
//============================================================
//============================================================

// ??$$$
export interface IIdeation {
  messages: IIdeationMessage[];
  brief: string;
  objective: string;
  compute: string;
  phases: Record<string, string>;
  constraints: string;
  open: string;

  thinking: string;
  toolTrace: string;

  readyForComponents: boolean;
  readyAt: Date | null;
  readinessReason: string;

  validatorApproved: boolean;
  validatorFeedback: string;

  validationAttempts: number;
  snapshot?: any;
}

const ideationMessageSchema = new Schema<IIdeationMessage>(
  {
    role: {
      type: String,
      enum: ["user", "model"],
      required: true
    },
    content: {
      type: String,
      default: ""
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
    // ??$$$ Commented out toolCalls per senior engineer instructions
    // toolCalls: {
    //   type: String,
    //   default: ""
    // }
  },
  { _id: false }
);


const ideationSchema = new Schema<IIdeation>(
  {
    messages: {
      type: [ideationMessageSchema],
      default: []
    },

    brief:       { type: String, default: "" },
    objective:   { type: String, default: "" },
    compute:     { type: String, default: "" },
    phases:      { type: Schema.Types.Mixed, default: () => ({}) },
    constraints: { type: String, default: "" },
    open:        { type: String, default: "" },

    thinking: {
      type: String,
      default: ""
    },

    toolTrace: {
      type: String,
      default: ""
    },

    readyForComponents: {
      type: Boolean,
      default: false
    },

    readyAt: {
      type: Date,
      default: null
    },

    readinessReason: {
      type: String,
      default: ""
    },

    validatorApproved: {
      type: Boolean,
      default: false
    },

    validatorFeedback: {
      type: String,
      default: ""
    },

// ??$$$
    validationAttempts: {
      type: Number,
      default: 0
    },
    snapshot: {
      type: Schema.Types.Mixed,
      default: () => ({})
    }
  },
  { _id: false }
);

interface IArchitectureState {
  summary: string;
  pattern: string;
  sourceStrategy: string;
  entryFile: string;
  files: any[];
  libraries: any[];
  pinAssignments: any[];
  runtimeFlow: string[];
  assumptions: string[];
  openDecisions: string[];
  updatedAt: Date | null;
}

const architectureStateSchema = new Schema<IArchitectureState>(
  {
    summary: { type: String, default: "" },
    pattern: { type: String, default: "" },
    sourceStrategy: { type: String, default: "" },
    entryFile: { type: String, default: "" },
    files: { type: [Schema.Types.Mixed] as any, default: [] },
    libraries: { type: [Schema.Types.Mixed] as any, default: [] },
    pinAssignments: { type: [Schema.Types.Mixed] as any, default: [] },
    runtimeFlow: { type: [String], default: [] },
    assumptions: { type: [String], default: [] },
    openDecisions: { type: [String], default: [] },
    updatedAt: { type: Date, default: null },
  },
  { _id: false }
);

interface IGenerationProfile {
  board: string | null;
  boardPartType: string;
  powerSource: string | null;
  language: "cpp" | "micropython";
  firmwareTarget: string;
  simulationTarget: string;
  runtimeHints: string[];
  profileVersion: number;
  lockedAt: Date | null;
  updatedAt: Date | null;
}

const generationProfileSchema = new Schema<IGenerationProfile>(
  {
    board: {
      type: String,
      enum: getAllowedBoardValues(),
      default: null
    },

    boardPartType: {
      type: String,
      default: "wokwi-arduino-uno"
    },

    powerSource: {
      type: String,
      enum: ["usb", "lipo", "9v", "aa-batteries", "unknown", null],
      default: null,
    },

    language: {
      type: String,
      enum: ["cpp", "micropython"],
      default: "cpp"
    },

    firmwareTarget: {
      type: String,
      default: "arduino-cpp-sketch-ino"
    },

    simulationTarget: {
      type: String,
      default: "wokwi-json-ino"
    },

    runtimeHints: {
      type: [String],
      default: []
    },

    profileVersion: {
      type: Number,
      default: 1
    },

    lockedAt: {
      type: Date,
      default: null
    },

    updatedAt: {
      type: Date,
      default: null
    },
  },
  { _id: false }
);

// ??$$$ newer code
interface IBomItem {
  key: string;
  role?: string; // ??$$$ newer code
  wokwiPartType: string;
  displayName: string;
  qty: number;
  purpose: string;
  pinConnections: Array<{
    pin: string;
    connectsTo: string;
  }>;
  price: number;
  storeUrl: string;
  mpn?: string;
  partId?: string;
  phase?: string;
  // ??$$$ NEW FLOW — SnapEDA 3D fields
  glbUrl?: string;
  // ??$$$ newer code
  type?: string;
  pins?: Array<{
    id: string;
    name: string;
    x_mm: number;
    y_mm: number;
    z_mm: number;
    type: string;
  }>;
}

// ??$$$ newer code
const bomItemSchema = new Schema<IBomItem>(
  {
    key: { type: String, default: "" },
    role: { type: String, default: "" }, // ??$$$ newer code
    wokwiPartType: { type: String, default: "" },
    displayName: { type: String, default: "" },
    qty: { type: Number, default: 1 },
    purpose: { type: String, default: "" },

    pinConnections: [
      {
        pin: { type: String, default: "" },
        connectsTo: { type: String, default: "" }
      }
    ],

    price: { type: Number, default: 0 },
    storeUrl: { type: String, default: "" },
    mpn: { type: String, default: "" },
    partId: { type: String, default: "" },
    phase: { type: String, default: "" },
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
  },
  { _id: false }
);

interface ICompilation {
  hex: string;
  compilationErrors: any[];
  warnings: string[];
  compiledAt: Date | null;
}

const compilationSchema = new Schema<ICompilation>(
  {
    hex: { type: String, default: "" },
    compilationErrors: {
      type: [Schema.Types.Mixed] as any,
      default: []
    },
    warnings: { type: [String], default: [] },
    compiledAt: { type: Date, default: null }
  },
  { _id: false }
);

interface IAssemblyLayout {
  svgString: string;

  dimensions: {
    width_mm: number;
    height_mm: number;
    depth_mm: number;
  };

  componentPositions: any[];

  sizePreference: "pocket" | "desk" | "wall" | "custom";

  warnings: string[];

  generatedAt: Date | null;
}

const assemblyLayoutSchema = new Schema<IAssemblyLayout>(
  {
    svgString: { type: String, default: "" },

    dimensions: {
      width_mm: { type: Number, default: 0 },
      height_mm: { type: Number, default: 0 },
      depth_mm: { type: Number, default: 0 }
    },

    componentPositions: {
      type: [Schema.Types.Mixed] as any,
      default: []
    },

    sizePreference: {
      type: String,
      enum: ["pocket", "desk", "wall", "custom"],
      default: "pocket"
    },

    warnings: {
      type: [String],
      default: []
    },

    generatedAt: {
      type: Date,
      default: null
    }
  },
  { _id: false }
);

interface IStageStatus {
  ideation: string;
  components: string;
  build: string;
  simulation: string;
  assembly: string;
  shopping: string;
}

const stageStatusSchema = new Schema<IStageStatus>(
  {
    ideation: {
      type: String,
      enum: STAGE_STATUS_ENUM,
      default: "ready"
    },

    components: {
      type: String,
      enum: STAGE_STATUS_ENUM,
      default: "locked"
    },

    build: {
      type: String,
      enum: STAGE_STATUS_ENUM,
      default: "locked"
    },

    simulation: {
      type: String,
      enum: STAGE_STATUS_ENUM,
      default: "locked"
    },

    assembly: {
      type: String,
      enum: STAGE_STATUS_ENUM,
      default: "locked"
    },

    shopping: {
      type: String,
      enum: STAGE_STATUS_ENUM,
      default: "locked"
    }
  },
  { _id: false }
);

interface IWokwiEvidenceResult {
  ok: boolean;
  command: string;
  exitCode: number;
  durationMs: number;
  stdoutTail: string;
  stderrTail: string;
  serialTail: string;
  summary: string;
  metadata: any;
  ranAt: Date;
}

const wokwiEvidenceResultSchema = new Schema<IWokwiEvidenceResult>(
  {
    ok: { type: Boolean, default: false },
    command: { type: String, default: "" },
    exitCode: { type: Number, default: 0 },
    durationMs: { type: Number, default: 0 },
    stdoutTail: { type: String, default: "" },
    stderrTail: { type: String, default: "" },
    serialTail: { type: String, default: "" },
    summary: { type: String, default: "" },
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({})
    },
    ranAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

interface IWokwiEvidence {
  lastLint: IWokwiEvidenceResult | null;
  lastRun: IWokwiEvidenceResult | null;
  lastScenario: IWokwiEvidenceResult | null;
  lastSerialCapture: IWokwiEvidenceResult | null;
  updatedAt: Date | null;
}

const wokwiEvidenceSchema = new Schema<IWokwiEvidence>(
  {
    lastLint: {
      type: wokwiEvidenceResultSchema,
      default: null
    },

    lastRun: {
      type: wokwiEvidenceResultSchema,
      default: null
    },

    lastScenario: {
      type: wokwiEvidenceResultSchema,
      default: null
    },

    lastSerialCapture: {
      type: wokwiEvidenceResultSchema,
      default: null
    },

    updatedAt: {
      type: Date,
      default: null
    }
  },
  { _id: false }
);

interface IProjectAiState {
  summary: string;
  hardwarePath: string;
  files: string[];
  notes: string[];
  lastContextAt: Date | null;
}

const projectAiStateSchema = new Schema<IProjectAiState>(
  {
    summary: { type: String, default: "" },
    hardwarePath: { type: String, default: "" },
    files: { type: [String], default: [] },
    notes: { type: [String], default: [] },
    lastContextAt: { type: Date, default: null }
  },
  { _id: false }
);

// ??$$$ Milestone Test Interface
export interface IMilestoneTest {
  expectedSerialOutput: string;
  passCondition: string;
  commonProblems: string[];
}

// ??$$$ Debug Message Interface
export interface IDebugMessage {
  role: "user" | "model";
  content: string;
  timestamp: Date;
}

// ??$$$ Milestone Interface
// ??$$$ newer code
export interface IRequiredLibrary {
  name: string;
  version?: string;
  type: "core" | "library_manager" | "manual";
  installCommand?: string;
}

// ??$$$ newer code
export interface IMilestone {
  id: string;
  order: number;
  title: string;
  objective: string;
  componentsInvolved: string[];
  wiringInstructions: string;
  code: string;
  explanation: string;
  test: IMilestoneTest;
  status: "locked" | "ready" | "in_progress" | "passed" | "failed";
  userConfirmed: boolean;
  userNotes: string;
  compiledHex: string;
  compilationErrors: any[];
  serialOutput: string;
  completedAt: Date | null;
  simulatable: boolean;
  dependsOn: string[];
  debugMessages: IDebugMessage[];
  requiredLibraries?: IRequiredLibrary[];
  manualLibsAcknowledged?: boolean;
}

// ??$$$ Milestone Schemas
const milestoneTestSchema = new Schema<IMilestoneTest>(
  {
    expectedSerialOutput: { type: String, default: "" },
    passCondition: { type: String, default: "" },
    commonProblems: { type: [String], default: [] }
  },
  { _id: false }
);

const debugMessageSchema = new Schema<IDebugMessage>(
  {
    role: { type: String, enum: ["user", "model"], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  },
  { _id: false }
);

// ??$$$ newer code
const milestoneSchema = new Schema<IMilestone>(
  {
    id: { type: String, required: true },
    order: { type: Number, required: true },
    title: { type: String, default: "" },
    objective: { type: String, default: "" },
    componentsInvolved: { type: [String], default: [] },
    wiringInstructions: { type: String, default: "" },
    code: { type: String, default: "" },
    explanation: { type: String, default: "" },
    test: { type: milestoneTestSchema, required: true },
    status: {
      type: String,
      enum: ["locked", "ready", "in_progress", "passed", "failed"],
      default: "locked"
    },
    userConfirmed: { type: Boolean, default: false },
    userNotes: { type: String, default: "" },
    compiledHex: { type: String, default: "" },
    compilationErrors: { type: [String], default: [] },
    serialOutput: { type: String, default: "" },
    completedAt: { type: Date, default: null },
    simulatable: { type: Boolean, default: true },
    dependsOn: { type: [String], default: [] },
    debugMessages: { type: [debugMessageSchema], default: [] },
    requiredLibraries: {
      type: [
        {
          name: { type: String, required: true },
          version: { type: String },
          type: { type: String, enum: ["core", "library_manager", "manual"], default: "core" },
          installCommand: { type: String }
        }
      ],
      default: []
    },
    manualLibsAcknowledged: { type: Boolean, default: false }
  },
  { _id: false }
);

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

interface IProject {
  owner: Types.ObjectId;
  description: string;

  ideation: IIdeation;

  bomMeta?: IArtifactMeta;
  wiringMeta?: IArtifactMeta;
  sketchMeta?: IArtifactMeta;

  architectureState: IArchitectureState;

  generationProfile: IGenerationProfile;

  meta: {
    stage:
      | "ideation"
      | "components"
      | "build"
      | "simulation"
      | "assembly"
      | "shopping";

    board?: string | null;
    powerSource?: string | null;
    language?: string;
    componentCount?: number;
    detectedAt?: Date | null;
    agentLock?: string | null;
    // ??$$$ Added experimental flag to identify agentic project runs
    isAgentic?: boolean;
  };

  bom: IBomItem[];

  // ??$$$ newer code — wiring array added for formulation exports integration
  wiring?: any[];

  pinAssignments: Record<string, any>;

  sketch: string;

  diagram: any;

  lastCompilation: ICompilation;

  assemblyLayout: IAssemblyLayout;

  stageStatus: IStageStatus;

  // ??$$$ Commented out global messages in favor of stage-specific messages
  // messages: IMessage[];

  componentsMessages: IMessage[];

  designMessages: IMessage[];

  projectAiMessages: IMessage[];

  projectAiState: IProjectAiState;

  wokwiUrl: string;

  wokwiProjectPath: string;

  wokwiEvidence: IWokwiEvidence;
  // ??$$$ newer code
  nodeCoordinates?: any;

  // ??$$$ milestones fields
  milestones: IMilestone[];
  milestonesGenerated: boolean;
  activeMilestoneId: string | null;
  // ??$$$ newer code
  pipelineStages?: any;
  pipelineFailures?: any[];
  // ??$$$ newer code
  derivedDependencies?: any;
  // ??$$$ newer code
  files?: Array<{
    name: string;
    language: string;
    content: string;
  }>;
  activeFile?: string;
}

export type ProjectDocument = HydratedDocument<IProject>;

const projectSchema = new Schema<IProject>(
  {
    // ??$$$ newer code
    files: [
      {
        name: { type: String, required: true },
        language: { type: String, default: "plaintext" },
        content: { type: String, default: "" },
      },
    ],
    activeFile: { type: String, default: "" },

    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    description: {
      type: String,
      required: true
    },

    // ??$$$ newer code
    bomMeta: {
      type: artifactMetaSchema,
      default: () => ({})
    },
    wiringMeta: {
      type: artifactMetaSchema,
      default: () => ({})
    },
    sketchMeta: {
      type: artifactMetaSchema,
      default: () => ({})
    },

    wokwiUrl: {
      type: String,
      default: ""
    },

    wokwiProjectPath: {
      type: String,
      default: ""
    },

    // ??$$$ Commented out global messages schema in favor of stage-specific messages
    // messages: {
    //   type: [messageSchema],
    //   default: []
    // },

    componentsMessages: {
      type: [messageSchema],
      default: []
    },

    designMessages: {
      type: [messageSchema],
      default: []
    },

    projectAiMessages: {
      type: [messageSchema],
      default: []
    },

    ideation: {
      type: ideationSchema,

      // ??$$$ Updated default structure according to Section 7 guidelines
      default: () => ({
        messages: [],
        brief: "",
        objective: "",
        compute: "",
        phases: {},
        constraints: "",
        open: "",
        thinking: "",
        toolTrace: "",
        readyForComponents: false,
        readyAt: null,
        readinessReason: "",
        validatorApproved: false,
        validatorFeedback: "",
        validationAttempts: 0
      })
    },

    architectureState: {
      type: architectureStateSchema,

      default: () => ({
        summary: "",
        pattern: "",
        sourceStrategy: "",
        entryFile: "",
        files: [],
        libraries: [],
        pinAssignments: [],
        runtimeFlow: [],
        assumptions: [],
        openDecisions: [],
        updatedAt: null,
      }),
    },

    generationProfile: {
      type: generationProfileSchema,

      default: () => ({
        board: null,
        boardPartType: "wokwi-arduino-uno",
        powerSource: null,
        language: "cpp",
        firmwareTarget: "arduino-cpp-sketch-ino",
        simulationTarget: "wokwi-json-ino",
        runtimeHints: [],
        profileVersion: 1,
        lockedAt: null,
        updatedAt: null,
      }),
    },

    meta: {
      stage: {
        type: String,
        enum: [
          "ideation",
          "components",
          "build",
          "simulation",
          "assembly",
          "shopping"
        ],
        default: "ideation",
      },

      board: {
        type: String,
        enum: getAllowedBoardValues(),
        default: null
      },

      powerSource: {
        type: String,
        enum: ["usb", "lipo", "9v", "aa-batteries", "unknown", null],
        default: null
      },

      language: {
        type: String,
        enum: ["cpp", "micropython"],
        default: "cpp"
      },

      componentCount: {
        type: Number,
        default: 0
      },

      detectedAt: {
        type: Date,
        default: null
      },

      agentLock: {
        type: String,
        default: null
      },

      // ??$$$ Added isAgentic flag to mongoose schema
      isAgentic: {
        type: Boolean,
        default: false
      }
    },

    projectAiState: {
      type: projectAiStateSchema,

      default: () => ({
        summary: "",
        hardwarePath: "",
        files: [],
        notes: [],
        lastContextAt: null
      })
    },

    wokwiEvidence: {
      type: wokwiEvidenceSchema,

      default: () => ({
        lastLint: null,
        lastRun: null,
        lastScenario: null,
        lastSerialCapture: null,
        updatedAt: null
      })
    },

    bom: {
      type: [bomItemSchema],
      default: []
    },

    pinAssignments: {
      type: Schema.Types.Mixed,
      default: () => ({})
    },

    sketch: {
      type: String,
      default: ""
    },

    diagram: {
      type: Schema.Types.Mixed,
      default: () => ({})
    },

    // ??$$$ newer code — wiring field added to Mongoose Project schema
    wiring: {
      type: Schema.Types.Mixed,
      default: []
    },

    lastCompilation: {
      type: compilationSchema,

      default: () => ({
        hex: "",
        compilationErrors: [],
        warnings: [],
        compiledAt: null
      })
    },

    assemblyLayout: {
      type: assemblyLayoutSchema,

      default: () => ({
        svgString: "",
        dimensions: {
          width_mm: 0,
          height_mm: 0,
          depth_mm: 0
        },
        componentPositions: [],
        sizePreference: "pocket",
        warnings: [],
        generatedAt: null
      })
    },

    stageStatus: {
      type: stageStatusSchema,

      default: () => ({
        ideation: "ready",
        components: "locked",
        build: "locked",
        simulation: "locked",
        assembly: "locked",
        shopping: "locked"
      })
    },
    // ??$$$ newer code
    nodeCoordinates: {
      type: Schema.Types.Mixed,
      default: () => ({})
    },
    // ??$$$
    milestones: {
      type: [milestoneSchema],
      default: []
    },
    milestonesGenerated: {
      type: Boolean,
      default: false
    },
    // ??$$$ newer code
    pipelineStages: {
      type: Schema.Types.Mixed,
      default: () => ({})
    },
    pipelineFailures: {
      type: [Schema.Types.Mixed],
      default: []
    },
    // ??$$$ newer code
    derivedDependencies: {
      type: Schema.Types.Mixed,
      default: () => ({})
    },
    activeMilestoneId: {
      type: String,
      default: null
    }
  },
  { timestamps: true }
);

// ??$$$
projectSchema.pre("validate", function (this: any, next: any) {
  const sanitizeMessages = (msgs: any[]) => {
    if (!Array.isArray(msgs)) return;
    for (const m of msgs) {
      if (m && m.role === "ai") {
        m.role = "model";
      }
    }
  };
  sanitizeMessages(this.componentsMessages);
  sanitizeMessages(this.designMessages);
  sanitizeMessages(this.projectAiMessages);
  if (this.ideation && Array.isArray(this.ideation.messages)) {
    sanitizeMessages(this.ideation.messages);
  }

  // Derive snapshot from ideation brief fields for downstream compatibility
  if (this.ideation) {
    const inputs: string[] = [];
    const outputs: string[] = [];
    const phases = this.ideation.phases || {};
    for (const [phaseName, phaseContent] of Object.entries(phases)) {
      const content = String(phaseContent || "");
      if (!content) continue;
      const upperPhase = phaseName.toUpperCase();
      if (upperPhase.includes("SENSING") || upperPhase.includes("INPUT")) {
        inputs.push(content);
      } else if (upperPhase.includes("MOTOR") || upperPhase.includes("DISPLAY") || upperPhase.includes("OUTPUT")) {
        outputs.push(content);
      } else {
        if (content.toLowerCase().includes("sensor") || content.toLowerCase().includes("read")) {
          inputs.push(content);
        } else {
          outputs.push(content);
        }
      }
    }

    this.ideation.snapshot = {
      corePurpose: this.ideation.objective || "",
      computeCore: this.ideation.compute || "",
      constraints: this.ideation.constraints ? [this.ideation.constraints] : [],
      openQuestions: this.ideation.open ? [this.ideation.open] : [],
      inputs,
      outputs
    };
  }

  if (typeof next === "function") {
    next();
  }
});

const Project: Model<IProject> =
  mongoose.models.Project ||
  mongoose.model<IProject>("Project", projectSchema);

export default Project;