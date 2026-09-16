import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, SchemaType } from "@google/generative-ai";
import type { Schema } from "@google/generative-ai";
import type { FormField, PageContext } from "../content/scraper";
import { QAGenerator, type QAFlavor } from "../lib/qaGenerator";
import { ENV } from "../config/env";

console.log('⚡ Filli AI Background Service Worker Initializing...');

// Add a context menu for quick fills
chrome.runtime.onInstalled.addListener((details) => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "autofill-magic",
      title: "⚡ Filli AI",
      contexts: ["editable", "page"]
    });
    
    chrome.contextMenus.create({
      parentId: "autofill-magic",
      id: "fill-default",
      title: "Fill Form (Realistic Persona)",
      contexts: ["editable", "page"]
    });
    
    chrome.contextMenus.create({
      parentId: "autofill-magic",
      id: "fill-profile",
      title: "Fill Form (My Real Profile)",
      contexts: ["editable", "page"]
    });

    chrome.contextMenus.create({
      parentId: "autofill-magic",
      id: "fill-qa",
      title: "Fill Form (QA Edge Cases)",
      contexts: ["editable", "page"]
    });

    chrome.contextMenus.create({
      parentId: "autofill-magic",
      id: "fill-b2b",
      title: "Fill Form (B2B Enterprise Profile)",
      contexts: ["editable", "page"]
    });
  });

  if (details.reason === 'install') {
    chrome.storage.sync.get(['hasSeenWelcome', 'onboardingCompleted'], (syncRes) => {
      chrome.storage.local.get(['hasSeenWelcome', 'onboardingCompleted'], (localRes) => {
        const alreadySeen = syncRes?.hasSeenWelcome || syncRes?.onboardingCompleted || localRes?.hasSeenWelcome || localRes?.onboardingCompleted;
        if (!alreadySeen) {
          chrome.storage.sync.set({ hasSeenWelcome: true });
          chrome.storage.local.set({ hasSeenWelcome: true });
          chrome.tabs.create({ url: 'options.html?onboarding=true' });
        } else {
          console.log('[Filli AI] Extension installed via Google Account sync on secondary device. Suppressing welcome tab.');
        }
      });
    });
  }
});

// Trigger fill via context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id || tab.id < 0) return;
  
  let persona = 'default';
  if (info.menuItemId === 'fill-profile') persona = 'profile';
  if (info.menuItemId === 'fill-qa') persona = 'qa';
  if (info.menuItemId === 'fill-b2b') persona = 'b2b';

  chrome.tabs.sendMessage(tab.id, { 
    action: 'trigger_fill_with_persona', 
    persona: persona 
  });
});

// Primary message router
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'ping') {
    sendResponse({ status: 'alive' });
    return true;
  }

  if (request.action === 'open_options') {
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
    return false;
  }

  if (request.action === 'sync_usage') {
    (async () => {
      try {
        const stored = await chrome.storage.local.get(['authToken', 'aiProvider', 'anonymousClientId']);
        if (stored.aiProvider && stored.aiProvider !== 'cloud') {
          sendResponse({ success: true, aiProvider: stored.aiProvider });
          return;
        }
        const anonId = await getOrCreateAnonymousClientId();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (stored.authToken) {
          headers['Authorization'] = `Bearer ${stored.authToken}`;
        } else {
          headers['X-Anonymous-Client-Id'] = anonId;
        }
        const res = await fetch(`${ENV.CLOUD_PROXY_URL}/usage`, { method: 'POST', headers });
        if (res.ok) {
          const data = await res.json();
          if (typeof data.usageCount === 'number') {
            await chrome.storage.local.set({
              usageCount: data.usageCount,
              ...(data.userPlan ? { userPlan: data.userPlan } : {})
            });
            sendResponse({ success: true, usageCount: data.usageCount, userPlan: data.userPlan });
            return;
          }
        }
      } catch (err) {
        console.warn('Could not sync usage in background:', err);
      }
      sendResponse({ success: false });
    })();
    return true;
  }

  // Route popup request directly to the tab content script's helper
  if (request.action === 'broadcast_fill' && typeof request.tabId === 'number' && request.tabId >= 0) {
    chrome.storage.local.get(['profileFirstName', 'profileLastName', 'profileEmail'], (result: Record<string, string | number | boolean | undefined>) => {
      const hasProfile = !!(result.profileFirstName || result.profileLastName || result.profileEmail);
      const defaultPersona = hasProfile ? 'profile' : 'default';
      chrome.tabs.sendMessage(request.tabId!, { 
        action: 'trigger_fill', 
        persona: request.persona || defaultPersona,
        customPrompt: request.customPrompt || '',
        qaFlavor: request.qaFlavor || 'all'
      }, (response: { success?: boolean; error?: string } | undefined) => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: "No fields detected" });
        } else {
          sendResponse(response || { success: false, error: "No response from page script" });
        }
      });
    });
    return true;
  }

  if (request.action === 'generate_data') {
    handleGenerateData(request.fields, request.persona || 'default', request.customPrompt || '', request.pageContext, request.qaFlavor)
      .then(sendResponse)
      .catch(err => {
        console.warn("AI Generation failed:", err);
        sendResponse({ error: err.message || 'Generation failed' });
      });
    return true;
  }

  if (request.action === 'clear_session_identity') {
    const domain = (request.domain || '').toLowerCase().replace(/^www\./, '');
    if (domain) sessionIdentities.delete(domain);
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'test_connection') {
    handleTestConnection(request.provider, request.key, request.proxyUrl)
      .then(msg => sendResponse({ success: true, message: msg }))
      .catch(err => sendResponse({ success: false, error: err.message || String(err) }));
    return true;
  }
});

interface CoherentLocation {
  city: string;
  state: string;
  stateCode: string;
  zip: string;
  country: string;
  countryCode: string;
  street: string;
}

