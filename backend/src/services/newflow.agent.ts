// ??$$$ legacy implementation moved to:
// backend/src/archive/legacy/newflow.agent.legacy.ts
// ??$$$ newer code
export { runAgent2, saveSessionProgress } from "../agents/formulation";

/*
import mongoose from "mongoose";
import * as fs from "fs";
import * as path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import rotationService from "./keyRotation.service";
import NewFlowSession from "../models/newFlowSession.model";
import Project from "../models/project.model";
import Part from "../models/part.model";
import { executeTool } from "./agent2tools.service";
import { GEMINI_AGENT2_TOOLS, GROQ_AGENT2_TOOLS } from "./agent2tools.declarations";
import { resolveAllPins } from "./pinResolver.service";
import {
  LLMResponse,
  LLMAdapter,
  GeminiAdapter,
  GroqAdapter,
  CerebrasAdapter,
  OllamaAdapter,
  checkOllama,
  getOllamaModel
} from "../agents/shared/adapters";
import { parseJsonRecursively } from "../agents/shared/jsonRepair";

export async function saveSessionProgress(sessionId: string, type: string, data: any) {
  // Legacy code commented out...
}

export async function runAgent2(sessionId: string, modelName: string, isResume = false) {
  // Legacy code commented out...
}
*/
