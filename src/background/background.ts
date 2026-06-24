import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import type { FormField } from "../content/scraper";

console.log('✨ AutoFill AI Background Service Worker Initializing...');

// Add a context menu for quick fills
chrome.runtime.onInstalled.addListener((details) => {
  chrome.contextMenus.create({
    id: "autofill-magic",
    title: "✨ AutoFill AI",
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

  if (details.reason === 'install') {
    chrome.tabs.create({ url: 'options.html?onboarding=true' });
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

  // Route popup request directly to the tab content script's helper
  if (request.action === 'broadcast_fill' && typeof request.tabId === 'number' && request.tabId >= 0) {
    chrome.storage.local.get(['profileFirstName', 'profileLastName', 'profileEmail'], (result: Record<string, string | number | boolean | undefined>) => {
      const hasProfile = !!(result.profileFirstName || result.profileLastName || result.profileEmail);
      const defaultPersona = hasProfile ? 'profile' : 'default';
      chrome.tabs.sendMessage(request.tabId!, { 
        action: 'trigger_fill', 
        persona: request.persona || defaultPersona,
        customPrompt: request.customPrompt || ''
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
    handleGenerateData(request.fields, request.persona || 'default', request.customPrompt || '')
      .then(sendResponse)
      .catch(err => {
        console.warn("AI Generation failed:", err);
        sendResponse({ error: err.message || 'Generation failed' });
      });
    return true;
  }
});

async function handleGenerateData(fields: FormField[], persona: string, customPrompt: string) {
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

  // Auth is optional for now — proxy accepts unauthenticated requests
  // (Supabase login will be wired in a later phase)
  if (provider === 'cloud' && !settings.authToken) {
    console.warn('No authToken found — proceeding as unauthenticated (free tier).');
  }

  if (!fields || fields.length === 0) return {};

  const CHUNK_SIZE = persona === 'qa' ? 5 : 15;
  const fieldChunks: FormField[][] = [];
  for (let i = 0; i < fields.length; i += CHUNK_SIZE) {
    fieldChunks.push(fields.slice(i, i + CHUNK_SIZE));
  }

  console.log(`[AutoFill AI] Processing ${fields.length} fields in ${fieldChunks.length} chunk(s).`);

  let personaContext = "";
  if (persona === 'default') {
    const personas = [
      "A 32-year-old male project manager named David Miller from Austin, Texas, USA. Phone prefix +1, zip 78701.",
      "A 27-year-old female software engineer named Emily Watson from London, UK. Phone prefix +44, postal code SW1A 1AA.",
      "A 45-year-old male finance director named Jean Dupont from Paris, France. Phone prefix +33, postal code 75001.",
      "A 35-year-old female marketing manager named Yuki Tanaka from Tokyo, Japan. Phone prefix +81, postal code 100-0001.",
      "A 29-year-old male developer named Raj Patel from Bangalore, India. Phone prefix +91, postal code 560001.",
      "A 38-year-old female pediatrician named Dr. Clara Oswald from Vancouver, Canada. Phone prefix +1, postal code V6B 2B1.",
      "A 31-year-old female designer named Sofia Rodriguez from Madrid, Spain. Phone prefix +34, postal code 28001.",
      "A 42-year-old male architect named Marcus Schmidt from Berlin, Germany. Phone prefix +49, postal code 10117."
    ];
    personaContext = "Persona context: " + personas[Math.floor(Math.random() * personas.length)] + "\n\n";
  } else if (persona === 'b2b') {
    const b2bPersonas = [
      "VP of Engineering name Alex Mercer at 'CloudScale Solutions' (cloudscale-solutions.com) in Seattle, WA. Phone prefix +1.",
      "Director of Product Management name Helen Carter at 'Apex Analytics' (apex-analytics.io) in Boston, MA. Phone prefix +1.",
      "HR Manager name James Foster at 'TalentFlow' (talentflow.co) in London, UK. Phone prefix +44."
    ];
    personaContext = "Persona context: " + b2bPersonas[Math.floor(Math.random() * b2bPersonas.length)] + "\n\n";
  }

  try {
    const chunkPromises = fieldChunks.map(async (chunk, index) => {
      const prompt = getPromptForPersona(persona, customPrompt, chunk, settings, personaContext);
      const shouldIncrement = (index === 0);
      
      const rawResult = await generateAICompletion(prompt, settings, shouldIncrement);
      console.log(`Raw LLM output received for chunk ${index + 1}/${fieldChunks.length}:`, rawResult);

      const jsonMatch = rawResult.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn(`Could not find matching JSON block in output for chunk ${index + 1}. Returning blank.`);
        return {};
      }

      const chunkKeys = chunk.map(f => f.id);
      return parseRobustJSON(jsonMatch[0], chunkKeys);
    });

    const results = await Promise.all(chunkPromises);

    // Increment SaaS usage count locally upon successful completion
    if (provider === 'cloud') {
      const newUsage = (settings.usageCount as number || 0) + 1;
      await chrome.storage.local.set({ usageCount: newUsage });
    }

    const mergedResult = Object.assign({}, ...results);
    return mergedResult;
  } catch (error: unknown) {
    console.warn('LLM Engine Error during chunked generation:', error);
    const rawMessage = error instanceof Error ? error.message : 'Error occurred while calling the AI model.';
    const message = cleanErrorMessage(rawMessage);
    throw new Error(message);
  }
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

function getPromptForPersona(persona: string, customPrompt: string, fields: FormField[], settings?: Record<string, string | number | boolean | undefined>, personaContext?: string) {
  const fieldList = fields.map(f => {
    let desc = `${f.id} (${f.label || f.placeholder || f.name}`;
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
1. For name, email, phone, company, and title, ALWAYS use the exact profile details provided above if the form field asks for them. Do not invent mock names or dummy emails.
2. If there are other standard fields (like country, address, etc.) or complex text fields (like "comments", "feedback", "interests") that are not explicitly provided in the profile list above, dynamically generate highly coherent, professional, and matching values that align naturally with the user's Job Title, Custom Background/Bio context, and country localization.
3. Make sure all generated text flows naturally and feels human-written.\n\n`;
  }

  if (personaContext) {
    instructions = personaContext + instructions;
  }

  if (customPrompt) {
    instructions += `ADDITIONAL CUSTOM INSTRUCTIONS FROM USER: "${customPrompt}"\n\n`;
  }

  instructions += `Form fields to fill:\n- ${fieldList}\n\n`;
  instructions += `CRITICAL INSTRUCTIONS:\n`;
  instructions += `1. Respond ONLY with a valid, clean JSON object mapping the field ID to its generated value. Example format: { "first_name": "John", "role": "Developer" }\n`;
  instructions += `2. Do not include markdown code block syntax (like \`\`\`json). Just return raw JSON text.\n`;
  instructions += `3. For select boxes, you MUST select exactly one of the options provided.\n`;
  instructions += `4. Ensure generated values satisfy any specified min, max, maxLength, or regex constraints.\n`;
  instructions += `5. If a field asks for boolean value (like checkbox or radio), return true or false.\n`;
  instructions += `6. Ensure all generated string values are properly escaped for JSON. Do not include unescaped double quotes or control characters inside string values.`;

  return instructions;
}

async function generateAICompletion(prompt: string, settings: Record<string, string | number | boolean | undefined>, incrementUsage?: boolean) {
  const provider = settings.aiProvider || 'cloud';
  
  if (provider === 'local') {
    const winAi = typeof window !== 'undefined' ? (window as { ai?: { languageModel?: { create: (opt?: Record<string, unknown>) => Promise<{ prompt: (p: string) => Promise<string>; destroy: () => void }> } } }).ai : undefined;
    const ai = (self as unknown as { ai?: { languageModel?: { create: (opt?: Record<string, unknown>) => Promise<{ prompt: (p: string) => Promise<string>; destroy: () => void }> } } }).ai || (chrome as unknown as { aiOriginTrial?: { languageModel?: { create: (opt?: Record<string, unknown>) => Promise<{ prompt: (p: string) => Promise<string>; destroy: () => void }> } } }).aiOriginTrial || winAi;
    
    if (ai && ai.languageModel) {
      const session = await ai.languageModel.create({
        systemPrompt: "You are a precise form-filler AI. You output raw JSON only."
      });
      const response = await session.prompt(prompt);
      session.destroy();
      return response;
    } else {
      throw new Error("Chrome's Local Gemini Nano is not enabled on this browser. Enable it in chrome://flags or switch to Google Pro/Cloud in settings.");
    }
  }

  if (provider === 'gemini') {
    if (!settings.geminiApiKey) throw new Error("Google Gemini API Key is missing. Add it in Options.");
    const genAI = new GoogleGenerativeAI(settings.geminiApiKey as string);
    const models = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-3.1-pro-preview", "gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.5-flash-lite"];
    let lastError: any = null;

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
            responseMimeType: "application/json"
          }
        }, { timeout: 25000 }); // 25-second timeout for large forms

        const result = await model.generateContent(prompt);
        return result.response.text();
      } catch (err: any) {
        console.warn(`[AutoFill AI] Direct model ${modelName} failed:`, err);
        lastError = err;
      }
    }
    throw lastError || new Error("All direct Gemini model attempts failed.");
  }

  if (provider === 'openai') {
    if (!settings.openaiApiKey) throw new Error("OpenAI API Key is missing. Add it in Options.");
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
        response_format: { type: "json_object" }
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

  // Cloud proxy — always use the hardcoded canonical URL (ignore stale storage values)
  const cloudUrl = 'https://autofill-ai-proxy.vinaykondabattula.workers.dev';
  // Keep storage in sync so Options UI shows the right URL
  chrome.storage.local.set({ cloudProxyUrl: cloudUrl });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (settings.authToken) {
    headers['Authorization'] = `Bearer ${settings.authToken}`;
  }

  console.log(`[AutoFill AI] Fetching cloud proxy: ${cloudUrl}`);

  let response: Response;
  try {
    response = await fetch(cloudUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ prompt, incrementUsage })
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

function parseRobustJSON(str: string, keys?: string[]): any {
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
    cleaned = cleaned.replace(/,\s*([\}\]])/g, '$1');

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
    console.warn("All JSON parse attempts failed. Raw text was:", str);
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
    const escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
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
