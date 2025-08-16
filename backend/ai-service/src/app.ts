// src/app.ts
import compression from 'compression';
import cors from 'cors';
import express, { Application, NextFunction, Request, RequestHandler, Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

class App {
  public app: Application;

  constructor() {
    this.app = express();
    console.log('🔄 Creating Express app...');
    this.initializeMiddlewares();
    console.log('✅ Express app created');
    this.initializeRoutes();
    console.log('🔄 Initializing basic middlewares...');
    this.initializeErrorHandling();
    console.log('✅ Basic middlewares initialized');
  }

  private initializeMiddlewares(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      crossOriginEmbedderPolicy: false
    }) as RequestHandler);

    // CORS configuration
    const corsOptions = {
      origin: process.env.NODE_ENV === 'production' 
        ? process.env.CORS_ORIGINS?.split(',') || ['https://your-frontend-domain.com']
        : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173'],
      credentials: true,
      optionsSuccessStatus: 200
    };
    this.app.use(cors(corsOptions) as RequestHandler);

    // Compression
    this.app.use(compression() as RequestHandler);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }) as RequestHandler);
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }) as RequestHandler);

    // Logging
    const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
    this.app.use(morgan(morganFormat) as RequestHandler);

    // Request ID middleware
    this.app.use((req: Request, _res: Response, next: NextFunction) => {
      (req as any).id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      next();
    });

    // Security headers
    this.app.use((_req: Request, res: Response, next: NextFunction) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.removeHeader('X-Powered-By');
      next();
    });
  }

  private initializeRoutes(): void {
    console.log('🔄 Initializing basic routes...');
    
    // Health check (before any middleware that might block it)
    this.app.get('/health', (_req: Request, res: Response) => {
      const memoryUsage = process.memoryUsage();
      res.status(200).json({
        status: 'healthy',
        service: 'ai-service',
        timestamp: new Date().toISOString(),
        version: process.env.APP_VERSION || '1.0.0',
        uptime: Math.floor(process.uptime()),
        environment: process.env.NODE_ENV || 'development',
        memory: {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          usage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)
        }
      });
    });

    // Root endpoint
    this.app.get('/', (_req: Request, res: Response) => {
      res.status(200).json({
        message: 'CWIC AI Service',
        version: process.env.APP_VERSION || '1.0.0',
        status: 'running',
        endpoints: {
          health: '/health',
          api: '/api',
          docs: '/api/docs'
        },
        timestamp: new Date().toISOString()
      });
    });

    // API documentation endpoint
    this.app.get('/api/docs', (_req: Request, res: Response) => {
      res.status(200).json({
        service: 'CWIC AI Service',
        version: process.env.APP_VERSION || '1.0.0',
        description: 'AI-powered data governance and discovery service',
        endpoints: {
          discovery: {
            'POST /api/discovery': 'Start data discovery session',
            'GET /api/discovery/:sessionId': 'Get discovery status',
            'POST /api/discovery/query': 'Natural language queries',
            'POST /api/discovery/quality-rules': 'Generate quality rules'
          },
          analysis: {
            'POST /api/analysis/schema': 'Analyze database schema',
            'POST /api/analysis/quality': 'Data quality analysis'
          },
          health: {
            'GET /health': 'Service health check',
            'GET /health/ready': 'Readiness probe',
            'GET /health/live': 'Liveness probe'
          }
        }
      });
    });

    // API status endpoint (fallback)
    this.app.get('/api/status', (_req: Request, res: Response) => {
      res.status(200).json({
        status: 'AI Service API Ready',
        timestamp: new Date().toISOString(),
        routes: 'Basic routes loaded'
      });
    });

    // Try to load API routes (gracefully handle if not available)
   try {
  // IMPORTANT: prefer require here because ts-node is already running with tsconfig-paths/register
  // If this throws, you'll see the exact error below.
    const routes = require('./routes');
    this.app.use('/api', routes.default || routes);
    console.log('✅ API routes loaded successfully');
  } catch (routeError: any) {
    console.error('❌ Failed to load API routes:', {
      message: routeError?.message,
      stack: routeError?.stack,
    });

    // Fallback API route (keep this so app still runs)
    this.app.use('/api', (_req: Request, res: Response) => {
      res.status(503).json({
        error: 'API routes failed to load',
        message: routeError?.message || 'Service is starting up',
        retry: 'Fix the routes import error shown in server logs',
      });
    });
  }

    console.log('✅ Basic routes initialized');
  }

  private initializeErrorHandling(): void {
    // 404 handler
    this.app.use((_req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'The requested resource was not found',
          path: _req.path
        },
        timestamp: new Date().toISOString()
      });
    });

    // Global error handler
    this.app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
      // Type guard to check if error is an Error object
      const isError = error instanceof Error;
      const errorMessage = isError ? error.message : 'Unknown error occurred';
      const errorStack = isError ? error.stack : undefined;

      // Log error safely
      if (typeof console !== 'undefined') {
        console.error('❌ Application Error:', {
          message: errorMessage,
          stack: errorStack,
          url: _req.url,
          method: _req.method
        });
      }

      // Determine status code
      let statusCode = 500;
      if (isError && 'statusCode' in error) {
        statusCode = (error as any).statusCode || 500;
      }

      // Send error response
      const response: any = {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: process.env.NODE_ENV === 'development' 
            ? errorMessage 
            : 'An internal server error occurred'
        },
        timestamp: new Date().toISOString()
      };

      // Include stack trace in development
      if (process.env.NODE_ENV === 'development' && errorStack) {
        response.error.stack = errorStack;
      }

      if (!res.headersSent) {
        res.status(statusCode).json(response);
      }
    });
  }

  public getApp(): Application {
    return this.app;
  }

  public async shutdown(): Promise<void> {
    console.log('🔄 Shutting down application...');
    // Add cleanup logic here if needed
    console.log('✅ Application shutdown complete');
  }
}

export default App;