/**
 * Structured Logging Framework
 * Provides leveled logging with context and file persistence
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

interface LogEntry {
    timestamp: string;
    level: string;
    message: string;
    context?: Record<string, any>;
    error?: {
        message: string;
        stack?: string;
        code?: string;
    };
}

class Logger {
    private static instance: Logger;
    private level: LogLevel = LogLevel.INFO;
    private logFile: string;
    private logDir: string;

    private constructor() {
        // Use Electron's standard logs directory (platform-independent)
        // macOS: ~/Library/Logs/Household Payroll/
        // Windows: %USERPROFILE%\AppData\Roaming\Household Payroll\logs\
        // Linux: ~/.config/Household Payroll/logs/
        this.logDir = app.getPath('logs');
        this.ensureLogDirectory();
        this.logFile = path.join(
            this.logDir,
            `payroll-${new Date().toISOString().split('T')[0]}.log`
        );
    }

    static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    private ensureLogDirectory(): void {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    configure(level: LogLevel): void {
        this.level = level;
    }

    debug(message: string, context?: Record<string, any>): void {
        if (this.level <= LogLevel.DEBUG) {
            this.log('DEBUG', message, context);
        }
    }

    info(message: string, context?: Record<string, any>): void {
        if (this.level <= LogLevel.INFO) {
            this.log('INFO', message, context);
        }
    }

    warn(message: string, context?: Record<string, any>): void {
        if (this.level <= LogLevel.WARN) {
            this.log('WARN', message, context);
        }
    }

    error(message: string, error?: Error | any, context?: Record<string, any>): void {
        const errorContext = error ? {
            message: error.message,
            stack: error.stack,
            code: error.code
        } : undefined;

        this.log('ERROR', message, context, errorContext);
    }

    private log(
        level: string,
        message: string,
        context?: Record<string, any>,
        error?: any
    ): void {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            ...(context && { context }),
            ...(error && { error })
        };

        // Console output (formatted for readability)
        const consoleMessage = this.formatForConsole(entry);
        if (level === 'ERROR') {
            console.error(consoleMessage);
        } else if (level === 'WARN') {
            console.warn(consoleMessage);
        } else {
            console.log(consoleMessage);
        }

        // File output (JSON for parsing)
        try {
            fs.appendFileSync(this.logFile, JSON.stringify(entry) + '\n');
        } catch (err) {
            console.error('Failed to write to log file:', err);
        }
    }

    private formatForConsole(entry: LogEntry): string {
        const timestamp = entry.timestamp.split('T')[1].split('.')[0];
        let msg = `[${timestamp}] ${entry.level}: ${entry.message}`;

        if (entry.context) {
            msg += ` | ${JSON.stringify(entry.context)}`;
        }

        if (entry.error) {
            msg += `\n  Error: ${entry.error.message}`;
            if (entry.error.stack) {
                msg += `\n  ${entry.error.stack}`;
            }
        }

        return msg;
    }

    /**
     * Clean up old log files (keep last 30 days)
     */
    cleanOldLogs(daysToKeep: number = 30): void {
        try {
            const files = fs.readdirSync(this.logDir);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

            for (const file of files) {
                if (!file.endsWith('.log')) continue;

                const filePath = path.join(this.logDir, file);
                const stats = fs.statSync(filePath);

                if (stats.mtime < cutoffDate) {
                    fs.unlinkSync(filePath);
                    this.info('Deleted old log file', { file });
                }
            }
        } catch (err) {
            this.error('Failed to clean old logs', err);
        }
    }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Export convenience functions
export const debug = (message: string, context?: Record<string, any>) =>
    logger.debug(message, context);

export const info = (message: string, context?: Record<string, any>) =>
    logger.info(message, context);

export const warn = (message: string, context?: Record<string, any>) =>
    logger.warn(message, context);

export const error = (message: string, err?: Error | any, context?: Record<string, any>) =>
    logger.error(message, err, context);

// Configure log level based on environment
if (process.env.NODE_ENV === 'development') {
    logger.configure(LogLevel.DEBUG);
} else {
    logger.configure(LogLevel.INFO);
}

// Clean old logs on startup
try {
    logger.cleanOldLogs();
} catch (e) {
    // Ignore errors during cleanup to prevent startup crash (especially in tests)
}
