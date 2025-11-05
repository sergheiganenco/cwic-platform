// backend/quality-engine/src/events/EventStreamManager.ts
// Redis Streams-based event management for real-time quality monitoring

import Redis from 'ioredis';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { config } from '../config';
import { QualityEvent, QualityResult, AnomalyEvent, HealingEvent } from '../types';

export class EventStreamManager extends EventEmitter {
  private redis: Redis;
  private subscriber: Redis;
  private publisher: Redis;
  private consumerGroup: string = 'quality-engine-group';
  private consumerId: string = `quality-engine-${process.pid}`;
  private isProcessing: boolean = false;

  constructor() {
    super();

    // Create separate Redis connections for different purposes
    this.redis = new Redis(config.redis);
    this.subscriber = new Redis(config.redis);
    this.publisher = new Redis(config.redis);

    this.setupErrorHandlers();
  }

  private setupErrorHandlers() {
    [this.redis, this.subscriber, this.publisher].forEach((client, index) => {
      const name = ['main', 'subscriber', 'publisher'][index];

      client.on('error', (error) => {
        logger.error(`Redis ${name} client error:`, error);
        this.emit('error', error);
      });

      client.on('connect', () => {
        logger.info(`Redis ${name} client connected`);
      });

      client.on('ready', () => {
        logger.info(`Redis ${name} client ready`);
      });
    });
  }

  async connect() {
    try {
      // Create consumer groups for each stream
      const streams = [
        'quality:events',
        'quality:results',
        'quality:anomalies',
        'quality:healing'
      ];

      for (const stream of streams) {
        try {
          await this.redis.xgroup('CREATE', stream, this.consumerGroup, '$', 'MKSTREAM');
          logger.info(`Created consumer group ${this.consumerGroup} for stream ${stream}`);
        } catch (error: any) {
          if (error.message.includes('BUSYGROUP')) {
            logger.info(`Consumer group ${this.consumerGroup} already exists for stream ${stream}`);
          } else {
            throw error;
          }
        }
      }

      // Start processing events
      this.startEventProcessing();

      logger.info('Event Stream Manager connected and ready');
    } catch (error) {
      logger.error('Failed to connect Event Stream Manager:', error);
      throw error;
    }
  }

  async disconnect() {
    this.isProcessing = false;
    await Promise.all([
      this.redis.quit(),
      this.subscriber.quit(),
      this.publisher.quit()
    ]);
    logger.info('Event Stream Manager disconnected');
  }

  // Publish a quality event
  async publishQualityEvent(event: QualityEvent) {
    const streamKey = 'quality:events';
    const eventData = {
      id: event.id,
      type: event.type,
      assetId: event.assetId,
      ruleId: event.ruleId,
      timestamp: event.timestamp.toISOString(),
      metadata: JSON.stringify(event.metadata || {}),
      source: event.source,
      priority: event.priority || 'medium'
    };

    const messageId = await this.publisher.xadd(
      streamKey,
      '*',
      ...Object.entries(eventData).flat()
    );

    logger.debug(`Published quality event ${event.id} to stream ${streamKey} with ID ${messageId}`);

    // Emit for local processing
    this.emit('quality:event', event);

    return messageId;
  }

  // Publish quality check result
  async publishQualityResult(result: QualityResult) {
    const streamKey = 'quality:results';
    const resultData = {
      id: result.id,
      ruleId: result.ruleId,
      assetId: result.assetId,
      status: result.status,
      score: result.score?.toString() || '0',
      executionTimeMs: result.executionTimeMs.toString(),
      rowsChecked: result.rowsChecked?.toString() || '0',
      rowsFailed: result.rowsFailed?.toString() || '0',
      timestamp: result.timestamp.toISOString(),
      metadata: JSON.stringify(result.metadata || {})
    };

    const messageId = await this.publisher.xadd(
      streamKey,
      '*',
      ...Object.entries(resultData).flat()
    );

    // Track metrics
    this.emit('metrics:quality_check', {
      status: result.status,
      executionTime: result.executionTimeMs,
      score: result.score
    });

    return messageId;
  }

  // Publish anomaly detection event
  async publishAnomaly(anomaly: AnomalyEvent) {
    const streamKey = 'quality:anomalies';
    const anomalyData = {
      id: anomaly.id,
      assetId: anomaly.assetId,
      type: anomaly.type,
      severity: anomaly.severity,
      confidence: anomaly.confidence.toString(),
      description: anomaly.description,
      detectedAt: anomaly.detectedAt.toISOString(),
      metadata: JSON.stringify(anomaly.metadata || {})
    };

    const messageId = await this.publisher.xadd(
      streamKey,
      '*',
      ...Object.entries(anomalyData).flat()
    );

    // Alert if critical
    if (anomaly.severity === 'critical') {
      this.emit('alert:critical', anomaly);
    }

    return messageId;
  }

