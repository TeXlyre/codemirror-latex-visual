import { MathfieldElement } from 'mathlive';
MathfieldElement.soundsDirectory = null;

export function createEditableMath(latex: string, displayMode: boolean = false): HTMLElement {
  const mathfield = new MathfieldElement();

  mathfield.value = latex;
  mathfield.readOnly = false;
  mathfield.mathVirtualKeyboardPolicy = 'manual';
  mathfield.smartMode = true;
  mathfield.smartFence = true;
  mathfield.smartSuperscript = true;

  if (displayMode) {
    mathfield.classList.add('math-display-field');
    mathfield.setAttribute('style', 'display: block; text-align: center; min-height: 2em; width: 100%;');
  } else {
    mathfield.classList.add('math-inline-field');
    mathfield.setAttribute('style', 'display: inline-block; min-width: 2em;');
  }

  let wasRecentlyFocused = false;
  let menuClickHandler: ((e: MouseEvent) => void) | null = null;

  mathfield.addEventListener('focusin', () => {
    wasRecentlyFocused = true;
    if ((window as any).mathVirtualKeyboard) {
      (window as any).mathVirtualKeyboard.show();
    }

    if (menuClickHandler) {
      document.removeEventListener('mousedown', menuClickHandler, true);
    }

    menuClickHandler = (e: MouseEvent) => {
      const target = e.target as Element;
      if (target && (target.closest('.ML__popover') || target.closest('.ML__menu') || target.classList.contains('ML__button'))) {
        setTimeout(() => {
          if (wasRecentlyFocused) {
            mathfield.focus();
          }
        }, 50);
      }
    };

    document.addEventListener('mousedown', menuClickHandler, true);
  });

  mathfield.addEventListener('focusout', () => {
    setTimeout(() => {
      wasRecentlyFocused = false;
    }, 200);

    if ((window as any).mathVirtualKeyboard) {
      (window as any).mathVirtualKeyboard.hide();
    }

    if (menuClickHandler) {
      document.removeEventListener('mousedown', menuClickHandler, true);
      menuClickHandler = null;
    }
  });

  mathfield.addEventListener('click', () => {
    if (!mathfield.hasFocus()) {
      mathfield.focus();
    }
  });

  return mathfield;
}