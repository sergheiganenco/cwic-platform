import { Request, Response } from 'express';
import { GovernanceService } from '../services/GovernanceService';

export class GovernanceController {
  private svc = new GovernanceService();

  listPolicies = async (req: Request, res: Response) => {
    const data = await this.svc.listPolicies(String(req.query.status || ''));
    res.json({ success: true, data });
  };

  createPolicy = async (req: Request, res: Response) => {
    const data = await this.svc.createPolicy(req.body, (req as any).user?.id);
    res.status(201).json({ success: true, data });
  };

  updatePolicy = async (req: Request, res: Response) => {
    const data = await this.svc.updatePolicy(req.params.id, req.body, (req as any).user?.id);
    if (!data) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
    res.json({ success: true, data });
  };

  deletePolicy = async (req: Request, res: Response) => {
    const ok = await this.svc.deletePolicy(req.params.id);
    if (!ok) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
    res.json({ success: true });
  };
}
