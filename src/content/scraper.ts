export interface FormField {
  id: string;
  type: string;
  label: string;
  placeholder: string;
  name: string;
  tagName: string;
  options?: string[]; // For selects/radios/checkboxes
  required?: boolean;
  min?: string;
  max?: string;
  pattern?: string;
  maxLength?: number;
}

export class FormScraper {
  /**
   * Recursively finds all form-associated elements, even those inside Shadow DOMs.
   */
  private static findElementsRecursively(
    root: Document | ShadowRoot | Element = document
  ): HTMLElement[] {
    const elements: HTMLElement[] = [];
    
    // Query all immediate children
    const allNodes = root.querySelectorAll('*');
    allNodes.forEach((node) => {
      const el = node as HTMLElement;
      
      // If it matches form tags or standard editable roles
      if (
        el.matches('input, textarea, select') ||
        el.getAttribute('contenteditable') === 'true' ||
        el.getAttribute('role') === 'textbox' ||
        el.getAttribute('role') === 'combobox'
      ) {
        elements.push(el);
      }
      
      // If the node has a shadow root, traverse inside it
      if (el.shadowRoot) {
        elements.push(...this.findElementsRecursively(el.shadowRoot));
      }
    });

    return elements;
  }

  static scrapeForms(targetElement?: HTMLElement): FormField[] {
    const fields: FormField[] = [];
    const rawElements = targetElement 
      ? [targetElement] 
      : this.findElementsRecursively(document);

    // Filter unique elements to prevent duplicate scrapes
    const uniqueElements = Array.from(new Set(rawElements));

    uniqueElements.forEach((el, index) => {
      const isTextArea = el instanceof HTMLTextAreaElement;
      const isSelect = el instanceof HTMLSelectElement;

      // Extract types and attributes
      let type = el.getAttribute('type') || 'text';
      if (isTextArea) type = 'textarea';
      if (isSelect) type = 'select';
      if (el.getAttribute('contenteditable') === 'true') type = 'contenteditable';

      // 1. Skip elements that are visually hidden (size check)
      const rect = el.getBoundingClientRect();
      if (rect.width <= 2 || rect.height <= 2) {
        return;
      }

      // 2. Skip standard hidden/action elements
      if (
        type === 'hidden' || 
        type === 'submit' || 
        type === 'button' || 
        type === 'reset'
      ) {
        return;
      }

      // 3. Skip disabled or read-only elements
      if (
        el.hasAttribute('disabled') ||
        el.hasAttribute('readonly') ||
        (el as HTMLInputElement).disabled ||
        (el as HTMLInputElement).readOnly
      ) {
        return;
      }

      // 4. Skip elements hidden via CSS stylesheet rules (display, visibility, opacity)
      const computedStyle = window.getComputedStyle(el);
      if (
        computedStyle.display === 'none' ||
        computedStyle.visibility === 'hidden' ||
        (computedStyle.opacity === '0' && type !== 'checkbox' && type !== 'radio')
      ) {
        return;
      }

      // 5. Skip search-only inputs (since they aren't part of forms to be autofilled)
      const nameAttr = (el.getAttribute('name') || '').toLowerCase();
      const idAttr = (el.id || '').toLowerCase();
      const placeholderAttr = (el.getAttribute('placeholder') || '').toLowerCase();
      const ariaLabelAttr = (el.getAttribute('aria-label') || '').toLowerCase();
      
      const searchTerms = ['search', 'query', 'find', 'keyword'];
      const isSearch = type === 'search' || 
        nameAttr === 'q' || 
        idAttr === 'q' || 
        searchTerms.some(term => 
          nameAttr.includes(term) || 
          idAttr.includes(term) || 
          placeholderAttr.includes(term) || 
          ariaLabelAttr.includes(term)
        );
      if (isSearch) {
        return;
      }

      const label = this.getLabel(el);
      const id = el.id || el.getAttribute('name') || `${type}-field-${index}`;
      if (!el.id) el.id = id;

      const field: FormField = {
        id: id,
        type: type,
        label: label,
        placeholder: el.getAttribute('placeholder') || '',
        name: el.getAttribute('name') || '',
        tagName: el.tagName.toLowerCase(),
        required: el.hasAttribute('required') || el.getAttribute('aria-required') === 'true',
        min: el.getAttribute('min') || undefined,
        max: el.getAttribute('max') || undefined,
        pattern: el.getAttribute('pattern') || undefined,
        maxLength: el.hasAttribute('maxlength') ? parseInt(el.getAttribute('maxlength') || '0', 10) : undefined
      };

      if (isSelect) {
        const select = el as HTMLSelectElement;
        field.options = Array.from(select.options)
          .map(opt => opt.text.trim())
          .filter(text => text !== '');
      } else if (type === 'radio' || type === 'checkbox') {
        const fieldset = el.closest('fieldset');
        const legend = fieldset?.querySelector('legend');
        const groupLabel = legend?.textContent?.trim() || '';
        const individualLabel = this.getLabel(el);
        field.label = groupLabel ? `${groupLabel} (${individualLabel})` : individualLabel;
      }

      fields.push(field);
    });

    return fields;
  }

