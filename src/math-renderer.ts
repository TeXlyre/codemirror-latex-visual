import { MathfieldElement } from 'mathlive';
MathfieldElement.soundsDirectory = null;

export function createEditableMath(latex: string, displayMode: boolean = false): HTMLElement {
  const mathfield = new MathfieldElement();

  mathfield.value = latex;
  mathfield.readOnly = false;

  // Critical: Don't set to 'sandboxed' - this might block keyboard input
  mathfield.mathVirtualKeyboardPolicy = 'auto';

  mathfield.smartMode = true;
  mathfield.smartFence = true;
  mathfield.smartSuperscript = true;
  mathfield.letterShapeStyle = 'tex';

  // Remove this line - it might interfere with keyboard input
  // mathfield.setAttribute('contenteditable', 'false');

  if (displayMode) {
    mathfield.classList.add('math-display-field');
    mathfield.setAttribute('style', 'display: block; text-align: center; min-height: 2em; width: 100%;');
  } else {
    mathfield.classList.add('math-inline-field');
    mathfield.setAttribute('style', 'display: inline-block; min-width: 2em;');
  }

  // Ensure proper focus handling
  mathfield.addEventListener('focusin', () => {
    mathfield.classList.add('focused');

    // Don't override selection immediately
    // setTimeout(() => {
    //   if (mathfield.selection.ranges.length === 0) {
    //     mathfield.selection = { ranges: [[0, 0]] };
    //   }
    // }, 10);

    // Let MathLive handle virtual keyboard automatically
    // if ((window as any).mathVirtualKeyboard) {
    //   (window as any).mathVirtualKeyboard.show();
    // }
  });

  mathfield.addEventListener('focusout', () => {
    mathfield.classList.remove('focused');
  });

  return mathfield;
}