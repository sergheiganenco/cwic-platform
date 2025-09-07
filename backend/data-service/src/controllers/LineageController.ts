import { Request, Response } from 'express';
import { LineageService } from '../services/LineageService';

export class LineageController {
  private svc = new LineageService();
  graph = async (_req: Request, res: Response) => {
    const data = await this.svc.buildDemoGraph();
    res.json({ success: true, data });
  };
}