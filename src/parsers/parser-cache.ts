// src/parsers/parser-cache.ts
import { LatexToken } from './base-parser';
import { errorService, ErrorCategory, ErrorSeverity } from '../core/error-service';

export interface CacheEntry {
  tokens: LatexToken[];
  timestamp: number;
  contentHash: string;
  parseOptions: ParseCacheOptions;
}

export interface ParseCacheOptions {
  maxDepth?: number;
  showCommands?: boolean;
  maxContentLength?: number;
}

export class ParserCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;
  private maxAge: number;
  private hitCount = 0;
  private missCount = 0;

  constructor(maxSize: number = 100, maxAge: number = 300000) {
    this.maxSize = maxSize;
    this.maxAge = maxAge;
  }

  generateCacheKey(content: string, options: ParseCacheOptions = {}): string {
    const optionsStr = JSON.stringify(options);
    const contentHash = this.hash(content);
    return `${contentHash}_${this.hash(optionsStr)}`;
  }

  get(key: string): LatexToken[] | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.missCount++;
      return null;
    }

    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(key);
      this.missCount++;
      return null;
    }

    this.hitCount++;
    return entry.tokens;
  }

  set(key: string, tokens: LatexToken[], content: string, options: ParseCacheOptions = {}): void {
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    const entry: CacheEntry = {
      tokens: this.cloneTokens(tokens),
      timestamp: Date.now(),
      contentHash: this.hash(content),
      parseOptions: { ...options }
    };

    this.cache.set(key, entry);
  }

  clear(): void {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  invalidateByContent(content: string): void {
    const contentHash = this.hash(content);
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.contentHash === contentHash) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  getStats() {
    const total = this.hitCount + this.missCount;
    return {
      size: this.cache.size,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: total > 0 ? this.hitCount / total : 0,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private cloneTokens(tokens: LatexToken[]): LatexToken[] {
    return tokens.map(token => ({
      ...token,
      children: token.children ? this.cloneTokens(token.children) : undefined,
      elements: token.elements ? [...token.elements] : undefined
    }));
  }

  private hash(str: string): string {
    let hash = 0;
    if (str.length === 0) return hash.toString();

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }

    return Math.abs(hash).toString(36);
  }

  private estimateMemoryUsage(): number {
    let totalSize = 0;

    for (const entry of this.cache.values()) {
      totalSize += JSON.stringify(entry).length * 2;
    }

    return totalSize;
  }
}