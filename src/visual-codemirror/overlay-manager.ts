// src/visual-codemirror/overlay-manager.ts
import { EditorState } from '@codemirror/state';
import { Decoration, DecorationSet } from '@codemirror/view';
import { ParserService } from '../core/parser-service';
import { ConfigService } from '../core/config';
import { WidgetFactory } from './widget-factory';
import { errorService, ErrorCategory, ErrorSeverity } from '../core/error-service';

export class OverlayManager {
  private parserService: ParserService;
  private configService: ConfigService;
  private decorationCache = new Map<string, { decorations: DecorationSet; timestamp: number }>();
  private cacheTimeout = 5000; // 5 seconds

  constructor(configService: ConfigService) {
    this.configService = configService;
    this.parserService = new ParserService(configService);
  }

  createDecorations(state: EditorState, showCommands: boolean = false): DecorationSet {
    const doc = state.doc;
    const text = doc.toString();

    if (!text.trim()) {
      return Decoration.none;
    }

    const cacheKey = this.generateCacheKey(text, showCommands);
    const cached = this.getFromCache(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const decorations = this.createDecorationsInternal(text, showCommands);
      this.setCache(cacheKey, decorations);
      return decorations;
    } catch (error) {
      errorService.logError(
        ErrorCategory.RENDER,
        ErrorSeverity.ERROR,
        'Failed to create decorations',
        { textLength: text.length, showCommands, error }
      );
      return Decoration.none;
    }
  }

  private createDecorationsInternal(text: string, showCommands: boolean): DecorationSet {
    const decorations: any[] = [];
    const config = this.configService.get();

    try {
      const tokens = this.parserService.tokenize(text, {
        showCommands,
        maxContentLength: config.maxContentLength,
        useCache: true
      });

      for (const token of tokens) {
        if (token.type === 'text' || token.type === 'paragraph_break') {
          continue;
        }

        if (!this.isCompleteConstruct(token)) {
          continue;
        }

        const from = this.findTokenPosition(text, token);
        if (from === -1) continue;

        const to = from + token.latex.length;

        if (from < 0 || to > text.length || from >= to) {
          continue;
        }

        const widget = WidgetFactory.createWidget(token, showCommands);

        if (widget) {
          const decorationConfig = this.isBlockWidget(token.type)
                                  ? { widget, block: true }
                                  : { widget };

          decorations.push(Decoration.replace(decorationConfig).range(from, to));
        }
      }
    } catch (error) {
      errorService.logError(
        ErrorCategory.RENDER,
        ErrorSeverity.WARN,
        'Error processing tokens for decorations',
        { textLength: text.length, error }
      );
      return Decoration.none;
    }

    try {
      return Decoration.set(decorations.sort((a, b) => a.from - b.from));
    } catch (error) {
      errorService.logError(
        ErrorCategory.RENDER,
        ErrorSeverity.ERROR,
        'Error creating decoration set',
        { decorationCount: decorations.length, error }
      );
      return Decoration.none;
    }
  }

  private isBlockWidget(tokenType: string): boolean {
    return tokenType === 'section' ||
           tokenType === 'math_display' ||
           tokenType === 'environment';
  }

  private isCompleteConstruct(token: any): boolean {
    const latex = token.latex;

    try {
      switch (token.type) {
        case 'command':
        case 'editable_command':
          if (latex.startsWith('\\') && !latex.includes('{')) return false;
          if (latex.includes('{') && !latex.includes('}')) return false;
          let braceCount = 0;
          for (let i = 0; i < latex.length; i++) {
            if (latex[i] === '{') braceCount++;
            if (latex[i] === '}') braceCount--;
          }
          return braceCount === 0;

        case 'environment':
          const envName = token.name || '';
          return latex.includes(`\\begin{${envName}}`) && latex.includes(`\\end{${envName}}`);

        case 'section':
          return latex.includes('{') && latex.includes('}');

        case 'math_inline':
          if (!latex.startsWith('$') || !latex.endsWith('$') || latex.length < 3) return false;
          if (latex === '$') return false;
          if (latex.startsWith('$$') || latex.endsWith('$$')) return false;
          const dollarCount = (latex.match(/\$/g) || []).length;
          return dollarCount === 2;

        case 'math_display':
          if (!latex.startsWith('$$') || !latex.endsWith('$$') || latex.length < 5) return false;
          if (latex === '$$') return false;
          const content = latex.slice(2, -2);
          return !content.includes('$$');

        default:
          return true;
      }
    } catch (error) {
      errorService.logError(
        ErrorCategory.RENDER,
        ErrorSeverity.WARN,
        'Error validating construct completeness',
        { tokenType: token.type, latex: latex.substring(0, 50), error }
      );
      return false;
    }
  }

  private findTokenPosition(text: string, token: any): number {
    if (typeof token.start === 'number' && token.start >= 0) {
      return token.start;
    }

    return text.indexOf(token.latex);
  }

  private generateCacheKey(text: string, showCommands: boolean): string {
    const hash = this.hashString(text);
    return `${hash}_${showCommands}`;
  }

  private getFromCache(key: string): DecorationSet | null {
    const cached = this.decorationCache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.cacheTimeout) {
      this.decorationCache.delete(key);
      return null;
    }

    return cached.decorations;
  }

  private setCache(key: string, decorations: DecorationSet): void {
    if (this.decorationCache.size > 50) {
      this.evictOldestCache();
    }

    this.decorationCache.set(key, {
      decorations,
      timestamp: Date.now()
    });
  }

  private evictOldestCache(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.decorationCache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.decorationCache.delete(oldestKey);
    }
  }

  private hashString(str: string): string {
    let hash = 0;
    if (str.length === 0) return hash.toString();

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }

    return Math.abs(hash).toString(36);
  }

  clearCache(): void {
    this.decorationCache.clear();
  }

  getCacheStats() {
    return {
      size: this.decorationCache.size,
      maxSize: 50,
      timeout: this.cacheTimeout
    };
  }

  cleanup(): void {
    this.clearCache();
    this.parserService.cleanup();
  }
}