const COHERENT_LOCATIONS: CoherentLocation[] = [
  { city: "Austin", state: "Texas", stateCode: "TX", zip: "78701", country: "United States", countryCode: "US", street: "401 Congress Ave, Suite 1500" },
  { city: "Seattle", state: "Washington", stateCode: "WA", zip: "98101", country: "United States", countryCode: "US", street: "1201 3rd Ave" },
  { city: "New York", state: "New York", stateCode: "NY", zip: "10001", country: "United States", countryCode: "US", street: "350 5th Ave" },
  { city: "San Francisco", state: "California", stateCode: "CA", zip: "94105", country: "United States", countryCode: "US", street: "415 Mission St" },
  { city: "Chicago", state: "Illinois", stateCode: "IL", zip: "60601", country: "United States", countryCode: "US", street: "233 S Wacker Dr" },
  { city: "London", state: "Greater London", stateCode: "ENG", zip: "SW1A 1AA", country: "United Kingdom", countryCode: "GB", street: "10 Downing Street" },
  { city: "Toronto", state: "Ontario", stateCode: "ON", zip: "M5V 2T6", country: "Canada", countryCode: "CA", street: "290 Bremner Blvd" },
  { city: "Paris", state: "Île-de-France", stateCode: "IDF", zip: "75001", country: "France", countryCode: "FR", street: "1 Rue de Rivoli" },
  { city: "Berlin", state: "Berlin", stateCode: "BE", zip: "10117", country: "Germany", countryCode: "DE", street: "Unter den Linden 77" },
  { city: "Tokyo", state: "Tokyo", stateCode: "13", zip: "100-0001", country: "Japan", countryCode: "JP", street: "1-1 Chiyoda" },
  { city: "Bangalore", state: "Karnataka", stateCode: "KA", zip: "560001", country: "India", countryCode: "IN", street: "1 Mahatma Gandhi Rd" },
  { city: "Sydney", state: "New South Wales", stateCode: "NSW", zip: "2000", country: "Australia", countryCode: "AU", street: "100 George St" }
];

interface SessionIdentity {
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  company: string;
  jobTitle: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  street: string;
  website: string;
  createdAt: number;
}

const sessionIdentities = new Map<string, SessionIdentity>();

function updateSessionIdentityFromResults(domain: string, normalized: Record<string, string>, fields: FormField[]) {
  const existing = sessionIdentities.get(domain) || {
    firstName: '',
    lastName: '',
    fullName: '',
    email: '',
    phone: '',
    company: '',
    jobTitle: '',
    city: '',
    state: '',
    zip: '',
    country: '',
    street: '',
    website: '',
    createdAt: Date.now()
  };

  for (const f of fields) {
    const val = (normalized[f.id] || '').trim();
    if (!val) continue;

    const label = (f.label || '').toLowerCase();
    const name = (f.name || '').toLowerCase();
    const type = (f.type || '').toLowerCase();

    if (type === 'email' || label.includes('email')) existing.email = val;
    else if (type === 'tel' || label.includes('phone')) existing.phone = val;
    else if (label.includes('first') && label.includes('name')) existing.firstName = val;
    else if (label.includes('last') && label.includes('name')) existing.lastName = val;
    else if (label === 'name' || label === 'full name' || name === 'name') existing.fullName = val;
    else if (label.includes('company')) existing.company = val;
    else if (label.includes('job') || label.includes('title') || label.includes('role')) existing.jobTitle = val;
    else if (label.includes('city')) existing.city = val;
    else if (label.includes('state') || label.includes('province')) existing.state = val;
    else if (label.includes('zip') || label.includes('postal')) existing.zip = val;
    else if (label.includes('country')) existing.country = val;
    else if (label.includes('street') || label.includes('address')) existing.street = val;
    else if (type === 'url' || label.includes('website')) existing.website = val;
  }

  if (!existing.fullName && existing.firstName && existing.lastName) {
    existing.fullName = `${existing.firstName} ${existing.lastName}`;
  }

  existing.createdAt = Date.now();
  sessionIdentities.set(domain, existing);
}

function enforceAddressCoherence(normalized: Record<string, string>, fields: FormField[]) {
  let cityField: FormField | undefined;
  let stateField: FormField | undefined;
  let zipField: FormField | undefined;
  let countryField: FormField | undefined;
  let streetField: FormField | undefined;

  for (const f of fields) {
    const label = (f.label || '').toLowerCase();
    const name = (f.name || '').toLowerCase();
    const id = (f.id || '').toLowerCase();
    const type = (f.type || '').toLowerCase();

    if (type === 'hidden' || type === 'submit') continue;

    if (label.includes('city') || name.includes('city') || id.includes('city')) {
      cityField = f;
    } else if (label.includes('state') || label.includes('province') || label.includes('region') || name.includes('state') || id.includes('state')) {
      stateField = f;
    } else if (label.includes('zip') || label.includes('postal') || label.includes('postcode') || name.includes('zip') || id.includes('postal')) {
      zipField = f;
    } else if (label.includes('country') || name.includes('country') || id.includes('country')) {
      countryField = f;
    } else if (label.includes('street') || label.includes('address 1') || label.includes('address line 1') || name.includes('address1') || id.includes('street')) {
      streetField = f;
    }
  }

  if (!cityField && !stateField && !zipField) return;

  const currentCity = cityField ? (normalized[cityField.id] || '').trim().toLowerCase() : '';
  const currentState = stateField ? (normalized[stateField.id] || '').trim().toLowerCase() : '';

  let matchedLoc = COHERENT_LOCATIONS.find(loc => loc.city.toLowerCase() === currentCity);
  if (!matchedLoc && currentState) {
    matchedLoc = COHERENT_LOCATIONS.find(loc => 
      loc.state.toLowerCase().includes(currentState) || 
      loc.stateCode.toLowerCase() === currentState
    );
  }
  if (!matchedLoc) {
    matchedLoc = COHERENT_LOCATIONS[0]; // Default to Austin, TX
  }

  if (cityField && (!normalized[cityField.id] || normalized[cityField.id].trim() === '')) {
    normalized[cityField.id] = matchedLoc.city;
  }

  if (stateField) {
    const options = stateField.options || [];
    const useCode = options.some(opt => opt.trim().toUpperCase() === matchedLoc.stateCode);
    normalized[stateField.id] = useCode ? matchedLoc.stateCode : matchedLoc.state;
  }

  if (zipField) {
    normalized[zipField.id] = matchedLoc.zip;
  }

  if (countryField) {
    const options = countryField.options || [];
    const useCode = options.some(opt => opt.trim().toUpperCase() === matchedLoc.countryCode);
    normalized[countryField.id] = useCode ? matchedLoc.countryCode : matchedLoc.country;
  }

  if (streetField && (!normalized[streetField.id] || normalized[streetField.id].trim() === '')) {
    normalized[streetField.id] = matchedLoc.street;
  }
}

