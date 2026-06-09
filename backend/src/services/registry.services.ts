import { readFileSync } from "node:fs";
import path from "node:path";

export type Registry = Record<string, ComponentDefinition>;

export interface ComponentPin {
  name: string;
  signals: Array<{
    type: string;
    role?: string;
    voltage?: number;
    channel?: number;
  }>;
  description?: string;
}

export interface ComponentDefinition {
  wokwiType: string;
  category: string;
  attrs?: Record<string, any>;
  pins: ComponentPin[];
  gltf?: string;
}

export interface AIContextItem {
  name: string;
  type: string;
  category: string;
  pins: string[];
  capabilities: Record<string, string[]>;
}

let REGISTRY_CACHE: Registry | null = null;
let AI_CONTEXT_CACHE: AIContextItem[] | null = null;

const getRegistryPath = (): string => {
  return path.resolve(__dirname, "../../data/componentRegistry.json");
};

export function getRegistry(): Registry {
  if (REGISTRY_CACHE) return REGISTRY_CACHE;

  const raw = readFileSync(getRegistryPath(), "utf8");
  REGISTRY_CACHE = JSON.parse(raw) as Registry;

  return REGISTRY_CACHE;
}

export function buildAIContext(registry: Registry): AIContextItem[] {
  if (!registry || typeof registry !== "object") return [];

  return Object.entries(registry).map(([name, comp]: [string, ComponentDefinition]) => {
    const filteredPins = (comp?.pins || [])
      .filter((p: any) => Array.isArray(p?.signals) && p.signals.length > 0)
      .map((p: any) => p.name);

    const capabilities = Object.fromEntries(
      (Array.isArray(comp?.pins) ? comp.pins : [])
        .filter((p: any) => Array.isArray(p?.signals) && p.signals.length > 0)
        .map((p: any) => [
          p.name,
          p.signals
            .map((s: any) => {
              const t = String(s?.type || "").trim();
              if (!t) return "";
              const role = s?.role ? `-${String(s.role).toLowerCase()}` : "";
              return `${t}${role}`;
            })
            .filter(Boolean)
        ])
    );

    return {
      name,
      type: comp?.wokwiType || "",
      category: comp?.category || "",
      pins: filteredPins,
      capabilities
    };
  });
}

export function getAIContext(): AIContextItem[] {
  if (AI_CONTEXT_CACHE) return AI_CONTEXT_CACHE;
  AI_CONTEXT_CACHE = buildAIContext(getRegistry());
  return AI_CONTEXT_CACHE;
}

export function validateComponentType(componentType: string): boolean {
  const registry = getRegistry();
  return Boolean(
    registry &&
    Object.prototype.hasOwnProperty.call(registry, componentType)
  );
}

export function assertValidComponentType(componentType: string): void {
  if (!validateComponentType(componentType)) {
    throw new Error(
      `Invalid component type: ${String(componentType || "").trim() || "(empty)"}`
    );
  }
}
