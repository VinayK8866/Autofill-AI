import { FormScraper, injectValue } from './scraper';
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
  private observer: MutationObserver | null = null;
  private usageCount: number = 0;
  private userPlan: string = 'Free Tier';
  private authToken: string = '';
  private aiProvider: string = 'cloud';
  private hasProfile: boolean = false;
  private isLoading: boolean = false;
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
          <svg xmlns="http://www.w3.org/2000/svg" width="30" height="29" viewBox="0 0 48 46" fill="none">
            <path fill="#863bff" d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"/>
            <mask id="af-bubble-mask-a" width="48" height="46" x="0" y="0" maskUnits="userSpaceOnUse" style="mask-type:alpha">
              <path fill="#000" d="M25.842 44.938c-.664.844-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.183c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.498 0-3.579-1.842-3.579H1.133c-.92 0-1.456-1.04-.92-1.787L9.91.473c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.578 1.842 3.578h11.377c.943 0 1.473 1.088.89 1.832L25.843 44.94z"/>
            </mask>
            <g mask="url(#af-bubble-mask-a)">
              <g filter="url(#af-bubble-filter-b)">
                <ellipse cx="5.508" cy="14.704" fill="#ede6ff" rx="5.508" ry="14.704" transform="matrix(.00324 1 1 -.00324 -4.47 31.516)"/>
              </g>
              <g filter="url(#af-bubble-filter-c)">
                <ellipse cx="10.399" cy="29.851" fill="#ede6ff" rx="10.399" ry="29.851" transform="matrix(.00324 1 1 -.00324 -39.328 7.883)"/>
              </g>
              <g filter="url(#af-bubble-filter-d)">
                <ellipse cx="5.508" cy="30.487" fill="#7e14ff" rx="5.508" ry="30.487" transform="rotate(89.814 -25.913 -14.639)scale(1 -1)"/>
              </g>
              <g filter="url(#af-bubble-filter-e)">
                <ellipse cx="5.508" cy="30.599" fill="#7e14ff" rx="5.508" ry="30.599" transform="rotate(89.814 -32.644 -3.334)scale(1 -1)"/>
              </g>
              <g filter="url(#af-bubble-filter-f)">
                <ellipse cx="5.508" cy="30.599" fill="#7e14ff" rx="5.508" ry="30.599" transform="matrix(.00324 1 1 -.00324 -34.34 30.47)"/>
              </g>
              <g filter="url(#af-bubble-filter-g)">
                <ellipse cx="14.072" cy="22.078" fill="#ede6ff" rx="14.072" ry="22.078" transform="rotate(93.35 24.506 48.493)scale(-1 1)"/>
              </g>
              <g filter="url(#af-bubble-filter-h)">
                <ellipse cx="3.47" cy="21.501" fill="#7e14ff" rx="3.47" ry="21.501" transform="rotate(89.009 28.708 47.59)scale(-1 1)"/>
              </g>
              <g filter="url(#af-bubble-filter-i)">
                <ellipse cx="3.47" cy="21.501" fill="#7e14ff" rx="3.47" ry="21.501" transform="rotate(89.009 28.708 47.59)scale(-1 1)"/>
              </g>
              <g filter="url(#af-bubble-filter-j)">
                <ellipse cx=".387" cy="8.972" fill="#7e14ff" rx="4.407" ry="29.108" transform="rotate(39.51 .387 8.972)"/>
              </g>
              <g filter="url(#af-bubble-filter-k)">
                <ellipse cx="47.523" cy="-6.092" fill="#7e14ff" rx="4.407" ry="29.108" transform="rotate(37.892 47.523 -6.092)"/>
              </g>
              <g filter="url(#af-bubble-filter-l)">
                <ellipse cx="41.412" cy="6.333" fill="#47bfff" rx="5.971" ry="9.665" transform="rotate(37.892 41.412 6.333)"/>
              </g>
              <g filter="url(#af-bubble-filter-m)">
                <ellipse cx="-1.879" cy="38.332" fill="#7e14ff" rx="4.407" ry="29.108" transform="rotate(37.892 -1.88 38.332)"/>
              </g>
              <g filter="url(#af-bubble-filter-n)">
                <ellipse cx="-1.879" cy="38.332" fill="#7e14ff" rx="4.407" ry="29.108" transform="rotate(37.892 -1.88 38.332)"/>
              </g>
              <g filter="url(#af-bubble-filter-o)">
                <ellipse cx="35.651" cy="29.907" fill="#7e14ff" rx="4.407" ry="29.108" transform="rotate(37.892 35.651 29.907)"/>
              </g>
              <g filter="url(#af-bubble-filter-p)">
                <ellipse cx="38.418" cy="32.4" fill="#47bfff" rx="5.971" ry="15.297" transform="rotate(37.892 38.418 32.4)"/>
              </g>
            </g>
            <defs>
              <filter id="af-bubble-filter-b" width="60.045" height="41.654" x="-19.77" y="16.149" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse">
                <feFlood flood-opacity="0" result="BackgroundImageFix"/>
                <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                <feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="7.659"/>
              </filter>
              <filter id="af-bubble-filter-c" width="90.34" height="51.437" x="-54.613" y="-7.533" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse">
                <feFlood flood-opacity="0" result="BackgroundImageFix"/>
                <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                <feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="7.659"/>
              </filter>
              <filter id="af-bubble-filter-d" width="79.355" height="29.4" x="-49.64" y="2.03" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse">
                <feFlood flood-opacity="0" result="BackgroundImageFix"/>
                <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                <feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/>
              </filter>
              <filter id="af-bubble-filter-e" width="79.579" height="29.4" x="-45.045" y="20.029" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse">
                <feFlood flood-opacity="0" result="BackgroundImageFix"/>
                <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                <feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/>
              </filter>
              <filter id="af-bubble-filter-f" width="79.579" height="29.4" x="-43.513" y="21.178" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse">
                <feFlood flood-opacity="0" result="BackgroundImageFix"/>
                <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                <feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/>
              </filter>
              <filter id="af-bubble-filter-g" width="74.749" height="58.852" x="15.756" y="-17.901" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse">
                <feFlood flood-opacity="0" result="BackgroundImageFix"/>
                <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                <feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="7.659"/>
              </filter>
              <filter id="af-bubble-filter-h" width="61.377" height="25.362" x="23.548" y="2.284" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse">
                <feFlood flood-opacity="0" result="BackgroundImageFix"/>
                <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                <feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/>
              </filter>
              <filter id="af-bubble-filter-i" width="61.377" height="25.362" x="23.548" y="2.284" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse">
                <feFlood flood-opacity="0" result="BackgroundImageFix"/>
                <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                <feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/>
              </filter>
              <filter id="af-bubble-filter-j" width="56.045" height="63.649" x="-27.636" y="-22.853" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse">
                <feFlood flood-opacity="0" result="BackgroundImageFix"/>
                <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                <feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/>
              </filter>
              <filter id="af-bubble-filter-k" width="54.814" height="64.646" x="20.116" y="-38.415" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse">
                <feFlood flood-opacity="0" result="BackgroundImageFix"/>
                <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                <feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/>
              </filter>
              <filter id="af-bubble-filter-l" width="33.541" height="35.313" x="24.641" y="-11.323" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse">
                <feFlood flood-opacity="0" result="BackgroundImageFix"/>
                <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                <feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/>
              </filter>
              <filter id="af-bubble-filter-m" width="54.814" height="64.646" x="-29.286" y="6.009" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse">
                <feFlood flood-opacity="0" result="BackgroundImageFix"/>
                <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                <feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/>
              </filter>
              <filter id="af-bubble-filter-n" width="54.814" height="64.646" x="-29.286" y="6.009" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse">
                <feFlood flood-opacity="0" result="BackgroundImageFix"/>
                <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                <feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/>
              </filter>
              <filter id="af-bubble-filter-o" width="54.814" height="64.646" x="8.244" y="-2.416" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse">
                <feFlood flood-opacity="0" result="BackgroundImageFix"/>
                <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                <feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/>
              </filter>
              <filter id="af-bubble-filter-p" width="39.409" height="43.623" x="18.713" y="10.588" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse">
                <feFlood flood-opacity="0" result="BackgroundImageFix"/>
                <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                <feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/>
              </filter>
            </defs>
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
        (!this.authToken && this.usageCount >= 10) ||
        (this.authToken && this.userPlan === 'Free Tier' && this.usageCount >= 50)
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
      }

      this.dockContainer.innerHTML = `
        <div class="af-dock-panel">
          <!-- Header -->
          <div class="af-dock-header">
            <div class="af-dock-brand">
              <div class="af-dock-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="19" viewBox="0 0 48 46" fill="none">
                  <path fill="#863bff" d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"/>
                  <mask id="af-hdr-mask-a" width="48" height="46" x="0" y="0" maskUnits="userSpaceOnUse" style="mask-type:alpha">
                    <path fill="#000" d="M25.842 44.938c-.664.844-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.183c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.498 0-3.579-1.842-3.579H1.133c-.92 0-1.456-1.04-.92-1.787L9.91.473c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.578 1.842 3.578h11.377c.943 0 1.473 1.088.89 1.832L25.843 44.94z"/>
                  </mask>
                  <g mask="url(#af-hdr-mask-a)">
                    <g filter="url(#af-hdr-filter-b)">
                      <ellipse cx="5.508" cy="14.704" fill="#ede6ff" rx="5.508" ry="14.704" transform="matrix(.00324 1 1 -.00324 -4.47 31.516)"/>
                    </g>
                    <g filter="url(#af-hdr-filter-c)">
                      <ellipse cx="10.399" cy="29.851" fill="#ede6ff" rx="10.399" ry="29.851" transform="matrix(.00324 1 1 -.00324 -39.328 7.883)"/>
                    </g>
                    <g filter="url(#af-hdr-filter-d)">
                      <ellipse cx="5.508" cy="30.487" fill="#7e14ff" rx="5.508" ry="30.487" transform="rotate(89.814 -25.913 -14.639)scale(1 -1)"/>
                    </g>
                    <g filter="url(#af-hdr-filter-e)">
                      <ellipse cx="5.508" cy="30.599" fill="#7e14ff" rx="5.508" ry="30.599" transform="rotate(89.814 -32.644 -3.334)scale(1 -1)"/>
                    </g>
                    <g filter="url(#af-hdr-filter-f)">
                      <ellipse cx="5.508" cy="30.599" fill="#7e14ff" rx="5.508" ry="30.599" transform="matrix(.00324 1 1 -.00324 -34.34 30.47)"/>
                    </g>
                    <g filter="url(#af-hdr-filter-g)">
                      <ellipse cx="14.072" cy="22.078" fill="#ede6ff" rx="14.072" ry="22.078" transform="rotate(93.35 24.506 48.493)scale(-1 1)"/>
                    </g>
                    <g filter="url(#af-hdr-filter-h)">
                      <ellipse cx="3.47" cy="21.501" fill="#7e14ff" rx="3.47" ry="21.501" transform="rotate(89.009 28.708 47.59)scale(-1 1)"/>
                    </g>
                    <g filter="url(#af-hdr-filter-i)">
                      <ellipse cx="3.47" cy="21.501" fill="#7e14ff" rx="3.47" ry="21.501" transform="rotate(89.009 28.708 47.59)scale(-1 1)"/>
                    </g>
                    <g filter="url(#af-hdr-filter-j)">
                      <ellipse cx=".387" cy="8.972" fill="#7e14ff" rx="4.407" ry="29.108" transform="rotate(39.51 .387 8.972)"/>
                    </g>
                    <g filter="url(#af-hdr-filter-k)">
                      <ellipse cx="47.523" cy="-6.092" fill="#7e14ff" rx="4.407" ry="29.108" transform="rotate(37.892 47.523 -6.092)"/>
                    </g>
                    <g filter="url(#af-hdr-filter-l)">
                      <ellipse cx="41.412" cy="6.333" fill="#47bfff" rx="5.971" ry="9.665" transform="rotate(37.892 41.412 6.333)"/>
                    </g>
                    <g filter="url(#af-hdr-filter-m)">
                      <ellipse cx="-1.879" cy="38.332" fill="#7e14ff" rx="4.407" ry="29.108" transform="rotate(37.892 -1.88 38.332)"/>
                    </g>
                    <g filter="url(#af-hdr-filter-n)">
                      <ellipse cx="-1.879" cy="38.332" fill="#7e14ff" rx="4.407" ry="29.108" transform="rotate(37.892 -1.88 38.332)"/>
                    </g>
                    <g filter="url(#af-hdr-filter-o)">
                      <ellipse cx="35.651" cy="29.907" fill="#7e14ff" rx="4.407" ry="29.108" transform="rotate(37.892 35.651 29.907)"/>
                    </g>
                    <g filter="url(#af-hdr-filter-p)">
                      <ellipse cx="38.418" cy="32.4" fill="#47bfff" rx="5.971" ry="15.297" transform="rotate(37.892 38.418 32.4)"/>
                    </g>
                  </g>
                  <defs>
                    <filter id="af-hdr-filter-b" width="60.045" height="41.654" x="-19.77" y="16.149" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse">
                      <feFlood flood-opacity="0" result="BackgroundImageFix"/>
                      <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                      <feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="7.659"/>
                    </filter>
                    <filter id="af-hdr-filter-c" width="90.34" height="51.437" x="-54.613" y="-7.533" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse">
                      <feFlood flood-opacity="0" result="BackgroundImageFix"/>
                      <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                      <feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="7.659"/>
                    </filter>
                    <filter id="af-hdr-filter-d" width="79.355" height="29.4" x="-49.64" y="2.03" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse">
                      <feFlood flood-opacity="0" result="BackgroundImageFix"/>
                      <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                      <feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/>
                    </filter>
                    <filter id="af-hdr-filter-e" width="79.579" height="29.4" x="-45.045" y="20.029" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse">
                      <feFlood flood-opacity="0" result="BackgroundImageFix"/>
                      <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                      <feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/>
                    </filter>
                    <filter id="af-hdr-filter-f" width="79.579" height="29.4" x="-43.513" y="21.178" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse">
                      <feFlood flood-opacity="0" result="BackgroundImageFix"/>
                      <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                      <feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/>
                    </filter>
                    <filter id="af-hdr-filter-g" width="74.749" height="58.852" x="15.756" y="-17.901" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse">
                      <feFlood flood-opacity="0" result="BackgroundImageFix"/>
                      <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                      <feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="7.659"/>
                    </filter>
                    <filter id="af-hdr-filter-h" width="61.377" height="25.362" x="23.548" y="2.284" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse">
                      <feFlood flood-opacity="0" result="BackgroundImageFix"/>
                      <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                      <feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/>
                    </filter>
                    <filter id="af-hdr-filter-i" width="61.377" height="25.362" x="23.548" y="2.284" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse">
                      <feFlood flood-opacity="0" result="BackgroundImageFix"/>
                      <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                      <feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/>
                    </filter>
                    <filter id="af-hdr-filter-j" width="56.045" height="63.649" x="-27.636" y="-22.853" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse">
                      <feFlood flood-opacity="0" result="BackgroundImageFix"/>
                      <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                      <feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/>
                    </filter>
                    <filter id="af-hdr-filter-k" width="54.814" height="64.646" x="20.116" y="-38.415" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse">
                      <feFlood flood-opacity="0" result="BackgroundImageFix"/>
                      <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                      <feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/>
                    </filter>
                    <filter id="af-hdr-filter-l" width="33.541" height="35.313" x="24.641" y="-11.323" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse">
                      <feFlood flood-opacity="0" result="BackgroundImageFix"/>
                      <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                      <feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/>
                    </filter>
                    <filter id="af-hdr-filter-m" width="54.814" height="64.646" x="-29.286" y="6.009" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse">
                      <feFlood flood-opacity="0" result="BackgroundImageFix"/>
                      <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                      <feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/>
                    </filter>
                    <filter id="af-hdr-filter-n" width="54.814" height="64.646" x="-29.286" y="6.009" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse">
                      <feFlood flood-opacity="0" result="BackgroundImageFix"/>
                      <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                      <feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/>
                    </filter>
                    <filter id="af-hdr-filter-o" width="54.814" height="64.646" x="8.244" y="-2.416" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse">
                      <feFlood flood-opacity="0" result="BackgroundImageFix"/>
                      <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                      <feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/>
                    </filter>
                    <filter id="af-hdr-filter-p" width="39.409" height="43.623" x="18.713" y="10.588" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse">
                      <feFlood flood-opacity="0" result="BackgroundImageFix"/>
                      <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                      <feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/>
                    </filter>
                  </defs>
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
          
          if ((persona === 'qa' || persona === 'b2b') && this.userPlan !== 'Pro Plan') {
            const errorAlert = this.dockContainer?.querySelector('#af-error-alert') as HTMLDivElement;
            if (errorAlert) {
              errorAlert.style.display = 'flex';
              const errorText = errorAlert.querySelector('.af-error-text');
              if (errorText) {
                errorText.textContent = "QA and B2B personas require a Pro Plan.";
              }
            }
            return;
          }
          
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
        if (this.userPlan !== 'Pro Plan') {
          const errorAlert = this.dockContainer?.querySelector('#af-error-alert') as HTMLDivElement;
          if (errorAlert) {
            errorAlert.style.display = 'flex';
            const errorText = errorAlert.querySelector('.af-error-text');
            if (errorText) {
              errorText.textContent = "Custom instructions require a Pro Plan.";
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

    if ((persona === 'qa' || persona === 'b2b' || prompt) && this.userPlan !== 'Pro Plan') {
      this.isLoading = false;
      const errorAlert = this.dockContainer?.querySelector('#af-error-alert') as HTMLDivElement;
      if (errorAlert) {
        errorAlert.style.display = 'flex';
        const errorText = errorAlert.querySelector('.af-error-text');
        if (errorText) {
          errorText.textContent = "Pro Plan required for advanced options.";
        }
      }
      setTimeout(() => {
        this.updateDockState();
      }, 3000);
      return { success: false, error: 'Pro Plan required for advanced options' };
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

    const isLimitReached = this.aiProvider === 'cloud' && (
      (!this.authToken && this.usageCount >= 10) ||
      (this.authToken && this.userPlan === 'Free Tier' && this.usageCount >= 50)
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
        // Inject values sequentially with dynamic wave glow pulses
        let count = 0;
        Object.entries(response).forEach(([fieldId, value]) => {
          setTimeout(() => {
            injectValue(fieldId, value as string);

            // Add wave pulse styling to show fill activity
            const inputEl = document.querySelector(`[data-autofill-id="${CSS.escape(fieldId)}"]`) ||
                            document.getElementById(fieldId) || 
                            document.querySelector(`[name="${CSS.escape(fieldId)}"]`);
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
