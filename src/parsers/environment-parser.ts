// src/parsers/environment-parser.ts (Updated for Phase 2)
import { BaseLatexParser, LatexToken } from './base-parser';
import { ParserService } from '../core/parser-service';
import { ConfigService } from '../core/config';
import { errorService, ErrorCategory, ErrorSeverity } from '../core/error-service';

export class EnvironmentParser extends BaseLatexParser {
  private static parserService: ParserService;
  private static configService: ConfigService;

  static initialize(configService: ConfigService): void {
    this.configService = configService;
    this.parserService = new ParserService(configService);
  }

  canParse(latex: string, position: number): boolean {
    return latex.startsWith('\\begin{', position);
  }

  parse(latex: string, position: number): LatexToken | null {
    if (!this.canParse(latex, position)) return null;

    try {
      const beginMatch = latex.slice(position).match(/^\\begin\{([^}]+)\}/);

      if (!beginMatch) {
        const incompleteMatch = latex.slice(position).match(/^\\begin(\{[^}]*)?$/);
        if (incompleteMatch) {
          errorService.logError(
            ErrorCategory.PARSER,
            ErrorSeverity.WARN,
            'Incomplete environment begin construct',
            { match: incompleteMatch[0], position }
          );
          return this.createFallbackToken(incompleteMatch[0], position);
        }
        return this.parseAsCommand(latex, position);
      }

      const envName = beginMatch[1];
      const endPos = this.findMatchingEnd(latex, position, envName);

      if (endPos === -1) {
        errorService.logError(
          ErrorCategory.PARSER,
          ErrorSeverity.WARN,
          'No matching end found for environment',
          { envName, position }
        );
        return this.createFallbackToken(latex.slice(position), position);
      }

      const endPattern = `\\end{${envName}}`;
      const fullLatex = latex.slice(position, endPos + endPattern.length);
      const content = latex.slice(position + beginMatch[0].length, endPos);

      const token: LatexToken = {
        type: 'environment',
        content,
        latex: fullLatex,
        start: position,
        end: endPos + endPattern.length,
        name: envName
      };

      if (content.trim() && !this.isListEnvironment(envName) && envName !== 'tabular') {
        if (EnvironmentParser.parserService) {
          try {
            token.children = EnvironmentParser.parserService.tokenize(content, {
              maxContentLength: 1000,
              useCache: true
            });
          } catch (error) {
            errorService.logError(
              ErrorCategory.PARSER,
              ErrorSeverity.WARN,
              'Failed to parse environment content',
              { envName, contentLength: content.length, error }
            );
          }
        }
      }

      const validation = this.validateToken(token);
      if (!validation.isComplete || !validation.isValid) {
        this.logValidationWarning(token, validation);
      }

      return token;

    } catch (error) {
      return this.handleParseError(error, latex, position);
    }
  }

  private isListEnvironment(envName: string): boolean {
    return ['enumerate', 'itemize', 'description'].includes(envName);
  }

  private findMatchingEnd(latex: string, startPos: number, envName: string): number {
    const beginPattern = `\\begin{${envName}}`;
    const endPattern = `\\end{${envName}}`;

    let pos = startPos + beginPattern.length;
    let depth = 1;
    let iterations = 0;
    const maxIterations = 1000;

    while (pos < latex.length && depth > 0 && iterations < maxIterations) {
      iterations++;

      const nextBegin = latex.indexOf(beginPattern, pos);
      const nextEnd = latex.indexOf(endPattern, pos);

      if (nextEnd === -1) {
        return -1;
      }

      if (nextBegin !== -1 && nextBegin < nextEnd) {
        depth++;
        pos = nextBegin + beginPattern.length;
      } else {
        depth--;
        if (depth === 0) {
          return nextEnd;
        }
        pos = nextEnd + endPattern.length;
      }
    }

    if (iterations >= maxIterations) {
      errorService.logError(
        ErrorCategory.PARSER,
        ErrorSeverity.ERROR,
        'Environment parsing iteration limit exceeded',
        { envName, startPos, iterations }
      );
    }

    return -1;
  }

  private parseAsCommand(latex: string, position: number): LatexToken {
    try {
      const cmdResult = BaseLatexParser.extractCommandWithBraces(latex, position);
      if (!cmdResult) {
        return this.createFallbackToken(latex.charAt(position), position);
      }

      return {
        type: 'command',
        content: cmdResult.params,
        latex: cmdResult.fullCommand,
        start: position,
        end: cmdResult.end,
        name: cmdResult.name,
        params: ''
      };
    } catch (error) {
      return this.handleParseError(error, latex, position);
    }
  }
}