async function handleGenerateData(
  fields: FormField[], 
  persona: string, 
  customPrompt: string, 
  pageContext?: PageContext,
  qaFlavor?: QAFlavor
) {
  const settings = await chrome.storage.local.get([
    'geminiApiKey', 
    'openaiApiKey', 
    'anthropicApiKey', 
    'aiProvider', 
    'cloudProxyUrl',
    'profileFirstName',
    'profileLastName',
    'profileEmail',
    'profilePhone',
    'profileCompany',
    'profileJobTitle',
    'profileBio',
    'authToken',
    'usageCount'
  ]) as Record<string, string | number | boolean | undefined>;

  const provider = settings.aiProvider || 'cloud';

  if (provider === 'cloud' && !settings.authToken) {
    console.warn('No authToken found — proceeding as unauthenticated (free tier).');
  }

  if (!fields || fields.length === 0) return {};

  // Deterministic QA Edge-Case & Boundary Generator
  // Bypasses LLM API Safety filters (OpenAI/Anthropic content filters) and guarantees exact boundary math
  if (persona === 'qa') {
    console.log(`[AutoFill AI] Generating deterministic QA test data (flavor: ${qaFlavor || 'all'}) for ${fields.length} fields.`);
    return QAGenerator.generateQAData(fields, qaFlavor || 'all');
  }

  console.log(`[AutoFill AI] Processing all ${fields.length} fields in a single AI call. Page domain: ${pageContext?.domain || 'unknown'}`);

  const domainKey = (pageContext?.domain || 'global').toLowerCase().replace(/^www\./, '');
  const existingSession = sessionIdentities.get(domainKey);
  const isSessionValid = existingSession && (Date.now() - existingSession.createdAt < 30 * 60 * 1000);

  let personaContext = "";
  if (persona === 'default') {
    if (isSessionValid && existingSession) {
      personaContext = `MULTI-STEP FORM CONSISTENCY (Active session for ${domainKey}):
You MUST maintain 100% identity consistency with the user profile generated in Step 1 of this form:
- Full Name: ${existingSession.fullName}
- First Name: ${existingSession.firstName}
- Last Name: ${existingSession.lastName}
- Email: ${existingSession.email}
- Phone: ${existingSession.phone}
- Company: ${existingSession.company}
- Job Title: ${existingSession.jobTitle}
- Street Address: ${existingSession.street}
- City: ${existingSession.city}, State: ${existingSession.state}, ZIP/Postal: ${existingSession.zip}, Country: ${existingSession.country}
- Website: ${existingSession.website}
Reuse these exact values for any matching fields on this step.\n\n`;
    } else {
      const personas = [
        "A 32-year-old male project manager named David Miller from Austin, Texas, USA. Street: 401 Congress Ave, Suite 1500, phone +1 512-555-0142, zip 78701. Email: david.miller@austinpm.io, company: Nexus Dynamics.",
        "A 27-year-old female software engineer named Emily Watson from London, UK. Street: 10 Downing Street, phone +44 20 7946 0912, postal code SW1A 1AA. Email: emily.watson@devcore.co.uk, company: DevCore Systems.",
        "A 45-year-old male finance director named Jean Dupont from Paris, France. Street: 1 Rue de Rivoli, phone +33 1 42 68 55 00, postal code 75001. Email: jean.dupont@hexagone-finance.fr, company: Hexagone Capital.",
        "A 35-year-old female marketing manager named Yuki Tanaka from Tokyo, Japan. Street: 1-1 Chiyoda, phone +81 3 5555 0183, postal code 100-0001. Email: yuki.tanaka@tokyomedia.jp, company: Tokyo Media Works.",
        "A 29-year-old male developer named Raj Patel from Bangalore, India. Street: 1 Mahatma Gandhi Rd, phone +91 80 2558 0192, postal code 560001. Email: raj.patel@techscale.in, company: TechScale India.",
        "A 38-year-old female pediatrician named Dr. Clara Oswald from Vancouver, Canada. Street: 290 Bremner Blvd, phone +1 604-555-0188, postal code V6B 2B1. Email: clara.oswald@healthwest.ca, company: Pacific Medical Group.",
        "A 31-year-old female designer named Sofia Rodriguez from Madrid, Spain. Street: Gran Via 28, phone +34 91 555 0199, postal code 28001. Email: sofia.rodriguez@creativa.es, company: Creativa Studio.",
        "A 42-year-old male architect named Marcus Schmidt from Berlin, Germany. Street: Unter den Linden 77, phone +49 30 2270, postal code 10117. Email: marcus.schmidt@berlinbau.de, company: Berlin Bau Architekten."
      ];
      personaContext = "Persona context: " + personas[Math.floor(Math.random() * personas.length)] + "\n\n";
    }
  } else if (persona === 'b2b') {
    if (isSessionValid && existingSession) {
      personaContext = `MULTI-STEP FORM CONSISTENCY SESSION (Domain: ${domainKey}):
Maintain exact corporate identity from previous step:
- Executive Name: ${existingSession.fullName}
- Corporate Email: ${existingSession.email}
- Company Name: ${existingSession.company}
- Job Title: ${existingSession.jobTitle}
- Business Phone: ${existingSession.phone}
- Office Address: ${existingSession.street}, ${existingSession.city}, ${existingSession.state} ${existingSession.zip}, ${existingSession.country}
- Website: ${existingSession.website}\n\n`;
    } else {
      const b2bPersonas = [
        "VP of Engineering Alex Mercer at 'CloudScale Solutions' (cloudscale-solutions.com) in Seattle, WA. Street: 1201 3rd Ave, Phone: +1 206-555-0199, Zip: 98101, Email: alex.mercer@cloudscale-solutions.com.",
        "Director of Product Management Helen Carter at 'Apex Analytics' (apex-analytics.io) in Boston, MA. Street: 100 Federal St, Phone: +1 617-555-0144, Zip: 02110, Email: helen.carter@apex-analytics.io.",
        "HR Director James Foster at 'TalentFlow Global' (talentflow.co) in London, UK. Street: 100 Bishopsgate, Phone: +44 20 7123 4567, Postcode: EC2N 4AG, Email: james.foster@talentflow.co."
      ];
      personaContext = "Persona context: " + b2bPersonas[Math.floor(Math.random() * b2bPersonas.length)] + "\n\n";
    }
  }

  try {
    const prompt = getPromptForPersona(persona, customPrompt, fields, settings, personaContext, pageContext);
    
    // Send a single completion request for all fields
    const rawResult = await generateAICompletion(prompt, settings, true, fields);
    console.log(`[AutoFill AI] LLM output received successfully (${rawResult.length} characters).`);

    const jsonMatch = rawResult.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("Could not find matching JSON block in output. Returning blank.");
      return {};
    }

    const fieldKeys = fields.map(f => f.id);
    const parsedResult = parseRobustJSON(jsonMatch[0], fieldKeys);
    const normalizedResult = normalizeResultsToFieldIds(parsedResult, fields, persona, settings);

    // Cache the identity for multi-step form consistency across this domain
    if (domainKey && domainKey !== 'unknown' && (persona === 'default' || persona === 'b2b')) {
      updateSessionIdentityFromResults(domainKey, normalizedResult, fields);
    }

    return normalizedResult;
  } catch (error: unknown) {
    console.warn('LLM Engine Error during generation:', error);
    const rawMessage = error instanceof Error ? error.message : 'Error occurred while calling the AI model.';
    const message = cleanErrorMessage(rawMessage);
    throw new Error(message);
  }
}

