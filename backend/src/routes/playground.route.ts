// ??$$$ newer code: Merged virtual-playground backend routes
import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const router = express.Router();

const mockProject = {
  id: "starter-project",
  name: "Virtual Playground Starter",
  description: "Load a formulated project payload to simulate its real sketch, wiring, and components.",
  author: "Virtual Playground",
  createdAt: "2026-06-06",
  bom: [],
  wiring: [],
  editableJson: {
    simulationSpeed: 1,
    ledInitialState: false,
    buttonInitialState: false
  },
  sketch: `// Starter sketch placeholder.
// Real behavior should come from the loaded project payload.

void setup() {
}

void loop() {
}
`
};

router.get('/project', (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  if (sessionId) {
    const exportsBaseDir = process.env.FORMULATION_EXPORTS_DIR || "/tmp/wireup_formulation_exports";
    const exportDir = path.join(exportsBaseDir, `session_${sessionId}`);
    
    if (fs.existsSync(exportDir)) {
      try {
        console.log(`[API Playground] Serving dynamic session project from ${exportDir} for session: ${sessionId}`);
        const bom = JSON.parse(fs.readFileSync(path.join(exportDir, "bom.json"), "utf8") || "[]");
        const wiring = JSON.parse(fs.readFileSync(path.join(exportDir, "wiring.json"), "utf8") || "[]");
        const milestones = JSON.parse(fs.readFileSync(path.join(exportDir, "milestones.json"), "utf8") || "[]");
        const context = JSON.parse(fs.readFileSync(path.join(exportDir, "context.json"), "utf8") || "{}");
        const sketch = fs.readFileSync(path.join(exportDir, "sketch.ino"), "utf8") || "";

        // Build normalized projectData structure as expected by the frontend
        const projectPayload = {
          id: sessionId,
          name: context.corePurpose || "Wireup Project",
          description: "AI-formulated project loaded from session exports",
          author: "Wireup AI",
          createdAt: new Date().toISOString().slice(0, 10),
          bom,
          wiring,
          editableJson: {
            simulationSpeed: 1,
            ledInitialState: false,
            buttonInitialState: false
          },
          sketch,
          context,
          phases: context.subsystems || [],
          milestones,
          additionalTools: [
            "Soldering iron",
            "Solder wire",
            "Wire stripper",
            "Wire cutter",
            "Multimeter"
          ]
        };
        return res.json(projectPayload);
      } catch (err) {
        console.error(`[API Playground] Error reading session exports for ${sessionId}:`, err);
      }
    } else {
      console.warn(`[API Playground] Export directory not found for session: ${sessionId}`);
    }
  }

  console.log('[API Playground] GET /project requested - serving fallback mockProject');
  return res.json(mockProject);
});

export default router;
