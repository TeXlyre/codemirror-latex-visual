// src/core/parser-service.ts
import { LatexToken } from '../parsers/base-parser';
import { LatexTokenizer } from '../parsers/main-parser';
import { ParserCache, ParseCacheOptions } from '../parsers/parser-cache';
import { ConfigService } from './config';
import { errorService, ErrorCategory, ErrorSeverity } from './error-service';

export interface ParseOptions extends ParseCacheOptions {
  useCache?: boolean;
  timeout?: number;
}

export class ParserService {
  private tokenizer: LatexTokenizer;
  private cache: ParserCache;
  private configService: ConfigService;
  private parseTimeouts = new Map<string, number>();

  constructor(configService: ConfigService) {
    this.configService = configService;
    this.tokenizer = new LatexTokenizer();
    this.cache = new ParserCache();
    this.setupConfigListeners();
  }

  tokenize(content: string, options: ParseOptions = {}): LatexToken[] {
    const config = this.configService.get();
    const startTime = performance.now();

    const parseOptions: ParseCacheOptions = {
      maxDepth: options.maxDepth || config.maxParseDepth,
      showCommands: options.showCommands || config.showCommands,
      maxContentLength: options.maxContentLength || config.maxContentLength
    };

    if (content.length > parseOptions.maxContentLength!) {
      errorService.logError(
        ErrorCategory.PARSER,
        ErrorSeverity.WARN,
        'Content exceeds maximum length, truncating',
        { contentLength: content.length, maxLength: parseOptions.maxContentLength }
      );
      content = content.substring(0, parseOptions.maxContentLength!);
    }

    const cacheKey = this.cache.generateCacheKey(content, parseOptions);

    if (options.useCache !== false) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.logParsePerformance(startTime, content.length, true);
        return cached;
      }
    }

    const timeoutMs = options.timeout || config.defaultTimeouts.render;
    const parseId = Math.random().toString(36);

    try {
      const timeoutId = window.setTimeout(() => {
        throw new Error(`Parse timeout after ${timeoutMs}ms`);
      }, timeoutMs);

      this.parseTimeouts.set(parseId, timeoutId);

      const tokens = this.tokenizer.tokenize(content);

      clearTimeout(timeoutId);
      this.parseTimeouts.delete(parseId);

      if (options.useCache !== false) {
        this.cache.set(cacheKey, tokens, content, parseOptions);
      }

      this.logParsePerformance(startTime, content.length, false);
      return tokens;

    } catch (error) {
      const timeoutId = this.parseTimeouts.get(parseId);
      if (timeoutId) {
        clearTimeout(timeoutId);
        this.parseTimeouts.delete(parseId);
      }

      const latexError = errorService.logError(
        ErrorCategory.PARSER,
        ErrorSeverity.ERROR,
        'Tokenization failed',
        { content: content.substring(0, 100), error, options }
      );

      const recovered = errorService.tryRecover<LatexToken>(latexError, { content, start: 0, end: content.length });
      if (recovered) {
        return [recovered];
      }

      return [{
        type: 'text',
        content,
        latex: content,
        start: 0,
        end: content.length
      }];
    }
  }

  invalidateCache(content?: string): void {
    if (content) {
      this.cache.invalidateByContent(content);
    } else {
      this.cache.clear();
    }
  }

  getCacheStats() {
    return this.cache.getStats();
  }

  getPerformanceStats() {
    return {
      cache: this.cache.getStats(),
      activeParses: this.parseTimeouts.size
    };
  }

  cleanup(): void {
    for (const timeoutId of this.parseTimeouts.values()) {
      clearTimeout(timeoutId);
    }
    this.parseTimeouts.clear();
    this.cache.clear();
  }

  private setupConfigListeners(): void {
    this.configService.subscribe((config) => {
      if (config.maxParseDepth !== this.tokenizer.getMaxDepth()) {
        this.tokenizer.setMaxDepth(config.maxParseDepth);
        this.cache.clear();
      }
    });
  }

  private logParsePerformance(startTime: number, contentLength: number, fromCache: boolean): void {
    const duration = performance.now() - startTime;
    const config = this.configService.get();

    if (duration > config.defaultTimeouts.render) {
      errorService.logError(
        ErrorCategory.PARSER,
        ErrorSeverity.WARN,
        'Slow parsing detected',
        {
          duration,
          contentLength,
          fromCache,
          threshold: config.defaultTimeouts.render
        }
      );
    }
  }
}