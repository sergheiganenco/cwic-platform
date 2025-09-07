import { Request, Response } from 'express';
import { StatsService } from '../services/StatsService';

export class StatsController {
  private svc = new StatsService();
  get = async (_req: Request, res: Response) => {
    const data = await this.svc.snapshot();
    res.json({ success: true, data });
  };
}