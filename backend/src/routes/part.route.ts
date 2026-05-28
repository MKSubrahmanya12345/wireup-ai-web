// ??$$$ newer code — Component Ingestion & Metadata API Routes
import express, { Request, Response } from "express";
import Part from "../models/part.model";
import { ingestComponent } from "../services/model.service";

const router = express.Router();

/**
 * POST /api/parts/import
 * Ingests a new electronic component by MPN and LCSC ID.
 */
router.post("/parts/import", async (req: Request, res: Response) => {
  const { mpn, lcscId, forceRefresh } = req.body;

  if (!mpn) {
    return res.status(400).json({ error: "Missing required parameter 'mpn'" });
  }

  try {
    const part = await ingestComponent(mpn, lcscId, !!forceRefresh);
    res.status(201).json(part);
  } catch (err: any) {
    console.error(`[API Parts Import] Error:`, err.message);
    res.status(500).json({ error: err.message || "Failed to import component" });
  }
});

/**
 * GET /api/parts/search
 * Search for ingested components by MPN, manufacturer, category, package type, or LCSC ID.
 */
router.get("/parts/search", async (req: Request, res: Response) => {
  const q = req.query.q as string;

  if (!q) {
    return res.json([]);
  }

  try {
    const parts = await Part.find({
      $or: [
        { mpn: { $regex: q, $options: "i" } },
        { manufacturer: { $regex: q, $options: "i" } },
        { category: { $regex: q, $options: "i" } },
        { "package.type": { $regex: q, $options: "i" } },
        { lcscId: { $regex: q, $options: "i" } }
      ]
    });
    res.json(parts);
  } catch (err: any) {
    console.error(`[API Parts Search] Error:`, err.message);
    res.status(500).json({ error: "Failed to search components" });
  }
});

/**
 * GET /api/parts/:mpn
 * Retrieves a single component configuration.
 */
router.get("/parts/:mpn", async (req: Request, res: Response) => {
  const { mpn } = req.params;

  try {
    const part = await Part.findOne({ mpn });
    if (!part) {
      return res.status(404).json({ error: `Component with MPN "${mpn}" not found` });
    }
    res.json(part);
  } catch (err: any) {
    console.error(`[API Parts Get] Error:`, err.message);
    res.status(500).json({ error: "Failed to retrieve component details" });
  }
});

export default router;
