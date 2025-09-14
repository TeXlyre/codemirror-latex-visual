// src/core/config.ts
export interface LatexEditorConfig {
  showCommands: boolean;
  showToolbar: boolean;
  maxRenderDepth: number;
  maxParseDepth: number;
  maxContentLength: number;
  theme: 'light' | 'dark';
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
      background: string;
      foreground: string;
      surface: string;
      border: string;
    };
    spacing: {
      widget: string;
      container: string;
      cell: string;
    };
  };
}

export const DARK_THEME_COLORS = {
  primary: '#4da6ff',
  secondary: '#9ca3af',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  math: '#a78bfa',
  environment: '#10b981',
  command: '#4da6ff',
  table: '#a78bfa',
  background: '#1f2937',
  foreground: '#f9fafb',
  surface: '#374151',
  border: '#4b5563'
};

export const LIGHT_THEME_COLORS = {
  primary: '#007acc',
  secondary: '#6c757d',
  success: '#28a745',
  warning: '#fd7e14',
  danger: '#dc3545',
  math: '#6f42c1',
  environment: '#28a745',
  command: '#007acc',
  table: '#6f42c1',
  background: '#ffffff',
  foreground: '#000000',
  surface: '#f8f9fa',
  border: '#ddd'
};

export const DEFAULT_CONFIG: LatexEditorConfig = {
  showCommands: false,
  showToolbar: true,
  maxRenderDepth: 5,
  maxParseDepth: 10,
  maxContentLength: 1000,
  theme: 'light',
  defaultTimeouts: {
    blur: 150,
    focus: 10,
    update: 0,
    render: 50
  },
  styles: {
    colors: LIGHT_THEME_COLORS,
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

  setTheme(theme: 'light' | 'dark'): void {
    const colors = theme === 'dark' ? DARK_THEME_COLORS : LIGHT_THEME_COLORS;
    this.config = this.mergeConfig(this.config, {
      theme,
      styles: {
        ...this.config.styles,
        colors
      }
    });
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