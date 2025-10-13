// src/proxy/pipelineServiceProxy.ts
import axios, { type AxiosError } from 'axios';
import { Router, type Request, type Response } from 'express';
import { resolveUpstreams } from '../config/upstreams.js';

const router = Router();
const upstreams = resolveUpstreams();
const BASE_URL = upstreams.pipelineService;

console.log(`[API-Gateway] Pipeline service proxy -> ${BASE_URL}`);

// Helper to forward errors
function forwardError(error: unknown, res: Response) {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;
    const status = axiosError.response?.status || 500;
    const data = axiosError.response?.data || { error: 'Pipeline service error' };
    return res.status(status).json(data);
  }
  console.error('Pipeline proxy error:', error);
  return res.status(500).json({ error: 'Internal server error' });
}

// Pipelines endpoints
router.get('/pipelines', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${BASE_URL}/api/pipelines`, {
      params: req.query,
      headers: { 'x-user-id': req.headers['x-user-id'] }
    });
    res.json(response.data);
  } catch (error) {
    forwardError(error, res);
  }
});

router.post('/pipelines', async (req: Request, res: Response) => {
  try {
    const response = await axios.post(`${BASE_URL}/api/pipelines`, req.body, {
      headers: { 'x-user-id': req.headers['x-user-id'] }
    });
    res.status(201).json(response.data);
  } catch (error) {
    forwardError(error, res);
  }
});

router.get('/pipelines/:id', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${BASE_URL}/api/pipelines/${req.params.id}`, {
      headers: { 'x-user-id': req.headers['x-user-id'] }
    });
    res.json(response.data);
  } catch (error) {
    forwardError(error, res);
  }
});

router.put('/pipelines/:id', async (req: Request, res: Response) => {
  try {
    const response = await axios.put(`${BASE_URL}/api/pipelines/${req.params.id}`, req.body, {
      headers: { 'x-user-id': req.headers['x-user-id'] }
    });
    res.json(response.data);
  } catch (error) {
    forwardError(error, res);
  }
});

router.delete('/pipelines/:id', async (req: Request, res: Response) => {
  try {
    await axios.delete(`${BASE_URL}/api/pipelines/${req.params.id}`, {
      headers: { 'x-user-id': req.headers['x-user-id'] }
    });
    res.status(204).send();
  } catch (error) {
    forwardError(error, res);
  }
});

router.post('/pipelines/:id/run', async (req: Request, res: Response) => {
  try {
    const response = await axios.post(`${BASE_URL}/api/pipelines/${req.params.id}/run`, req.body, {
      headers: { 'x-user-id': req.headers['x-user-id'] }
    });
    res.status(202).json(response.data);
  } catch (error) {
    forwardError(error, res);
  }
});

// Pipeline runs endpoints
router.get('/pipeline-runs', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${BASE_URL}/api/pipeline-runs`, {
      params: req.query,
      headers: { 'x-user-id': req.headers['x-user-id'] }
    });
    res.json(response.data);
  } catch (error) {
    forwardError(error, res);
  }
});

router.get('/pipeline-runs/:id', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${BASE_URL}/api/pipeline-runs/${req.params.id}`, {
      params: req.query,
      headers: { 'x-user-id': req.headers['x-user-id'] }
    });
    res.json(response.data);
  } catch (error) {
    forwardError(error, res);
  }
});

router.post('/pipeline-runs/:id/cancel', async (req: Request, res: Response) => {
  try {
    const response = await axios.post(`${BASE_URL}/api/pipeline-runs/${req.params.id}/cancel`, {}, {
      headers: { 'x-user-id': req.headers['x-user-id'] }
    });
    res.status(202).json(response.data);
  } catch (error) {
    forwardError(error, res);
  }
});

router.post('/pipeline-runs/:id/retry', async (req: Request, res: Response) => {
  try {
    const response = await axios.post(`${BASE_URL}/api/pipeline-runs/${req.params.id}/retry`, req.body, {
      headers: { 'x-user-id': req.headers['x-user-id'] }
    });
    res.status(202).json(response.data);
  } catch (error) {
    forwardError(error, res);
  }
});

router.get('/pipeline-runs/:id/logs', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${BASE_URL}/api/pipeline-runs/${req.params.id}/logs`, {
      params: req.query,
      headers: { 'x-user-id': req.headers['x-user-id'] }
    });
    res.json(response.data);
  } catch (error) {
    forwardError(error, res);
  }
});

export default router;