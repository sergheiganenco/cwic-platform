// backend/quality-engine/src/services/CostAwareScheduler.ts
import { logger } from '../utils/logger';
import { DatabaseService } from '../utils/database';
import { CostEstimate, ScheduledJob, Priority } from '../types';
import { config } from '../config';

export class CostAwareScheduler {
  private db: DatabaseService;
  private dailySpent: number = 0;
  private monthlySpent: number = 0;

  constructor() {
    this.db = new DatabaseService();
  }

  async estimateRuleCost(ruleId: string): Promise<CostEstimate> {
    // Simplified cost estimation
    const estimate: CostEstimate = {
      ruleId,
      computeUnits: Math.random() * 100,
      storageScannedGB: Math.random() * 10,
      monetaryCost: Math.random() * 5,
      estimatedTimeMs: Math.random() * 5000,
      confidence: 0.85
    };

    return estimate;
  }

  async isWithinBudget(estimate: CostEstimate): Promise<boolean> {
    const dailyLimit = config.scheduling.budgetLimits.daily;
    const monthlyLimit = config.scheduling.budgetLimits.monthly;

    return (
      this.dailySpent + estimate.monetaryCost <= dailyLimit &&
      this.monthlySpent + estimate.monetaryCost <= monthlyLimit
    );
  }

  async scheduleJob(job: ScheduledJob): Promise<void> {
    logger.info(`Scheduling job ${job.id} for ${job.scheduledAt}`);

    // Store in database
    await this.db.query(
      `INSERT INTO quality_scheduled_jobs
       (id, rule_id, asset_id, scheduled_at, priority, cost_estimate, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        job.id,
        job.ruleId,
        job.assetId,
        job.scheduledAt,
        job.priority,
        JSON.stringify(job.costEstimate),
        job.status
      ]
    );
  }

  async getOptimalSchedule(): Promise<ScheduledJob[]> {
    // Get jobs within budget and optimize by priority
    const jobs = await this.db.query(
      `SELECT * FROM quality_scheduled_jobs
       WHERE status = 'pending'
       ORDER BY priority DESC, scheduled_at ASC
       LIMIT 100`
    );

    return jobs.rows;
  }

  async updateSpending(cost: number): Promise<void> {
    this.dailySpent += cost;
    this.monthlySpent += cost;

    // Record in database
    await this.db.query(
      `INSERT INTO quality_cost_tracking
       (execution_date, monetary_cost, status)
       VALUES (CURRENT_DATE, $1, 'completed')`,
      [cost]
    );
  }
}