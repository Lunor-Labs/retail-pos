/**
 * Log levels
 */
export enum LogLevel {
    DEBUG = 'debug',
    INFO = 'info',
    WARN = 'warn',
    ERROR = 'error',
}

/**
 * Log entry structure
 */
export interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: Date;
    context?: Record<string, any>;
    error?: Error;
    userId?: string;
    sessionId?: string;
}

/**
 * Logger interface
 */
export interface ILogger {
    debug(message: string, context?: Record<string, any>): void;
    info(message: string, context?: Record<string, any>): void;
    warn(message: string, context?: Record<string, any>): void;
    error(message: string, error?: Error, context?: Record<string, any>): void;

    /**
     * Log performance metrics
     */
    performance(operation: string, duration: number, context?: Record<string, any>): void;

    /**
     * Set user context for all subsequent logs
     */
    setUser(userId: string): void;

    /**
     * Set session context for all subsequent logs
     */
    setSession(sessionId: string): void;

    /**
     * Clear user and session context
     */
    clearContext(): void;
}
