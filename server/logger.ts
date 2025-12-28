/**
 * Structured Logger for Visual DNA
 * 
 * Provides consistent, leveled logging with context support.
 * Replaces scattered console.log/error calls with structured output.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  module?: string;
  operation?: string;
  styleId?: string;
  jobId?: string;
  userId?: string;
  duration?: number;
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function parseLogLevel(envValue: string | undefined): LogLevel {
  if (!envValue) return 'info';
  const normalized = envValue.toLowerCase() as LogLevel;
  if (normalized in LOG_LEVELS) {
    return normalized;
  }
  return 'info';
}

const CURRENT_LEVEL = parseLogLevel(process.env.LOG_LEVEL);

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[CURRENT_LEVEL];
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function formatContext(context?: LogContext): string {
  if (!context) return '';
  const parts: string[] = [];
  if (context.module) parts.push(`[${context.module}]`);
  if (context.operation) parts.push(`op=${context.operation}`);
  if (context.styleId) parts.push(`style=${context.styleId.slice(0, 8)}`);
  if (context.jobId) parts.push(`job=${context.jobId.slice(0, 8)}`);
  if (context.duration !== undefined) parts.push(`duration=${context.duration}ms`);
  return parts.length > 0 ? ` ${parts.join(' ')}` : '';
}

function formatMessage(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = formatTimestamp();
  const levelStr = level.toUpperCase().padEnd(5);
  const contextStr = formatContext(context);
  return `${timestamp} ${levelStr}${contextStr} ${message}`;
}

export const logger = {
  debug(message: string, context?: LogContext): void {
    if (shouldLog('debug')) {
      console.debug(formatMessage('debug', message, context));
    }
  },

  info(message: string, context?: LogContext): void {
    if (shouldLog('info')) {
      console.info(formatMessage('info', message, context));
    }
  },

  warn(message: string, context?: LogContext): void {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', message, context));
    }
  },

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (shouldLog('error')) {
      const errorMsg = error instanceof Error ? error.message : String(error || '');
      const fullMessage = errorMsg ? `${message}: ${errorMsg}` : message;
      console.error(formatMessage('error', fullMessage, context));
      if (error instanceof Error && error.stack && process.env.NODE_ENV !== 'production') {
        console.error(error.stack);
      }
    }
  },

  child(defaultContext: LogContext) {
    return {
      debug: (message: string, context?: LogContext) => 
        logger.debug(message, { ...defaultContext, ...context }),
      info: (message: string, context?: LogContext) => 
        logger.info(message, { ...defaultContext, ...context }),
      warn: (message: string, context?: LogContext) => 
        logger.warn(message, { ...defaultContext, ...context }),
      error: (message: string, error?: Error | unknown, context?: LogContext) => 
        logger.error(message, error, { ...defaultContext, ...context }),
    };
  },
};

export default logger;
