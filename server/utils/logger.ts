export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export interface StructuredLogEntry {
  requestId?: string;
  service: string;
  timestamp: string;
  level: LogLevel;
  operation: string;
  status: 'SUCCESS' | 'FAILURE' | 'PENDING' | 'SKIPPED';
  durationMs?: number;
  syncStatus?: string;
  metadata?: Record<string, any>;
  error?: string;
}

export class StructuredLogger {
  private serviceName: string;

  constructor(serviceName: string = 'MediKiosk-Core') {
    this.serviceName = serviceName;
  }

  private sanitizeMetadata(data?: Record<string, any>): Record<string, any> | undefined {
    if (!data) return undefined;
    const sanitized: Record<string, any> = {};
    const sensitiveKeys = [
      'password',
      'token',
      'jwt',
      'key',
      'secret',
      'pin',
      'authorization',
      'cookie',
      'base64Audio',
      'audio',
      'fileBuffer',
    ];

    for (const [k, v] of Object.entries(data)) {
      const lower = k.toLowerCase();
      if (sensitiveKeys.some((sk) => lower.includes(sk))) {
        sanitized[k] = '[REDACTED]';
      } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        sanitized[k] = this.sanitizeMetadata(v);
      } else {
        sanitized[k] = v;
      }
    }
    return sanitized;
  }

  log(entry: Omit<StructuredLogEntry, 'timestamp' | 'service'>) {
    const fullEntry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      service: this.serviceName,
      ...entry,
      metadata: this.sanitizeMetadata(entry.metadata),
    };

    const out = JSON.stringify(fullEntry);
    if (entry.level === 'ERROR') {
      console.error(out);
    } else if (entry.level === 'WARN') {
      console.warn(out);
    } else {
      console.log(out);
    }
  }

  info(operation: string, metadata?: Record<string, any>, requestId?: string) {
    this.log({
      level: 'INFO',
      operation,
      status: 'SUCCESS',
      metadata,
      requestId,
    });
  }

  warn(operation: string, error?: string, metadata?: Record<string, any>, requestId?: string) {
    this.log({
      level: 'WARN',
      operation,
      status: 'PENDING',
      error,
      metadata,
      requestId,
    });
  }

  error(operation: string, error: Error | string, metadata?: Record<string, any>, requestId?: string) {
    this.log({
      level: 'ERROR',
      operation,
      status: 'FAILURE',
      error: typeof error === 'string' ? error : error.message,
      metadata,
      requestId,
    });
  }
}

export const logger = new StructuredLogger('MediKiosk-API');
