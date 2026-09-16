import { useState, useEffect } from 'react';
import { 
  Settings, Sparkles, History, Cpu, Rocket, AlertCircle, LockKeyhole, 
  User, Star, X, Building2, ShieldCheck, Download, Copy, Check, Globe, FileText 
} from 'lucide-react';
import { posthog } from '@/lib/posthog';
import { Logo } from '@/components/Logo';
import { type SavedProfile, loadSavedProfiles, syncActiveProfileToStorage } from '@/lib/profileManager';
import { getDomainPrompt, saveDomainPrompt, deleteDomainPrompt, normalizeDomain } from '@/lib/domainPromptManager';
import { type QAFlavor } from '@/lib/qaGenerator';
import { 
  type TestRunReportData, 
  generateReportMarkdown, 
  generateReportCSV, 
  generateReportJSON, 
  downloadReportFile, 
  copyReportToClipboard 
} from '@/lib/exportReport';

const CHROME_STORE_REVIEW_URL = 'https://chromewebstore.google.com/detail/filli-ai-ai-form-filler-q/hgegjecojocbaajhpphckaphclpdkbhl/reviews';

export const Popup = () => {
  const [loading, setLoading] = useState(false);
  const [formFields, setFormFields] = useState<number>(0);
  const [hasProfile, setHasProfile] = useState(false);

  // SaaS and Provider States
  const [aiProvider, setAiProvider] = useState('cloud');
  const [authToken, setAuthToken] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [usageCount, setUsageCount] = useState(0);
  const [userPlan, setUserPlan] = useState('Free Tier');

  // Multi-Profile Vault States
  const [savedProfiles, setSavedProfiles] = useState<SavedProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string>('');

  // Persona and Custom Instruction States
  const [persona, setPersona] = useState<'default' | 'profile' | 'qa' | 'b2b'>('default');
  const [customPrompts, setCustomPrompts] = useState<Record<'default' | 'profile' | 'qa' | 'b2b', string>>({
    default: '',
    profile: '',
    qa: '',
    b2b: ''
  });
  const [showCustomPrompt, setShowCustomPrompt] = useState(false);

  // Per-Domain Custom Prompt Memory States
  const [currentDomain, setCurrentDomain] = useState<string>('');
  const [domainPromptSaved, setDomainPromptSaved] = useState<boolean>(false);
  const [domainSaveMsg, setDomainSaveMsg] = useState<string>('');

  // QA Flavor State (Standard vs AppSec Pro)
  const [qaFlavor, setQaFlavor] = useState<QAFlavor>('all');

  // Test Run Report & Export States
  const [lastReport, setLastReport] = useState<TestRunReportData | null>(null);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [copiedFormat, setCopiedFormat] = useState<string>('');

  // Rate Limit / Onboarding States
  const [limitReached, setLimitReached] = useState(false);
  const [limitErrorMessage, setLimitErrorMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Interface Configuration States
  const [enableFloatingDock, setEnableFloatingDock] = useState(true);

  // QA Daily Usage State
  const [qaDailyCount, setQaDailyCount] = useState<number>(0);

  // Review Prompt State
  const [showReviewPrompt, setShowReviewPrompt] = useState(false);

  useEffect(() => {
    // Read user preferences
    chrome.storage.local.get([
      'geminiApiKey',
      'openaiApiKey',
      'anthropicApiKey',
      'aiProvider',
      'profileFirstName',
      'profileLastName',
      'profileEmail',
      'authToken',
      'userEmail',
      'lastActivePersona',
      'usageCount',
      'userPlan',
      'enableFloatingDock',
      'successfulFills',
      'hasReviewed',
      'reviewPromptDismissed',
      'qaDailyCount',
      'qaLastDate'
    ], (result: Record<string, string | number | boolean | undefined>) => {
      const profileExists = !!(result.profileFirstName || result.profileLastName || result.profileEmail);
      setHasProfile(profileExists);
      setAiProvider(result.aiProvider as string || 'cloud');
      setAuthToken(result.authToken as string || '');
      setUserEmail(result.userEmail as string || '');
      setUsageCount(result.usageCount as number || 0);
      setUserPlan(result.userPlan as string || 'Free Tier');
      setEnableFloatingDock(result.enableFloatingDock !== false);

      const today = new Date().toISOString().slice(0, 10);
      let qCount = typeof result.qaDailyCount === 'number' ? result.qaDailyCount : 0;
      if (result.qaLastDate !== today) {
        qCount = 0;
        chrome.storage.local.set({ qaDailyCount: 0, qaLastDate: today });
      }
      setQaDailyCount(qCount);

      const fills = (result.successfulFills as number) || 0;
      const reviewed = !!result.hasReviewed;
      const dismissed = !!result.reviewPromptDismissed;
      if (fills >= 3 && !reviewed && !dismissed) {
        setShowReviewPrompt(true);
      }

      const usage = result.usageCount as number || 0;
      const plan = result.userPlan as string || 'Free Tier';
      const token = result.authToken as string || '';
      const currentProvider = result.aiProvider as string || 'cloud';

      // Limit check logic (Monthly limit for auth free tier, Anonymous limit for unauth cloud)
      if (currentProvider === 'cloud' && !token) {
        if (usage >= 10) {
          setLimitReached(true);
          setLimitErrorMessage('Anonymous fill limit reached (10/10). Sign up inside Settings to get 50 free fills!');
        } else {
          setLimitReached(false);
        }
      } else if (plan === 'Free Tier' && usage >= 50 && currentProvider === 'cloud') {
        setLimitReached(true);
        setLimitErrorMessage('Monthly fill limit reached (50/50). Upgrade to Pro inside Settings!');
      } else {
        setLimitReached(false);
      }

      const savedPersona = result.lastActivePersona as 'default' | 'profile' | 'qa' | 'b2b' | undefined;
      const finalPlan = result.userPlan as string || 'Free Tier';
      if (savedPersona && (savedPersona === 'default' || savedPersona === 'profile' || finalPlan === 'Pro Plan')) {
        setPersona(savedPersona);
      } else {
        setPersona(profileExists ? 'profile' : 'default');
      }

      if (currentProvider === 'cloud') {
        chrome.runtime.sendMessage({ action: 'sync_usage' }, (res) => {
          if (chrome.runtime.lastError || !res?.success) return;
          if (typeof res.usageCount === 'number') {
            const currentUsage = res.usageCount;
            const currentPlan = res.userPlan || plan;
            setUsageCount(currentUsage);
            if (res.userPlan) setUserPlan(res.userPlan);

            if (!token) {
              if (currentUsage >= 10) {
                setLimitReached(true);
                setLimitErrorMessage('Anonymous fill limit reached (10/10). Sign up inside Settings to get 50 free fills!');
              } else {
                setLimitReached(false);
              }
            } else if (currentPlan === 'Free Tier' && currentUsage >= 50) {
              setLimitReached(true);
              setLimitErrorMessage('Monthly fill limit reached (50/50). Upgrade to Pro inside Settings!');
            } else {
              setLimitReached(false);
            }
          }
        });
      }
    });

    // Load saved profiles for Multi-Profile Vault
    loadSavedProfiles().then(({ profiles, activeId }) => {
      setSavedProfiles(profiles);
      setActiveProfileId(activeId);
    });

    // Load last test run and saved QA flavor
    chrome.storage.local.get(['lastTestRun', 'lastQaFlavor'], (res) => {
      if (res.lastTestRun) {
        setLastReport(res.lastTestRun as TestRunReportData);
      }
      if (res.lastQaFlavor) {
        setQaFlavor(res.lastQaFlavor as QAFlavor);
      }
    });

    // Listen for storage changes in real-time (to update count after fills)
    const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>) => {
      chrome.storage.local.get(['usageCount', 'userPlan', 'authToken', 'aiProvider'], (res) => {
        const currentUsage = res.usageCount as number || 0;
        const currentPlan = res.userPlan as string || 'Free Tier';
        const currentToken = res.authToken as string || '';
        const currentProvider = res.aiProvider as string || 'cloud';

        setUsageCount(currentUsage);
        setUserPlan(currentPlan);
        setAuthToken(currentToken);
        setAiProvider(currentProvider);

        const today = new Date().toISOString().slice(0, 10);
        chrome.storage.local.get(['qaDailyCount', 'qaLastDate'], (qRes) => {
          let qCount = typeof qRes.qaDailyCount === 'number' ? qRes.qaDailyCount : 0;
          if (qRes.qaLastDate !== today) {
            qCount = 0;
          }
          setQaDailyCount(qCount);
        });

        if (currentProvider === 'cloud' && !currentToken) {
          if (currentUsage >= 10) {
            setLimitReached(true);
            setLimitErrorMessage('Anonymous fill limit reached (10/10). Sign up inside Settings to get 50 free fills!');
          } else {
            setLimitReached(false);
          }
        } else if (currentPlan === 'Free Tier' && currentUsage >= 50 && currentProvider === 'cloud') {
          setLimitReached(true);
          setLimitErrorMessage('Monthly fill limit reached (50/50). Upgrade to Pro inside Settings!');
        } else {
          setLimitReached(false);
        }
      });

      if (changes.enableFloatingDock) {
        setEnableFloatingDock(changes.enableFloatingDock.newValue !== false);
      }

      if (changes.savedProfiles || changes.activeProfileId) {
        loadSavedProfiles().then(({ profiles, activeId }) => {
          setSavedProfiles(profiles);
          setActiveProfileId(activeId);
        });
      }

      if (changes.lastTestRun) {
        setLastReport(changes.lastTestRun.newValue as TestRunReportData);
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);

    // Check for Built-in Intelligence
    const checkBuiltInAi = async () => {
      try {
        const win = window as unknown as { ai?: { languageModel?: { capabilities: () => Promise<unknown> } } };
        if (win.ai && win.ai.languageModel) {
          await win.ai.languageModel.capabilities();
        }
      } catch {
        console.log("Local AI capability check skipped");
      }
    };
    checkBuiltInAi();

    // Detect forms on current page via multiple reliable methods
    const detectFields = async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id && tab.url?.startsWith('http')) {
        // Detect domain for Per-Domain Custom Prompt Memory
        const domain = normalizeDomain(tab.url);
        setCurrentDomain(domain);
        if (domain) {
          getDomainPrompt(domain).then((savedPrompt) => {
            if (savedPrompt) {
              setCustomPrompts(prev => ({
                ...prev,
                default: prev.default || savedPrompt,
                qa: prev.qa || savedPrompt,
                b2b: prev.b2b || savedPrompt
              }));
              setDomainPromptSaved(true);
            }
          });
        }

        // Exclude search engines
        const isSearchEngine = (url: string) => {
          try {
            const host = new URL(url).hostname.toLowerCase();
            const isGoogleSearch = host === 'google.com' || host === 'www.google.com' || /^www\.google\.co\.[a-z]{2,3}$/.test(host) || /^google\.co\.[a-z]{2,3}$/.test(host);
            const isOtherSearch = host === 'bing.com' || host === 'www.bing.com' || host === 'duckduckgo.com' || host === 'www.duckduckgo.com' || host.includes('search.yahoo.com') || host === 'yahoo.com' || host === 'www.yahoo.com';
            return isGoogleSearch || isOtherSearch;
          } catch {
            return false;
          }
        };

        if (isSearchEngine(tab.url)) {
          setFormFields(0);
          return;
        }

        // Method 1: Ask background (already cached)
        chrome.runtime.sendMessage({ action: 'get_tab_info', tabId: tab.id }, (response) => {
          if (chrome.runtime.lastError) return;
          if (response?.count) setFormFields(f => Math.max(f, response.count));
        });

        // Method 2: Ask tab directly
        chrome.tabs.sendMessage(tab.id, { action: 'detect_fields' }, (response) => {
          if (chrome.runtime.lastError) return;
          if (response?.count) setFormFields(f => Math.max(f, response.count));
        });

        // Method 3: Direct injection fallback (Bulletproof)
        try {
          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              const inputs = document.querySelectorAll('input:not([type="hidden"]), textarea, select');
              return inputs.length;
            }
          });
          if (typeof results?.[0]?.result === 'number') setFormFields(f => Math.max(f, results[0].result as number));
        } catch {
          console.log('Scripting injection restricted or failed');
        }
      }
    };
    detectFields();

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  const changePersona = (newPersona: 'default' | 'profile' | 'qa' | 'b2b') => {
    setPersona(newPersona);
    setErrorMessage('');
    chrome.storage.local.set({ lastActivePersona: newPersona });
  };

  const handleSwitchProfile = (id: string) => {
    const target = savedProfiles.find(p => p.id === id);
    if (!target) return;
    setActiveProfileId(id);
    syncActiveProfileToStorage(target);
    setHasProfile(!!(target.firstName || target.lastName || target.email));
  };

  const handleSaveDomainPrompt = async () => {
    if (!currentDomain) return;
    const promptToSave = customPrompts[persona] || '';
    if (!promptToSave.trim()) {
      setDomainSaveMsg('Type a custom prompt first.');
      return;
    }
    const isBypass = userPlan === 'Pro Plan' || aiProvider !== 'cloud';
    const result = await saveDomainPrompt(currentDomain, promptToSave, userPlan, isBypass);
    if (result.success) {
      setDomainPromptSaved(true);
      setDomainSaveMsg(`Saved rule for ${currentDomain}!`);
      setTimeout(() => setDomainSaveMsg(''), 3000);
    } else {
      setDomainSaveMsg(result.error || 'Failed to save rule');
    }
  };

  const handleRemoveDomainPrompt = async () => {
    if (!currentDomain) return;
    await deleteDomainPrompt(currentDomain);
    setDomainPromptSaved(false);
    setDomainSaveMsg(`Rule cleared for ${currentDomain}`);
    setTimeout(() => setDomainSaveMsg(''), 3000);
  };

  const handleQaFlavorChange = (flavor: QAFlavor) => {
    const isBypass = userPlan === 'Pro Plan' || aiProvider !== 'cloud';
    if (flavor === 'appsec_pro' && !isBypass && userPlan !== 'Pro Plan') {
      setErrorMessage("OWASP AppSec Pentest Suite requires a Pro Plan or personal API key (BYOK).");
      setLimitReached(true);
      setLimitErrorMessage("OWASP AppSec Pentest Suite requires a Pro Plan or personal API key (BYOK).");
      return;
    }
    setQaFlavor(flavor);
    chrome.storage.local.set({ lastQaFlavor: flavor });
  };

  const changeCustomPrompt = (newPrompt: string) => {
    setCustomPrompts(prev => ({
      ...prev,
      [persona]: newPrompt
    }));
  };

  const toggleFloatingDock = () => {
    const nextVal = !enableFloatingDock;
    setEnableFloatingDock(nextVal);
    chrome.storage.local.set({ enableFloatingDock: nextVal });
  };

  const handleFill = async () => {
    if (formFields === 0) return;

    const isBypass = userPlan === 'Pro Plan' || aiProvider !== 'cloud';
    const isQaLimitReached = !isBypass && persona === 'qa' && qaDailyCount >= 5;

    // If QA daily limit is reached for free cloud users, redirect to settings
    if (isQaLimitReached) {
      chrome.storage.local.set({ activeTabOnOpen: 'account' }, () => {
        chrome.runtime.openOptionsPage();
      });
      return;
    }

    // If cloud monthly/anonymous fill limit is reached, redirect to settings
    if (limitReached && persona !== 'qa') {
      chrome.storage.local.set({ activeTabOnOpen: 'account' }, () => {
        chrome.runtime.openOptionsPage();
      });
      return;
    }

    // If profile is selected but user has no profile details configured, redirect to options profile tab
    if (persona === 'profile' && !hasProfile) {
      chrome.storage.local.set({ activeTabOnOpen: 'profile' }, () => {
        chrome.runtime.openOptionsPage();
      });
      return;
    }

    // Set loading synchronously to guarantee immediate spinner rendering
    setLoading(true);
    setErrorMessage('');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && typeof tab.id === 'number') {
        const response = await new Promise<{ success?: boolean; error?: string }>((resolve) => {
          chrome.runtime.sendMessage({
            action: 'broadcast_fill',
            tabId: tab.id,
            persona: persona,
            customPrompt: customPrompts[persona] || '',
            qaFlavor: qaFlavor
          }, (res) => {
            if (chrome.runtime.lastError) {
              resolve({ error: chrome.runtime.lastError.message });
            } else {
              resolve(res || { error: 'No response received' });
            }
          });
        });

        if (response?.error) {
          setErrorMessage(response.error);
          posthog.capture('form_filled_failed', {
            fieldsCount: formFields,
            persona: persona,
            aiProvider: aiProvider,
            error: response.error
          });
          // Detect if rate limits or monthly caps have been hit
          if (
            response.error.toLowerCase().includes('limit reached') ||
            response.error.includes('429') ||
            response.error.includes('402')
          ) {
            setLimitReached(true);
            setLimitErrorMessage(response.error);
          }
        } else {
          setLimitReached(false);
          setErrorMessage('');
          posthog.capture('form_filled_success', {
            fieldsCount: formFields,
            persona: persona,
            aiProvider: aiProvider,
            qaFlavor: persona === 'qa' ? qaFlavor : undefined
          });

          // Reload last test run report after short delay for injection to settle
          setTimeout(() => {
            chrome.storage.local.get(['lastTestRun'], (res) => {
              if (res.lastTestRun) {
                setLastReport(res.lastTestRun as TestRunReportData);
              }
            });
          }, 600);

          // If QA persona on free tier, track and increment daily count
          const isBypass = userPlan === 'Pro Plan' || aiProvider !== 'cloud';
          if (persona === 'qa' && !isBypass) {
            const today = new Date().toISOString().slice(0, 10);
            const nextCount = qaDailyCount + 1;
            setQaDailyCount(nextCount);
            chrome.storage.local.set({ qaDailyCount: nextCount, qaLastDate: today });
          }

          // Track successful fills and trigger review prompt when >= 3
          chrome.storage.local.get(['successfulFills', 'hasReviewed', 'reviewPromptDismissed'], (res) => {
            const currentFills = ((res.successfulFills as number) || 0) + 1;
            chrome.storage.local.set({ successfulFills: currentFills });
            if (currentFills >= 3 && !res.hasReviewed && !res.reviewPromptDismissed) {
              setShowReviewPrompt(true);
            }
          });
        }
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.log('Broadcast fill error:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setErrorMessage(errMsg);
      posthog.capture('form_filled_error', {
        fieldsCount: formFields,
        persona: persona,
        aiProvider: aiProvider,
        error: errMsg
      });
      setLoading(false);
    } finally {
      const totalFillDuration = formFields * 80;
      const resetDelay = Math.max(1500, totalFillDuration);
      setTimeout(() => {
        setLoading(false);
      }, resetDelay);
    }
  };

  const handleOpenReview = () => {
    chrome.storage.local.set({ hasReviewed: true });
    setShowReviewPrompt(false);
    posthog.capture('review_prompt_clicked');
    chrome.tabs.create({ url: CHROME_STORE_REVIEW_URL });
  };

  const handleDismissReview = () => {
    chrome.storage.local.set({ reviewPromptDismissed: true });
    setShowReviewPrompt(false);
    posthog.capture('review_prompt_dismissed');
  };

  const getFriendlyErrorMessage = (rawError: string) => {
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
  };

  // Determine active engine label based on Auth and Config
  const getModeDetails = () => {
    if (aiProvider !== 'cloud' && aiProvider !== 'local') {
      return {
        label: 'Private API Key',
        icon: <Rocket className="w-3.5 h-3.5" />,
        desc: 'Unlimited fills'
      };
    }
    if (aiProvider === 'local') {
      return {
        label: 'Local Gemini Nano',
        icon: <Cpu className="w-3.5 h-3.5" />,
        desc: 'Unlimited offline fills'
      };
    }
    // Cloud modes
    if (authToken) {
      if (userPlan === 'Pro Plan') {
        return {
          label: 'Filli AI (Pro)',
          icon: <Logo size={14} className="rounded-[3px]" />,
          desc: 'Unlimited fills'
        };
      }
      return {
        label: 'Filli AI (Free)',
        icon: <Logo size={14} className="rounded-[3px]" />,
        desc: `${Math.max(0, 50 - usageCount)}/50 left`
      };
    }
    return {
      label: 'Filli AI (Anon)',
      icon: <Logo size={14} className="rounded-[3px]" />,
      desc: `${Math.max(0, 10 - usageCount)}/10 left`
    };
  };

  const mode = getModeDetails();

  const isBypass = userPlan === 'Pro Plan' || aiProvider !== 'cloud';
  const qaRemaining = isBypass ? 999 : Math.max(0, 5 - qaDailyCount);
  const isQaLimitReached = !isBypass && persona === 'qa' && qaRemaining <= 0;

  // Determine dynamic action CTA text and icons based on state
  const getButtonText = () => {
    if (formFields === 0) return "No Forms Detected";
    if (loading) return "Magically Filling...";
    if (isQaLimitReached) {
      return "Daily QA Limit Reached (5/5) — Upgrade to Pro";
    }
    if (limitReached && persona !== 'qa') {
      if (aiProvider === 'cloud' && !authToken) {
        return "Limit Reached: Sign Up for 50 Free Fills!";
      }
      return "Limit Reached: Upgrade to Pro";
    }
    if (persona === 'profile' && !hasProfile) return "Configure Profile Card";

    switch (persona) {
      case 'profile': return "Fill with My Profile Card";
      case 'qa': return isBypass ? "Fill with QA Edge Cases" : `Fill with QA Edge Cases (${qaRemaining} left today)`;
      case 'b2b': return "Fill with B2B Corp Persona";
      default: return "Generate Randomly & Fill Form";
    }
  };

  const getButtonIcon = () => {
    if (formFields === 0) {
      return <AlertCircle className="w-5 h-5 text-slate-400" />;
    }
    if (loading) {
      return <div className="w-5 h-5 border-[3px] border-white/20 border-t-white rounded-full animate-spin" />;
    }
    if (isQaLimitReached || (limitReached && persona !== 'qa')) {
      return <LockKeyhole className="w-5 h-5 text-white animate-bounce" />;
    }

    switch (persona) {
      case 'profile':
        return <User className="w-5 h-5 text-amber-300 fill-amber-300/20 group-hover:scale-125 transition-transform" />;
      case 'qa':
        return <AlertCircle className="w-5 h-5 text-amber-300 fill-amber-300/20 group-hover:scale-125 transition-transform" />;
      case 'b2b':
        return <Building2 className="w-5 h-5 text-amber-300 fill-amber-300/20 group-hover:scale-125 transition-transform" />;
      default:
        return <Sparkles className="w-5 h-5 text-amber-300 fill-amber-300/20 group-hover:scale-125 transition-transform" />;
    }
  };

  return (
    <div className="w-[380px] p-0.5 bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-transparent rounded-none overflow-hidden font-sans">
      <div className="bg-white/70 backdrop-blur-3xl rounded-none shadow-2xl relative overflow-hidden border border-white/40 flex flex-col max-h-[580px]">

        {/* Animated Background Glow */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-indigo-50/20 blur-3xl animate-pulse pointer-events-none" />
        <div className="absolute top-1/2 -left-8 w-24 h-24 bg-purple-500/10 blur-2xl rounded-full pointer-events-none" />

        {/* Header */}
        <div className="p-4 pb-1">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 flex items-center justify-center shadow-lg transform rotate-3 bg-white rounded-xl border border-slate-100 p-1">
                <Logo size={28} />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">Filli AI</h1>
                <p className="text-[10px] font-bold text-slate-400 mt-1 flex items-center gap-1 uppercase tracking-widest">
                  <span className={`w-1.5 h-1.5 rounded-full ${formFields > 0 ? 'bg-emerald-500 animate-ping' : 'bg-slate-300'}`} />
                  {formFields > 0 ? `${formFields} Elements Detected` : 'No Forms Detected'}
                </p>
              </div>
            </div>
            <button
              onClick={() => chrome.runtime.openOptionsPage()}
              className="p-2.5 rounded-xl bg-slate-100/50 hover:bg-slate-200/50 text-slate-600 transition-all hover:rotate-12 cursor-pointer"
              title="Open Settings"
            >
              <Settings className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body Container */}
        <div className="flex-1 overflow-y-auto min-h-0 py-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-slate-200/80">

          {/* Connection Status Card */}
          <div className="px-6 mb-3">
            <div className="bg-gradient-to-br from-indigo-50/40 via-purple-50/20 to-slate-50/50 backdrop-blur-xl border border-indigo-100/40 rounded-2xl p-3 flex flex-col gap-2.5 shadow-sm shadow-indigo-100/10 animate-in fade-in duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md shadow-indigo-200/50 text-white">
                    {mode.icon}
                  </div>
                  <div>
                    <p className="text-[14px] font-black text-slate-800 leading-none">
                      {mode.label}
                    </p>
                    <p className="text-[9px] font-bold text-slate-400 mt-1 leading-none uppercase tracking-wider">
                      {aiProvider === 'cloud' ? (authToken ? 'Cloud Engine' : 'Cloud Engine (Auth Required)') : aiProvider === 'local' ? 'Local Engine' : 'Private Key Engine'}
                    </p>
                  </div>
                </div>
                <div className={`px-2 py-0.5 rounded-full border flex items-center gap-1 shadow-sm ${limitReached
                  ? 'bg-rose-50 border-rose-100 text-rose-600 shadow-rose-50'
                  : 'bg-emerald-50 border-emerald-100 text-emerald-700 shadow-emerald-50'
                  }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${limitReached ? 'bg-rose-500' : 'bg-emerald-500 animate-pulse'}`} />
                  <span className="text-[9px] font-black uppercase tracking-widest leading-none">
                    {limitReached ? 'Limited' : 'Active'}
                  </span>
                </div>
              </div>
              <div className="border-t border-slate-100/60 pt-2 flex items-center justify-between text-[11px] font-semibold text-slate-500 leading-none">
                <span className="truncate max-w-[170px] text-slate-400 font-medium">{authToken ? userEmail : 'Guest User'}</span>
                <span className="text-slate-600 font-black">{mode.desc}</span>
              </div>
            </div>
          </div>

          {/* Quick Interface Toggle Settings */}
          <div className="px-6 mb-3">
            <div className="bg-white/40 border border-white/60 rounded-2xl p-2.5 flex items-center justify-between shadow-sm animate-in fade-in duration-300">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-600/10 text-indigo-600">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                    <path d="M9 3v18" />
                  </svg>
                </div>
                <div>
                  <p className="text-[12px] font-bold text-slate-800 leading-none">In-Page Shortcut</p>
                  <p className="text-[9.5px] font-semibold text-slate-400 mt-1 leading-none">Show shortcut panel inside forms</p>
                </div>
              </div>
              <button
                onClick={toggleFloatingDock}
                className={`w-9 h-5 rounded-full p-0.5 transition-colors focus:outline-none cursor-pointer ${enableFloatingDock ? 'bg-indigo-600' : 'bg-slate-300'
                  }`}
                title={enableFloatingDock ? "Hide in-page dock" : "Show in-page dock"}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${enableFloatingDock ? 'translate-x-4' : 'translate-x-0'
                    }`}
                />
              </button>
            </div>
          </div>

          {/* Form Insights */}
          <div className="px-6 mb-3 flex justify-between gap-3">
            <div className="flex-1 bg-white/40 border border-white/60 p-2.5 rounded-2xl text-center">
              <p className="text-[18px] font-black text-slate-800 mb-0">{formFields}</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Fields Found</p>
            </div>
            <div className="flex-1 bg-indigo-50/50 border border-indigo-100 p-2.5 rounded-2xl text-center">
              <p className="text-[18px] font-black text-indigo-600 mb-0">~{(formFields * 1.5).toFixed(0)}s</p>
              <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">Time Saved</p>
            </div>
          </div>

          {/* Persona Selector Grid */}
          <div className="px-6 mb-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex justify-between items-center">
              <span>Filling Persona</span>
              <button
                onClick={() => {
                  if (!isBypass && userPlan !== 'Pro Plan' && aiProvider === 'cloud') {
                    setErrorMessage("Custom instructions require a Pro Plan or personal API key (BYOK).");
                    setLimitReached(true);
                    setLimitErrorMessage("Custom instructions require a Pro Plan or personal API key (BYOK).");
                    return;
                  }
                  setShowCustomPrompt(!showCustomPrompt);
                }}
                disabled={formFields === 0}
                className={`font-bold text-[9px] uppercase tracking-normal transition-colors ${formFields === 0
                  ? 'text-slate-300 cursor-not-allowed'
                  : 'text-indigo-600 hover:text-indigo-700 cursor-pointer'
                  }`}
              >
                {showCustomPrompt ? 'Hide Prompt' : '+ Add Instruction'}
              </button>
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => changePersona('default')}
                disabled={formFields === 0}
                className={`p-2 h-8 rounded-xl text-center text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${formFields === 0
                  ? 'bg-slate-100/50 border-slate-200/50 text-slate-400 cursor-not-allowed'
                  : persona === 'default'
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200 cursor-pointer'
                    : 'bg-slate-50 border-slate-200/80 text-slate-600 hover:bg-slate-100/80 cursor-pointer'
                  }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Default</span>
              </button>
              <button
                onClick={() => changePersona('profile')}
                disabled={formFields === 0}
                className={`p-2 h-8 rounded-xl text-center text-xs font-bold border transition-all flex items-center justify-center gap-1.5 relative ${formFields === 0
                  ? 'bg-slate-100/50 border-slate-200/50 text-slate-400 cursor-not-allowed'
                  : persona === 'profile'
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200 cursor-pointer'
                    : 'bg-slate-50 border-slate-200/80 text-slate-600 hover:bg-slate-100/80 cursor-pointer'
                  }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>My Profile</span>
                {formFields > 0 && !hasProfile && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-500 rounded-full border border-white" title="Profile not configured" />
                )}
              </button>
              <button
                onClick={() => changePersona('qa')}
                disabled={formFields === 0}
                className={`p-2 h-8 rounded-xl text-center text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${formFields === 0
                  ? 'bg-slate-100/50 border-slate-200/50 text-slate-400 cursor-not-allowed'
                  : persona === 'qa'
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200 cursor-pointer'
                    : 'bg-slate-50 border-slate-200/80 text-slate-600 hover:bg-slate-100/80 cursor-pointer'
                  }`}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>QA Test</span>
                {!isBypass && (
                  <span className={`text-[8.5px] px-1 py-0.2 rounded font-black ml-0.5 ${persona === 'qa' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'}`}>
                    {qaRemaining}/5
                  </span>
                )}
              </button>
              <button
                onClick={() => changePersona('b2b')}
                disabled={formFields === 0}
                className={`p-2 h-8 rounded-xl text-center text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${formFields === 0
                  ? 'bg-slate-100/50 border-slate-200/50 text-slate-400 cursor-not-allowed'
                  : persona === 'b2b'
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200 cursor-pointer'
                    : 'bg-slate-50 border-slate-200/80 text-slate-600 hover:bg-slate-100/80 cursor-pointer'
                  }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>B2B Corp</span>
              </button>
            </div>

            {/* Multi-Profile Vault Selector */}
            {persona === 'profile' && formFields > 0 && savedProfiles.length > 0 && (
              <div className="mt-2.5 p-2 bg-slate-50/90 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs animate-in fade-in duration-200">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <User className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider shrink-0">Profile:</span>
                  <select
                    value={activeProfileId}
                    onChange={(e) => handleSwitchProfile(e.target.value)}
                    className="text-[11px] font-bold text-slate-800 bg-transparent border-none outline-none cursor-pointer truncate max-w-[170px] hover:text-indigo-600 transition-colors"
                  >
                    {savedProfiles.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => chrome.runtime.openOptionsPage()}
                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 hover:underline shrink-0 ml-2 cursor-pointer"
                >
                  Manage ⚙
                </button>
              </div>
            )}

            {/* QA Suite Flavor Selector */}
            {persona === 'qa' && formFields > 0 && (
              <div className="mt-2 p-2 bg-amber-50/70 border border-amber-200/60 rounded-xl animate-in fade-in duration-200">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                    QA Suite Flavor
                  </span>
                  {qaFlavor === 'appsec_pro' && (
                    <span className="text-[9px] font-black text-purple-700 bg-purple-100 px-1.5 py-0.2 rounded border border-purple-200 uppercase tracking-wider">
                      Pro / BYOK
                    </span>
                  )}
                </div>
                <select
                  value={qaFlavor}
                  onChange={(e) => handleQaFlavorChange(e.target.value as QAFlavor)}
                  className="w-full text-xs font-bold text-slate-800 bg-white border border-amber-200 rounded-lg p-1.5 focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="all">Mixed Edge-Cases & Fuzzing (Standard)</option>
                  <option value="realistic">Realistic SDET Clean Pass</option>
                  <option value="boundary">Boundary Limits & MaxLength Overflow</option>
                  <option value="security">Basic Security (XSS / SQL Injection)</option>
                  <option value="appsec_pro">⚡ OWASP AppSec Penetration Suite (Pro)</option>
                </select>
              </div>
            )}

            {/* Custom Instruction Input & Per-Domain Memory */}
            {showCustomPrompt && formFields > 0 && (
              <div className="mt-2 animate-in slide-in-from-top-2 duration-200">
                <textarea
                  value={customPrompts[persona]}
                  onChange={(e) => changeCustomPrompt(e.target.value)}
                  placeholder={currentDomain ? `e.g. Instructions specific to ${currentDomain}...` : "e.g. A developer from Seattle named Jane who loves coding..."}
                  rows={2}
                  className="w-full text-xs rounded-xl border border-slate-200 focus:border-indigo-500 focus:outline-none p-2.5 resize-none font-sans bg-slate-50/50 backdrop-blur-md"
                />
                {currentDomain && (
                  <div className="mt-1 flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1 text-slate-500 font-medium truncate max-w-[200px]">
                      <Globe className="w-3 h-3 text-indigo-500 shrink-0" />
                      <span className="truncate">{currentDomain}</span>
                      {domainPromptSaved && (
                        <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-100">
                          Saved
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {domainPromptSaved ? (
                        <button
                          onClick={handleRemoveDomainPrompt}
                          className="font-bold text-rose-500 hover:text-rose-700 cursor-pointer"
                        >
                          Forget
                        </button>
                      ) : (
                        <button
                          onClick={handleSaveDomainPrompt}
                          className="font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer flex items-center gap-0.5"
                        >
                          📌 Remember for site
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {domainSaveMsg && (
                  <p className={`text-[9.5px] font-semibold mt-1 ${domainSaveMsg.includes('Saved') ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {domainSaveMsg}
                  </p>
                )}
              </div>
            )}

            {/* Unconfigured Profile Alert */}
            {persona === 'profile' && !hasProfile && formFields > 0 && (
              <div className="mt-2 flex items-center gap-2 text-amber-600 bg-amber-50/80 px-3.5 py-2.5 rounded-2xl border border-amber-100/80 text-[10px] font-semibold animate-in fade-in duration-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <div className="flex-1 leading-normal">
                  Your profile card is empty.
                  <button
                    onClick={() => chrome.runtime.openOptionsPage()}
                    className="text-indigo-600 hover:underline ml-1 font-black inline cursor-pointer"
                  >
                    Setup Profile Card
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Main Action Trigger */}
          <div className="px-6 pb-4">
            <button
              onClick={handleFill}
              disabled={loading || formFields === 0}
              className={`w-full group relative h-12 rounded-2xl overflow-hidden transition-all duration-300 transform ${formFields === 0
                ? 'bg-slate-100 border border-slate-200/60 opacity-50 cursor-not-allowed'
                : loading
                  ? 'opacity-80 cursor-default'
                  : 'active:scale-[0.97] hover:shadow-xl hover:scale-[1.02] cursor-pointer'
                }`}
            >
              {/* Button Layer - Dynamic Gradients */}
              {formFields > 0 && (
                <div className={`absolute inset-0 pointer-events-none ${limitReached ? 'bg-gradient-to-r from-rose-500 to-orange-600' : persona === 'qa' ? 'bg-gradient-to-r from-amber-500 to-orange-600' : 'bg-gradient-to-r from-indigo-600 to-violet-700'}`} />
              )}
              {formFields === 0 && (
                <div className="absolute inset-0 pointer-events-none bg-slate-200" />
              )}

              {/* Shine Effect */}
              {formFields > 0 && (
                <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-[100%] group-hover:translate-x-[100%] duration-1000 ease-in-out" />
              )}

              <div className="relative flex items-center justify-center gap-3 pointer-events-none">
                {getButtonIcon()}
                <span className={`font-black text-base tracking-tight ${formFields === 0 ? 'text-slate-400' : 'text-white'}`}>
                  {getButtonText()}
                </span>
              </div>
            </button>

            <div className="flex flex-col items-center gap-2 mt-2.5">
              {formFields === 0 && (
                <div className="flex items-center gap-2 text-slate-500 bg-slate-50 px-3 py-2 rounded-2xl border border-slate-100/50 text-center text-[10px] font-semibold max-w-[320px] leading-normal animate-in fade-in">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                  <span>Navigate to a page containing input fields (like a signup or checkout form) to start autofilling.</span>
                </div>
              )}
              {(limitReached || errorMessage) && formFields > 0 && (
                <div className="flex items-center gap-2 text-rose-700 bg-rose-50/80 px-3 py-2 rounded-2xl border border-rose-100 text-center text-[10px] font-bold max-w-[320px] leading-normal shadow-sm">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <span className="text-left">{getFriendlyErrorMessage(errorMessage || limitErrorMessage) || 'Usage limit reached. Click above to sign in or upgrade.'}</span>
                </div>
              )}
              {formFields > 0 && (
                <button
                  onClick={() => {
                    setFormFields(0); // Trigger visual reset
                    // Re-run detection
                    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
                      if (tab?.id) {
                        chrome.tabs.sendMessage(tab.id, { action: 'detect_fields' }, (res) => {
                          if (chrome.runtime.lastError) return;
                          if (res?.count) setFormFields(f => Math.max(f, res.count));
                        });
                        chrome.runtime.sendMessage({ action: 'get_tab_info', tabId: tab.id }, (res) => {
                          if (chrome.runtime.lastError) return;
                          if (res?.count) setFormFields(f => Math.max(f, res.count));
                        });
                      }
                    });
                  }}
                  className="text-[10px] font-black text-slate-400 hover:text-indigo-600 uppercase tracking-widest transition-all p-1.5 bg-slate-100/50 rounded-xl cursor-pointer animate-in fade-in"
                >
                  Force Re-Scan Page
                </button>
              )}
            </div>

            {/* Export Bug Report / Test Run */}
            {lastReport && lastReport.fields.length > 0 && (
              <div className="mt-3 p-3 bg-indigo-50/50 border border-indigo-100 rounded-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="text-[11px] font-black text-slate-800">Test Run Report</span>
                    <span className="text-[9px] font-bold text-slate-400">({lastReport.fields.length} fields)</span>
                  </div>
                  <button
                    onClick={() => setShowExportModal(!showExportModal)}
                    className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 bg-white px-2 py-0.5 rounded-lg border border-indigo-100 shadow-xs cursor-pointer"
                  >
                    {showExportModal ? 'Hide' : 'Export Options'}
                  </button>
                </div>

                {showExportModal ? (
                  <div className="flex flex-col gap-1.5 pt-1 border-t border-indigo-100/60">
                    <button
                      onClick={async () => {
                        const md = generateReportMarkdown(lastReport);
                        const success = await copyReportToClipboard(md);
                        if (success) {
                          setCopiedFormat('md');
                          setTimeout(() => setCopiedFormat(''), 2500);
                        }
                      }}
                      className="w-full flex items-center justify-between p-2 rounded-xl bg-white hover:bg-indigo-50/80 border border-slate-200/60 text-xs font-bold text-slate-700 transition-all cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <Copy className="w-3.5 h-3.5 text-indigo-500" />
                        Copy Markdown (GitHub / Jira)
                      </span>
                      {copiedFormat === 'md' ? (
                        <span className="text-[10px] text-emerald-600 flex items-center gap-0.5">
                          <Check className="w-3 h-3" /> Copied!
                        </span>
                      ) : (
                        <span className="text-[9px] text-slate-400">Markdown</span>
                      )}
                    </button>

                    <div className="grid grid-cols-3 gap-1">
                      <button
                        onClick={() => {
                          const md = generateReportMarkdown(lastReport);
                          downloadReportFile(md, `filli-report-${Date.now()}.md`, 'text/markdown');
                        }}
                        className="p-1.5 bg-white hover:bg-slate-100/80 border border-slate-200/60 rounded-xl text-[10px] font-bold text-slate-700 flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Download className="w-3 h-3 text-slate-500" />
                        .MD
                      </button>
                      <button
                        onClick={() => {
                          const csv = generateReportCSV(lastReport);
                          downloadReportFile(csv, `filli-report-${Date.now()}.csv`, 'text/csv');
                        }}
                        className="p-1.5 bg-white hover:bg-slate-100/80 border border-slate-200/60 rounded-xl text-[10px] font-bold text-slate-700 flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Download className="w-3 h-3 text-emerald-600" />
                        .CSV
                      </button>
                      <button
                        onClick={() => {
                          const json = generateReportJSON(lastReport);
                          downloadReportFile(json, `filli-report-${Date.now()}.json`, 'application/json');
                        }}
                        className="p-1.5 bg-white hover:bg-slate-100/80 border border-slate-200/60 rounded-xl text-[10px] font-bold text-slate-700 flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Download className="w-3 h-3 text-purple-600" />
                        .JSON
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={async () => {
                      const md = generateReportMarkdown(lastReport);
                      const success = await copyReportToClipboard(md);
                      if (success) {
                        setCopiedFormat('md_quick');
                        setTimeout(() => setCopiedFormat(''), 2500);
                      }
                    }}
                    className="w-full py-1.5 px-2.5 bg-white/80 hover:bg-white border border-indigo-100 rounded-xl text-[11px] font-bold text-indigo-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    {copiedFormat === 'md_quick' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600">Copied to Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-indigo-600" />
                        <span>1-Click Copy Bug Report (Markdown)</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* In-App Review Prompt */}
          {showReviewPrompt && (
            <div className="mx-6 mb-4 p-3.5 bg-gradient-to-br from-amber-500/10 via-indigo-500/10 to-violet-500/10 border border-amber-300/50 rounded-2xl relative shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
              <button
                onClick={handleDismissReview}
                className="absolute top-2.5 right-2.5 text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center gap-1.5 mb-1">
                <div className="flex text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <span className="text-[11px] font-black text-slate-800 tracking-tight">Enjoying Filli AI?</span>
              </div>

              <p className="text-[10.5px] text-slate-600 mb-2.5 leading-snug font-medium">
                Saved you manual typing? A quick 5-star review on the Chrome Store helps us rank and keep features free!
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleOpenReview}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs py-1.5 px-3 rounded-xl shadow-sm transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
                >
                  <Star className="w-3.5 h-3.5 fill-white text-white" />
                  <span>Rate on Chrome Store</span>
                </button>
                <button
                  onClick={handleDismissReview}
                  className="text-[10px] font-semibold text-slate-400 hover:text-slate-600 px-2 py-1.5 transition-colors cursor-pointer"
                >
                  Later
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
          <button className="flex items-center gap-2 text-[10px] font-black text-slate-400 hover:text-indigo-600 uppercase tracking-widest transition-all group cursor-pointer">
            <History className="w-3.5 h-3.5 group-hover:rotate-[-45deg] transition-transform" />
            History
          </button>
          <button
            onClick={() => chrome.tabs.create({ url: CHROME_STORE_REVIEW_URL })}
            className="flex items-center gap-1 text-[9px] font-black text-slate-400 hover:text-amber-500 transition-colors uppercase tracking-widest cursor-pointer"
          >
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            Rate 5★
          </button>
        </div>
      </div>
    </div>
  );
};
