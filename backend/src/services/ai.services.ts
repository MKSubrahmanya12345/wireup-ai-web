// ??$$$ group 2 - Ideation Stage (Phase 1)
/* eslint-disable @typescript-eslint/no-explicit-any */
/*
  Note: this file was migrated from JS. The next edits add minimal
  typings for ideation-related functions and normalize AI response fields.
*/
// @ts-nocheck
type IdeationRaw = any;
type IdeationNormalized = {
  summary: string;
  requirements: string[];
  unknowns: string[];
  question: string;
  assistantReply: string;
  extractedContext: Record<string, any>;
  architectureState: Record<string, any>;
};
// ??$$$
import Groq from "groq-sdk";
import { getAIContext, getRegistry } from "./registry.services";
import rotationService from "./keyRotation.service"; // ??$$$ Key rotation
import { formatWokwiComponentCatalogForPrompt, findUnsupportedPartTypesInText } from "../lib/wokwi-components";
import { buildWokwiEvidenceText } from "./wokwi-runner.service";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { deriveBOMKey } from "../utils/bom.utils"; // ??$$$
// ??$$$ newer code
import {
  safeParse,
  stripThinking,
  recoverGeneratedAssetsFromText
} from "../agents/shared/jsonRepair";

/*
import Groq from "groq-sdk";
import { getAIContext, getRegistry } from "./registry.services";
import rotationService from "./keyRotation.service"; // ??$$$ Key rotation
*/

// ??$$$ newer code
import {
  normalizeArchitectureState as _normalizeArchitectureState,
  extractHardwareContext as _extractHardwareContext,
  generateCustomChipTemplate as _generateCustomChipTemplate,
  buildGenerationProfileFromMeta as _buildGenerationProfileFromMeta,
  detectBoardFromRequirements as _detectBoardFromRequirements,
  detectPowerSourceFromRequirements as _detectPowerSourceFromRequirements,
  processInput as _processInput,
  processComponents as _processComponents,
  processDesign as _processDesign,
  generateWokwiAssetsFromState as _generateWokwiAssetsFromState,
  generateSketchOnly as _generateSketchOnly,
  generateDiagramOnly as _generateDiagramOnly,
  validatePinSync as _validatePinSync
} from "../agents/discovery";
import { safeParse as _safeParse } from "../agents/shared/jsonRepair";

// ??$$$ re-exporting for compatibility
export const normalizeArchitectureState = _normalizeArchitectureState;
export const safeParse = _safeParse;
export const extractHardwareContext = _extractHardwareContext;
export const generateCustomChipTemplate = _generateCustomChipTemplate;
export const buildGenerationProfileFromMeta = _buildGenerationProfileFromMeta;
export const detectBoardFromRequirements = _detectBoardFromRequirements;
export const detectPowerSourceFromRequirements = _detectPowerSourceFromRequirements;
export const processInput = _processInput;
export const processComponents = _processComponents;
export const processDesign = _processDesign;
export const generateWokwiAssetsFromState = _generateWokwiAssetsFromState;
export const generateSketchOnly = _generateSketchOnly;
export const generateDiagramOnly = _generateDiagramOnly;
export const validatePinSync = _validatePinSync;