function normalizeResultsToFieldIds(
  parsed: Record<string, unknown>,
  fields: FormField[],
  persona: string,
  settings?: Record<string, string | number | boolean | undefined>
): Record<string, string> {
  const normalized: Record<string, string> = {};
  const remainingKeys = new Set(Object.keys(parsed));

  // 1. Direct field ID match
  for (const field of fields) {
    if (parsed[field.id] !== undefined && parsed[field.id] !== null) {
      normalized[field.id] = String(parsed[field.id]);
      remainingKeys.delete(field.id);
    }
  }

  // 2. Fuzzy key match for leftover keys (e.g. LLM returned "email" instead of "email-field-1" or "input_4")
  for (const leftoverKey of Array.from(remainingKeys)) {
    const val = String(parsed[leftoverKey] || '');
    if (!val) continue;

    const keyClean = leftoverKey.toLowerCase().replace(/[-_]/g, '');

    const candidate = fields.find(f => {
      if (normalized[f.id] !== undefined) return false;
      const fName = (f.name || '').toLowerCase().replace(/[-_]/g, '');
      const fLabel = (f.label || '').toLowerCase().replace(/[-_]/g, '');
      const fPlaceholder = (f.placeholder || '').toLowerCase().replace(/[-_]/g, '');
      const fType = (f.type || '').toLowerCase();

      return fName.includes(keyClean) || 
             keyClean.includes(fName) || 
             fLabel.includes(keyClean) || 
             keyClean.includes(fLabel) || 
             fPlaceholder.includes(keyClean) || 
             (keyClean.includes('email') && fType === 'email') ||
             (keyClean.includes('phone') && (fType === 'tel' || fName.includes('phone')));
    });

    if (candidate) {
      normalized[candidate.id] = val;
      remainingKeys.delete(leftoverKey);
    }
  }

  // 3. PROFILE MODE HARD GUARANTEES:
  // When user is in Profile mode, ALWAYS guarantee the exact profile details are filled
  if (persona === 'profile' && settings) {
    const profileEmail = String(settings.profileEmail || '').trim();
    const profileFirstName = String(settings.profileFirstName || '').trim();
    const profileLastName = String(settings.profileLastName || '').trim();
    const profilePhone = String(settings.profilePhone || '').trim();
    const profileCompany = String(settings.profileCompany || '').trim();
    const profileJobTitle = String(settings.profileJobTitle || '').trim();

    for (const field of fields) {
      const type = (field.type || '').toLowerCase();
      const label = (field.label || '').toLowerCase();
      const name = (field.name || '').toLowerCase();
      const placeholder = (field.placeholder || '').toLowerCase();
      const id = (field.id || '').toLowerCase();

      // EMAIL GUARANTEE:
      const isEmailField = type === 'email' || 
        label.includes('email') || 
        name.includes('email') || 
        placeholder.includes('email') || 
        id.includes('email');

      if (isEmailField && profileEmail) {
        if (!normalized[field.id] || normalized[field.id].trim() === '' || !normalized[field.id].includes('@') || normalized[field.id].includes('example.com')) {
          normalized[field.id] = profileEmail;
        }
      }

      // FIRST NAME GUARANTEE:
      const isFirstNameField = (label.includes('first') && label.includes('name')) ||
        (name.includes('first') && name.includes('name')) ||
        name === 'fname' || name === 'firstname' || id.includes('firstname');

      if (isFirstNameField && profileFirstName) {
        if (!normalized[field.id] || normalized[field.id].trim() === '') {
          normalized[field.id] = profileFirstName;
        }
      }

      // LAST NAME GUARANTEE:
      const isLastNameField = (label.includes('last') && label.includes('name')) ||
        (name.includes('last') && name.includes('name')) ||
        label.includes('surname') || name === 'lname' || name === 'lastname' || id.includes('lastname');

      if (isLastNameField && profileLastName) {
        if (!normalized[field.id] || normalized[field.id].trim() === '') {
          normalized[field.id] = profileLastName;
        }
      }

      // FULL NAME GUARANTEE:
      const isFullNameField = (label === 'name' || label === 'full name' || name === 'name' || name === 'fullname') &&
        !isFirstNameField && !isLastNameField;

      if (isFullNameField && (profileFirstName || profileLastName)) {
        if (!normalized[field.id] || normalized[field.id].trim() === '') {
          normalized[field.id] = `${profileFirstName} ${profileLastName}`.trim();
        }
      }

      // PHONE GUARANTEE:
      const isPhoneField = type === 'tel' || 
        label.includes('phone') || label.includes('mobile') ||
        name.includes('phone') || name.includes('mobile') ||
        placeholder.includes('phone') || id.includes('phone');

      if (isPhoneField && profilePhone) {
        if (!normalized[field.id] || normalized[field.id].trim() === '') {
          normalized[field.id] = profilePhone;
        }
      }

      // COMPANY GUARANTEE:
      const isCompanyField = label.includes('company') || label.includes('organization') ||
        name.includes('company') || name.includes('organization');

      if (isCompanyField && profileCompany) {
        if (!normalized[field.id] || normalized[field.id].trim() === '') {
          normalized[field.id] = profileCompany;
        }
      }

      // JOB TITLE GUARANTEE:
      const isJobTitleField = label.includes('job title') || label.includes('position') || label.includes('role') ||
        name.includes('jobtitle') || name.includes('position');

      if (isJobTitleField && profileJobTitle) {
        if (!normalized[field.id] || normalized[field.id].trim() === '') {
          normalized[field.id] = profileJobTitle;
        }
      }
    }
  }

  // 4. ADDRESS COHERENCE ENFORCEMENT:
  // Ensure City, State, ZIP, Country, and Street are 100% geographically valid and coherent
  if (persona !== 'qa') {
    enforceAddressCoherence(normalized, fields);
  }

  return normalized;
}

