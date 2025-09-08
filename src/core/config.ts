// src/core/config.ts
export interface LatexEditorConfig {
  showCommands: boolean;
  showToolbar: boolean;
  maxRenderDepth: number;
  maxParseDepth: number;
  maxContentLength: number;
  defaultTimeouts: {
    blur: number;
    focus: number;
    update: number;
    render: number;
  };
  styles: {
    colors: {
      primary: string;
      secondary: string;
      success: string;
      warning: string;
      danger: string;
      math: string;
      environment: string;
      command: string;
      table: string;
    };
    spacing: {
      widget: string;
      container: string;
      cell: string;
    };
  };
}

export const DEFAULT_CONFIG: LatexEditorConfig = {
  showCommands: false,
  showToolbar: true,
  maxRenderDepth: 5,
  maxParseDepth: 10,
  maxContentLength: 1000,
  defaultTimeouts: {
    blur: 150,
    focus: 10,
    update: 0,
    render: 50
  },
  styles: {
    colors: {
      primary: '#007acc',
      secondary: '#6c757d',
      success: '#28a745',
      warning: '#fd7e14',
      danger: '#dc3545',
      math: '#6f42c1',
      environment: '#28a745',
      command: '#007acc',
      table: '#6f42c1'
    },
    spacing: {
      widget: '10px 0',
      container: '8px 12px',
      cell: '8px 12px'
    }
  }
};

export class ConfigService {
  private config: LatexEditorConfig;
  private listeners: Set<(config: LatexEditorConfig) => void> = new Set();

  constructor(initialConfig: Partial<LatexEditorConfig> = {}) {
    this.config = this.mergeConfig(DEFAULT_CONFIG, initialConfig);
  }

  get(): LatexEditorConfig {
    return { ...this.config };
  }

  update(updates: Partial<LatexEditorConfig>): void {
    this.config = this.mergeConfig(this.config, updates);
    this.notifyListeners();
  }

  subscribe(listener: (config: LatexEditorConfig) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private mergeConfig(base: LatexEditorConfig, updates: Partial<LatexEditorConfig>): LatexEditorConfig {
    return {
      ...base,
      ...updates,
      defaultTimeouts: { ...base.defaultTimeouts, ...updates.defaultTimeouts },
      styles: {
        ...base.styles,
        ...updates.styles,
        colors: { ...base.styles.colors, ...updates.styles?.colors },
        spacing: { ...base.styles.spacing, ...updates.styles?.spacing }
      }
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.config));
  }
}