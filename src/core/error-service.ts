// src/core/error-service.ts (Updated for Phase 2)
export enum ErrorSeverity {
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal'
}

export enum ErrorCategory {
  PARSER = 'parser',
  WIDGET = 'widget',
  RENDER = 'render',
  STATE = 'state',
  DOM = 'dom',
  CONFIG = 'config'
}

export interface LatexError {
  id: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  context?: any;
  timestamp: number;
  stack?: string;
}

export interface ErrorRecoveryStrategy {
  canRecover(error: LatexError): boolean;
  recover(error: LatexError, context: any): any;
}

export class FallbackTextRecovery implements ErrorRecoveryStrategy {
  canRecover(error: LatexError): boolean {
    return error.category === ErrorCategory.PARSER || error.category === ErrorCategory.RENDER;
  }

  recover(error: LatexError, context: any): any {
    if (typeof context?.content === 'string') {
      return {
        type: 'text' as const,
        content: context.content,
        latex: context.content,
        start: context.start || 0,
        end: context.end || context.content.length
      };
    }
    return null;
  }
}

export class ErrorService {
  private errors: LatexError[] = [];
  private recoveryStrategies: ErrorRecoveryStrategy[] = [];
  private errorListeners: Set<(error: LatexError) => void> = new Set();
  private maxErrors = 100;

  constructor() {
    this.addRecoveryStrategy(new FallbackTextRecovery());
  }

  addRecoveryStrategy(strategy: ErrorRecoveryStrategy): void {
    this.recoveryStrategies.push(strategy);
  }

  logError(
    category: ErrorCategory,
    severity: ErrorSeverity,
    message: string,
    context?: any,
    originalError?: Error
  ): LatexError {
    const error: LatexError = {
      id: this.generateErrorId(),
      category,
      severity,
      message,
      context,
      timestamp: Date.now(),
      stack: originalError?.stack
    };

    this.errors.push(error);
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }

    this.notifyListeners(error);

    if (severity === ErrorSeverity.ERROR || severity === ErrorSeverity.FATAL) {
      console.error(`[LatexEditor:${category}] ${message}`, context, originalError);
    } else if (severity === ErrorSeverity.WARN) {
      console.warn(`[LatexEditor:${category}] ${message}`, context);
    }

    return error;
  }

  tryRecover<T>(error: LatexError, context: any): T | null {
    for (const strategy of this.recoveryStrategies) {
      if (strategy.canRecover(error)) {
        try {
          const result = strategy.recover(error, context);
          if (result !== null) {
            this.logError(
              ErrorCategory.STATE,
              ErrorSeverity.INFO,
              `Recovered from error using ${strategy.constructor.name}`,
              { originalError: error.id, recoveredResult: result }
            );
            return result;
          }
        } catch (recoveryError) {
          this.logError(
            ErrorCategory.STATE,
            ErrorSeverity.WARN,
            `Recovery strategy failed: ${strategy.constructor.name}`,
            { originalError: error.id, recoveryError }
          );
        }
      }
    }
    return null;
  }

  getErrors(category?: ErrorCategory): LatexError[] {
    if (category) {
      return this.errors.filter(error => error.category === category);
    }
    return [...this.errors];
  }

  clearErrors(category?: ErrorCategory): void {
    if (category) {
      this.errors = this.errors.filter(error => error.category !== category);
    } else {
      this.errors = [];
    }
  }

  subscribe(listener: (error: LatexError) => void): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private notifyListeners(error: LatexError): void {
    this.errorListeners.forEach(listener => {
      try {
        listener(error);
      } catch (e) {
        console.error('Error in error listener:', e);
      }
    });
  }
}

export const errorService = new ErrorService();