function cleanErrorMessage(rawMessage: string): string {
  if (!rawMessage) return 'Unknown error occurred.';
  
  // If the message contains a nested JSON error (like from Gemini API or custom proxy)
  const jsonMatch = rawMessage.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed && parsed.error && parsed.error.message) {
        return parsed.error.message;
      }
    } catch {
      // Ignore parsing errors
    }
  }

  // Remove SDK boilerplate prefixes like "[GoogleGenerativeAI Error]: Error fetching from ..."
  let clean = rawMessage;
  if (clean.includes('[GoogleGenerativeAI Error]:')) {
    clean = clean.replace(/\[GoogleGenerativeAI Error\]:\s*/g, '');
  }
  
  // Clean up URL and status info from Google SDK
  // e.g., "Error fetching from https://...: [503 Service Unavailable] Actual Message"
  const fetchErrMatch = clean.match(/Error fetching from\s+https?:\/\/[^\s:]+:\s*(?:\[\d+\s+[^\]]+\])?\s*(.*)/i);
  if (fetchErrMatch && fetchErrMatch[1]) {
    clean = fetchErrMatch[1].trim();
  }

  return clean;
}

function detectCountryDetails(phoneNumber?: string) {
  const cleanPhone = (phoneNumber || '').trim();
  
  // Default to US if no match or empty
  const defaults = {
    prefix: "+1",
    name: "United States",
    currency: "Dollars (USD, $)",
    currencySymbol: "$",
    states: "California, New York, Texas, Washington",
    postalCodeFormat: "5-digit numeric ZIP code"
  };

  if (!cleanPhone) return defaults;

  // List of common country codes
  const countryMap = [
    { prefix: "+91", name: "India", currency: "Rupees (INR, ₹)", currencySymbol: "₹", states: "Maharashtra, Karnataka, Delhi, Tamil Nadu, West Bengal", postalCodeFormat: "6-digit numeric PIN code (e.g., 400001, 560001)" },
    { prefix: "+44", name: "United Kingdom", currency: "Pounds (GBP, £)", currencySymbol: "£", states: "England, Scotland, Wales, Northern Ireland", postalCodeFormat: "alphanumeric postcode (e.g., SW1A 1AA, EC1A 1BB)" },
    { prefix: "+61", name: "Australia", currency: "Dollars (AUD, A$)", currencySymbol: "A$", states: "New South Wales, Victoria, Queensland, Western Australia", postalCodeFormat: "4-digit numeric postcode (e.g., 2000, 3000)" },
    { prefix: "+49", name: "Germany", currency: "Euros (EUR, €)", currencySymbol: "€", states: "Bavaria, Berlin, Hamburg, North Rhine-Westphalia", postalCodeFormat: "5-digit numeric postcode (e.g., 80331, 10115)" },
    { prefix: "+33", name: "France", currency: "Euros (EUR, €)", currencySymbol: "€", states: "Île-de-France, Provence-Alpes-Côte d'Azur, Auvergne-Rhône-Alpes", postalCodeFormat: "5-digit numeric postcode (e.g., 75001, 13001)" },
    { prefix: "+81", name: "Japan", currency: "Yen (JPY, ¥)", currencySymbol: "¥", states: "Tokyo, Osaka, Kyoto, Hokkaido", postalCodeFormat: "7-digit numeric postcode with a hyphen (e.g., 100-0001, 530-0001)" },
    { prefix: "+65", name: "Singapore", currency: "Dollars (SGD, S$)", currencySymbol: "S$", states: "Central Region, East Region, North-East Region", postalCodeFormat: "6-digit numeric postcode (e.g., 039794, 189721)" },
    { prefix: "+86", name: "China", currency: "Yuan (CNY, ¥)", currencySymbol: "¥", states: "Guangdong, Zhejiang, Beijing, Shanghai", postalCodeFormat: "6-digit numeric postcode (e.g., 518000, 100000)" },
    { prefix: "+1", name: "United States", currency: "Dollars (USD, $)", currencySymbol: "$", states: "California, New York, Texas, Washington", postalCodeFormat: "5-digit numeric ZIP code" }
  ];

  // Try exact start prefix match (with plus)
  for (const country of countryMap) {
    if (cleanPhone.startsWith(country.prefix)) {
      return country;
    }
  }

  // Remove all non-digit characters to check purely numeric codes
  const digits = cleanPhone.replace(/\D/g, '');
  if (digits) {
    for (const country of countryMap) {
      const countryDigits = country.prefix.replace(/\D/g, '');
      if (digits.startsWith(countryDigits)) {
        return country;
      }
    }
  }

  return defaults;
}

