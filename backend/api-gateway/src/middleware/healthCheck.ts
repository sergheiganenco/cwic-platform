import { Request, Response } from 'express';
// These clients come from @cwic/shared (we’ll wire them as simple axios wrappers)
import { AIServiceClient, AuthServiceClient, DataServiceClient } from '@cwic/shared';

const serviceClients = {
  auth: new AuthServiceClient(),
  data: new DataServiceClient(),
  ai: new AIServiceClient()
};

export const healthCheck = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  try {
    const serviceChecks = await Promise.allSettled([
      checkServiceHealth('auth', serviceClients.auth),
      checkServiceHealth('data', serviceClients.data),
      checkServiceHealth('ai', serviceClients.ai)
    ]);

    const services = serviceChecks.reduce((acc, result, index) => {
      const serviceName = ['auth', 'data', 'ai'][index];
      acc[serviceName] = result.status === 'fulfilled'
        ? result.value
        : { status: 'unhealthy', error: (result as any).reason?.message };
      return acc;
    }, {} as any);

    const allHealthy = Object.values(services).every((s: any) => s.status === 'healthy');

    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime: Date.now() - startTime,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

async function checkServiceHealth(_name: string, client: any): Promise<any> {
  try {
    const start = Date.now();
    await client.get('/health');
    return { status: 'healthy', responseTime: Date.now() - start };
  } catch (error) {
    return { status: 'unhealthy', error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
