import { MathfieldElement } from 'mathlive';
MathfieldElement.soundsDirectory = null;

// Ensure clipboard polyfill is available globally
if (typeof window !== 'undefined' && !navigator.clipboard) {
  (navigator as any).clipboard = {
    writeText: function(text: string) {
      return new Promise((resolve, reject) => {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
          const result = document.execCommand('copy');
          document.body.removeChild(textArea);
          if (result) {
            resolve(undefined);
          } else {
            reject(new Error('Copy command failed'));
          }
        } catch (err) {
          document.body.removeChild(textArea);
          reject(err);
        }
      });
    },

    readText: function() {
      return new Promise((resolve, reject) => {
        const textArea = document.createElement('textarea');
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();

        try {
          document.execCommand('paste');
          const text = textArea.value;
          document.body.removeChild(textArea);
          resolve(text);
        } catch (err) {
          document.body.removeChild(textArea);
          reject(new Error('Paste operation not supported or blocked'));
        }
      });
    }
  };
}

export function createEditableMath(latex: string, displayMode: boolean = false): HTMLElement {
  const mathfield = new MathfieldElement();

  mathfield.value = latex;
  mathfield.readOnly = false;

  mathfield.mathVirtualKeyboardPolicy = 'auto';

  mathfield.smartMode = true;
  mathfield.smartFence = true;
  mathfield.smartSuperscript = true;
  mathfield.letterShapeStyle = 'tex';

  if (displayMode) {
    mathfield.classList.add('math-display-field');
  } else {
    mathfield.classList.add('math-inline-field');
  }

  mathfield.addEventListener('focusin', () => {
    mathfield.classList.add('focused');
  });

  mathfield.addEventListener('focusout', () => {
    mathfield.classList.remove('focused');
  });

  return mathfield;
}