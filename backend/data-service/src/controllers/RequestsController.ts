import { Request, Response } from 'express';
import { RequestsService } from '../services/RequestsService';

export class RequestsController {
  private svc = new RequestsService();

  list = async (req: Request, res: Response) => {
    const data = await this.svc.list(String(req.query.status || ''), String(req.query.type || ''));
    res.json({ success: true, data });
  };

  create = async (req: Request, res: Response) => {
    const data = await this.svc.create(req.body, (req as any).user?.id);
    res.status(201).json({ success: true, data });
  };

  update = async (req: Request, res: Response) => {
    const data = await this.svc.update(req.params.id, req.body, (req as any).user?.id);
    if (!data) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
    res.json({ success: true, data });
  };
}
