import { FormScraper, injectValue } from './scraper';
import contentCss from './content.css?inline';

function isContextValid(): boolean {
  try {
    return typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;
  } catch {
    return false;
  }
}

function shouldDisableOnCurrentPage(): boolean {
  const host = window.location.hostname.toLowerCase();
  const isGoogleSearch = host === 'google.com' || host === 'www.google.com' || /^www\.google\.co\.[a-z]{2,3}$/.test(host) || /^google\.co\.[a-z]{2,3}$/.test(host);
  const isOtherSearch = host === 'bing.com' || host === 'www.bing.com' || host === 'duckduckgo.com' || host === 'www.duckduckgo.com' || host.includes('search.yahoo.com') || host === 'yahoo.com' || host === 'www.yahoo.com';
  return isGoogleSearch || isOtherSearch;
}

class MagicCommandDock {
  private dockContainer: HTMLDivElement | null = null;
  private currentPersona: string = 'default';
  private customPrompts: Record<string, string> = {
    default: '',
    profile: '',
    qa: '',
    b2b: ''
  };
  private isMinimized: boolean = true;
  private lastMinimizedState: boolean | null = null;
  private lastFieldsCount: number | null = null;
  private observer: MutationObserver | null = null;
  private usageCount: number = 0;
  private userPlan: string = 'Free Tier';
  private authToken: string = '';
  private aiProvider: string = 'cloud';
  private hasProfile: boolean = false;
  private isLoading: boolean = false;

  constructor() {
    if (!isContextValid()) return;
    if (shouldDisableOnCurrentPage()) return;

    // Check if floating dock interface is enabled in preferences
    chrome.storage.local.get([
      'enableFloatingDock',
      'isMinimized',
      'profileFirstName',
      'profileLastName',
      'profileEmail',
      'usageCount',
      'userPlan',
      'authToken',
      'aiProvider'
    ], (result: Record<string, string | number | boolean | undefined>) => {
      if (!isContextValid()) return;

      this.usageCount = result.usageCount as number || 0;
      this.userPlan = result.userPlan as string || 'Free Tier';
      this.authToken = result.authToken as string || '';
      this.aiProvider = result.aiProvider as string || 'cloud';

      const enabled = result.enableFloatingDock !== false;
      if (!enabled) {
        // Run without floating dock interface, only setup shortcuts/messaging
        this.setupListeners();
        return;
      }

      this.createDock();
      this.setupListeners();
      this.setupObserver();

      this.isMinimized = result.isMinimized !== undefined ? !!result.isMinimized : true;
      this.hasProfile = !!(result.profileFirstName || result.profileLastName || result.profileEmail);
      if (this.hasProfile) {
        this.currentPersona = 'profile';
      } else {
        this.currentPersona = 'default';
      }
      this.updateDockState();
    });
  }