  // Publish healing action event
  async publishHealingAction(healing: HealingEvent) {
    const streamKey = 'quality:healing';
    const healingData = {
      id: healing.id,
      issueId: healing.issueId,
      assetId: healing.assetId,
      action: healing.action,
      status: healing.status,
      confidence: healing.confidence.toString(),
      executedAt: healing.executedAt.toISOString(),
      result: JSON.stringify(healing.result || {}),
      metadata: JSON.stringify(healing.metadata || {})
    };

    const messageId = await this.publisher.xadd(
      streamKey,
      '*',
      ...Object.entries(healingData).flat()
    );

    this.emit('healing:action', healing);

    return messageId;
  }

  // Process events from streams
  private async startEventProcessing() {
    this.isProcessing = true;

    const processStream = async () => {
      if (!this.isProcessing) return;

      try {
        // Read from multiple streams
        const streams = await this.redis.xreadgroup(
          'GROUP',
          this.consumerGroup,
          this.consumerId,
          'COUNT',
          10, // Process up to 10 messages at a time
          'BLOCK',
          1000, // Block for 1 second
          'STREAMS',
          'quality:events',
          'quality:results',
          'quality:anomalies',
          'quality:healing',
          '>', '>', '>', '>' // Read new messages
        ) as any;

        if (streams) {
          for (const [streamKey, messages] of streams as any) {
            for (const [messageId, fields] of messages as any) {
              await this.processMessage(streamKey, messageId, fields);
            }
          }
        }
      } catch (error) {
        logger.error('Error processing stream:', error);
      }

      // Continue processing
      if (this.isProcessing) {
        setImmediate(processStream);
      }
    };

    processStream();
  }

  private async processMessage(streamKey: string, messageId: string, fields: string[]) {
    try {
      // Convert array of fields to object
      const data: any = {};
      for (let i = 0; i < fields.length; i += 2) {
        data[fields[i]] = fields[i + 1];
      }

      // Parse JSON fields
      if (data.metadata) data.metadata = JSON.parse(data.metadata);
      if (data.result) data.result = JSON.parse(data.result);

      // Emit events based on stream type
      switch (streamKey) {
        case 'quality:events':
          this.emit('process:quality_event', data);
          break;
        case 'quality:results':
          this.emit('process:quality_result', data);
          break;
        case 'quality:anomalies':
          this.emit('process:anomaly', data);
          break;
        case 'quality:healing':
          this.emit('process:healing', data);
          break;
      }

      // Acknowledge the message
      await this.redis.xack(streamKey, this.consumerGroup, messageId);

    } catch (error) {
      logger.error(`Failed to process message ${messageId} from ${streamKey}:`, error);

      // Add to dead letter queue if configured
      if (config.events.deadLetterQueue) {
        await this.addToDeadLetterQueue(streamKey, messageId, fields, error);
      }
    }
  }

  private async addToDeadLetterQueue(
    streamKey: string,
    messageId: string,
    fields: string[],
    error: any
  ) {
    const dlqKey = `${streamKey}:dlq`;
    await this.redis.xadd(
      dlqKey,
      '*',
      'originalStream', streamKey,
      'originalMessageId', messageId,
      'error', error.message || String(error),
      'timestamp', new Date().toISOString(),
      'data', JSON.stringify(fields)
    );
  }

  // Get stream statistics
  async getStreamStats() {
    const streams = [
      'quality:events',
      'quality:results',
      'quality:anomalies',
      'quality:healing'
    ];

    const stats: any = {};

    for (const stream of streams) {
      const info = await this.redis.xinfo('STREAM', stream);
      const groups = await this.redis.xinfo('GROUPS', stream);

      stats[stream] = {
        length: (info as any)[1],
        firstEntry: (info as any)[3],
        lastEntry: (info as any)[5],
        consumerGroups: (groups as any).map((g: any) => ({
          name: g[1],
          pending: g[3],
          lastDelivered: g[5]
        }))
      };
    }

    return stats;
  }

  // Trim streams to manage memory
  async trimStreams(maxLength: number = 10000) {
    const streams = [
      'quality:events',
      'quality:results',
      'quality:anomalies',
      'quality:healing'
    ];

    for (const stream of streams) {
      await this.redis.xtrim(stream, 'MAXLEN', '~', maxLength);
      logger.info(`Trimmed stream ${stream} to approximately ${maxLength} entries`);
    }
  }
}