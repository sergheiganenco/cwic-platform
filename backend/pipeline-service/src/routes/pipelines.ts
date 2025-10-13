import { Router } from 'express';
import { PipelineController } from '../controllers/PipelineController.js';

const router = Router();
const controller = new PipelineController();

// Pipeline management
router.get('/', (req, res) => controller.listPipelines(req, res));
router.post('/', (req, res) => controller.createPipeline(req, res));
router.get('/:id', (req, res) => controller.getPipeline(req, res));
router.put('/:id', (req, res) => controller.updatePipeline(req, res));
router.delete('/:id', (req, res) => controller.deletePipeline(req, res));

// Run pipeline
router.post('/:id/run', (req, res) => controller.triggerRun(req, res));

export default router;