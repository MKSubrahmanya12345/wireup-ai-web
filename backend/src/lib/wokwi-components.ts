import { getRegistry } from "../services/registry.services";

export interface WokwiComponent {
  label: string;
  partType: string;
  aliases: string[];
}

export const getWokwiComponentCatalog = (): WokwiComponent[] => {
  const registry = getRegistry();
  return Object.entries(registry).map(([key, def]) => ({
    label: key.replace(/_/g, " "),
    partType: def.wokwiType,
    aliases: [key.toLowerCase(), key.replace(/_/g, " ").toLowerCase()]
  }));
};

export const formatWokwiComponentCatalogForPrompt = (): string => {
  return getWokwiComponentCatalog()
    .map((item) => `- ${item.label} (${item.partType})`)
    .join("\n");
};

export const findUnsupportedPartTypesInText = (text: string = ""): string[] => {
  const content = String(text || "");
  const tokens = content.match(/\b(?:wokwi|board|chip)-[a-z0-9-]+\b/gi) || [];

  const allowedPartTypes = new Set(
    getWokwiComponentCatalog().map((item) => item.partType.toLowerCase())
  );

  const unsupported = [...new Set(
    tokens
      .map((token) => token.toLowerCase())
      .filter((token) => !token.startsWith("chip-") && !allowedPartTypes.has(token))
  )];

  return unsupported;
};
