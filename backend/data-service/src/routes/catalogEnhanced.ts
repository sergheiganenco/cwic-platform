/**
 * Enhanced Catalog API Routes
 * Comprehensive endpoints for modern data catalog features
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { CatalogService } from '../services/CatalogService';

const router = Router();

// Helper functions
const ok = (res: Response, data: any, meta?: any) => {
  res.json({ success: true, data, meta });
};

const fail = (res: Response, status: number, message: string) => {
  res.status(status).json({ success: false, error: message });
};

export function initEnhancedCatalog(db: Pool) {
  const catalogService = new CatalogService(db);

  // ============================================================================
  // TRUST SCORE & METRICS
  // ============================================================================

  router.get('/catalog/assets/:id/trust-score', async (req: Request, res: Response) => {
    try {
      const score = await catalogService.calculateTrustScore(req.params.id);
      ok(res, { trustScore: score });
    } catch (e: any) {
      fail(res, 500, e.message);
    }
  });

  router.get('/catalog/assets/:id/trust-breakdown', async (req: Request, res: Response) => {
    try {
      const breakdown = await catalogService.getTrustScoreBreakdown(req.params.id);
      ok(res, breakdown);
    } catch (e: any) {
      fail(res, 500, e.message);
    }
  });

  router.post('/catalog/assets/:id/view', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || req.body.userId;
      await catalogService.incrementViewCount(req.params.id, userId);
      ok(res, { success: true });
    } catch (e: any) {
      fail(res, 500, e.message);
    }
  });

  // ============================================================================
  // RATINGS & REVIEWS
  // ============================================================================

  router.post('/catalog/assets/:id/rate', async (req: Request, res: Response) => {
    try {
      const { rating, review } = req.body;
      const userId = (req as any).user?.id || req.body.userId;

      if (!userId) {
        return fail(res, 401, 'User ID required');
      }

      await catalogService.rateAsset(req.params.id, userId, rating, review);
      ok(res, { success: true });
    } catch (e: any) {
      fail(res, 400, e.message);
    }
  });

  router.get('/catalog/assets/:id/ratings', async (req: Request, res: Response) => {
    try {
      const stats = await catalogService.getAssetRatings(req.params.id);
      ok(res, stats);
    } catch (e: any) {
      fail(res, 500, e.message);
    }
  });

  router.get('/catalog/assets/:id/my-rating', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || req.query.userId as string;
      if (!userId) {
        return fail(res, 401, 'User ID required');
      }

      const rating = await catalogService.getUserRating(req.params.id, userId);
      ok(res, rating);
    } catch (e: any) {
      fail(res, 500, e.message);
    }
  });

  // ============================================================================
  // COMMENTS & DISCUSSIONS
  // ============================================================================

  router.post('/catalog/assets/:id/comments', async (req: Request, res: Response) => {
    try {
      const { content, parentCommentId } = req.body;
      const userId = (req as any).user?.id || req.body.userId;

      if (!userId) {
        return fail(res, 401, 'User ID required');
      }

      const comment = await catalogService.addComment(
        req.params.id,
        userId,
        content,
        parentCommentId
      );
      ok(res, comment);
    } catch (e: any) {
      fail(res, 400, e.message);
    }
  });

  router.get('/catalog/assets/:id/comments', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const comments = await catalogService.getComments(req.params.id, limit);
      ok(res, { comments });
    } catch (e: any) {
      fail(res, 500, e.message);
    }
  });

  router.delete('/catalog/comments/:commentId', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || req.body.userId;
      if (!userId) {
        return fail(res, 401, 'User ID required');
      }

      await catalogService.deleteComment(req.params.commentId, userId);
      ok(res, { success: true });
    } catch (e: any) {
      fail(res, 400, e.message);
    }
  });

  // ============================================================================
  // BOOKMARKS
  // ============================================================================

  router.post('/catalog/assets/:id/bookmark', async (req: Request, res: Response) => {
    try {
      const { folder, notes } = req.body;
      const userId = (req as any).user?.id || req.body.userId;

      if (!userId) {
        return fail(res, 401, 'User ID required');
      }

      await catalogService.bookmarkAsset(req.params.id, userId, folder, notes);
      ok(res, { success: true });
    } catch (e: any) {
      fail(res, 400, e.message);
    }
  });

  router.delete('/catalog/assets/:id/bookmark', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || req.query.userId as string;
      if (!userId) {
        return fail(res, 401, 'User ID required');
      }

      await catalogService.unbookmarkAsset(req.params.id, userId);
      ok(res, { success: true });
    } catch (e: any) {
      fail(res, 400, e.message);
    }
  });

  router.get('/catalog/my-bookmarks', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || req.query.userId as string;
      if (!userId) {
        return fail(res, 401, 'User ID required');
      }

      const folder = req.query.folder as string;
      const bookmarks = await catalogService.getUserBookmarks(userId, folder);
      ok(res, { bookmarks });
    } catch (e: any) {
      fail(res, 500, e.message);
    }
  });

  // ============================================================================
  // Q&A SYSTEM
  // ============================================================================

  router.post('/catalog/assets/:id/questions', async (req: Request, res: Response) => {
    try {
      const { question, tags } = req.body;
      const userId = (req as any).user?.id || req.body.userId;

      if (!userId) {
        return fail(res, 401, 'User ID required');
      }

      const q = await catalogService.askQuestion(req.params.id, userId, question, tags);
      ok(res, q);
    } catch (e: any) {
      fail(res, 400, e.message);
    }
  });

  router.get('/catalog/assets/:id/questions', async (req: Request, res: Response) => {
    try {
      const questions = await catalogService.getAssetQuestions(req.params.id);
      ok(res, { questions });
    } catch (e: any) {
      fail(res, 500, e.message);
    }
  });

  router.post('/catalog/questions/:questionId/answers', async (req: Request, res: Response) => {
    try {
      const { answer } = req.body;
      const userId = (req as any).user?.id || req.body.userId;

      if (!userId) {
        return fail(res, 401, 'User ID required');
      }

      const a = await catalogService.answerQuestion(req.params.questionId, userId, answer);
      ok(res, a);
    } catch (e: any) {
      fail(res, 400, e.message);
    }
  });

  router.post('/catalog/questions/:questionId/accept/:answerId', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || req.body.userId;
      if (!userId) {
        return fail(res, 401, 'User ID required');
      }

      await catalogService.acceptAnswer(req.params.questionId, req.params.answerId, userId);
      ok(res, { success: true });
    } catch (e: any) {
      fail(res, 400, e.message);
    }
  });

  // ============================================================================
  // DOCUMENTATION
  // ============================================================================

  router.put('/catalog/assets/:id/documentation', async (req: Request, res: Response) => {
    try {
      const { content, format } = req.body;
      const userId = (req as any).user?.id || req.body.userId;

      if (!userId) {
        return fail(res, 401, 'User ID required');
      }

      const doc = await catalogService.updateDocumentation(
        req.params.id,
        userId,
        content,
        format
      );
      ok(res, doc);
    } catch (e: any) {
      fail(res, 400, e.message);
    }
  });

  router.get('/catalog/assets/:id/documentation/history', async (req: Request, res: Response) => {
    try {
      const history = await catalogService.getDocumentationHistory(req.params.id);
      ok(res, { history });
    } catch (e: any) {
      fail(res, 500, e.message);
    }
  });

  // ============================================================================
  // BUSINESS GLOSSARY
  // ============================================================================

  router.post('/catalog/glossary/terms', async (req: Request, res: Response) => {
    try {
      const { term, definition, acronym, synonyms, category, domain } = req.body;
      const userId = (req as any).user?.id || req.body.userId;

      if (!userId) {
        return fail(res, 401, 'User ID required');
      }

      const glossaryTerm = await catalogService.createGlossaryTerm(
        term,
        definition,
        userId,
        { acronym, synonyms, category, domain }
      );
      ok(res, glossaryTerm);
    } catch (e: any) {
      fail(res, 400, e.message);
    }
  });

  router.post('/catalog/glossary/terms/:termId/map', async (req: Request, res: Response) => {
    try {
      const { assetId, columnId, mappingType, confidence } = req.body;

      const mapping = await catalogService.mapTermToAsset(
        req.params.termId,
        assetId,
        columnId,
        mappingType,
        confidence
      );
      ok(res, mapping);
    } catch (e: any) {
      fail(res, 400, e.message);
    }
  });

  router.get('/catalog/glossary/terms/:termId/mappings', async (req: Request, res: Response) => {
    try {
      const mappings = await catalogService.getTermMappings(req.params.termId);
      ok(res, { mappings });
    } catch (e: any) {
      fail(res, 500, e.message);
    }
  });

  router.get('/catalog/glossary/search', async (req: Request, res: Response) => {
    try {
      const query = req.query.q as string;
      const limit = parseInt(req.query.limit as string) || 20;

      if (!query) {
        return fail(res, 400, 'Search query required');
      }

      const results = await catalogService.searchGlossary(query, limit);
      ok(res, { terms: results });
    } catch (e: any) {
      fail(res, 500, e.message);
    }
  });

  // ============================================================================
  // NOTIFICATIONS
  // ============================================================================

  router.get('/catalog/notifications', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || req.query.userId as string;
      if (!userId) {
        return fail(res, 401, 'User ID required');
      }

      const unreadOnly = req.query.unreadOnly === 'true';
      const notifications = await catalogService.getUserNotifications(userId, unreadOnly);
      ok(res, { notifications });
    } catch (e: any) {
      fail(res, 500, e.message);
    }
  });

  router.post('/catalog/notifications/:id/read', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || req.body.userId;
      if (!userId) {
        return fail(res, 401, 'User ID required');
      }

      await catalogService.markNotificationRead(req.params.id, userId);
      ok(res, { success: true });
    } catch (e: any) {
      fail(res, 400, e.message);
    }
  });

  // ============================================================================
  // ACTIVITY FEED
  // ============================================================================

  router.get('/catalog/assets/:id/activity', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const activity = await catalogService.getAssetActivity(req.params.id, limit);
      ok(res, { activity });
    } catch (e: any) {
      fail(res, 500, e.message);
    }
  });

  router.get('/catalog/my-activity', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || req.query.userId as string;
      if (!userId) {
        return fail(res, 401, 'User ID required');
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const activity = await catalogService.getUserActivity(userId, limit);
      ok(res, { activity });
    } catch (e: any) {
      fail(res, 500, e.message);
    }
  });

  router.get('/catalog/trending', async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const limit = parseInt(req.query.limit as string) || 10;

      const trending = await catalogService.getTrendingAssets(days, limit);
      ok(res, { assets: trending });
    } catch (e: any) {
      fail(res, 500, e.message);
    }
  });

  return router;
}

export default initEnhancedCatalog;
