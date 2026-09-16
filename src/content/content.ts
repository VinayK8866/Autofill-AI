import { FormScraper, injectValue, type FormSnapshotItem } from './scraper';
import { type TestRunReportData, generateReportMarkdown, copyReportToClipboard } from '../lib/exportReport';
import { getDomainPrompt, saveDomainPrompt, normalizeDomain } from '../lib/domainPromptManager';
import contentCss from './content.css?inline';
import './global.css';

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
  private lastUsageCount: number | null = null;
  private lastUserPlan: string | null = null;
  private lastAuthToken: string | null = null;
  private lastAiProvider: string | null = null;
  private lastSnapshot: FormSnapshotItem[] | null = null;
  private lastSnapshotState: boolean = false;
  private qaFlavor: string = 'all';
  private lastQaFlavor: string | null = null;
  private observer: MutationObserver | null = null;
  private usageCount: number = 0;
  private userPlan: string = 'Free Tier';
  private authToken: string = '';
  private aiProvider: string = 'cloud';
  private hasProfile: boolean = false;
  private isLoading: boolean = false;
  private qaDailyCount: number = 0;
  private cleanupListeners: (() => void) | null = null;

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
      'aiProvider',
      'qaDailyCount',
      'qaLastDate'
    ], (result: Record<string, string | number | boolean | undefined>) => {
      if (!isContextValid()) return;

      this.usageCount = result.usageCount as number || 0;
      this.userPlan = result.userPlan as string || 'Free Tier';
      this.authToken = result.authToken as string || '';
      this.aiProvider = result.aiProvider as string || 'cloud';

      const today = new Date().toISOString().slice(0, 10);
      let qCount = typeof result.qaDailyCount === 'number' ? result.qaDailyCount : 0;
      if (result.qaLastDate !== today) {
        qCount = 0;
        chrome.storage.local.set({ qaDailyCount: 0, qaLastDate: today });
      }
      this.qaDailyCount = qCount;

      const enabled = result.enableFloatingDock !== false;
      if (!enabled) {
        // Run without floating dock interface, only setup shortcuts/messaging
        this.setupListeners();
        return;
      }

      this.createDock();
      this.setupListeners();
      this.setupObserver();

      // Silent background sync for latest quota
      if (this.aiProvider === 'cloud') {
        chrome.runtime.sendMessage({ action: 'sync_usage' });
      }

      this.isMinimized = result.isMinimized !== undefined ? !!result.isMinimized : true;
      this.hasProfile = !!(result.profileFirstName || result.profileLastName || result.profileEmail);
      if (this.hasProfile) {
        this.currentPersona = 'profile';
      } else {
        this.currentPersona = 'default';
      }

      if (result.lastQaFlavor) {
        this.qaFlavor = result.lastQaFlavor as string;
      }

      const domain = normalizeDomain(window.location.hostname);
      if (domain) {
        getDomainPrompt(domain).then((savedPrompt) => {
          if (savedPrompt) {
            this.customPrompts['default'] = savedPrompt;
            this.customPrompts['profile'] = this.customPrompts['profile'] || savedPrompt;
            this.customPrompts['qa'] = this.customPrompts['qa'] || savedPrompt;
            this.customPrompts['b2b'] = this.customPrompts['b2b'] || savedPrompt;
          }
        });
      }

      this.updateDockState();
    });
  }

  private setupObserver() {
    let lastScanTime = 0;
    let throttleTimeout: ReturnType<typeof setTimeout> | null = null;
    const SCAN_THROTTLE_MS = 1500; // Throttle scans to max once per 1.5 seconds

    const throttledUpdate = () => {
      if (!isContextValid()) {
        if (this.cleanupListeners) {
          this.cleanupListeners();
          this.cleanupListeners = null;
        }
        this.destroy();
        return;
      }

      const now = Date.now();
      const timeSinceLastScan = now - lastScanTime;

      if (timeSinceLastScan >= SCAN_THROTTLE_MS) {
        if (throttleTimeout) {
          clearTimeout(throttleTimeout);
          throttleTimeout = null;
        }
        lastScanTime = now;
        this.updateDockState();
      } else if (!throttleTimeout) {
        // Schedule a scan for the remaining duration of the throttle window
        throttleTimeout = setTimeout(() => {
          lastScanTime = Date.now();
          throttleTimeout = null;
          this.updateDockState();
        }, SCAN_THROTTLE_MS - timeSinceLastScan);
      }
    };

    // Lightweight MutationObserver that just detects general DOM tree updates
    // without traversing mutation nodes.
    this.observer = new MutationObserver(() => {
      throttledUpdate();
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    const handleLoad = () => throttledUpdate();
    const handleFocusIn = () => throttledUpdate();
    const handleClick = () => throttledUpdate();

    // Event listeners to react instantly when a user interacts with fields
    window.addEventListener('load', handleLoad);
    document.addEventListener('focusin', handleFocusIn, true);
    document.addEventListener('click', handleClick, true);

    this.cleanupListeners = () => {
      window.removeEventListener('load', handleLoad);
      document.removeEventListener('focusin', handleFocusIn, true);
      document.removeEventListener('click', handleClick, true);
      if (throttleTimeout) {
        clearTimeout(throttleTimeout);
      }
    };
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

  private getQuotaDetails() {
    if (this.aiProvider !== 'cloud' && this.aiProvider !== 'local') {
      return {
        badgeText: 'BYOK',
        tierName: 'Private API Key',
        desc: 'Unlimited fills',
        footerText: 'API Key: Unlimited',
        isLimitReached: false,
        isCloudLimited: false,
        percentUsed: 0,
        dotColor: 'green'
      };
    }

    if (this.aiProvider === 'local') {
      return {
        badgeText: 'Local AI',
        tierName: 'Local Gemini Nano',
        desc: 'Unlimited offline fills',
        footerText: 'Local AI: Unlimited',
        isLimitReached: false,
        isCloudLimited: false,
        percentUsed: 0,
        dotColor: 'green'
      };
    }

    // Cloud: Pro Plan
    if (this.authToken && this.userPlan === 'Pro Plan') {
      return {
        badgeText: 'Pro',
        tierName: 'Autofill AI Pro',
        desc: 'Unlimited fills',
        footerText: 'Pro: Unlimited',
        isLimitReached: false,
        isCloudLimited: false,
        percentUsed: 0,
        dotColor: 'green'
      };
    }

    // Cloud: Free Tier (50 fills/month)
    if (this.authToken) {
      const remaining = Math.max(0, 50 - this.usageCount);
      const isLimitReached = this.usageCount >= 50;
      const percentUsed = Math.min(100, Math.round((this.usageCount / 50) * 100));
      const dotColor = isLimitReached ? 'red' : remaining <= 5 ? 'amber' : 'green';

      return {
        badgeText: isLimitReached ? '0/50 Limit' : `${remaining}/50 left`,
        tierName: 'Free Tier',
        desc: `${remaining}/50 monthly fills left`,
        footerText: isLimitReached ? '0/50 left • Upgrade to Pro' : `${remaining}/50 left • Upgrade to Pro`,
        isLimitReached,
        isCloudLimited: true,
        percentUsed,
        dotColor,
        warningText: isLimitReached
          ? 'Monthly limit reached (50/50). Upgrade to Pro for unlimited fills.'
          : remaining <= 5
          ? `Only ${remaining} monthly fills left. Upgrade to Pro for unlimited.`
          : undefined,
        ctaText: 'Upgrade to Pro →',
        ctaAction: 'upgrade' as const
      };
    }

    // Cloud: Guest / Anonymous (10 fills total)
    const remaining = Math.max(0, 10 - this.usageCount);
    const isLimitReached = this.usageCount >= 10;
    const percentUsed = Math.min(100, Math.round((this.usageCount / 10) * 100));
    const dotColor = isLimitReached ? 'red' : remaining <= 3 ? 'amber' : 'green';

    return {
      badgeText: isLimitReached ? '0/10 Limit' : `${remaining}/10 left`,
      tierName: 'Guest Mode',
      desc: `${remaining}/10 free fills left`,
      footerText: isLimitReached ? '0/10 left • Sign up for 50' : `${remaining}/10 left • Sign up for 50`,
      isLimitReached,
      isCloudLimited: true,
      percentUsed,
      dotColor,
      warningText: isLimitReached
        ? 'Guest limit reached (10/10). Sign up for free to unlock 50 fills/month!'
        : remaining <= 3
        ? `Only ${remaining} guest fills left. Sign up to unlock 50 free fills/month!`
        : undefined,
      ctaText: 'Unlock 50 Free Fills →',
      ctaAction: 'signup' as const
    };
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

    const quota = this.getQuotaDetails();
    const hasUndo = !!(this.lastSnapshot && this.lastSnapshot.length > 0);

    // Only repaint/rebuild the DOM if state has actually changed
    if (
      this.isMinimized === this.lastMinimizedState &&
      activeFields === this.lastFieldsCount &&
      this.usageCount === this.lastUsageCount &&
      this.userPlan === this.lastUserPlan &&
      this.authToken === this.lastAuthToken &&
      this.aiProvider === this.lastAiProvider &&
      hasUndo === this.lastSnapshotState &&
      this.qaFlavor === this.lastQaFlavor
    ) {
      return;
    }

    this.lastMinimizedState = this.isMinimized;
    this.lastFieldsCount = activeFields;
    this.lastUsageCount = this.usageCount;
    this.lastUserPlan = this.userPlan;
    this.lastAuthToken = this.authToken;
    this.lastAiProvider = this.aiProvider;
    this.lastSnapshotState = hasUndo;
    this.lastQaFlavor = this.qaFlavor;

    const logoUrl = chrome.runtime.getURL('icon-128.png');

    if (this.isMinimized) {
      this.dockContainer.innerHTML = `
        <div class="af-dock-bubble" title="${quota.isLimitReached ? 'Filli AI (Limit Reached - Click to Open)' : `Filli AI (${quota.desc}) [Alt+P]`}">
          ${quota.isLimitReached ? '<span class="af-bubble-limit-dot" title="Limit Reached">!</span>' : ''}
          <img src="${logoUrl}" alt="Filli AI" class="af-dock-bubble-logo" />
        </div>
      `;

      const bubble = this.dockContainer.querySelector('.af-dock-bubble');
      bubble?.addEventListener('click', () => {
        this.isMinimized = false;
        chrome.storage.local.set({ isMinimized: false });
        this.updateDockState();
      });
    } else {
      const isBypass = this.userPlan === 'Pro Plan' || this.aiProvider !== 'cloud';
      const isLimitReached = !isBypass && this.aiProvider === 'cloud' && (
        (!this.authToken && this.usageCount >= 10) ||
        (this.authToken && this.userPlan === 'Free Tier' && this.usageCount >= 50)
      );
      const isQaLimitReached = !isBypass && this.currentPersona === 'qa' && this.qaDailyCount >= 5;

      let btnText = 'Magically Fill Form';
      let btnClass = 'af-btn-primary';
      let btnIcon = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-3a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2H5z"></path>
          <path d="m8 11 3 3 5-5"></path>
        </svg>
      `;

      if (isQaLimitReached) {
        btnClass += ' limit-reached';
        btnText = 'Daily QA Limit Reached (5/5)';
        btnIcon = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        `;
      } else if (isLimitReached && this.currentPersona !== 'qa') {
        btnClass += ' limit-reached';
        btnText = (this.aiProvider === 'cloud' && !this.authToken)
          ? 'Limit Reached: Sign Up for 50 Free Fills'
          : 'Limit Reached: Upgrade to Pro';
        btnIcon = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        `;
      } else if (this.currentPersona === 'profile' && !this.hasProfile) {
        btnText = 'Configure Profile Card';
      } else if (this.currentPersona === 'qa') {
        const remaining = Math.max(0, 5 - this.qaDailyCount);
        btnText = isBypass ? '⚡ Fill QA Edge Cases' : `⚡ Fill QA Edge Cases (${remaining} left today)`;
        btnClass += ' af-btn-qa';
        btnIcon = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="m8 2 1.88 1.88"></path>
            <path d="M14.12 3.88 16 2"></path>
            <path d="M9 7.13v-1a3.003 3.003 0 0 1 6 0v1"></path>
            <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6z"></path>
            <path d="M12 20v-9"></path>
            <path d="M6.53 9C4.6 9.8 3 11.4 3 14"></path>
            <path d="M6 18c-2 0-3-1-3-3"></path>
            <path d="M17.47 9c1.93.8 3.53 2.4 3.53 5"></path>
            <path d="M18 18c2 0 3-1 3-3"></path>
          </svg>
        `;
      } else if (this.currentPersona === 'b2b') {
        btnText = 'Fill B2B Corp Identity';
        btnClass += ' af-btn-primary';
      }

      this.dockContainer.innerHTML = `
        <div class="af-dock-panel">
          <!-- Header -->
          <div class="af-dock-header">
            <div class="af-dock-brand">
              <div class="af-dock-icon">
                <img src="${logoUrl}" alt="Filli AI" class="af-dock-header-logo" />
              </div>
              <span class="af-dock-title">Filli AI</span>
            </div>
            <div class="af-dock-header-right">
              <span class="af-dock-status">${activeFields} fields</span>
              <button class="af-dock-quota-pill ${quota.isLimitReached ? 'limited' : ''}" id="af-quota-pill-btn" title="Plan: ${quota.tierName} • ${quota.desc}. Click to open Settings.">
                <span class="af-quota-dot ${quota.dotColor}"></span>
                <span>${quota.badgeText}</span>
              </button>
              <button class="af-dock-minimize" title="Minimize Dock [Alt+P]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>
            </div>
          </div>

          <!-- Quota & Usage Status Card -->
          <div class="af-quota-card ${quota.isLimitReached ? 'limited' : ''}">
            <div class="af-quota-card-top">
              <div class="af-quota-tier-badge">
                <span class="af-tier-name">${quota.tierName}</span>
                ${quota.isLimitReached ? '<span class="af-limited-tag">Limit Reached</span>' : ''}
              </div>
              <span class="af-quota-stat ${quota.isLimitReached ? 'limited' : ''}">${quota.desc}</span>
            </div>
            ${quota.isCloudLimited ? `
            <div class="af-quota-progress-track">
              <div class="af-quota-progress-bar ${quota.isLimitReached ? 'exhausted' : quota.percentUsed >= 70 ? 'warning' : ''}" style="width: ${quota.percentUsed}%"></div>
            </div>
            ` : ''}
            ${quota.warningText ? `
            <div class="af-quota-alert">
              <span class="af-quota-alert-msg">${quota.warningText}</span>
              <button class="af-quota-cta-btn" id="af-quota-cta-btn">${quota.ctaText}</button>
            </div>
            ` : ''}
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
            ${this.currentPersona === 'qa' ? `
            <div class="af-qa-flavor-selector">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="af-section-label" style="font-size: 8px; color: #b45309;">Test Fuzz Strategy</span>
                <span class="af-section-label" style="font-size: 8px; color: #64748b;">${this.userPlan === 'Pro Plan' || this.aiProvider !== 'cloud' ? 'Unlimited' : `${Math.max(0, 5 - this.qaDailyCount)} left today`}</span>
              </div>
              <div class="af-qa-flavor-pills">
                <button class="af-qa-flavor-pill ${this.qaFlavor === 'all' ? 'active' : ''}" data-flavor="all">Mix All</button>
                <button class="af-qa-flavor-pill ${this.qaFlavor === 'boundary' ? 'active' : ''}" data-flavor="boundary">Boundary</button>
                <button class="af-qa-flavor-pill ${this.qaFlavor === 'security' ? 'active' : ''}" data-flavor="security">XSS/SQLi</button>
                <button class="af-qa-flavor-pill ${this.qaFlavor === 'realistic' ? 'active' : ''}" data-flavor="realistic">Realistic</button>
                <button class="af-qa-flavor-pill ${this.qaFlavor === 'appsec_pro' ? 'active' : ''}" data-flavor="appsec_pro" title="OWASP Top 10 Suite (Pro / BYOK)">⚡ AppSec (Pro)</button>
              </div>
            </div>
            ` : ''}
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
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                <span style="font-size: 8.5px; color: #64748b; font-weight: 600;">${window.location.hostname}</span>
                <button id="af-remember-domain-btn" style="font-size: 9px; font-weight: bold; color: #4f46e5; background: none; border: none; cursor: pointer; padding: 2px 4px;">
                  📌 Remember for site
                </button>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="af-dock-actions">
            <button class="${btnClass}" id="af-fill-btn">
              ${btnIcon}
              <span>${btnText}</span>
            </button>
            <div class="af-dock-subactions ${hasUndo ? 'has-undo' : ''}">
              <button class="af-btn-secondary" id="af-rescan-btn">Re-Scan</button>
              ${hasUndo ? `
              <button class="af-btn-warning" id="af-undo-btn" title="Undo last autofill and restore previous inputs">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 7v6h6"></path>
                  <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path>
                </svg>
                <span>Undo</span>
              </button>
              <button class="af-btn-secondary" id="af-export-report-btn" title="Copy Markdown bug report of this test run to clipboard">
                <span>📋 Bug Report</span>
              </button>
              ` : ''}
              <button class="af-btn-danger" id="af-clear-btn">Clear</button>
            </div>
            <button class="af-btn-clipboard" id="af-clipboard-btn" title="Map copied text or JSON from your clipboard into this form">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <rect width="8" height="4" x="8" y="2" rx="1" ry="1"></rect>
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
              </svg>
              <span>📋 Paste & Map Clipboard</span>
            </button>
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
            <span class="af-dock-footer-quota" id="af-footer-quota-link" title="Open Settings">${quota.footerText}</span>
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
        const isBypass = this.userPlan === 'Pro Plan' || this.aiProvider !== 'cloud';
        if (!isBypass && this.userPlan !== 'Pro Plan' && this.aiProvider === 'cloud') {
          const errorAlert = this.dockContainer?.querySelector('#af-error-alert') as HTMLDivElement;
          if (errorAlert) {
            errorAlert.style.display = 'flex';
            const errorText = errorAlert.querySelector('.af-error-text');
            if (errorText) {
              errorText.textContent = "Custom instructions require a Pro Plan or personal API key (BYOK).";
            }
          }
          return;
        }
        const container = this.dockContainer?.querySelector('.af-custom-prompt-container');
        if (container) {
          container.classList.toggle('visible');
          if (container.classList.contains('visible')) {
            const input = container.querySelector('.af-custom-prompt-input') as HTMLTextAreaElement;
            input?.focus();
          }
        }
      });

      // Bind Prompt input changes & domain memory button
      const textarea = this.dockContainer.querySelector('.af-custom-prompt-input') as HTMLTextAreaElement;
      if (textarea) {
        textarea.value = this.customPrompts[this.currentPersona] || '';
        textarea.addEventListener('input', (e) => {
          const val = (e.target as HTMLTextAreaElement).value;
          this.customPrompts[this.currentPersona] = val;
        });
      }

      const rememberDomainBtn = this.dockContainer.querySelector('#af-remember-domain-btn');
      rememberDomainBtn?.addEventListener('click', async () => {
        const promptVal = this.customPrompts[this.currentPersona] || '';
        if (!promptVal.trim()) return;
        const isBypass = this.userPlan === 'Pro Plan' || this.aiProvider !== 'cloud';
        const res = await saveDomainPrompt(window.location.hostname, promptVal, this.userPlan, isBypass);
        if (rememberDomainBtn) {
          if (res.success) {
            rememberDomainBtn.textContent = '✓ Saved for site!';
            setTimeout(() => {
              rememberDomainBtn.textContent = '📌 Remember for site';
            }, 2000);
          } else {
            const errorAlert = this.dockContainer?.querySelector('#af-error-alert') as HTMLDivElement;
            if (errorAlert) {
              errorAlert.style.display = 'flex';
              const errorText = errorAlert.querySelector('.af-error-text');
              if (errorText) errorText.textContent = res.error || 'Free tier allows 1 saved site rule. Upgrade to Pro!';
            }
          }
        }
      });

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

      // Undo Button
      const undoBtn = this.dockContainer.querySelector('#af-undo-btn') as HTMLButtonElement;
      undoBtn?.addEventListener('click', () => this.handleUndo());

      // Export Bug Report Button
      const exportReportBtn = this.dockContainer.querySelector('#af-export-report-btn');
      exportReportBtn?.addEventListener('click', async () => {
        chrome.storage.local.get(['lastTestRun'], async (res) => {
          if (res.lastTestRun) {
            const md = generateReportMarkdown(res.lastTestRun as TestRunReportData);
            const success = await copyReportToClipboard(md);
            if (success && exportReportBtn) {
              exportReportBtn.innerHTML = `<span>✓ Copied to clipboard!</span>`;
              setTimeout(() => {
                exportReportBtn.innerHTML = `<span>📋 Bug Report</span>`;
              }, 2500);
            }
          }
        });
      });

      // Clipboard Fill Button
      const clipboardBtn = this.dockContainer.querySelector('#af-clipboard-btn') as HTMLButtonElement;
      clipboardBtn?.addEventListener('click', () => this.handleFillFromClipboard());

      // QA Flavor Pills
      const flavorPills = this.dockContainer.querySelectorAll('.af-qa-flavor-pill');
      flavorPills.forEach(pill => {
        pill.addEventListener('click', (e) => {
          const target = e.currentTarget as HTMLButtonElement;
          const flavor = target.getAttribute('data-flavor') || 'all';
          const isBypass = this.userPlan === 'Pro Plan' || this.aiProvider !== 'cloud';
          if (flavor === 'appsec_pro' && !isBypass && this.userPlan !== 'Pro Plan') {
            const errorAlert = this.dockContainer?.querySelector('#af-error-alert') as HTMLDivElement;
            if (errorAlert) {
              errorAlert.style.display = 'flex';
              const errorText = errorAlert.querySelector('.af-error-text');
              if (errorText) errorText.textContent = "OWASP AppSec Suite requires a Pro Plan or personal API key (BYOK).";
            }
            return;
          }
          this.qaFlavor = flavor;
          chrome.storage.local.set({ lastQaFlavor: flavor });
          this.lastQaFlavor = null;
          this.updateDockState();
        });
      });

      // Quota Navigation Actions
      const openSettings = (targetTab: string = 'account') => {
        chrome.storage.local.set({ activeTabOnOpen: targetTab }, () => {
          chrome.runtime.sendMessage({ action: 'open_options' });
        });
      };

      const quotaPill = this.dockContainer.querySelector('#af-quota-pill-btn');
      quotaPill?.addEventListener('click', () => {
        openSettings(quota.ctaAction === 'upgrade' ? 'subscription' : 'account');
      });

      const quotaCtaBtn = this.dockContainer.querySelector('#af-quota-cta-btn');
      quotaCtaBtn?.addEventListener('click', () => {
        openSettings(quota.ctaAction === 'upgrade' ? 'subscription' : 'account');
      });

      const footerQuotaLink = this.dockContainer.querySelector('#af-footer-quota-link');
      footerQuotaLink?.addEventListener('click', () => {
        openSettings(quota.ctaAction === 'upgrade' ? 'subscription' : 'account');
      });
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
        this.handleFill(request.persona, request.customPrompt, request.qaFlavor)
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

      if (request.action === 'undo_fill') {
        if (this.lastSnapshot && this.lastSnapshot.length > 0) {
          const count = FormScraper.restoreFormSnapshot(this.lastSnapshot);
          this.lastSnapshot = null;
          this.lastSnapshotState = false;
          this.updateDockState();
          sendResponse({ success: true, count });
        } else {
          sendResponse({ success: false, error: 'No undo snapshot available' });
        }
        return true;
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
      if (changes.qaDailyCount) {
        this.qaDailyCount = changes.qaDailyCount.newValue as number || 0;
        needsUpdate = true;
      }

      if (needsUpdate && this.dockContainer) {
        this.lastMinimizedState = null;
        this.lastFieldsCount = null;
        this.updateDockState();
      }
    });
  }

  private clearAllForms() {
    this.lastSnapshot = null;
    this.lastSnapshotState = false;
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

    // Clear multi-step session memory for this domain
    chrome.runtime.sendMessage({ action: 'clear_session_identity', domain: window.location.hostname });

    // Scan dynamic fields
    this.updateDockState();
  }

  private handleUndo() {
    if (!this.lastSnapshot || this.lastSnapshot.length === 0) return;
    FormScraper.restoreFormSnapshot(this.lastSnapshot);
    this.lastSnapshot = null;
    this.lastSnapshotState = false;

    const undoBtn = this.dockContainer?.querySelector('#af-undo-btn') as HTMLButtonElement;
    if (undoBtn) {
      undoBtn.innerHTML = `<span>Restored!</span>`;
      setTimeout(() => {
        this.updateDockState();
      }, 900);
    } else {
      this.updateDockState();
    }
  }

  private async handleFillFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || text.trim().length === 0) {
        const errorAlert = this.dockContainer?.querySelector('#af-error-alert') as HTMLDivElement;
        if (errorAlert) {
          errorAlert.style.display = 'flex';
          const errorText = errorAlert.querySelector('.af-error-text');
          if (errorText) errorText.textContent = "Clipboard is empty! Copy text or JSON first.";
          setTimeout(() => {
            if (errorAlert) errorAlert.style.display = 'none';
          }, 3000);
        }
        return;
      }

      const snippet = text.trim().slice(0, 3500);
      const clipboardPrompt = `MAP DATA FROM CLIPBOARD: Extract and populate matching form fields using the following data from the user's clipboard: """${snippet}"""`;
      await this.handleFill(this.currentPersona, clipboardPrompt);
    } catch {
      const errorAlert = this.dockContainer?.querySelector('#af-error-alert') as HTMLDivElement;
      if (errorAlert) {
        errorAlert.style.display = 'flex';
        const errorText = errorAlert.querySelector('.af-error-text');
        if (errorText) errorText.textContent = "Clipboard permission required or unavailable.";
        setTimeout(() => {
          if (errorAlert) errorAlert.style.display = 'none';
        }, 3000);
      }
    }
  }

  private async handleFill(overridePersona?: string, overridePrompt?: string, overrideQaFlavor?: string) {
    const persona = overridePersona || this.currentPersona;
    const prompt = overridePrompt !== undefined ? overridePrompt : (this.customPrompts[persona] || '');
    const qaFlavor = overrideQaFlavor || this.qaFlavor || 'all';

    const isBypass = this.userPlan === 'Pro Plan' || this.aiProvider !== 'cloud';

    // QA Daily Cap enforcement for non-bypass users
    if (persona === 'qa' && !isBypass) {
      const qaStatus = await this.getQaDailyStatus();
      if (!qaStatus.allowed) {
        this.isLoading = false;
        const errorAlert = this.dockContainer?.querySelector('#af-error-alert') as HTMLDivElement;
        if (errorAlert) {
          errorAlert.style.display = 'flex';
          const errorText = errorAlert.querySelector('.af-error-text');
          if (errorText) {
            errorText.textContent = "Daily free QA limit reached (5/5). Upgrade to Pro or add your own API key in Options!";
          }
        }
        setTimeout(() => {
          this.updateDockState();
        }, 4000);
        return { success: false, error: 'Daily free QA limit reached (5/5). Upgrade to Pro or add your own API key in Options.' };
      }
    }

    this.isLoading = true;

    const fillBtn = this.dockContainer?.querySelector('#af-fill-btn') as HTMLButtonElement;
    const originalText = fillBtn ? fillBtn.innerHTML : '';

    const errorAlert = this.dockContainer?.querySelector('#af-error-alert') as HTMLDivElement;
    if (errorAlert) {
      errorAlert.style.display = 'none';
      const errorText = errorAlert.querySelector('.af-error-text');
      if (errorText) errorText.textContent = '';
    }

    const isLimitReached = !isBypass && persona !== 'qa' && this.aiProvider === 'cloud' && (
      (!this.authToken && this.usageCount >= 10) ||
      (this.authToken && this.userPlan === 'Free Tier' && this.usageCount >= 50)
    );

    if (isLimitReached) {
      if (fillBtn) {
        fillBtn.innerHTML = `<span>Opening Settings...</span>`;
      }
      this.isLoading = false;
      const targetTab = this.authToken ? 'subscription' : 'account';
      chrome.storage.local.set({ activeTabOnOpen: targetTab }, () => {
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
    const pageContext = FormScraper.scrapePageContext();
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
      console.log(`Sending fields to background AI engine. Persona: ${persona}. Domain: ${pageContext.domain}. Prompt instruction length: ${prompt.length}`);

      const response = await new Promise<Record<string, string> | null | undefined>((resolve) => {
        chrome.runtime.sendMessage({
          action: 'generate_data',
          fields: fields,
          pageContext: pageContext,
          persona: persona,
          customPrompt: prompt,
          qaFlavor: qaFlavor
        }, (res) => {
          if (chrome.runtime.lastError) {
            resolve({ error: chrome.runtime.lastError.message || 'Unknown runtime error' });
          } else {
            resolve(res as Record<string, string> | null | undefined);
          }
        });
      });

      if (response && !response.error) {
        // Snapshot current form values before AI fill so user can 1-click Undo anytime
        this.lastSnapshot = FormScraper.snapshotForms();

        const initialFieldIds = new Set(fields.map(f => f.id));
        const totalCount = await this.injectValuesAndCheckDynamicFields(
          response as Record<string, string>,
          initialFieldIds,
          persona,
          prompt
        );

        // Save last test run report for 1-click export
        const reportData: TestRunReportData = {
          url: window.location.href,
          title: document.title || window.location.hostname,
          timestamp: new Date().toLocaleString(),
          persona: persona,
          provider: this.aiProvider,
          qaFlavor: persona === 'qa' ? qaFlavor : undefined,
          fields: fields.map(f => ({
            id: f.id,
            label: f.label || f.name || f.placeholder || f.id,
            name: f.name,
            type: f.type || 'text',
            value: (response as Record<string, string>)[f.id] ?? ''
          }))
        };
        chrome.storage.local.set({ lastTestRun: reportData });

        if (persona === 'qa' && !isBypass) {
          await this.incrementQaDailyCount();
        }

        const totalFillDuration = totalCount * 80;
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

  private async injectValuesAndCheckDynamicFields(
    response: Record<string, string>,
    initialFieldIds: Set<string>,
    persona: string,
    prompt: string
  ): Promise<number> {
    let count = 0;
    const entries = Object.entries(response);

    // Pass 1: Inject initial scraped values
    entries.forEach(([fieldId, value]) => {
      setTimeout(() => {
        injectValue(fieldId, value as string);

        const inputEl = document.querySelector(`[data-autofill-id="${CSS.escape(fieldId)}"]`) ||
          document.getElementById(fieldId) ||
          document.querySelector(`[name="${CSS.escape(fieldId)}"]`);
        if (inputEl) {
          inputEl.classList.add('af-filled-pulse');

          const rect = inputEl.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            const sparkle = document.createElement('span');
            sparkle.className = 'af-sparkle-overlay';
            sparkle.innerHTML = `<svg width="2" height="2" viewBox="0 0 24 24" fill="#ffffff" style="filter: drop-shadow(0 0 5px #6366f1);"><path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z"/></svg>`;
            sparkle.style.top = `${window.scrollY + rect.top + (rect.height / 2) - 8}px`;
            sparkle.style.left = `${window.scrollX + rect.right - 22}px`;
            document.body.appendChild(sparkle);

            setTimeout(() => {
              sparkle.remove();
            }, 1200);
          }

          setTimeout(() => {
            inputEl.classList.remove('af-filled-pulse');
          }, 1500);
        }
      }, count * 80);
      count++;
    });

    const initialFillTime = count * 80;

    // Reactive Settling Window: Wait 350ms for framework DOM updates (React/Vue/Angular state updates)
    await new Promise(resolve => setTimeout(resolve, initialFillTime + 350));

    // Pass 2: Re-scan DOM for newly spawned dynamic conditional fields
    const currentFields = FormScraper.scrapeForms();
    const newFields = currentFields.filter(f => !initialFieldIds.has(f.id));

    if (newFields.length > 0) {
      console.log(`[AutoFill AI] Detected ${newFields.length} newly rendered dynamic conditional fields after Pass 1 injection! Running Pass 2 reactive fill...`);

      const updatedPageContext = FormScraper.scrapePageContext();

      const parentSelections: string[] = [];
      entries.forEach(([id, val]) => {
        if (val && typeof val === 'string' && val.length < 60) {
          parentSelections.push(`${id}: "${val}"`);
        }
      });

      const secondaryCustomPrompt = (prompt ? prompt + "\n" : "") +
        `PARENT SELECTIONS MADE IN PASS 1: [${parentSelections.join(', ')}]. Fill newly rendered conditional fields to match these selections.`;

      const secondaryResponse = await new Promise<Record<string, string> | null | undefined>((resolve) => {
        chrome.runtime.sendMessage({
          action: 'generate_data',
          fields: newFields,
          pageContext: updatedPageContext,
          persona: persona,
          customPrompt: secondaryCustomPrompt
        }, (res) => {
          if (chrome.runtime.lastError) resolve(null);
          else resolve(res as Record<string, string> | null | undefined);
        });
      });

      if (secondaryResponse && !secondaryResponse.error) {
        let secondCount = 0;
        Object.entries(secondaryResponse).forEach(([fieldId, value]) => {
          setTimeout(() => {
            injectValue(fieldId, value as string);

            const inputEl = document.querySelector(`[data-autofill-id="${CSS.escape(fieldId)}"]`) ||
              document.getElementById(fieldId) ||
              document.querySelector(`[name="${CSS.escape(fieldId)}"]`);
            if (inputEl) {
              inputEl.classList.add('af-filled-pulse');
              setTimeout(() => {
                inputEl.classList.remove('af-filled-pulse');
              }, 1500);
            }
          }, secondCount * 80);
          secondCount++;
        });
        count += secondCount;
      }
    }

    return count;
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

  private async getQaDailyStatus(): Promise<{ count: number; remaining: number; allowed: boolean }> {
    return new Promise((resolve) => {
      chrome.storage.local.get(['qaDailyCount', 'qaLastDate'], (res) => {
        const today = new Date().toISOString().slice(0, 10);
        let count = typeof res.qaDailyCount === 'number' ? res.qaDailyCount : 0;
        const lastDate = typeof res.qaLastDate === 'string' ? res.qaLastDate : '';

        if (lastDate !== today) {
          count = 0;
          chrome.storage.local.set({ qaDailyCount: 0, qaLastDate: today });
        }

        const limit = 5;
        this.qaDailyCount = count;
        resolve({
          count,
          remaining: Math.max(0, limit - count),
          allowed: count < limit
        });
      });
    });
  }

  private async incrementQaDailyCount(): Promise<number> {
    return new Promise((resolve) => {
      chrome.storage.local.get(['qaDailyCount', 'qaLastDate'], (res) => {
        const today = new Date().toISOString().slice(0, 10);
        let count = typeof res.qaDailyCount === 'number' ? res.qaDailyCount : 0;
        const lastDate = typeof res.qaLastDate === 'string' ? res.qaLastDate : '';

        if (lastDate !== today) {
          count = 0;
        }
        count += 1;
        this.qaDailyCount = count;
        chrome.storage.local.set({ qaDailyCount: count, qaLastDate: today }, () => {
          resolve(count);
        });
      });
    });
  }

  private destroy() {
    if (this.cleanupListeners) {
      this.cleanupListeners();
      this.cleanupListeners = null;
    }
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
