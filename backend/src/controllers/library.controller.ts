// ??$$$ group 3 - Components BOM & Wiring (Phase 2)
// ??$$$ newer code
import { Request, Response } from "express";
import { searchLibrary } from "../services/library.service";

/**
 * searchLibraryController - Handles GET or POST library search requests
 * URL: GET/POST /api/library/search
 */
export const searchLibraryController = async (req: Request, res: Response) => {
  try {
    // Support parameters in query (GET) or body (POST)
    const queryParam = req.query.q || req.query.query || req.body?.query || req.body?.q;
    const limitParam = req.query.limit || req.body?.limit;
    const strategyParam = req.query.strategy || req.body?.strategy;

    const query = typeof queryParam === "string" ? queryParam.trim() : "";
    if (!query) {
      return res.status(400).json({ error: "Search query 'q' or 'query' is required." });
    }

    let limit = 5;
    if (limitParam !== undefined) {
      const parsedLimit = parseInt(String(limitParam), 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        limit = parsedLimit;
      }
    }

    let strategy: "auto" | "local_only" | "remote_only" = "auto";
    if (strategyParam === "local_only" || strategyParam === "remote_only" || strategyParam === "auto") {
      strategy = strategyParam;
    }

    console.log(`[LibraryController] Searching library for: "${query}" (limit: ${limit}, strategy: ${strategy})`);
    const results = await searchLibrary({ query, limit, strategy });

    return res.status(200).json({ results });
  } catch (err: any) {
    console.error("[LibraryController] Error handling search request:", err);
    return res.status(500).json({ error: err.message || "Failed to search component library." });
  }
};
