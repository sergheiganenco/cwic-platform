// Export all connectors
export { BaseConnector } from './base';
export { PostgreSQLConnector } from './postgresql';
export { AzureSqlConnector } from './azureSql';
export { ConnectorFactory } from './factory';
export { default as ConnectorFactory2 } from './factory';

// Export the createConnector method as a standalone function
import ConnectorFactoryClass from './factory';
export const createConnector = ConnectorFactoryClass.createConnector.bind(ConnectorFactoryClass);