function getPromptForPersona(persona: string, customPrompt: string, fields: FormField[], settings?: Record<string, string | number | boolean | undefined>, personaContext?: string, pageContext?: PageContext) {
  const fieldList = fields.map(f => {
    let desc = `"${f.id}" [type: ${f.type || 'text'}] (${f.label || f.placeholder || f.name || f.id}`;
    if (f.options && f.options.length > 0) {
      desc += `: select one from [${f.options.join(' | ')}]`;
    }
    if (f.required) desc += `, required`;
    if (f.min) desc += `, min_value: ${f.min}`;
    if (f.max) desc += `, max_value: ${f.max}`;
    if (f.pattern) desc += `, regex_pattern: ${f.pattern}`;
    if (f.maxLength) desc += `, max_characters: ${f.maxLength}`;
    desc += `)`;
    return desc;
  }).join('\n- ');

  let instructions = "You are an expert dummy data generator. Fill the following form fields with realistic, high-quality, mock test data. Make sure all related fields (like name, email, country, state, zip) are highly coherent and match the same persona (e.g. if the name is French, use a French phone number, address, and matching zip code).\n\n";

  if (persona === 'qa') {
    instructions = "You are a QA automation engineer stress-testing a form. Fill the fields with extreme values, border cases, SQL injection strings (e.g., OR 1=1), cross-site scripting (XSS) payloads (e.g., <script>alert(1)</script>), negative numbers for numeric fields, extremely long text strings (e.g., 500 characters) to test overflows, and standard invalid formats (e.g., email without '@' or domain) to test robust validation rules.\n\n";
  } else if (persona === 'b2b') {
    instructions = "You are filling a B2B corporate enterprise sales contact form. Generate realistic professional B2B profiles: corporate work email addresses (e.g., jane.doe@company.com), realistic modern enterprise company names, professional corporate titles (e.g., VP of Engineering, Director of Product Management, Senior HR Manager), professional phone numbers, and standard business addresses.\n\n";
  } else if (persona === 'profile' && settings) {
    const country = detectCountryDetails(settings.profilePhone as string | undefined);
    instructions = `You are a helpful AI assistant filling out a web form using the user's actual saved personal/professional profile info instead of dummy data. You MUST use the following profile details whenever a form field matches or demands them:
- First Name: ${settings.profileFirstName || ''}
- Last Name: ${settings.profileLastName || ''}
- Email Address: ${settings.profileEmail || ''}
- Phone Number: ${settings.profilePhone || ''}
- Company Name: ${settings.profileCompany || ''}
- Job Title: ${settings.profileJobTitle || ''}
- Custom Background/Bio Context: ${settings.profileBio || ''}

COUNTRY-SPECIFIC LOCALIZATION RULES (INFERRED FROM USER'S PHONE NUMBER: ${settings.profilePhone || 'None'}):
We have detected the user's primary country/region as: **${country.name}** (Calling code: ${country.prefix}).
You MUST strictly localize all dynamically generated fields (that are NOT explicitly provided in the profile list above) to align perfectly with ${country.name}:
1. **Currency & Financials**: If the form asks for monetary values, income, salary, annual revenue, budget, or prices, you MUST use ${country.currency} and format it locally (e.g., using the currency symbol ${country.currencySymbol}). Do NOT use US Dollars or US formatting if the country is not the United States. For example, for India, write "Rs. 12,00,000" or "₹75,000" or "10 Lakhs INR".
2. **Addresses & Regions**: If the form asks for address, state, city, county, province, or ZIP/postal code:
   - Generate realistic, valid locations in **${country.name}**.
   - For States/Provinces, select one from: ${country.states}.
   - For Postal/ZIP codes, strictly follow the format: ${country.postalCodeFormat}. Do not use US ZIP codes if the country is not the US.
3. **Phone Number Formatting**: If the form asks for a phone number and it is already provided above, use the user's exact phone number. If it asks for secondary numbers or alternative contact numbers, generate realistic ones matching the ${country.prefix} calling code and local formats.

CRITICAL RULES FOR PROFILE FILLING:
1. EMAIL FIELD RULE: If ANY form field asks for email (type="email", or label/name/placeholder contains "email" or "mail"), you MUST return the user's exact profile email: "${settings.profileEmail || ''}". NEVER leave an email field blank or invent a fake email.
2. For name, phone, company, and title, ALWAYS use the exact profile details provided above if the form field asks for them. Do not invent mock names or dummy emails.
3. If there are other standard fields (like country, address, etc.) or complex text fields (like "comments", "feedback", "interests") that are not explicitly provided in the profile list above, dynamically generate highly coherent, professional, and matching values that align naturally with the user's Job Title, Custom Background/Bio context, and country localization.
4. Make sure all generated text flows naturally and feels human-written.\n\n`;
  }

  if (pageContext) {
    let contextBlock = `SURROUNDING PAGE & FORM CONTEXT:\n`;
    if (pageContext.domain) contextBlock += `- Page Domain: ${pageContext.domain}\n`;
    if (pageContext.title) contextBlock += `- Page Title: ${pageContext.title}\n`;
    if (pageContext.formHeading) contextBlock += `- Form Section Title: ${pageContext.formHeading}\n`;
    if (pageContext.headings && pageContext.headings.length > 0) {
      contextBlock += `- Page Headings: ${pageContext.headings.join(' | ')}\n`;
    }
    if (pageContext.description) contextBlock += `- Page Summary: ${pageContext.description}\n`;
    contextBlock += `CONTEXTUAL FILLING DIRECTIVE: Use this page context to infer the exact domain/use-case (e.g. shipping address vs medical intake vs job application vs hotel reservation vs SaaS feedback). Ambiguous fields (like "Notes", "Special instructions", "Reason", "Title", "Comments") MUST be generated to fit this exact context.\n\n`;
    
    instructions = contextBlock + instructions;
  }

  if (personaContext) {
    instructions = personaContext + instructions;
  }

  if (customPrompt) {
    instructions += `ADDITIONAL CUSTOM INSTRUCTIONS FROM USER: "${customPrompt}"\n\n`;
  }

  instructions += `Form fields to fill:\n- ${fieldList}\n\n`;
  instructions += `CRITICAL INSTRUCTIONS:\n`;
  instructions += `1. Respond ONLY with a valid, clean JSON object mapping each EXACT Field ID (the exact quoted string in the list above) to its generated value. You MUST include every single Field ID listed.\n`;
  instructions += `2. Do not include markdown code block syntax (like \`\`\`json). Just return raw JSON text.\n`;
  instructions += `3. For select boxes, you MUST select exactly one of the options provided.\n`;
  instructions += `4. Ensure generated values satisfy any specified min, max, maxLength, or regex constraints.\n`;
  instructions += `5. If a field asks for boolean value (like checkbox or radio), return true or false.\n`;
  instructions += `6. Ensure all generated string values are properly escaped for JSON. Do not include unescaped double quotes or control characters inside string values.\n`;
  instructions += `7. STRICT ADDRESS COHERENCE: For any location fields (Street, City, State/Province, ZIP/Postal Code, Country), you MUST ensure they are 100% geographically real, valid, and match each other precisely (e.g. Austin + Texas/TX + 78701; Seattle + Washington/WA + 98101; London + Greater London + SW1A 1AA). Never mix mismatched cities, states, and postal codes that will fail address validation APIs.`;

  return instructions;
}

async function getOrCreateAnonymousClientId(): Promise<string> {
  const result = await chrome.storage.local.get('anonymousClientId');
  if (result.anonymousClientId && typeof result.anonymousClientId === 'string' && result.anonymousClientId.startsWith('anon_')) {
    return result.anonymousClientId;
  }
  const randomPart = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().replace(/-/g, '')
    : Math.random().toString(36).substring(2) + Date.now().toString(36);
  const newId = `anon_${randomPart}`;
  await chrome.storage.local.set({ anonymousClientId: newId });
  return newId;
}

