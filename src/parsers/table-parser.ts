// src/parsers/table-parser.ts (Updated for Phase 2)
import { BaseLatexParser, LatexToken } from './base-parser';
import { ParserService } from '../core/parser-service';
import { ConfigService } from '../core/config';
import { errorService, ErrorCategory, ErrorSeverity } from '../core/error-service';

export class TableParser extends BaseLatexParser {
  private static parserService: ParserService;
  private static configService: ConfigService;

  static initialize(configService: ConfigService): void {
    this.configService = configService;
    this.parserService = new ParserService(configService);
  }

  canParse(latex: string, position: number): boolean {
    return latex.startsWith('\\begin{tabular}', position) ||
           latex.startsWith('\\begin{table}', position);
  }

  parse(latex: string, position: number): LatexToken | null {
    if (!this.canParse(latex, position)) return null;

    try {
      const isTable = latex.startsWith('\\begin{table}', position);
      const envName = isTable ? 'table' : 'tabular';

      const beginMatch = latex.slice(position).match(
        isTable ? /^\\begin\{table\}(\[.*?\])?/ : /^\\begin\{tabular\}(\[.*?\])?\{([^}]+)\}/
      );

      if (!beginMatch) {
        const incompleteMatch = latex.slice(position).match(
          isTable ? /^\\begin\{table\}(\[.*?)?$/ : /^\\begin\{tabular\}(\[.*?\])?(\{[^}]*)?$/
        );

        if (incompleteMatch) {
          errorService.logError(
            ErrorCategory.PARSER,
            ErrorSeverity.WARN,
            'Incomplete table construct found',
            { match: incompleteMatch[0], position, envName }
          );
          return this.createFallbackToken(incompleteMatch[0], position);
        }
        return null;
      }

      const endPattern = `\\end{${envName}}`;
      const endPos = latex.indexOf(endPattern, position + beginMatch[0].length);

      if (endPos === -1) {
        errorService.logError(
          ErrorCategory.PARSER,
          ErrorSeverity.WARN,
          'No matching end found for table environment',
          { envName, position }
        );
        return this.createFallbackToken(latex.slice(position), position);
      }

      const fullLatex = latex.slice(position, endPos + endPattern.length);
      const rawContent = latex.slice(position + beginMatch[0].length, endPos);
      const content = rawContent.replace(/^\s*\n|\n\s*$/g, '');
      const alignment = isTable ? '' : (beginMatch[2] || '');

      const token: LatexToken = {
        type: 'environment',
        content,
        latex: fullLatex,
        start: position,
        end: endPos + endPattern.length,
        name: envName,
        params: alignment
      };

      if (content.trim() && envName === 'tabular') {
        if (TableParser.parserService) {
          try {
            token.children = this.parseTableContent(content);
          } catch (error) {
            errorService.logError(
              ErrorCategory.PARSER,
              ErrorSeverity.WARN,
              'Failed to parse table content',
              { contentLength: content.length, error }
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

  private parseTableContent(content: string): LatexToken[] {
    if (!content.trim()) return [];

    try {
      const rows = content.split('\\\\').map(row => row.trim()).filter(row => row);
      const tokens: LatexToken[] = [];

      rows.forEach((rowContent, rowIndex) => {
        if (rowContent) {
          const cells = rowContent.split('&').map(cell => cell.trim());
          cells.forEach((cellContent, cellIndex) => {
            if (cellContent && TableParser.parserService) {
              try {
                const cellTokens = TableParser.parserService.tokenize(cellContent, {
                  maxContentLength: 500,
                  useCache: true
                });
                tokens.push(...cellTokens);
              } catch (error) {
                errorService.logError(
                  ErrorCategory.PARSER,
                  ErrorSeverity.WARN,
                  'Failed to parse table cell content',
                  { rowIndex, cellIndex, cellContent: cellContent.substring(0, 50), error }
                );

                tokens.push({
                  type: 'text',
                  content: cellContent,
                  latex: cellContent,
                  start: 0,
                  end: cellContent.length
                });
              }
            }
          });
        }
      });

      return tokens;
    } catch (error) {
      errorService.logError(
        ErrorCategory.PARSER,
        ErrorSeverity.ERROR,
        'Failed to parse table content structure',
        { content: content.substring(0, 100), error }
      );
      return [];
    }
  }
}