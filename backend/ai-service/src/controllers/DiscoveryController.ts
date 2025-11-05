import { AIService, NaturalLanguageQuery } from '@services/AIService';
import { EnhancedAIService, EnhancedQueryRequest } from '@services/EnhancedAIService';
import { DiscoveryService, StartDiscoveryRequest } from '@services/DiscoveryService';
import { APIError } from '@utils/errors';
import { logger } from '@utils/logger';
import { successResponse } from '@utils/responses';
import { NextFunction, Request, Response } from 'express';

export class DiscoveryController {
  private discoveryService: DiscoveryService;
  private aiService: AIService;
  private enhancedAIService: EnhancedAIService;

  constructor() {
    this.discoveryService = new DiscoveryService();
    this.aiService = new AIService();
    this.enhancedAIService = new EnhancedAIService();
  }

  public startDiscovery = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { dataSourceId, schemas, tables, options } = req.body;
      const userId = (req as any).user.id;

      if (!dataSourceId) {
        throw new APIError('Data source ID is required', 400);
      }

      const request: StartDiscoveryRequest = {
        userId,
        dataSourceId,
        schemas,
        tables,
        options
      };

      const session = await this.discoveryService.startDiscovery(request);

      logger.info('Discovery started', { sessionId: session.sessionId, userId });

      res.status(201).json(successResponse(session, 'Discovery session started'));

    } catch (error) {
      next(error);
    }
  };

  public getDiscoveryStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId } = req.params;
      const userId = (req as any).user.id;

      const session = await this.discoveryService.getSession(sessionId);

      if (!session) {
        throw new APIError('Discovery session not found', 404);
      }

      if (session.userId !== userId) {
        throw new APIError('Access denied', 403);
      }

      res.json(successResponse(session));

    } catch (error) {
      next(error);
    }
  };

  public listDiscoverySessions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user.id;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      const sessions = await this.discoveryService.listSessions(userId, limit, offset);

      res.json(successResponse({
        sessions,
        pagination: {
          limit,
          offset,
          total: sessions.length
        }
      }));

    } catch (error) {
      next(error);
    }
  };

  public deleteDiscoverySession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId } = req.params;
      const userId = (req as any).user.id;

      await this.discoveryService.deleteSession(sessionId, userId);

      logger.info('Discovery session deleted', { sessionId, userId });

      res.json(successResponse(null, 'Discovery session deleted'));

    } catch (error) {
      next(error);
    }
  };

  public processNaturalLanguageQuery = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { query, context } = req.body;
    if (!query) throw new APIError('Query is required', 400);

    const nlQuery: NaturalLanguageQuery = { query, context };
    const result = await this.aiService.processNaturalLanguageQuery(nlQuery);

    // 🔧 Normalize to the frontend’s expected AIResponse.data shape
    const payload = {
      message: "Here’s the SQL I’d run based on your request.",
      type: 'query' as const,
      results: {
        sql:          result.sql,
        explanation:  result.explanation,
        tables:       result.tables,
        fields:       result.fields,
        confidence:   result.confidence,
        warnings:     result.warnings,
        isAiGenerated: result.isAiGenerated
      },
      suggestions: [
        'Add a date range filter',
        'Group results by day',
        'Limit to the last 1,000 rows',
        'Explain this query step-by-step'
      ],
      actions: [
        { type: 'view_details', label: 'Copy SQL', payload: { sql: result.sql } },
        { type: 'export_data',  label: 'Export as CSV' }
      ]
    };

    res.json(successResponse(payload, 'Natural language query processed'));
  } catch (error) {
    next(error);
  }
};

  public generateQualityRules = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { fieldInfo } = req.body;

      if (!fieldInfo) {
        throw new APIError('Field information is required', 400);
      }

      const rules = await this.aiService.generateQualityRules(fieldInfo);

      res.json(successResponse({ rules }));

    } catch (error) {
      next(error);
    }
  };

  public explainViolation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { violation } = req.body;

      if (!violation) {
        throw new APIError('Violation information is required', 400);
      }

      const explanation = await this.aiService.explainViolation(violation);

      res.json(successResponse({ explanation }));

    } catch (error) {
      next(error);
    }
  };

  /**
   * Enhanced query endpoint with full data context awareness
   */
  public processEnhancedQuery = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { query, sessionId, conversationHistory, includeContext, preferences } = req.body;

      if (!query || typeof query !== 'string' || !query.trim()) {
        throw new APIError('Query is required and must be a non-empty string', 400);
      }

      const request: EnhancedQueryRequest = {
        query: query.trim(),
        sessionId,
        conversationHistory,
        includeContext: includeContext !== false, // default to true
        preferences,
      };

      logger.info('Processing enhanced query', {
        query: request.query,
        sessionId: request.sessionId,
        userId: (req as any).user?.id
      });

      const result = await this.enhancedAIService.processQuery(request);

      // Format response to match frontend expectations
      const payload = {
        message: result.message,
        type: result.type,
        results: result.data,
        sql: result.sql,
        recommendations: result.recommendations,
        relatedAssets: result.relatedAssets,
        confidence: result.confidence,
        isAiGenerated: result.isAiGenerated,
      };

      const meta = {
        processingTime: result.processingTime,
        sessionId: result.sessionId,
        model: 'enhanced-ai',
        timestamp: new Date().toISOString(),
      };

      res.json(successResponse(payload, 'Query processed successfully', meta));

    } catch (error) {
      logger.error('Enhanced query processing error:', error);
      next(error);
    }
  };

  /**
   * Clear conversation history for a session
   */
  public clearConversation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        throw new APIError('Session ID is required', 400);
      }

      this.enhancedAIService.clearConversation(sessionId);

      logger.info('Conversation cleared', { sessionId, userId: (req as any).user?.id });

      res.json(successResponse(null, 'Conversation cleared successfully'));

    } catch (error) {
      next(error);
    }
  };

  /**
   * Get conversation history
   */
  public getConversation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        throw new APIError('Session ID is required', 400);
      }

      const conversation = this.enhancedAIService.getConversation(sessionId);

      if (!conversation) {
        throw new APIError('Conversation not found', 404);
      }

      res.json(successResponse({
        sessionId: conversation.sessionId,
        messageCount: conversation.messages.length,
        messages: conversation.messages.slice(-10), // Return last 10 messages
      }));

    } catch (error) {
      next(error);
    }
  };
}