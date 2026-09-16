export interface DomainRule {
  domain: string;
  prompt: string;
  updatedAt: number;
}

/**
 * Normalizes hostnames by stripping www. and lowercasing
 */
export function normalizeDomain(rawDomain: string): string {
  try {
    let domain = rawDomain.trim().toLowerCase();
    if (domain.startsWith('http://') || domain.startsWith('https://')) {
      domain = new URL(domain).hostname;
    }
    if (domain.startsWith('www.')) {
      domain = domain.substring(4);
    }
    return domain;
  } catch {
    return rawDomain.toLowerCase().replace(/^www\./, '');
  }
}

/**
 * Retrieves the saved custom prompt for a specific domain.
 */
export async function getDomainPrompt(rawDomain: string): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      resolve(null);
      return;
    }

    const domain = normalizeDomain(rawDomain);
    if (!domain) {
      resolve(null);
      return;
    }

    chrome.storage.local.get(['domainPrompts'], (result) => {
      const map = (result.domainPrompts || {}) as Record<string, DomainRule>;
      resolve(map[domain]?.prompt || null);
    });
  });
}

/**
 * Saves a custom prompt for a specific domain.
 * Free tier allows 1 saved site rule. Pro Plan & BYOK allow unlimited.
 */
export async function saveDomainPrompt(
  rawDomain: string,
  prompt: string,
  userPlan: string,
  isBypass: boolean
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      resolve({ success: false, error: 'Storage unavailable' });
      return;
    }

    const domain = normalizeDomain(rawDomain);
    if (!domain) {
      resolve({ success: false, error: 'Invalid domain' });
      return;
    }

    chrome.storage.local.get(['domainPrompts'], (result) => {
      const map = (result.domainPrompts || {}) as Record<string, DomainRule>;
      const existingKeys = Object.keys(map);
      const isExisting = Boolean(map[domain]);

      // If it's a new domain and user is on Free Tier without BYOK
      const isProOrBypass = userPlan === 'Pro Plan' || isBypass;
      if (!isExisting && !isProOrBypass && existingKeys.length >= 1) {
        resolve({
          success: false,
          error: 'Free tier allows 1 saved site rule. Upgrade to Pro for unlimited site memory!'
        });
        return;
      }

      const updatedMap = {
        ...map,
        [domain]: {
          domain,
          prompt: prompt.trim(),
          updatedAt: Date.now()
        }
      };

      chrome.storage.local.set({ domainPrompts: updatedMap }, () => {
        resolve({ success: true });
      });
    });
  });
}

/**
 * Deletes a saved domain prompt.
 */
export async function deleteDomainPrompt(rawDomain: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      resolve();
      return;
    }

    const domain = normalizeDomain(rawDomain);
    chrome.storage.local.get(['domainPrompts'], (result) => {
      const map = (result.domainPrompts || {}) as Record<string, DomainRule>;
      delete map[domain];
      chrome.storage.local.set({ domainPrompts: map }, () => {
        resolve();
      });
    });
  });
}

/**
 * Returns all saved domain rules sorted by most recently updated.
 */
export async function getAllDomainPrompts(): Promise<DomainRule[]> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      resolve([]);
      return;
    }

    chrome.storage.local.get(['domainPrompts'], (result) => {
      const map = (result.domainPrompts || {}) as Record<string, DomainRule>;
      const list = Object.values(map).sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(list);
    });
  });
}
