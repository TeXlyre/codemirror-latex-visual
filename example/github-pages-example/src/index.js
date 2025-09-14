// example/github-pages-example/src/index.js
import { EditorState } from '@codemirror/state';
import { EditorView, lineNumbers } from '@codemirror/view';
import { defaultKeymap, history } from '@codemirror/commands';
import { keymap } from '@codemirror/view';

import { DualLatexEditor, VisualCodeMirrorEditor } from '../../..';

import '../../../dist/styles.css';
import './styles.css';
import 'katex/dist/katex.min.css';

const initialLatex = `\\section{Introduction}
This is a sample document demonstrating the visual LaTeX editor with math hover support and theming.

\\subsection{Mathematical Expressions}
Here is an inline formula: $E = mc^2$, and here is another one: $\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}$.

Display math with hover preview:

$$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$

Complex equations also support hover editing:

$$\\frac{\\partial^2 u}{\\partial t^2} = c^2 \\nabla^2 u$$

More inline math: $\\alpha + \\beta = \\gamma$ and $\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$.

\\begin{theorem}
This is a theorem environment with some mathematical content: $\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}$.
\\end{theorem}

\\begin{proof}
The proof follows from the identity: $\\zeta(2) = \\sum_{n=1}^{\\infty} \\frac{1}{n^2}$.
\\end{proof}

\\section{Text Formatting}
This section demonstrates various \\textbf{formatting} and \\emph{emphasis} commands.

Try hovering over any math expression when in source mode! Also try switching between light and dark themes.`;

let dualEditor; // Global reference for control functions
let currentTheme = 'light'; // Track current theme

document.addEventListener('DOMContentLoaded', () => {
  // Detect system theme preference
  detectSystemTheme();
  
  setupSideBySideDemo();
  setupDualEditorDemo();
  setupMathHoverControls();
  setupThemeControls();
});

function detectSystemTheme() {
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  currentTheme = prefersDark ? 'dark' : 'light';
  
  // Apply theme to document body for consistency
  document.body.classList.toggle('theme-dark', currentTheme === 'dark');
  
  // Listen for system theme changes
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      const newTheme = e.matches ? 'dark' : 'light';
      setGlobalTheme(newTheme);
    });
  }
}

function setGlobalTheme(theme) {
  currentTheme = theme;
  document.body.classList.toggle('theme-dark', theme === 'dark');
  
  // Update dual editor theme if it exists
  if (dualEditor) {
    dualEditor.setTheme(theme);
  }
  
  // Update theme controls
  updateThemeControls();
  
  // Update notification colors based on theme
  updateNotificationTheme();
}

function setupSideBySideDemo() {
  const cmEditorSource = new EditorView({
    state: EditorState.create({
      doc: initialLatex,
      extensions: [
        lineNumbers(),
        history(),
        keymap.of(defaultKeymap),
        EditorView.lineWrapping
      ]
    }),
    parent: document.getElementById('codemirror-editor')
  });

  const cmEditorVisual = new EditorView({
    state: EditorState.create({
      doc: initialLatex,
      extensions: [
        lineNumbers(),
        history(),
        keymap.of(defaultKeymap),
        EditorView.lineWrapping
      ]
    }),
    parent: document.getElementById('prosemirror-editor')
  });

  const visualEditor = new VisualCodeMirrorEditor(cmEditorVisual, {
    showCommands: false,
    config: {
      theme: currentTheme
    }
  });

  visualEditor.setVisualMode(true);

  let syncing = false;

  const syncFromSource = () => {
    if (syncing) return;
    syncing = true;
    const sourceText = cmEditorSource.state.doc.toString();
    const visualText = cmEditorVisual.state.doc.toString();

    if (sourceText !== visualText) {
      cmEditorVisual.dispatch({
        changes: { from: 0, to: cmEditorVisual.state.doc.length, insert: sourceText }
      });
    }
    syncing = false;
  };

  const syncFromVisual = () => {
    if (syncing) return;
    syncing = true;
    const sourceText = cmEditorSource.state.doc.toString();
    const visualText = cmEditorVisual.state.doc.toString();

    if (sourceText !== visualText) {
      cmEditorSource.dispatch({
        changes: { from: 0, to: cmEditorSource.state.doc.length, insert: visualText }
      });
    }
    syncing = false;
  };

  cmEditorSource.dispatch = ((originalDispatch) => {
    return (...args) => {
      originalDispatch.apply(cmEditorSource, args);
      const transaction = args[0];
      if (transaction && transaction.docChanged && !syncing) {
        setTimeout(syncFromSource, 10);
      }
    };
  })(cmEditorSource.dispatch.bind(cmEditorSource));

  cmEditorVisual.dispatch = ((originalDispatch) => {
    return (...args) => {
      originalDispatch.apply(cmEditorVisual, args);
      const transaction = args[0];
      if (transaction && transaction.docChanged && !syncing) {
        setTimeout(syncFromVisual, 10);
      }
    };
  })(cmEditorVisual.dispatch.bind(cmEditorVisual));
}