  private setupObserver() {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const throttledUpdate = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => this.updateDockState(), 400);
    };

    // Instantiate observer to watch for dynamic DOM updates to elements
    this.observer = new MutationObserver((mutations) => {
      if (!isContextValid()) {
        this.destroy();
        return;
      }
      let shouldUpdate = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0) {
          const elementsModified = Array.from(mutation.addedNodes).some(node =>
            node instanceof HTMLElement && (
              node.matches('input, textarea, select') ||
              node.querySelector('input, textarea, select')
            )
          ) || Array.from(mutation.removedNodes).some(node =>
            node instanceof HTMLElement && (
              node.matches('input, textarea, select') ||
              node.querySelector('input, textarea, select')
            )
          );
          if (elementsModified) {
            shouldUpdate = true;
            break;
          }
        }
      }
      if (shouldUpdate) {
        throttledUpdate();
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also trigger updates on window load and focus movements
    window.addEventListener('load', throttledUpdate);
    document.addEventListener('focusin', throttledUpdate, true);
  }


  private createDock() {
    let host = document.getElementById('autofill-ai-shadow-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'autofill-ai-shadow-host';
      document.body.appendChild(host);
    }

    const shadowRoot = host.shadowRoot || host.attachShadow({ mode: 'open' });
    shadowRoot.innerHTML = '';

    this.dockContainer = document.createElement('div');
    this.dockContainer.className = 'af-dock-root';
    shadowRoot.appendChild(this.dockContainer);

    const styleEl = document.createElement('style');
    styleEl.textContent = contentCss;
    shadowRoot.appendChild(styleEl);
  }

  private getQuotaText(): string {
    if (this.aiProvider !== 'cloud' && this.aiProvider !== 'local') {
      return 'API Key: Unlimited';
    }
    if (this.aiProvider === 'local') {
      return 'Local AI: Unlimited';
    }
    // Cloud modes
    if (this.authToken) {
      if (this.userPlan === 'Pro Plan') {
        return 'Pro: Unlimited';
      }
      return `Fills: ${Math.max(0, 50 - this.usageCount)}/50 left`;
    }
    return 'Autofill AI: Auth Required';
  }

  private updateDockState() {
    if (!isContextValid()) {
      this.destroy();
      return;
    }
    if (!this.dockContainer) return;
    if (this.isLoading) return; // Prevent rebuilding during active filling

    const activeFields = FormScraper.scrapeForms().length;

    const host = document.getElementById('autofill-ai-shadow-host');
    // Completely hide the floating dock if there are no forms to fill on the page
    if (activeFields === 0) {
      if (host) host.style.display = 'none';
      this.lastFieldsCount = 0;
      return;
    }
    if (host) host.style.display = 'block';

    // Only repaint/rebuild the DOM if minimized state or form field count has actually changed
    if (this.isMinimized === this.lastMinimizedState && activeFields === this.lastFieldsCount) {
      return;
    }

    this.lastMinimizedState = this.isMinimized;
    this.lastFieldsCount = activeFields;

    if (this.isMinimized) {
      this.dockContainer.innerHTML = `
        <div class="af-dock-bubble" title="Expand AutoFill AI [Alt+P]">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
          </svg>
        </div>
      `;

      const bubble = this.dockContainer.querySelector('.af-dock-bubble');
      bubble?.addEventListener('click', () => {
        this.isMinimized = false;
        chrome.storage.local.set({ isMinimized: false });
        this.updateDockState();
      });
    } else {
      const isLimitReached = this.aiProvider === 'cloud' && (
        !this.authToken || (this.userPlan === 'Free Tier' && this.usageCount >= 50)
      );

      let btnText = 'Magically Fill Form';
      let btnClass = 'af-btn-primary';
      let btnIcon = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-3a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2H5z"></path>
          <path d="m8 11 3 3 5-5"></path>
        </svg>
      `;

      if (isLimitReached) {
        btnClass += ' limit-reached';
        btnText = (this.aiProvider === 'cloud' && !this.authToken)
          ? 'Sign In to use Autofill AI'
          : 'Limit Reached: Upgrade to Pro';
        btnIcon = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        `;
      } else if (this.currentPersona === 'profile' && !this.hasProfile) {
        btnText = 'Configure Profile Card';
      }

      this.dockContainer.innerHTML = `
        <div class="af-dock-panel">
          <!-- Header -->
          <div class="af-dock-header">
            <div class="af-dock-brand">
              <div class="af-dock-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
                </svg>
              </div>
              <span class="af-dock-title">AutoFill AI</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="af-dock-status">${activeFields} fields</span>
              <button class="af-dock-minimize" title="Minimize Dock [Alt+P]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>
            </div>
          </div>

          <!-- Persona Grid -->
          <div class="af-persona-selector">
            <span class="af-section-label">Filling Persona</span>
            <div class="af-persona-grid">
              <button class="af-persona-tab ${this.currentPersona === 'default' ? 'active' : ''}" data-persona="default">Default</button>
              <button class="af-persona-tab ${this.currentPersona === 'profile' ? 'active' : ''}" data-persona="profile" style="position: relative;">
                My Profile
                ${!this.hasProfile ? '<span style="position: absolute; top: 3px; right: 3px; width: 6px; height: 6px; background: #f59e0b; border-radius: 50%; border: 1px solid white;" title="Profile not configured"></span>' : ''}
              </button>
              <button class="af-persona-tab ${this.currentPersona === 'qa' ? 'active' : ''}" data-persona="qa">QA Test</button>
              <button class="af-persona-tab ${this.currentPersona === 'b2b' ? 'active' : ''}" data-persona="b2b">B2B Corp</button>
            </div>
          </div>

          <!-- Custom Instruction Toggle -->
          <div class="af-persona-selector">
            <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;" id="af-toggle-custom-trigger">
              <span class="af-section-label">Custom Instruction</span>
              <span class="af-section-label" style="font-size: 8px; color: #4f46e5;">Toggle Custom</span>
            </div>
            <div class="af-custom-prompt-container ${this.customPrompts[this.currentPersona] ? 'visible' : ''}">
              <textarea 
                class="af-custom-prompt-input" 
                placeholder="e.g. A developer from Seattle named Jane who loves coding..."
                rows="2"
              ></textarea>
            </div>
          </div>

          <!-- Actions -->
          <div class="af-dock-actions">
            <button class="${btnClass}" id="af-fill-btn">
              ${btnIcon}
              <span>${btnText}</span>
            </button>
            <div class="af-dock-subactions">
              <button class="af-btn-secondary" id="af-rescan-btn">Re-Scan</button>
              <button class="af-btn-danger" id="af-clear-btn">Clear Form</button>
            </div>
            <!-- Error Alert -->
            <div class="af-dock-error" id="af-error-alert" style="display: none;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span class="af-error-text"></span>
            </div>
          </div>

          <!-- Footer -->
          <div class="af-dock-footer">
            <span>[Alt + F] to Fill</span>
            <span>${this.getQuotaText()}</span>
          </div>
        </div>
      `;

      // Wire up Panel event listeners
      const minimizeBtn = this.dockContainer.querySelector('.af-dock-minimize');
      minimizeBtn?.addEventListener('click', () => {
        this.isMinimized = true;
        chrome.storage.local.set({ isMinimized: true });
        this.updateDockState();
      });

      // Persona Grid Clicks
      const personaTabs = this.dockContainer.querySelectorAll('.af-persona-tab');
      personaTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
          const target = e.currentTarget as HTMLButtonElement;
          const persona = target.getAttribute('data-persona') || 'default';
          this.currentPersona = persona;

          // Force repaint to dynamically update active selection, button class, text, and icons
          this.lastMinimizedState = null;
          this.lastFieldsCount = null;
          this.updateDockState();
        });
      });

      // Custom prompt dropdown toggle
      const customTrigger = this.dockContainer.querySelector('#af-toggle-custom-trigger');
      customTrigger?.addEventListener('click', () => {
        const container = this.dockContainer?.querySelector('.af-custom-prompt-container');
        if (container) {
          container.classList.toggle('visible');
          if (container.classList.contains('visible')) {
            const input = container.querySelector('.af-custom-prompt-input') as HTMLTextAreaElement;
            input?.focus();
          }
        }
      });

      // Bind Prompt input changes
      const textarea = this.dockContainer.querySelector('.af-custom-prompt-input') as HTMLTextAreaElement;
      if (textarea) {
        textarea.value = this.customPrompts[this.currentPersona] || '';
        textarea.addEventListener('input', (e) => {
          const val = (e.target as HTMLTextAreaElement).value;
          this.customPrompts[this.currentPersona] = val;
        });
      }

      // Fill Button
      const fillBtn = this.dockContainer.querySelector('#af-fill-btn') as HTMLButtonElement;
      fillBtn?.addEventListener('click', () => this.handleFill());

      // Re-scan Button
      const rescanBtn = this.dockContainer.querySelector('#af-rescan-btn') as HTMLButtonElement;
      rescanBtn?.addEventListener('click', () => {
        this.updateDockState();
      });

      // Clear Button
      const clearBtn = this.dockContainer.querySelector('#af-clear-btn') as HTMLButtonElement;
      clearBtn?.addEventListener('click', () => this.clearAllForms());
    }
  }

  private setupListeners() {
    // Keyboard Hotkeys
    document.addEventListener('keydown', (e) => {
      if (!isContextValid()) {
        this.destroy();
        return;
      }
      // Alt + F to Fill Form
      if (e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        this.handleFill();
      }

      // Alt + P to Toggle Dock Minimize
      if (e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        this.isMinimized = !this.isMinimized;
        chrome.storage.local.set({ isMinimized: this.isMinimized });
        this.updateDockState();
      }
    });

    // Message receiver from options/background triggers
    chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
      if (request.action === 'ping') {
        sendResponse({ status: 'alive' });
        return true;
      }

      if (request.action === 'trigger_fill') {
        const fields = FormScraper.scrapeForms();
        if (fields.length === 0) {
          return false;
        }
        this.handleFill(request.persona, request.customPrompt)
          .then(sendResponse)
          .catch(err => sendResponse({ error: err.message }));
        return true;
      }

      if (request.action === 'trigger_fill_with_persona') {
        const fields = FormScraper.scrapeForms();
        if (fields.length === 0) {
          return false;
        }
        this.handleFill(request.persona)
          .then(sendResponse)
          .catch(err => sendResponse({ error: err.message }));
        return true;
      }

      if (request.action === 'detect_fields') {
        const fields = FormScraper.scrapeForms();
        if (fields.length > 0) {
          sendResponse({ count: fields.length });
        }
        return false;
      }
      return false;
    });

    // Listen for storage changes dynamically (e.g. toggling floating dock from the extension popup)
    chrome.storage.onChanged.addListener((changes) => {
      if (!isContextValid()) return;

      let needsUpdate = false;

      if (changes.profileFirstName || changes.profileLastName || changes.profileEmail) {
        chrome.storage.local.get(['profileFirstName', 'profileLastName', 'profileEmail'], (res) => {
          if (!isContextValid()) return;
          this.hasProfile = !!(res.profileFirstName || res.profileLastName || res.profileEmail);
          if (!this.hasProfile && this.currentPersona === 'profile') {
            this.currentPersona = 'default';
          }
          // Force repaint
          this.lastMinimizedState = null;
          this.lastFieldsCount = null;
          this.updateDockState();
        });
      }

      if (changes.enableFloatingDock) {
        const newVal = changes.enableFloatingDock.newValue !== false;
        if (newVal) {
          if (!this.dockContainer) {
            this.createDock();
            this.setupObserver();
            chrome.storage.local.get([
              'isMinimized',
              'profileFirstName',
              'profileLastName',
              'profileEmail',
              'usageCount',
              'userPlan',
              'authToken',
              'aiProvider'
            ], (result) => {
              if (!isContextValid()) return;
              this.usageCount = result.usageCount as number || 0;
              this.userPlan = result.userPlan as string || 'Free Tier';
              this.authToken = result.authToken as string || '';
              this.aiProvider = result.aiProvider as string || 'cloud';
              this.isMinimized = result.isMinimized !== undefined ? !!result.isMinimized : true;
              const hasProfile = !!(result.profileFirstName || result.profileLastName || result.profileEmail);
              if (hasProfile) {
                this.currentPersona = 'profile';
              }
              // Force repaint
              this.lastMinimizedState = null;
              this.lastFieldsCount = null;
              this.updateDockState();
            });
          }
        } else {
          this.destroy();
          this.dockContainer = null;
        }
      }

      if (changes.usageCount) {
        this.usageCount = changes.usageCount.newValue as number || 0;
        needsUpdate = true;
      }
      if (changes.userPlan) {
        this.userPlan = changes.userPlan.newValue as string || 'Free Tier';
        needsUpdate = true;
      }
      if (changes.authToken) {
        this.authToken = changes.authToken.newValue as string || '';
        needsUpdate = true;
      }
      if (changes.aiProvider) {
        this.aiProvider = changes.aiProvider.newValue as string || 'cloud';
        needsUpdate = true;
      }

      if (needsUpdate && this.dockContainer && !this.isMinimized) {
        this.lastMinimizedState = null;
        this.lastFieldsCount = null;
        this.updateDockState();
      }
    });
  }

  private clearAllForms() {
    const inputs = document.querySelectorAll('input, textarea, select');
    inputs.forEach((node) => {
      const el = node as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      if (el.type === 'hidden' || el.type === 'submit' || el.type === 'button') return;

      if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
        el.checked = false;
      } else {
        el.value = '';
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Scan dynamic fields
    this.updateDockState();
  }

  private async handleFill(overridePersona?: string, overridePrompt?: string) {
    const persona = overridePersona || this.currentPersona;
    const prompt = overridePrompt !== undefined ? overridePrompt : (this.customPrompts[persona] || '');

    this.isLoading = true;

    const fillBtn = this.dockContainer?.querySelector('#af-fill-btn') as HTMLButtonElement;
    const originalText = fillBtn ? fillBtn.innerHTML : '';

    const errorAlert = this.dockContainer?.querySelector('#af-error-alert') as HTMLDivElement;
    if (errorAlert) {
      errorAlert.style.display = 'none';
      const errorText = errorAlert.querySelector('.af-error-text');
      if (errorText) errorText.textContent = '';
    }

    const isLimitReached = this.aiProvider === 'cloud' && (
      !this.authToken || (this.userPlan === 'Free Tier' && this.usageCount >= 50)
    );

    if (isLimitReached) {
      if (fillBtn) {
        fillBtn.innerHTML = `<span>Opening Settings...</span>`;
      }
      this.isLoading = false;
      chrome.storage.local.set({ activeTabOnOpen: 'account' }, () => {
        chrome.runtime.sendMessage({ action: 'open_options' });
      });
      setTimeout(() => {
        this.updateDockState();
      }, 1500);
      return { success: false, error: 'Usage limit reached' };
    }

    if (persona === 'profile' && !this.hasProfile) {
      if (fillBtn) {
        fillBtn.innerHTML = `<span>Opening Settings...</span>`;
      }
      this.isLoading = false;
      chrome.storage.local.set({ activeTabOnOpen: 'profile' }, () => {
        chrome.runtime.sendMessage({ action: 'open_options' });
      });
      setTimeout(() => {
        this.updateDockState();
      }, 1500);
      return { success: false, error: 'Profile not configured' };
    }

    if (fillBtn) {
      fillBtn.classList.add('loading');
      fillBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="af-animate-spin">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
          <path d="M4 12a8 8 0 0 1 8-8"></path>
        </svg>
        <span>AI is generating...</span>
      `;
    }

    const fields = FormScraper.scrapeForms();
    if (fields.length === 0) {
      this.isLoading = false;
      if (fillBtn) {
        fillBtn.classList.remove('loading');
        fillBtn.innerHTML = `<span>No fields detected!</span>`;
        setTimeout(() => { fillBtn.innerHTML = originalText; }, 2000);
      }
      return { success: false, error: 'No fields detected' };
    }

    try {
      console.log(`Sending fields to background AI engine. Persona: ${persona}. Prompt instruction length: ${prompt.length}`);

      const response = await new Promise<Record<string, string> | null | undefined>((resolve) => {
        chrome.runtime.sendMessage({
          action: 'generate_data',
          fields: fields,
          persona: persona,
          customPrompt: prompt
        }, (res) => {
          if (chrome.runtime.lastError) {
            resolve({ error: chrome.runtime.lastError.message || 'Unknown runtime error' });
          } else {
            resolve(res as Record<string, string> | null | undefined);
          }
        });
      });

      if (response && !response.error) {
        // Guarantee animation keyframes are registered on the host page stylesheet
        this.injectGlobalAnimationStyles();

        // Inject values sequentially with dynamic wave glow pulses
        let count = 0;
        Object.entries(response).forEach(([fieldId, value]) => {
          setTimeout(() => {
            injectValue(fieldId, value as string);

            // Add wave pulse styling to show fill activity
            const inputEl = document.getElementById(fieldId) || document.querySelector(`[name="${CSS.escape(fieldId)}"]`);
            if (inputEl) {
              inputEl.classList.add('af-filled-pulse');
              setTimeout(() => {
                inputEl.classList.remove('af-filled-pulse');
              }, 1500);
            }
          }, count * 80); // 80ms wave interval
          count++;
        });

        const totalFillDuration = count * 80;
        const resetDelay = Math.max(1500, totalFillDuration);
        if (fillBtn) {
          fillBtn.innerHTML = `<span>✨ Magic complete!</span>`;
          setTimeout(() => {
            fillBtn.classList.remove('loading');
            fillBtn.innerHTML = originalText;
            this.isLoading = false;
            this.lastMinimizedState = null;
            this.lastFieldsCount = null;
            this.updateDockState();
          }, resetDelay);
        } else {
          this.isLoading = false;
          this.lastMinimizedState = null;
          this.lastFieldsCount = null;
          this.updateDockState();
        }
        return { success: true };
      } else {
        throw new Error(response?.error || 'Unknown AI error.');
      }
    } catch (err: unknown) {
      console.log('Magic filling failed:', err);
      if (fillBtn) {
        fillBtn.innerHTML = `<span style="color: #ef4444;">Filling failed</span>`;
        setTimeout(() => {
          fillBtn.classList.remove('loading');
          fillBtn.innerHTML = originalText;
          this.isLoading = false;
          this.lastMinimizedState = null;
          this.lastFieldsCount = null;
          this.updateDockState();
        }, 3000);
      } else {
        this.isLoading = false;
        this.lastMinimizedState = null;
        this.lastFieldsCount = null;
        this.updateDockState();
      }
      const message = err instanceof Error ? err.message : String(err);

      const errorAlert = this.dockContainer?.querySelector('#af-error-alert') as HTMLDivElement;
      if (errorAlert) {
        errorAlert.style.display = 'flex';
        const errorText = errorAlert.querySelector('.af-error-text');
        if (errorText) {
          errorText.textContent = this.getFriendlyErrorMessage(message);
        }
      }
      return { success: false, error: message };
    }
  }

  private getFriendlyErrorMessage(rawError: string): string {
    if (!rawError) return '';
    const lower = rawError.toLowerCase();
    if (lower.includes('503') || lower.includes('unavailable') || lower.includes('high demand') || lower.includes('busy')) {
      return "AI servers are currently experiencing high demand. Please wait a moment and try again.";
    }
    if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('deadline_exceeded')) {
      return "The AI generation request timed out. Please try again in a moment.";
    }
    if (lower.includes('api key') || lower.includes('api_key') || lower.includes('invalid key')) {
      return "Google Gemini API Key is invalid or missing. Please configure it in Settings.";
    }
    if (lower.includes('network error') || lower.includes('failed to fetch')) {
      return "Network error. Please make sure you are connected to the internet.";
    }
    return rawError;
  }

  private injectGlobalAnimationStyles() {
    const styleId = 'autofill-ai-global-animations';
    if (document.getElementById(styleId)) return;

    const globalStyle = document.createElement('style');
    globalStyle.id = styleId;
    globalStyle.textContent = `
      @keyframes af-pulse-wave {
        0% {
          box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.6), inset 0 0 0 2px rgba(99, 102, 241, 0.6);
          border-color: #6366f1 !important;
        }
        50% {
          box-shadow: 0 0 0 10px rgba(99, 102, 241, 0), inset 0 0 0 2px rgba(99, 102, 241, 0.2);
        }
        100% {
          box-shadow: 0 0 0 0 rgba(99, 102, 241, 0), inset 0 0 0 0 rgba(99, 102, 241, 0);
        }
      }
      .af-filled-pulse {
        animation: af-pulse-wave 1.4s ease-out !important;
        transition: all 0.2s ease;
      }
    `;
    document.head.appendChild(globalStyle);
  }

  private destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    const host = document.getElementById('autofill-ai-shadow-host');
    if (host) {
      host.remove();
    }
    this.lastMinimizedState = null;
    this.lastFieldsCount = null;
  }
}

// Instantiate the supreme floating panel dock
new MagicCommandDock();
console.log('✨ AutoFill AI command dock active and monitoring [Alt+F / Alt+P]');
