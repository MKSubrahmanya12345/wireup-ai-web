// @ts-nocheck
// ??$$$ FORGE: shopping.controller.js — Stage 5 APIs
import Project from '../models/project.model';
import { processBOMForShopping } from '../services/shopping.service';
import { advanceStage } from '../services/pipeline.service';

export const getShoppingList = async (req, res) => {
  const { projectId } = req.params;

  try {
    const project = await Project.findOne({ _id: projectId, owner: req.user._id })
      .select('bom stageStatus');

    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Mark stage done as soon as they view it (since it's just a static list)
    if (project.stageStatus?.shopping !== 'done') {
      await advanceStage(projectId, 'shopping');
    }

    const items = processBOMForShopping(project.bom || []);

    return res.status(200).json({ items });

  } catch (err) {
    console.error('[shopping.controller] getShoppingList error:', err);
    return res.status(500).json({ error: 'Failed to load shopping list' });
  }
};
