import mongoose, { Schema, Types, HydratedDocument, Model } from "mongoose";
import { getRegistry } from "../services/registry.services";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const LEGACY_BOARD_SLUGS = [
  "arduino-uno",
  "arduino-nano",
  "esp32-devkit-v1",
  "raspberry-pi-pico",
  "attiny85",
] as const;

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const getAllowedBoardValues = (): (string | null)[] => {
  const registry = getRegistry();

  const registryBoardKeys = Object.entries(registry || {})
    .filter(([, def]: any) =>
      String(def?.category || "").toLowerCase() === "controller"
    )
    .map(([key]) => key);

  return [...new Set([...LEGACY_BOARD_SLUGS, ...registryBoardKeys, null])];
};

// ─────────────────────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────────────────────

interface IMessage {
  role: "user" | "ai";
  content: string;
}

interface IIdeaState {
  summary: string;
  requirements: string[];
  unknowns: string[];
}

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

interface IProject {
  owner: Types.ObjectId;
  description: string;

  // ⚠️ IMPORTANT: these were missing before (your controller uses them)
  ideaState: IIdeaState;
  architectureState: IArchitectureState;
  generationProfile: IGenerationProfile;

  meta: {
    stage: "ideation" | "components" | "build" | "simulation" | "assembly" | "shopping";
  };

  extractedContext?: string;

  messages: IMessage[];
  componentsMessages: IMessage[];
  designMessages: IMessage[];

  wokwiUrl: string;
  wokwiProjectPath: string;
}

// Hydrated document type (IMPORTANT FIX)
export type ProjectDocument = HydratedDocument<IProject>;

// ─────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────

const messageSchema = new Schema<IMessage>(
  {
    role: { type: String, enum: ["user", "ai"], required: true },
    content: { type: String, required: true },
  },
  { _id: false }
);

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

const generationProfileSchema = new Schema<IGenerationProfile>(
  {
    board: { type: String, enum: getAllowedBoardValues(), default: null },
    boardPartType: { type: String, default: "wokwi-arduino-uno" },
    powerSource: {
      type: String,
      enum: ["usb", "lipo", "9v", "aa-batteries", "unknown", null],
      default: null,
    },
    language: { type: String, enum: ["cpp", "micropython"], default: "cpp" },
    firmwareTarget: { type: String, default: "arduino-cpp-sketch-ino" },
    simulationTarget: { type: String, default: "wokwi-json-ino" },
    runtimeHints: { type: [String], default: [] },
    profileVersion: { type: Number, default: 1 },
    lockedAt: { type: Date, default: null },
    updatedAt: { type: Date, default: null },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────
// Main Schema
// ─────────────────────────────────────────────────────────────

const projectSchema = new Schema<IProject>(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    description: { type: String, required: true },

    wokwiUrl: { type: String, default: "" },
    wokwiProjectPath: { type: String, default: "" },

    messages: { type: [messageSchema], default: [] },
    componentsMessages: { type: [messageSchema], default: [] },
    designMessages: { type: [messageSchema], default: [] },

    // FIXED: avoid empty object default (causes TS inference issues)
    ideaState: {
      summary: { type: String, default: "" },
      requirements: { type: [String], default: [] },
      unknowns: { type: [String], default: [] },
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
        enum: ["ideation", "components", "build", "simulation", "assembly", "shopping"],
        default: "ideation",
      },
    },

    extractedContext: { type: String, default: "" },
  },
  { timestamps: true }
);

// ─────────────────────────────────────────────────────────────
// Model
// ─────────────────────────────────────────────────────────────

const Project: Model<IProject> =
  mongoose.models.Project || mongoose.model<IProject>("Project", projectSchema);

export default Project;