function setupDualEditorDemo() {
  const cmEditor = new EditorView({
    state: EditorState.create({
      doc: initialLatex,
      extensions: [
        lineNumbers(),
        history(),
        keymap.of(defaultKeymap),
        EditorView.lineWrapping
      ]
    })
  });

  dualEditor = new DualLatexEditor(
    document.getElementById('dual-editor'),
    cmEditor,
    {
      theme: currentTheme,
      initialMode: 'source',
      showCommands: false,
      showToolbar: true,
      enableMathHover: true,
      onModeChange: (mode) => {
        console.log('Mode changed to:', mode);
        
        updateModeIndicators(mode);
        updateMathHoverStatus();
        updateMathHoverControlsVisibility(mode);
      }
    }
  );

  // Initial UI update
  updateModeIndicators('source');
  updateMathHoverStatus();
  updateMathHoverControlsVisibility('source');
}

function setupMathHoverControls() {
  createMathHoverControlPanel();
  setupControlEventListeners();
}

function setupThemeControls() {
  createThemeControlPanel();
  setupThemeEventListeners();
}

function createThemeControlPanel() {
  const themePanel = document.createElement('div');
  themePanel.id = 'theme-controls';
  themePanel.className = 'theme-controls';
  themePanel.innerHTML = `
    <div class="control-section">
      <h3>Theme Controls</h3>
      <div class="control-group">
        <button id="toggle-theme-btn" class="control-btn">🌙 Switch to Dark</button>
        <button id="auto-theme-btn" class="control-btn">🔄 Auto Theme</button>
        <span id="current-theme-indicator" class="status-indicator">Theme: Light</span>
      </div>
      <div class="theme-preview">
        <div class="theme-sample light-sample">
          <div class="sample-header">Light Theme</div>
          <div class="sample-content">
            <span class="sample-text">Text</span>
            <span class="sample-math">$x^2$</span>
            <span class="sample-env">Environment</span>
          </div>
        </div>
        <div class="theme-sample dark-sample">
          <div class="sample-header">Dark Theme</div>
          <div class="sample-content">
            <span class="sample-text">Text</span>
            <span class="sample-math">$x^2$</span>
            <span class="sample-env">Environment</span>
          </div>
        </div>
      </div>
      <div class="control-info">
        <p><strong>Theme Options:</strong></p>
        <ul>
          <li><strong>Toggle:</strong> Switch between light and dark themes manually</li>
          <li><strong>Auto:</strong> Follow system theme preference</li>
          <li>Use <kbd>Ctrl+Shift+D</kbd> to quickly toggle themes</li>
        </ul>
      </div>
    </div>
  `;

  // Insert before math hover controls
  const mathControls = document.getElementById('math-hover-controls');
  if (mathControls) {
    mathControls.parentNode.insertBefore(themePanel, mathControls);
  } else {
    const dualEditorContainer = document.getElementById('dual-editor');
    dualEditorContainer.parentNode.insertBefore(themePanel, dualEditorContainer);
  }

  updateThemeControls();
}

function setupThemeEventListeners() {
  // Theme toggle button
  document.getElementById('toggle-theme-btn').addEventListener('click', () => {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setGlobalTheme(newTheme);
    showNotification(`Switched to ${newTheme} theme!`);
  });

  // Auto theme button
  document.getElementById('auto-theme-btn').addEventListener('click', () => {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const systemTheme = prefersDark ? 'dark' : 'light';
    setGlobalTheme(systemTheme);
    showNotification(`Applied system theme: ${systemTheme}`);
  });

  // Keyboard shortcut for theme toggle
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      setGlobalTheme(newTheme);
      showNotification(`Theme toggled to ${newTheme} via keyboard!`);
    }
  });
}

