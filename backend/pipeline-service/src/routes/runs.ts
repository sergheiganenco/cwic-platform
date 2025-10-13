import { Router } from 'express';
import { PipelineController } from '../controllers/PipelineController.js';

const router = Router();
const controller = new PipelineController();

// Pipeline runs management
router.get('/', (req, res) => controller.listRuns(req, res));
router.get('/:id', (req, res) => controller.getRun(req, res));
router.post('/:id/cancel', (req, res) => controller.cancelRun(req, res));
router.post('/:id/retry', (req, res) => controller.retryRun(req, res));
router.get('/:id/logs', (req, res) => controller.getRunLogs(req, res));

export default router;