import { ILogger, LogLevel } from './ILogger';
import { ConsoleLogger } from './ConsoleLogger';

/**
 * Logger configuration
 */
interface LoggerConfig {
    level: LogLevel;
    enableRemote: boolean;
    remoteEndpoint?: string;
}

/**
 * Get logger configuration from environment
 */
function getLoggerConfig(): LoggerConfig {
    const isDevelopment = import.meta.env.DEV;

    return {
        level: isDevelopment ? LogLevel.DEBUG : LogLevel.INFO,
        enableRemote: !isDevelopment,
        remoteEndpoint: import.meta.env.VITE_LOG_ENDPOINT,
    };
}

/**
 * Create logger instance based on environment
 */
function createLogger(): ILogger {
    const config = getLoggerConfig();

    // For now, always use ConsoleLogger
    // In production, you could use RemoteLogger or a composite logger
    return new ConsoleLogger(config.level);
}

// Export singleton logger instance
export const logger = createLogger();

// Export types and classes for testing
export type { ILogger, LoggerConfig };
export { LogLevel, ConsoleLogger };
