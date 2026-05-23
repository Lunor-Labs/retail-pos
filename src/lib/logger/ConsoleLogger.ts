import { ILogger, LogLevel, LogEntry } from './ILogger';

/**
 * Console logger for development
 */
export class ConsoleLogger implements ILogger {
    private userId?: string;
    private sessionId?: string;
    private minLevel: LogLevel;

    constructor(minLevel: LogLevel = LogLevel.DEBUG) {
        this.minLevel = minLevel;
    }

    debug(message: string, context?: Record<string, any>): void {
        this.log(LogLevel.DEBUG, message, context);
    }

    info(message: string, context?: Record<string, any>): void {
        this.log(LogLevel.INFO, message, context);
    }

    warn(message: string, context?: Record<string, any>): void {
        this.log(LogLevel.WARN, message, context);
    }

    error(message: string, error?: Error, context?: Record<string, any>): void {
        this.log(LogLevel.ERROR, message, { ...context, error: error?.message, stack: error?.stack });
    }

    performance(operation: string, duration: number, context?: Record<string, any>): void {
        this.log(LogLevel.INFO, `Performance: ${operation}`, {
            ...context,
            duration: `${duration}ms`,
            type: 'performance',
        });
    }

    setUser(userId: string): void {
        this.userId = userId;
    }

    setSession(sessionId: string): void {
        this.sessionId = sessionId;
    }

    clearContext(): void {
        this.userId = undefined;
        this.sessionId = undefined;
    }

    private log(level: LogLevel, message: string, context?: Record<string, any>): void {
        if (!this.shouldLog(level)) return;

        const entry: LogEntry = {
            level,
            message,
            timestamp: new Date(),
            context,
            userId: this.userId,
            sessionId: this.sessionId,
        };

        const formattedMessage = this.formatMessage(entry);

        switch (level) {
            case LogLevel.DEBUG:
                console.debug(formattedMessage, entry);
                break;
            case LogLevel.INFO:
                console.info(formattedMessage, entry);
                break;
            case LogLevel.WARN:
                console.warn(formattedMessage, entry);
                break;
            case LogLevel.ERROR:
                console.error(formattedMessage, entry);
                break;
        }
    }

    private shouldLog(level: LogLevel): boolean {
        const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
        const minIndex = levels.indexOf(this.minLevel);
        const currentIndex = levels.indexOf(level);
        return currentIndex >= minIndex;
    }

    private formatMessage(entry: LogEntry): string {
        const timestamp = entry.timestamp.toISOString();
        const level = entry.level.toUpperCase().padEnd(5);
        const user = entry.userId ? `[User: ${entry.userId}]` : '';
        const session = entry.sessionId ? `[Session: ${entry.sessionId}]` : '';

        return `[${timestamp}] ${level} ${user}${session} ${entry.message}`;
    }
}