  private static getLabel(el: HTMLElement): string {
    // 1. Check for <label for="...">
    if (el.id) {
      // Search globally and within shadow roots if needed
      const labelEl = document.querySelector(`label[for="${el.id}"]`);
      if (labelEl) return labelEl.textContent?.replace(/\s+/g, ' ').trim() || '';
    }

    // 2. Check for parent <label>
    const parentLabel = el.closest('label');
    if (parentLabel) return parentLabel.textContent?.replace(/\s+/g, ' ').trim() || '';

    // 3. Check for aria-label, aria-labelledby, or title
    const ariaLabel = el.getAttribute('aria-label') || el.getAttribute('title');
    if (ariaLabel) return ariaLabel;

    const ariaLabelledBy = el.getAttribute('aria-labelledby');
    if (ariaLabelledBy) {
      const source = document.getElementById(ariaLabelledBy);
      if (source && source.textContent) return source.textContent.trim();
    }

    // 4. Check for preceding text node or sibling labels/spans
    const prev = el.previousElementSibling;
    if (prev && (prev.tagName === 'LABEL' || prev.tagName === 'SPAN')) {
      return prev.textContent?.trim() || '';
    }

    // 5. Try parent heading or text label if it's styled nicely
    const parent = el.parentElement;
    if (parent) {
      const textSibling = Array.from(parent.childNodes)
        .find(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
      if (textSibling) return textSibling.textContent?.trim() || '';
    }

    return '';
  }
}

/**
 * Robustly injects value into an element, bypassing React/Vue virtual DOM limitations.
 */
export const injectValue = (fieldId: string, value: string) => {
  // Support selector-based or ID-based queries, including shadow roots
  let el = document.getElementById(fieldId) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  if (!el) {
    try {
      el = document.querySelector(`[name="${CSS.escape(fieldId)}"]`) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    } catch {
      // Ignored
    }
  }
  
  if (!el) {
    // Fallback recursive search by ID or Name
    const all = document.querySelectorAll('*');
    for (const node of Array.from(all)) {
      if (node.id === fieldId || node.getAttribute('name') === fieldId) {
        el = node as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
        break;
      }
      if (node.shadowRoot) {
        const shadowNode = node.shadowRoot.getElementById(fieldId) || node.shadowRoot.querySelector(`[name="${CSS.escape(fieldId)}"]`);
        if (shadowNode) {
          el = shadowNode as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
          break;
        }
      }
    }
  }

  if (!el) return;

  const isInput = el instanceof HTMLInputElement;
  const isTextArea = el instanceof HTMLTextAreaElement;
  const isSelect = el instanceof HTMLSelectElement;

  if (el.getAttribute('contenteditable') === 'true') {
    el.innerHTML = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }

  if (isInput && (el.type === 'checkbox' || el.type === 'radio')) {
    const input = el as HTMLInputElement;
    const normalizedValue = value.toString().toLowerCase();
    const isTrue = ['true', 'yes', 'on', '1', 'checked'].includes(normalizedValue);
    
    // For radio buttons, set checked if the radio value matches the generated value
    if (el.type === 'radio') {
      const valAttr = el.getAttribute('value')?.toLowerCase() || '';
      const matches = valAttr === normalizedValue || normalizedValue.includes(valAttr) || isTrue;
      
      const nativeCheckedSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'checked')?.set;
      if (nativeCheckedSetter) {
        nativeCheckedSetter.call(input, matches);
      } else {
        input.checked = matches;
      }
    } else {
      // For checkboxes
      const nativeCheckedSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'checked')?.set;
      if (nativeCheckedSetter) {
        nativeCheckedSetter.call(input, isTrue);
      } else {
        input.checked = isTrue;
      }
    }
    input.dispatchEvent(new Event('click', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  } else if (isSelect) {
    const select = el as HTMLSelectElement;
    const valLower = value.toString().toLowerCase();
    
    let matchedIndex = -1;
    // Attempt 1: Match by exact text or subtext
    for (let i = 0; i < select.options.length; i++) {
      const optText = select.options[i].text.toLowerCase();
      const optVal = select.options[i].value.toLowerCase();
      if (optText.includes(valLower) || valLower.includes(optText) || optVal === valLower) {
        matchedIndex = i;
        break;
      }
    }
    
    // Attempt 2: Fallback to matching index if value is numeric within range
    if (matchedIndex === -1 && /^\d+$/.test(value)) {
      const idx = parseInt(value, 10);
      if (idx >= 0 && idx < select.options.length) {
        matchedIndex = idx;
      }
    }

    if (matchedIndex !== -1) {
      select.selectedIndex = matchedIndex;
    }
    
    select.dispatchEvent(new Event('change', { bubbles: true }));
    select.dispatchEvent(new Event('input', { bubbles: true }));
  } else if (isInput || isTextArea) {
    const input = el as HTMLInputElement | HTMLTextAreaElement;
    
    // React / Vue input value tracker bypass
    const prototype = isInput ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype;
    const nativeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    
    if (nativeValueSetter) {
      nativeValueSetter.call(input, value);
    } else {
      input.value = value;
    }
    
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
};
