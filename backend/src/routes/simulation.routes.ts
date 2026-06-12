// ??$$$ newer code - Simulation routes for simulation v2
import { Router } from 'express';
import NewFlowSession from '../models/newFlowSession.model';
import Project from '../models/project.model';
import { compileSimulationBundle } from '../simulation/SimulationCompiler';

const router = Router();

// Handle both standard and legacy paths for compatibility
const handler = async (req: any, res: any) => {
  const { sessionId } = req.params;

  try {
    // Load session
    const session = await NewFlowSession.findById(sessionId).lean();
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Load linked project if available
    let project = null;
    if ((session as any).projectId) {
      project = await Project.findById((session as any).projectId).lean();
    }

    const bom = (project as any)?.bom || (session as any).bom || [];
    const wiring = (project as any)?.wiring || (session as any).wiring || [];
    const milestones = (project as any)?.milestones || (session as any).milestones || [];
    const sketch = (project as any)?.sketch || (session as any).sketch || '';
    const context = (session as any).context || {};
    const name = (project as any)?.name || (session as any).projectName || 'Hardware Project';

    // Compile the SimulationBundle — all intelligence is here, not in the frontend
    const bundle = compileSimulationBundle(sessionId, {
      name,
      bom,
      wiring,
      milestones,
      sketch,
      context,
    });

    return res.json({ bundle });
  } catch (err: any) {
    console.error('[SimulationRoute] Failed to compile bundle:', err);
    return res.status(500).json({ error: err.message || 'Failed to compile simulation bundle' });
  }
};

router.get('/virtual-project/:sessionId', handler);
router.get('/new-flow/virtual-project/:sessionId', handler);

export default router;
