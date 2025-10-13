/**
 * Comprehensive Catalog Service
 * Handles: Trust Scores, Collaboration, Documentation, Quality, AI Features
 */

import { Pool } from 'pg';

interface TrustScoreComponents {
  documentation: number;
  quality: number;
  community: number;
  freshness: number;
  usage: number;
  total: number;
}

interface RatingStats {
  average: number;
  count: number;
  distribution: { [key: number]: number };
}

export class CatalogService {
  constructor(private db: Pool) {}

  // ============================================================================
  // TRUST SCORE & METRICS
  // ============================================================================

  async calculateTrustScore(assetId: string | number): Promise<number> {
    const result = await this.db.query(
      'SELECT calculate_trust_score($1) as trust_score',
      [assetId]
    );
    return result.rows[0]?.trust_score || 0;
  }

  async getTrustScoreBreakdown(assetId: string | number): Promise<TrustScoreComponents> {
    const asset = await this.db.query(
      `SELECT * FROM catalog_assets WHERE id = $1`,
      [assetId]
    );

    if (!asset.rows[0]) {
      throw new Error('Asset not found');
    }

    const a = asset.rows[0];

    // Documentation score (0-25)
    let docScore = 0;
    if (a.description && a.description.length > 50) docScore += 10;
    else if (a.description) docScore += 5;
    if (a.tags && a.tags.length > 0) docScore += 5;
    if (a.owner_id) docScore += 5;
    if (a.domain) docScore += 5;

    // Quality score (0-25)
    const qualityScore = Math.floor((a.quality_score || 0) / 4);

    // Community score (0-25)
    const communityScore = Math.min(25,
      (a.rating_avg || 0) * 5 +
      Math.min(10, a.comment_count || 0) +
      Math.min(5, a.bookmark_count || 0)
    );

    // Freshness score (0-15)
    let freshnessScore = 0;
    const daysSinceUpdate = Math.floor((Date.now() - new Date(a.updated_at).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceUpdate <= 1) freshnessScore = 15;
    else if (daysSinceUpdate <= 7) freshnessScore = 10;
    else if (daysSinceUpdate <= 30) freshnessScore = 5;

    // Usage score (0-10)
    const usageScore = Math.min(10, Math.floor((a.view_count || 0) / 10));

    return {
      documentation: docScore,
      quality: qualityScore,
      community: communityScore,
      freshness: freshnessScore,
      usage: usageScore,
      total: Math.min(100, docScore + qualityScore + communityScore + freshnessScore + usageScore)
    };
  }

  async incrementViewCount(assetId: string | number, userId?: string): Promise<void> {
    await this.db.query(
      `UPDATE catalog_assets SET view_count = view_count + 1 WHERE id = $1`,
      [assetId]
    );

    // Track in activity feed
    if (userId) {
      await this.db.query(
        `INSERT INTO catalog_activity_feed (tenant_id, activity_type, entity_type, entity_id, asset_id, user_id, created_at)
         VALUES (1, 'asset_viewed', 'asset', $1, $1, $2, now())`,
        [assetId, userId]
      );
    }
  }

  // ============================================================================
  // RATINGS & REVIEWS
  // ============================================================================

  async rateAsset(assetId: string | number, userId: string, rating: number, review?: string): Promise<void> {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    await this.db.query(
      `INSERT INTO asset_ratings (tenant_id, asset_id, user_id, rating, review_text, created_at, updated_at)
       VALUES (1, $1, $2, $3, $4, now(), now())
       ON CONFLICT (asset_id, user_id)
       DO UPDATE SET rating = $3, review_text = $4, updated_at = now()`,
      [assetId, userId, rating, review]
    );

    // Activity feed
    await this.db.query(
      `INSERT INTO catalog_activity_feed (tenant_id, activity_type, entity_type, asset_id, user_id, action_data)
       VALUES (1, 'asset_rated', 'rating', $1, $2, jsonb_build_object('rating', $3))`,
      [assetId, userId, rating]
    );
  }

  async getAssetRatings(assetId: string | number): Promise<RatingStats> {
    const stats = await this.db.query(
      `SELECT
        AVG(rating)::DECIMAL(3,2) as average,
        COUNT(*)::INT as count,
        jsonb_object_agg(rating::TEXT, rating_count) as distribution
       FROM (
         SELECT rating, COUNT(*)::INT as rating_count
         FROM asset_ratings
         WHERE asset_id = $1
         GROUP BY rating
       ) t`,
      [assetId]
    );

    const row = stats.rows[0];
    return {
      average: parseFloat(row.average) || 0,
      count: row.count || 0,
      distribution: row.distribution || {}
    };
  }

  async getUserRating(assetId: string | number, userId: string): Promise<any> {
    const result = await this.db.query(
      `SELECT rating, review_text, created_at, updated_at
       FROM asset_ratings
       WHERE asset_id = $1 AND user_id = $2`,
      [assetId, userId]
    );
    return result.rows[0] || null;
  }

  // ============================================================================
  // COMMENTS & DISCUSSIONS
  // ============================================================================

  async addComment(
    assetId: string | number,
    userId: string,
    content: string,
    parentCommentId?: string
  ): Promise<any> {
    const result = await this.db.query(
      `INSERT INTO asset_comments (tenant_id, asset_id, user_id, content, parent_comment_id, created_at)
       VALUES (1, $1, $2, $3, $4, now())
       RETURNING *`,
      [assetId, userId, content, parentCommentId || null]
    );

    // Extract @mentions
    const mentions = content.match(/@(\w+)/g);
    if (mentions) {
      const mentionIds = mentions.map(m => m.substring(1)); // Remove @
      await this.db.query(
        `UPDATE asset_comments SET mentions = $1 WHERE id = $2`,
        [mentionIds, result.rows[0].id]
      );

      // Create notifications for mentioned users
      for (const mentionedUserId of mentionIds) {
        await this.createNotification(
          mentionedUserId,
          'comment_mention',
          `You were mentioned in a comment`,
          content.substring(0, 100),
          assetId
        );
      }
    }

    // Activity feed
    await this.db.query(
      `INSERT INTO catalog_activity_feed (tenant_id, activity_type, entity_type, entity_id, asset_id, user_id)
       VALUES (1, 'comment_added', 'comment', $1, $2, $3)`,
      [result.rows[0].id, assetId, userId]
    );

    return result.rows[0];
  }

  async getComments(assetId: string | number, limit = 50): Promise<any[]> {
    const result = await this.db.query(
      `SELECT c.*,
        CASE WHEN c.parent_comment_id IS NULL THEN 0 ELSE 1 END as is_reply
       FROM asset_comments c
       WHERE c.asset_id = $1
       ORDER BY c.parent_comment_id NULLS FIRST, c.created_at ASC
       LIMIT $2`,
      [assetId, limit]
    );
    return result.rows;
  }

  async deleteComment(commentId: string, userId: string): Promise<void> {
    await this.db.query(
      `DELETE FROM asset_comments WHERE id = $1 AND user_id = $2`,
      [commentId, userId]
    );
  }

  // ============================================================================
  // BOOKMARKS
  // ============================================================================

  async bookmarkAsset(assetId: string | number, userId: string, folder?: string, notes?: string): Promise<void> {
    await this.db.query(
      `INSERT INTO asset_bookmarks (tenant_id, asset_id, user_id, folder, notes, created_at)
       VALUES (1, $1, $2, $3, $4, now())
       ON CONFLICT (asset_id, user_id) DO UPDATE SET folder = $3, notes = $4`,
      [assetId, userId, folder, notes]
    );
  }

  async unbookmarkAsset(assetId: string | number, userId: string): Promise<void> {
    await this.db.query(
      `DELETE FROM asset_bookmarks WHERE asset_id = $1 AND user_id = $2`,
      [assetId, userId]
    );
  }

  async getUserBookmarks(userId: string, folder?: string): Promise<any[]> {
    const query = folder
      ? `SELECT b.*, a.* FROM asset_bookmarks b
         JOIN catalog_assets a ON a.id = b.asset_id
         WHERE b.user_id = $1 AND b.folder = $2
         ORDER BY b.created_at DESC`
      : `SELECT b.*, a.* FROM asset_bookmarks b
         JOIN catalog_assets a ON a.id = b.asset_id
         WHERE b.user_id = $1
         ORDER BY b.created_at DESC`;

    const params = folder ? [userId, folder] : [userId];
    const result = await this.db.query(query, params);
    return result.rows;
  }

  // ============================================================================
  // Q&A SYSTEM
  // ============================================================================

  async askQuestion(assetId: string | number, userId: string, question: string, tags?: string[]): Promise<any> {
    const result = await this.db.query(
      `INSERT INTO asset_questions (tenant_id, asset_id, user_id, question, tags, created_at)
       VALUES (1, $1, $2, $3, $4, now())
       RETURNING *`,
      [assetId, userId, question, tags || []]
    );

    return result.rows[0];
  }

  async answerQuestion(questionId: string, userId: string, answer: string): Promise<any> {
    const result = await this.db.query(
      `INSERT INTO question_answers (question_id, user_id, answer, created_at)
       VALUES ($1, $2, $3, now())
       RETURNING *`,
      [questionId, userId, answer]
    );

    // Notify question author
    const question = await this.db.query(
      `SELECT user_id, asset_id FROM asset_questions WHERE id = $1`,
      [questionId]
    );

    if (question.rows[0]) {
      await this.createNotification(
        question.rows[0].user_id,
        'question_answered',
        'Your question received an answer',
        answer.substring(0, 100),
        question.rows[0].asset_id
      );
    }

    return result.rows[0];
  }

  async acceptAnswer(questionId: string, answerId: string, userId: string): Promise<void> {
    // Verify user owns the question
    const question = await this.db.query(
      `SELECT user_id FROM asset_questions WHERE id = $1`,
      [questionId]
    );

    if (question.rows[0]?.user_id !== userId) {
      throw new Error('Only question author can accept answers');
    }

    await this.db.query(
      `UPDATE question_answers SET is_accepted = TRUE WHERE id = $1`,
      [answerId]
    );

    await this.db.query(
      `UPDATE asset_questions SET has_accepted_answer = TRUE WHERE id = $1`,
      [questionId]
    );
  }

  async getAssetQuestions(assetId: string | number): Promise<any[]> {
    const result = await this.db.query(
      `SELECT q.*,
        (SELECT jsonb_agg(jsonb_build_object(
          'id', a.id,
          'answer', a.answer,
          'user_id', a.user_id,
          'upvotes', a.upvotes,
          'is_accepted', a.is_accepted,
          'created_at', a.created_at
        )) FROM question_answers a WHERE a.question_id = q.id) as answers
       FROM asset_questions q
       WHERE q.asset_id = $1
       ORDER BY q.has_accepted_answer DESC, q.upvotes DESC, q.created_at DESC`,
      [assetId]
    );
    return result.rows;
  }

  // ============================================================================
  // DOCUMENTATION
  // ============================================================================

  async updateDocumentation(
    assetId: string | number,
    userId: string,
    content: string,
    format = 'markdown'
  ): Promise<any> {
    // Get current version
    const current = await this.db.query(
      `SELECT MAX(version) as max_version FROM asset_documentation WHERE asset_id = $1`,
      [assetId]
    );

    const nextVersion = (current.rows[0]?.max_version || 0) + 1;

    // Mark all previous versions as not current
    await this.db.query(
      `UPDATE asset_documentation SET is_current = FALSE WHERE asset_id = $1`,
      [assetId]
    );

    // Insert new version
    const result = await this.db.query(
      `INSERT INTO asset_documentation (tenant_id, asset_id, content, format, version, is_current, created_by, created_at)
       VALUES (1, $1, $2, $3, $4, TRUE, $5, now())
       RETURNING *`,
      [assetId, content, format, nextVersion, userId]
    );

    // Update asset description
    await this.db.query(
      `UPDATE catalog_assets SET description = $1, updated_at = now() WHERE id = $2`,
      [content.substring(0, 500), assetId]
    );

    // Activity feed
    await this.db.query(
      `INSERT INTO catalog_activity_feed (tenant_id, activity_type, entity_type, entity_id, asset_id, user_id)
       VALUES (1, 'documentation_updated', 'documentation', $1, $2, $3)`,
      [result.rows[0].id, assetId, userId]
    );

    return result.rows[0];
  }

  async getDocumentationHistory(assetId: string | number): Promise<any[]> {
    const result = await this.db.query(
      `SELECT * FROM asset_documentation
       WHERE asset_id = $1
       ORDER BY version DESC`,
      [assetId]
    );
    return result.rows;
  }

  // ============================================================================
  // BUSINESS GLOSSARY
  // ============================================================================

  async createGlossaryTerm(
    term: string,
    definition: string,
    userId: string,
    options?: {
      acronym?: string;
      synonyms?: string[];
      category?: string;
      domain?: string;
    }
  ): Promise<any> {
    const result = await this.db.query(
      `INSERT INTO business_glossary_terms (
        tenant_id, term, definition, acronym, synonyms, category, domain, status, created_by, created_at
       )
       VALUES (1, $1, $2, $3, $4, $5, $6, 'draft', $7, now())
       RETURNING *`,
      [
        term,
        definition,
        options?.acronym,
        options?.synonyms || [],
        options?.category,
        options?.domain,
        userId
      ]
    );
    return result.rows[0];
  }

  async mapTermToAsset(
    termId: string,
    assetId: string | number,
    columnId?: string | number,
    mappingType: 'manual' | 'ai_suggested' | 'auto_detected' = 'manual',
    confidence?: number
  ): Promise<any> {
    const result = await this.db.query(
      `INSERT INTO glossary_term_mappings (term_id, asset_id, column_id, mapping_type, confidence_score, created_at)
       VALUES ($1, $2, $3, $4, $5, now())
       RETURNING *`,
      [termId, assetId, columnId, mappingType, confidence]
    );
    return result.rows[0];
  }

  async getTermMappings(termId: string): Promise<any[]> {
    const result = await this.db.query(
      `SELECT m.*,
        a.table_name, a.schema_name, a.datasource_id,
        c.column_name, c.data_type
       FROM glossary_term_mappings m
       LEFT JOIN catalog_assets a ON a.id = m.asset_id
       LEFT JOIN catalog_columns c ON c.id = m.column_id
       WHERE m.term_id = $1
       ORDER BY m.confidence_score DESC NULLS LAST`,
      [termId]
    );
    return result.rows;
  }

  async searchGlossary(query: string, limit = 20): Promise<any[]> {
    const result = await this.db.query(
      `SELECT *,
        ts_rank(to_tsvector('english', term || ' ' || definition), plainto_tsquery('english', $1)) as rank
       FROM business_glossary_terms
       WHERE to_tsvector('english', term || ' ' || definition) @@ plainto_tsquery('english', $1)
          OR term ILIKE $2
          OR $1 = ANY(synonyms)
       ORDER BY rank DESC, term ASC
       LIMIT $3`,
      [query, `%${query}%`, limit]
    );
    return result.rows;
  }

  // ============================================================================
  // NOTIFICATIONS
  // ============================================================================

  async createNotification(
    userId: string,
    type: string,
    title: string,
    message: string,
    assetId?: string | number,
    relatedEntityType?: string,
    relatedEntityId?: string
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO user_notifications (
        tenant_id, user_id, notification_type, title, message, asset_id,
        related_entity_type, related_entity_id, created_at
       )
       VALUES (1, $1, $2, $3, $4, $5, $6, $7, now())`,
      [userId, type, title, message, assetId, relatedEntityType, relatedEntityId]
    );
  }

  async getUserNotifications(userId: string, unreadOnly = false): Promise<any[]> {
    const query = unreadOnly
      ? `SELECT * FROM user_notifications WHERE user_id = $1 AND is_read = FALSE ORDER BY created_at DESC LIMIT 50`
      : `SELECT * FROM user_notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`;

    const result = await this.db.query(query, [userId]);
    return result.rows;
  }

  async markNotificationRead(notificationId: string, userId: string): Promise<void> {
    await this.db.query(
      `UPDATE user_notifications SET is_read = TRUE, read_at = now() WHERE id = $1 AND user_id = $2`,
      [notificationId, userId]
    );
  }

  // ============================================================================
  // ACTIVITY FEED
  // ============================================================================

  async getAssetActivity(assetId: string | number, limit = 50): Promise<any[]> {
    const result = await this.db.query(
      `SELECT * FROM catalog_activity_feed
       WHERE asset_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [assetId, limit]
    );
    return result.rows;
  }

  async getUserActivity(userId: string, limit = 50): Promise<any[]> {
    const result = await this.db.query(
      `SELECT a.*, ast.table_name, ast.schema_name
       FROM catalog_activity_feed a
       LEFT JOIN catalog_assets ast ON ast.id = a.asset_id
       WHERE a.user_id = $1
       ORDER BY a.created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  }

  async getTrendingAssets(days = 7, limit = 10): Promise<any[]> {
    const result = await this.db.query(
      `SELECT a.*,
        (a.view_count + (a.comment_count * 5) + (a.bookmark_count * 10)) as trending_score
       FROM catalog_assets a
       WHERE a.updated_at > now() - INTERVAL '${days} days'
       ORDER BY trending_score DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }
}