async function generateAICompletion(prompt: string, settings: Record<string, string | number | boolean | undefined>, incrementUsage?: boolean, fields?: FormField[]) {
  let provider = settings.aiProvider || 'cloud';
  
  if (provider === 'local') {
    try {
      const winAi = typeof window !== 'undefined' ? (window as { ai?: { languageModel?: { create: (opt?: Record<string, unknown>) => Promise<{ prompt: (p: string) => Promise<string>; destroy: () => void }> } } }).ai : undefined;
      const ai = (self as unknown as { ai?: { languageModel?: { create: (opt?: Record<string, unknown>) => Promise<{ prompt: (p: string) => Promise<string>; destroy: () => void }> } } }).ai || (chrome as unknown as { aiOriginTrial?: { languageModel?: { create: (opt?: Record<string, unknown>) => Promise<{ prompt: (p: string) => Promise<string>; destroy: () => void }> } } }).aiOriginTrial || winAi;
      
      if (ai && ai.languageModel) {
        const session = await ai.languageModel.create({
          systemPrompt: "You are a precise form-filler AI. You output raw JSON only."
        });
        const response = await session.prompt(prompt);
        session.destroy();
        return response;
      }
    } catch (localErr) {
      console.warn("[AutoFill AI] Local Gemini Nano execution failed, falling back to Cloud mode:", localErr);
    }
    console.warn("[AutoFill AI] Local Gemini Nano is unavailable in this browser. Falling back to Cloud Express Mode.");
    provider = 'cloud';
  }

  if (provider === 'gemini') {
    if (!settings.geminiApiKey) throw new Error("Google Gemini API Key is missing. Add it in Options.");
    const genAI = new GoogleGenerativeAI(settings.geminiApiKey as string);
    
    // Stable production Gemini models with ordered fallback cascade
    const models = [
      "gemini-2.5-flash",
      "gemini-2.5-pro",
      "gemini-1.5-flash",
      "gemini-1.5-pro"
    ];
    let lastError: unknown = null;

    let responseSchema: Schema | undefined = undefined;
    if (fields && fields.length > 0) {
      const properties: Record<string, Schema> = {};
      const required: string[] = [];
      fields.forEach(field => {
        if (field && typeof field.id === 'string') {
          const isBool = field.type === 'checkbox' || field.type === 'radio';
          properties[field.id] = {
            type: isBool ? SchemaType.BOOLEAN : SchemaType.STRING,
            description: `Generated mock data for field '${field.id}' (label: ${field.label || ''}, placeholder: ${field.placeholder || ''})`
          } as Schema;
          required.push(field.id);
        }
      });
      if (required.length > 0) {
        responseSchema = {
          type: SchemaType.OBJECT,
          properties: properties,
          required: required
        };
      }
    }

    for (const modelName of models) {
      try {
        console.log(`[AutoFill AI] Direct API key attempting model: ${modelName}`);
        const model = genAI.getGenerativeModel({ 
          model: modelName,
          safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
          ],
          generationConfig: {
            responseMimeType: "application/json",
            ...(responseSchema ? { responseSchema } : {})
          }
        }, { timeout: 25000 }); // 25-second timeout for large forms

        const result = await model.generateContent(prompt);
        return result.response.text();
      } catch (err: any) {
        console.warn(`[AutoFill AI] Direct model ${modelName} failed:`, err);
        lastError = err;

        const errMsg = err?.message || String(err);
        
        // Parse HTTP status code from Google SDK error if present (e.g. "[403 Forbidden] ...")
        const statusMatch = errMsg.match(/\[(\d+)\]/);
        const status = statusMatch ? parseInt(statusMatch[1], 10) : (err?.status || 0);

        // Abort cascade loop for static client/auth errors (400, 401, 403, 404, etc.)
        // Only retry if it is a transient error (500+ or rate limit 429) or if status is unknown (0)
        const shouldRetry = status === 0 || status === 429 || (status >= 500 && status <= 599);
        if (!shouldRetry) {
          console.warn(`[AutoFill AI] Static error status ${status} detected. Aborting cascade.`);
          break;
        }
      }
    }
    throw lastError || new Error("All direct Gemini model attempts failed.");
  }

  if (provider === 'openai') {
    if (!settings.openaiApiKey) throw new Error("OpenAI API Key is missing. Add it in Options.");

    let openAiResponseFormat: Record<string, unknown> = { type: "json_object" };
    if (fields && fields.length > 0) {
      const properties: Record<string, { type: string; description: string }> = {};
      const required: string[] = [];
      fields.forEach(field => {
        if (field && typeof field.id === 'string') {
          const isBool = field.type === 'checkbox' || field.type === 'radio';
          properties[field.id] = {
            type: isBool ? "boolean" : "string",
            description: `Generated value for field '${field.id}' (label: ${field.label || ''})`
          };
          required.push(field.id);
        }
      });
      if (required.length > 0) {
        openAiResponseFormat = {
          type: "json_schema",
          json_schema: {
            name: "form_fill",
            strict: true,
            schema: {
              type: "object",
              properties: properties,
              required: required,
              additionalProperties: false
            }
          }
        };
      }
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        response_format: openAiResponseFormat
      })
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API error: ${errData.error?.message || response.statusText}`);
    }
    const data = await response.json();
    return data.choices[0].message.content;
  }

  if (provider === 'anthropic') {
    if (!settings.anthropicApiKey) throw new Error("Anthropic API Key is missing. Add it in Options.");
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.anthropicApiKey as string,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(`Anthropic API error: ${errData.error?.message || response.statusText}`);
    }
    const data = await response.json();
    return data.content[0].text;
  }

  // Cloud proxy — use custom cloudProxyUrl if configured, otherwise fallback to environment URL
  const cloudUrl = (settings.cloudProxyUrl as string) || ENV.CLOUD_PROXY_URL;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (settings.authToken) {
    headers['Authorization'] = `Bearer ${settings.authToken}`;
  } else {
    const anonId = await getOrCreateAnonymousClientId();
    headers['X-Anonymous-Client-Id'] = anonId;
  }

  console.log(`[AutoFill AI] Fetching cloud proxy: ${cloudUrl}`);

  let response: Response;
  try {
    const schemaFields = fields ? fields.map(f => ({
      id: f.id,
      type: f.type,
      label: f.label || '',
      placeholder: f.placeholder || ''
    })) : [];

    response = await fetch(cloudUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ prompt, incrementUsage, schemaFields })
    });
  } catch (fetchErr: unknown) {
    const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
    console.log(`[AutoFill AI] fetch() threw for URL ${cloudUrl}:`, fetchErr);
    throw new Error(`Network error reaching cloud proxy (${cloudUrl}): ${msg}`);
  }

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    let cleanMessage = `Cloud proxy returned ${response.status}`;
    try {
      const parsed = JSON.parse(errBody);
      if (parsed && parsed.error) {
        cleanMessage = parsed.error;
      } else if (errBody) {
        cleanMessage = errBody;
      }
    } catch {
      if (errBody) cleanMessage = errBody;
    }
    throw new Error(cleanMessage);
  }

  const data = await response.json();

  if (incrementUsage !== false && data.usageCount !== undefined) {
    chrome.storage.local.set({
      usageCount: data.usageCount,
      userPlan: data.userPlan || 'Free Tier'
    });
  }

  return data.text;
}

function parseRobustJSON(str: string, keys?: string[]): Record<string, unknown> {
  // First attempt: standard JSON.parse
  try {
    return JSON.parse(str);
  } catch (e) {
    console.warn("[AutoFill AI] Standard JSON parse failed, trying robust fallback:", (e as Error).message);
  }

  // Second attempt: flat JSON parser with known keys if available
  if (keys && keys.length > 0) {
    try {
      const parsed = parseFlatJSONWithKnownKeys(str, keys);
      if (Object.keys(parsed).length > 0) {
        console.log("[AutoFill AI] Successfully recovered JSON using flat keys parser.");
        return parsed;
      }
    } catch (err) {
      console.warn("[AutoFill AI] Flat key parser recovery failed:", err);
    }
  }

  // Third attempt: generic cleanup parsing
  try {
    let cleaned = str.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    }
    
    // Fix trailing commas
    cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

    // Escape internal quotes
    let result = "";
    let inString = false;
    let isEscaped = false;
    
    for (let i = 0; i < cleaned.length; i++) {
      const char = cleaned[i];
      if (char === '"' && !isEscaped) {
        // Track string boundary quote or internal quote
        let prevChar = '';
        for (let j = i - 1; j >= 0; j--) {
          if (!/\s/.test(cleaned[j])) {
            prevChar = cleaned[j];
            break;
          }
        }
        
        let nextChar = '';
        for (let j = i + 1; j < cleaned.length; j++) {
          if (!/\s/.test(cleaned[j])) {
            nextChar = cleaned[j];
            break;
          }
        }
        
        const isStructural = 
          (prevChar === '{' || prevChar === ',' || prevChar === '[') ||
          (nextChar === ':') ||
          (prevChar === ':') ||
          (nextChar === ',' || nextChar === '}' || nextChar === ']');
          
        if (!isStructural) {
          result += '\\"';
          continue;
        }
        
        inString = !inString;
      }
      
      if (inString && (char === '\n' || char === '\r')) {
        result += '\\n';
      } else {
        result += char;
      }
      
      if (char === '\\' && !isEscaped) {
        isEscaped = true;
      } else {
        isEscaped = false;
      }
    }
    
    return JSON.parse(result);
  } catch (innerErr) {
    console.warn("All JSON parse attempts failed for LLM response.");
    throw innerErr;
  }
}

function parseFlatJSONWithKnownKeys(str: string, keys: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  
  let cleaned = str.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  }
  
  if (cleaned.startsWith("{")) cleaned = cleaned.substring(1);
  if (cleaned.endsWith("}")) cleaned = cleaned.substring(0, cleaned.length - 1);
  cleaned = cleaned.trim();
  
  const keyPositions: { key: string; index: number; valueStart: number }[] = [];
  
  for (const key of keys) {
    const escapedKey = key.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    // Support matching double or single quotes around keys
    const regex = new RegExp(`['"]${escapedKey}['"]\\s*:`, 'g');
    let match;
    while ((match = regex.exec(cleaned)) !== null) {
      keyPositions.push({
        key,
        index: match.index,
        valueStart: match.index + match[0].length
      });
      break;
    }
  }
  
  keyPositions.sort((a, b) => a.index - b.index);
  
  if (keyPositions.length === 0) {
    return {};
  }
  
  for (let i = 0; i < keyPositions.length; i++) {
    const current = keyPositions[i];
    const next = keyPositions[i + 1];
    
    let rawValue = next 
      ? cleaned.substring(current.valueStart, next.index).trim()
      : cleaned.substring(current.valueStart).trim();
      
    if (rawValue.endsWith(",")) {
      rawValue = rawValue.substring(0, rawValue.length - 1).trim();
    }
    
    if ((rawValue.startsWith('"') && rawValue.endsWith('"')) || (rawValue.startsWith("'") && rawValue.endsWith("'"))) {
      rawValue = rawValue.substring(1, rawValue.length - 1);
      rawValue = rawValue
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\\\/g, '\\');
    } else if (rawValue.startsWith('"') || rawValue.startsWith("'")) {
      rawValue = rawValue.substring(1);
      if (rawValue.endsWith('"') || rawValue.endsWith("'")) {
        rawValue = rawValue.substring(0, rawValue.length - 1);
      }
      rawValue = rawValue
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\\\/g, '\\');
    } else {
      if (rawValue === "true") {
        result[current.key] = "true";
        continue;
      }
      if (rawValue === "false") {
        result[current.key] = "false";
        continue;
      }
    }
    
    result[current.key] = rawValue;
  }
  
  return result;
}

async function handleTestConnection(provider: string, key: string, proxyUrl?: string): Promise<string> {
  if (provider === 'gemini') {
    if (!key) throw new Error("Gemini API key is missing.");
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `Gemini API returned status ${response.status}`);
    }
    return "Gemini API key is valid!";
  }

  if (provider === 'openai') {
    if (!key) throw new Error("OpenAI API key is missing.");
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${key}` }
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `OpenAI API returned status ${response.status}`);
    }
    return "OpenAI API key is valid!";
  }

  if (provider === 'anthropic') {
    if (!key) throw new Error("Anthropic API key is missing.");
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'Ping' }]
      })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `Anthropic API returned status ${response.status}`);
    }
    return "Anthropic API key is valid!";
  }

  if (provider === 'cloud') {
    const url = proxyUrl || ENV.CLOUD_PROXY_URL;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'PING_TEST', incrementUsage: false })
    });
    if (!response.ok) {
      throw new Error(`Proxy returned status ${response.status}`);
    }
    const data = await response.json().catch(() => ({}));
    if (data && data.success) {
      return "Cloud proxy connection is healthy!";
    }
    throw new Error("Invalid response from cloud proxy.");
  }

  throw new Error(`Unknown provider type: ${provider}`);
}

