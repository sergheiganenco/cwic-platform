// backend/data-service/src/services/connectors/factory.ts - FIXED VERSION

import type { ConnectionConfig } from "../../models/Connection";
import type { DataSourceType } from "../../models/DataSource";
import { logger } from "../../utils/logger";
import { AzureSqlConnector } from "./azureSql";
import { BaseConnector } from "./base";

// Fix: Use generic constraint that works with union types
export interface ConnectorConstructor<TConfig extends ConnectionConfig = ConnectionConfig> {
  new (config: TConfig): BaseConnector<TConfig>;
}

/* Normalize common aliases to canonical DataSourceType values */
const normalizeType = (t: string): DataSourceType => {
  const x = (t || "").toLowerCase();
  if (x === "azure_sql" || x === "azure-sql" || x === "sqlserver" || x === "sql-server") return "mssql";
  return x as DataSourceType;
};

export class ConnectorFactory {
  private static connectors: Map<DataSourceType | string, ConnectorConstructor<any>> = new Map();
  private static instances: Map<string, BaseConnector<any>> = new Map();

  /* Register built-ins with proper type casting */
  static {
    // Fix: Use type assertion to handle the union type compatibility
    ConnectorFactory.registerConnector("mssql", AzureSqlConnector as ConnectorConstructor<any>);
    ConnectorFactory.registerConnector("azure-sql", AzureSqlConnector as ConnectorConstructor<any>);
    ConnectorFactory.registerConnector("azure_sql", AzureSqlConnector as ConnectorConstructor<any>);
  }

  static registerConnector(type: DataSourceType | string, ctor: ConnectorConstructor<any>): void {
    ConnectorFactory.connectors.set(type, ctor);
    logger.info(`Registered connector for type: ${type}`);
  }

  static createConnector(config: ConnectionConfig): BaseConnector<ConnectionConfig> {
    const type = normalizeType(config.type as string);
    const Ctor =
      ConnectorFactory.connectors.get(type) || 
      ConnectorFactory.connectors.get(config.type as string);
    
    if (!Ctor) {
      throw new Error(`No connector available for data source type: ${config.type}`);
    }
    
    try {
      const inst = new Ctor(config);
      logger.info(`Created connector instance for type: ${type}`);
      return inst;
    } catch (err: any) {
      logger.error(`Failed to create connector for ${type}:`, err);
      throw new Error(`Failed to create connector: ${err?.message || "Unknown error"}`);
    }
  }

  static async getConnector(dataSourceId: string, config: ConnectionConfig): Promise<BaseConnector<ConnectionConfig>> {
    let c = ConnectorFactory.instances.get(dataSourceId);
    if (!c) {
      c = ConnectorFactory.createConnector(config);
      ConnectorFactory.instances.set(dataSourceId, c);
      
      // Fix: Add proper event handling with type safety
      c.on("disconnected", () => {
        ConnectorFactory.instances.delete(dataSourceId);
        logger.info(`Connector removed from cache: ${dataSourceId}`);
      });
      
      c.on("error", (e) => {
        logger.error(`Connector error [${dataSourceId}]`, e);
      });
    }
    return c;
  }

  static async removeConnector(dataSourceId: string): Promise<void> {
    const c = ConnectorFactory.instances.get(dataSourceId);
    if (c) {
      try {
        // Fix: Check if cleanup method exists before calling
        if (c && typeof (c as any).cleanup === "function") {
          await (c as any).cleanup();
        }
      } catch (e) {
        logger.error(`Cleanup error for ${dataSourceId}`, e);
      } finally {
        ConnectorFactory.instances.delete(dataSourceId);
      }
    }
  }

  static async testConnection(config: ConnectionConfig): Promise<any> {
    const c = ConnectorFactory.createConnector(config);
    try {
      const result = await c.testConnection();
      await c.disconnect();
      return result;
    } catch (e) {
      try {
        await c.disconnect();
      } catch (disconnectError) {
        logger.warn("Error during connector cleanup after test failure:", disconnectError);
      }
      throw e;
    }
  }

  // Fix: Updated helper methods with better type safety
  static getAvailableTypes(): DataSourceType[] {
    const uniq = new Set<DataSourceType>();
    for (const k of ConnectorFactory.connectors.keys()) {
      const normalized = normalizeType(String(k));
      if (normalized) {
        uniq.add(normalized);
      }
    }
    return Array.from(uniq);
  }

  static isTypeSupported(type: DataSourceType | string): boolean {
    const normalized = normalizeType(String(type));
    return ConnectorFactory.connectors.has(normalized) || ConnectorFactory.connectors.has(type);
  }