function updateThemeControls() {
  const themeIndicator = document.getElementById('current-theme-indicator');
  const toggleBtn = document.getElementById('toggle-theme-btn');
  
  if (themeIndicator) {
    themeIndicator.textContent = `Theme: ${currentTheme.charAt(0).toUpperCase() + currentTheme.slice(1)}`;
    themeIndicator.className = `status-indicator theme-${currentTheme}`;
  }

  if (toggleBtn) {
    const isDark = currentTheme === 'dark';
    toggleBtn.innerHTML = isDark ? '☀️ Switch to Light' : '🌙 Switch to Dark';
    toggleBtn.classList.toggle('active', isDark);
  }

  // Update theme samples
  const lightSample = document.querySelector('.light-sample');
  const darkSample = document.querySelector('.dark-sample');
  
  if (lightSample && darkSample) {
    lightSample.classList.toggle('active', currentTheme === 'light');
    darkSample.classList.toggle('active', currentTheme === 'dark');
  }
}

function createMathHoverControlPanel() {
  const controlPanel = document.createElement('div');
  controlPanel.id = 'math-hover-controls';
  controlPanel.className = 'math-hover-controls';
  controlPanel.innerHTML = `
    <div class="control-section">
      <h3>Math Hover Controls</h3>
      <div class="control-group">
        <button id="toggle-math-hover-btn" class="control-btn">Toggle Math Hover</button>
        <span id="math-hover-status" class="status-indicator">Status: Enabled</span>
      </div>
      <div class="control-group">
        <button id="switch-to-source-btn" class="control-btn">Switch to Source</button>
        <button id="switch-to-visual-btn" class="control-btn">Switch to Visual</button>
        <span id="current-mode-indicator" class="status-indicator">Mode: Source</span>
      </div>
      <div class="control-info">
        <p><strong>How to use Math Hover:</strong></p>
        <ul>
          <li>Switch to <strong>Source</strong> mode</li>
          <li>Hover over any <code>$...$</code> or <code>$$...$$</code> expression</li>
          <li>Wait 300ms for preview to appear</li>
          <li>Click preview to edit with MathLive</li>
          <li>Use <kbd>Ctrl+Shift+M</kbd> to toggle math hover</li>
        </ul>
      </div>
    </div>
  `;

  const dualEditorContainer = document.getElementById('dual-editor');
  dualEditorContainer.parentNode.insertBefore(controlPanel, dualEditorContainer);
}

function setupControlEventListeners() {
  document.getElementById('toggle-math-hover-btn').addEventListener('click', () => {
    if (dualEditor) {
      dualEditor.toggleMathHover();
      updateMathHoverStatus();
    }
  });

  document.getElementById('switch-to-source-btn').addEventListener('click', () => {
    if (dualEditor) {
      dualEditor.setMode('source');
    }
  });

  document.getElementById('switch-to-visual-btn').addEventListener('click', () => {
    if (dualEditor) {
      dualEditor.setMode('visual');
    }
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'M') {
      showNotification('Math hover toggled via keyboard shortcut!');
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
      setTimeout(() => {
        updateMathHoverStatus();
      }, 100);
    }
  });
}

function updateModeIndicators(mode) {
  const modeIndicator = document.getElementById('current-mode-indicator');
  if (modeIndicator) {
    modeIndicator.textContent = `Mode: ${mode.charAt(0).toUpperCase() + mode.slice(1)}`;
    modeIndicator.className = `status-indicator mode-${mode}`;
  }

  const sourceBtn = document.getElementById('switch-to-source-btn');
  const visualBtn = document.getElementById('switch-to-visual-btn');
  
  if (sourceBtn && visualBtn) {
    sourceBtn.classList.toggle('active', mode === 'source');
    visualBtn.classList.toggle('active', mode === 'visual');
  }
}

function updateMathHoverStatus() {
  const statusIndicator = document.getElementById('math-hover-status');
  const toggleBtn = document.getElementById('toggle-math-hover-btn');
  
  if (dualEditor && statusIndicator && toggleBtn) {
    const isEnabled = dualEditor.isMathHoverEnabled();
    const currentMode = dualEditor.currentMode || 'source';
    
    if (currentMode === 'visual') {
      statusIndicator.textContent = 'Status: Disabled (Visual Mode)';
      statusIndicator.className = 'status-indicator status-disabled';
      toggleBtn.disabled = true;
      toggleBtn.textContent = 'Toggle Math Hover (Source Mode Only)';
    } else {
      statusIndicator.textContent = `Status: ${isEnabled ? 'Enabled' : 'Disabled'}`;
      statusIndicator.className = `status-indicator status-${isEnabled ? 'enabled' : 'disabled'}`;
      toggleBtn.disabled = false;
      toggleBtn.textContent = `${isEnabled ? 'Disable' : 'Enable'} Math Hover`;
    }
  }
}

