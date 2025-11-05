// backend/quality-engine/src/observability/tracing.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { logger } from '../utils/logger';

export function initializeOpenTelemetry(serviceName: string): NodeSDK | null {
  try {
    const sdk = new NodeSDK({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      }),
      instrumentations: [getNodeAutoInstrumentations()]
    });

    sdk.start();
    logger.info('OpenTelemetry initialized');
    return sdk;
  } catch (error) {
    logger.error('Failed to initialize OpenTelemetry:', error);
    return null;
  }
}