  // Fix: More robust config validation with type guards
  static validateConfig(type: DataSourceType | string, config: any): string[] {
    const normalizedType = normalizeType(String(type));
    const errors: string[] = [];

    // Basic validation
    if (!config || typeof config !== 'object') {
      errors.push("Configuration must be an object");
      return errors;
    }

    switch (normalizedType) {
      case "postgresql":
      case "mysql":
      case "mssql": {
        const hasConnStr = config.connectionString && typeof config.connectionString === 'string';
        if (!hasConnStr) {
          if (!config.host || typeof config.host !== 'string') {
            errors.push("Host is required when not using connection string");
          }
          if (!config.database || typeof config.database !== 'string') {
            errors.push("Database is required when not using connection string");
          }
          if (!config.username || typeof config.username !== 'string') {
            errors.push("Username is required when not using connection string");
          }
        }
        if (config.port !== undefined && (typeof config.port !== 'number' || config.port < 1 || config.port > 65535)) {
          errors.push("Port must be a number between 1 and 65535");
        }
        break;
      }
      case "mongodb": {
        const hasConnStr = config.connectionString && typeof config.connectionString === 'string';
        const hasHost = config.host && typeof config.host === 'string';
        if (!hasConnStr && !hasHost) {
          errors.push("Connection string or host is required");
        }
        break;
      }
      case "s3": {
        if (!config.bucket || typeof config.bucket !== 'string') {
          errors.push("Bucket is required");
        }
        if (!config.region || typeof config.region !== 'string') {
          errors.push("Region is required");
        }
        if (!config.accessKeyId || typeof config.accessKeyId !== 'string') {
          errors.push("Access Key ID is required");
        }
        if (!config.secretAccessKey || typeof config.secretAccessKey !== 'string') {
          errors.push("Secret Access Key is required");
        }
        break;
      }
      case "api": {
        if (!config.baseUrl || typeof config.baseUrl !== 'string') {
          errors.push("Base URL is required");
        } else {
          try {
            new URL(config.baseUrl);
          } catch {
            errors.push("Base URL must be a valid URL");
          }
        }
        break;
      }
      default:
        // For unknown types, do basic validation
        if (config.timeout !== undefined && (typeof config.timeout !== 'number' || config.timeout <= 0)) {
          errors.push("Timeout must be a positive number");
        }
        break;
    }

    return errors;
  }

  // Rest of your existing methods remain the same
  static getConfigTemplate(type: DataSourceType | string): any {
    const normalized = normalizeType(String(type));
    switch (normalized) {
      case "postgresql":
        return { 
          host: "localhost", port: 5432, database: "", username: "", password: "", 
          ssl: false, timeout: 30000, maxConnections: 10 
        };
      case "mysql":
        return { 
          host: "localhost", port: 3306, database: "", username: "", password: "", 
          ssl: false, timeout: 30000, maxConnections: 10 
        };
      case "mssql":
        return { 
          host: "localhost", port: 1433, database: "", username: "", password: "", 
          ssl: true, timeout: 30000, maxConnections: 10 
        };
      case "mongodb":
        return { 
          connectionString: "mongodb://localhost:27017", database: "", 
          username: "", password: "", timeout: 30000 
        };
      case "s3":
        return { 
          region: "us-east-1", bucket: "", accessKeyId: "", secretAccessKey: "" 
        };
      case "api":
        return { 
          baseUrl: "https://api.example.com", apiKey: "", timeout: 30000, headers: {} 
        };
      default:
        return { timeout: 30000 };
    }
  }

  static getActiveConnectors(): Map<string, BaseConnector<any>> {
    return new Map(ConnectorFactory.instances);
  }

  static getAllMetrics(): Record<string, any> {
    const out: Record<string, any> = {};
    for (const [id, c] of ConnectorFactory.instances) {
      try {
        out[id] = (c as any).getMetrics?.() || { status: "no metrics available" };
      } catch (e: any) {
        out[id] = { error: e?.message || "Failed to get metrics" };
      }
    }
    return out;
  }

  static async healthCheckAll(): Promise<Record<string, any>> {
    const results: Record<string, any> = {};
    const checks = Array.from(ConnectorFactory.instances.entries()).map(async ([id, c]) => {
      try {
        results[id] = await c.healthCheck();
      } catch (e: any) {
        results[id] = { status: "unhealthy", error: e?.message || "Health check failed" };
      }
    });
    
    await Promise.allSettled(checks);
    return results;
  }

  static async cleanupAll(): Promise<void> {
    const cleanupPromises = Array.from(ConnectorFactory.instances.keys()).map(id => 
      ConnectorFactory.removeConnector(id)
    );
    
    await Promise.allSettled(cleanupPromises);
    ConnectorFactory.instances.clear();
    logger.info("All connectors cleaned up");
  }
}

export default ConnectorFactory;