function updateMathHoverControlsVisibility(mode) {
  const controlInfo = document.querySelector('.control-info');
  if (controlInfo) {
    if (mode === 'visual') {
      controlInfo.style.opacity = '0.5';
      controlInfo.style.pointerEvents = 'none';
    } else {
      controlInfo.style.opacity = '1';
      controlInfo.style.pointerEvents = 'auto';
    }
  }
}

function updateNotificationTheme() {
  // This function ensures notifications follow the current theme
  // The actual styling is handled in the showNotification function
}

function showNotification(message) {
  const isDark = currentTheme === 'dark';
  const bgColor = isDark ? '#374151' : '#007acc';
  const textColor = isDark ? '#f9fafb' : 'white';
  const shadowOpacity = isDark ? '0.4' : '0.2';

  const notification = document.createElement('div');
  notification.className = `notification theme-${currentTheme}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${bgColor};
    color: ${textColor};
    padding: 12px 20px;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, ${shadowOpacity});
    z-index: 10001;
    font-size: 14px;
    max-width: 300px;
    opacity: 0;
    transform: translateY(-10px);
    transition: all 0.3s ease;
  `;
  
  document.body.appendChild(notification);
  
  requestAnimationFrame(() => {
    notification.style.opacity = '1';
    notification.style.transform = 'translateY(0)';
  });
  
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateY(-10px)';
    setTimeout(() => {
      if (notification.parentNode) {
        document.body.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

// Enhanced demo functionality with theme controls
window.demoFunctions = {
  toggleMathHover: () => {
    if (dualEditor) {
      dualEditor.toggleMathHover();
      updateMathHoverStatus();
      showNotification('Math hover toggled programmatically!');
    }
  },
  
  switchToSource: () => {
    if (dualEditor) {
      dualEditor.setMode('source');
      showNotification('Switched to source mode - math hover available!');
    }
  },
  
  switchToVisual: () => {
    if (dualEditor) {
      dualEditor.setMode('visual');
      showNotification('Switched to visual mode - math hover disabled');
    }
  },
  
  toggleTheme: () => {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setGlobalTheme(newTheme);
    showNotification(`Theme toggled to ${newTheme} programmatically!`);
  },
  
  setTheme: (theme) => {
    if (theme === 'light' || theme === 'dark') {
      setGlobalTheme(theme);
      showNotification(`Theme set to ${theme}!`);
    } else {
      console.error('Invalid theme. Use "light" or "dark".');
    }
  },
  
  autoTheme: () => {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const systemTheme = prefersDark ? 'dark' : 'light';
    setGlobalTheme(systemTheme);
    showNotification(`Applied system theme: ${systemTheme}`);
  },
  
  checkMathHoverStatus: () => {
    if (dualEditor) {
      const isEnabled = dualEditor.isMathHoverEnabled();
      showNotification(`Math hover is currently ${isEnabled ? 'enabled' : 'disabled'}`);
      return isEnabled;
    }
    return false;
  },
  
  getCurrentTheme: () => {
    showNotification(`Current theme: ${currentTheme}`);
    return currentTheme;
  }
};

// Enhanced console helper
console.log('Enhanced Demo Functions Available:');
console.log('Math Hover Controls:');
console.log('- window.demoFunctions.toggleMathHover()');
console.log('- window.demoFunctions.switchToSource()');
console.log('- window.demoFunctions.switchToVisual()');
console.log('- window.demoFunctions.checkMathHoverStatus()');
console.log('');
console.log('Theme Controls:');
console.log('- window.demoFunctions.toggleTheme()');
console.log('- window.demoFunctions.setTheme("light" | "dark")');
console.log('- window.demoFunctions.autoTheme()');
console.log('- window.demoFunctions.getCurrentTheme()');
console.log('');
console.log('Keyboard Shortcuts:');
console.log('- Ctrl+E / Cmd+E: Toggle source/visual mode');
console.log('- Ctrl+Shift+M / Cmd+Shift+M: Toggle math hover');
console.log('- Ctrl+Shift+C / Cmd+Shift+C: Toggle command visibility');
console.log('- Ctrl+Shift+T / Cmd+Shift+T: Toggle toolbar');
console.log('- Ctrl+Shift+D / Cmd+Shift+D: Toggle theme');