import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Lock, Settings2, CheckCircle2, AlertCircle, User, Globe } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { posthog } from '@/lib/posthog';

// Subcomponents
import { OnboardingWizard } from './components/OnboardingWizard';
import { ProfileCardForm } from './components/ProfileCardForm';
import { BillingAccount } from './components/BillingAccount';
import { ProviderConfig } from './components/ProviderConfig';

export const Options = () => {
  const [activeTab, setActiveTab] = useState<'account' | 'profile' | 'advanced'>('profile');
  const [provider, setProvider] = useState('cloud');
  const [geminiKey, setGeminiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [proxyUrl, setProxyUrl] = useState('');
  // Validation & Notification state
  const [phoneError, setPhoneError] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [isOnboarding] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('onboarding') === 'true';
    }
    return false;
  });
  const [onboardingStep, setOnboardingStep] = useState<'walkthrough' | 'profile' | 'success'>('walkthrough');
  const [previewPersona, setPreviewPersona] = useState<'default' | 'profile' | 'qa' | 'b2b'>('default');
  const [profileCompleted, setProfileCompleted] = useState(false);
  const [enableFloatingDock, setEnableFloatingDock] = useState(true);

  // Advanced Tab states
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [localAiStatus, setLocalAiStatus] = useState<'checking' | 'available' | 'unavailable'>('checking');

  // API Key Visibility States
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);

  // Connection Testing States
  const [testLoading, setTestLoading] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string } | null>>({});

  const triggerToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // Personal Profile state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [bio, setBio] = useState('');

  // SaaS Account Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [userAvatar, setUserAvatar] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [userPlan, setUserPlan] = useState('Free Tier');
  const [usageCount, setUsageCount] = useState(0);
  const [usageLimit] = useState(50); // Free Plan limit
  const [userId, setUserId] = useState('');
  const [customerPortalUrl, setCustomerPortalUrl] = useState('');
  const [checkoutUrl, setCheckoutUrl] = useState('');

  // Auth state
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    // Check if we opened with a session callback in the URL hash (from Supabase email confirmation link)
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const accessToken = params.get('access_token');
      const errorDescription = params.get('error_description');

      if (errorDescription) {
        triggerToast(decodeURIComponent(errorDescription), 'error');
      } else if (accessToken) {
        setAuthLoading(true);
        supabase.auth.getUser(accessToken).then(({ data: userData, error: userError }) => {
          if (userError || !userData.user) {
            triggerToast(userError?.message || 'Failed to retrieve user profile.', 'error');
            setAuthLoading(false);
            return;
          }

          const user = userData.user;
          const avatar = user.user_metadata?.avatar_url || '';
          const fullName = user.user_metadata?.full_name || '';
          const cloudUrl = 'https://autofill-ai-proxy.vinaykondabattula.workers.dev';
          let plan = 'Free Tier';
          let usage = 0;
          let portalUrl = '';

          fetch(`${cloudUrl}/usage`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            }
          })
            .then(res => res.ok ? res.json() : null)
            .then(data => {
              if (data) {
                plan = data.userPlan || 'Free Tier';
                usage = data.usageCount || 0;
                portalUrl = data.customerPortalUrl || '';
              }
            })
            .catch(err => {
              console.log('Error fetching usage on redirect:', err);
            })
            .finally(() => {
              chrome.storage.local.get(['profileFirstName', 'profileLastName', 'profileEmail'], (res) => {
                const parts = fullName.trim().split(/\s+/);
                const metaFirstName = parts[0] || '';
                const metaLastName = parts.slice(1).join(' ') || '';
                const metaEmail = user.email || '';

                const updateObj: Record<string, string | number | boolean | undefined> = {
                  authToken: accessToken,
                  userEmail: user.email,
                  userPlan: plan,
                  usageCount: usage,
                  userId: user.id,
                  userName: fullName,
                  userAvatar: avatar,
                  customerPortalUrl: portalUrl
                };

                let changedProfile = false;
                if (!res.profileFirstName) {
                  updateObj.profileFirstName = metaFirstName;
                  setFirstName(metaFirstName);
                  changedProfile = true;
                }
                if (!res.profileLastName) {
                  updateObj.profileLastName = metaLastName;
                  setLastName(metaLastName);
                  changedProfile = true;
                }
                if (!res.profileEmail) {
                  updateObj.profileEmail = metaEmail;
                  setEmail(metaEmail);
                  changedProfile = true;
                }

                chrome.storage.local.set(updateObj, () => {
                  setAuthToken(accessToken);
                  setUserEmail(user.email || '');
                  setUserPlan(plan);
                  setUsageCount(usage);
                  setUserId(user.id);
                  setUserName(fullName);
                  setUserAvatar(avatar);
                  setCustomerPortalUrl(portalUrl);
                  setIsLoggedIn(true);
                  setAuthLoading(false);

                  // PostHog Telemetry Identification
                  posthog.identify(user.id);
                  posthog.people.set({
                    email: user.email,
                    name: fullName,
                    plan: plan
                  });
                  posthog.capture('user_login_success', { method: 'oauth_google' });

                  setActiveTab('account'); // Force switch back to account tab upon redirect
                  triggerToast(changedProfile ? 'Signed in successfully! Profile details imported from Google.' : 'Signed in successfully!');
                  window.history.replaceState(null, '', window.location.pathname);
                });
              });
            });
        });
      }
    }

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get([
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
        'userEmail',
        'userPlan',
        'usageCount',
        'userId',
        'userName',
        'userAvatar',
        'enableFloatingDock',
        'activeTabOnOpen',
        'customerPortalUrl'
      ], (result: Record<string, string | number | boolean | undefined>) => {
        if (typeof result.activeTabOnOpen === 'string' && (result.activeTabOnOpen === 'account' || result.activeTabOnOpen === 'profile' || result.activeTabOnOpen === 'advanced')) {
          setActiveTab(result.activeTabOnOpen as 'account' | 'profile' | 'advanced');
          chrome.storage.local.remove('activeTabOnOpen');
        }
        if (typeof result.geminiApiKey === 'string') setGeminiKey(result.geminiApiKey);
        if (typeof result.openaiApiKey === 'string') setOpenaiKey(result.openaiApiKey);
        if (typeof result.anthropicApiKey === 'string') setAnthropicKey(result.anthropicApiKey);
        if (typeof result.aiProvider === 'string') setProvider(result.aiProvider);
        if (typeof result.cloudProxyUrl === 'string') setProxyUrl(result.cloudProxyUrl);
        if (typeof result.profilePhone === 'string') setPhone(result.profilePhone);
        if (typeof result.profileCompany === 'string') setCompany(result.profileCompany);
        if (typeof result.profileJobTitle === 'string') setJobTitle(result.profileJobTitle);
        if (typeof result.profileBio === 'string') setBio(result.profileBio);
        if (typeof result.userId === 'string') setUserId(result.userId);
        if (typeof result.userName === 'string') setUserName(result.userName);
        if (typeof result.userAvatar === 'string') setUserAvatar(result.userAvatar);

        // Extract details from Google metadata if profile FirstName/LastName/Email is empty
        let currentFirstName = result.profileFirstName as string || '';
        let currentLastName = result.profileLastName as string || '';
        let currentEmail = result.profileEmail as string || '';

        const loggedIn = !!result.authToken;
        const googleName = result.userName as string || '';
        const googleEmail = result.userEmail as string || '';

        let profileUpdated = false;
        if (loggedIn) {
          const parts = googleName.trim().split(/\s+/);
          const metaFirstName = parts[0] || '';
          const metaLastName = parts.slice(1).join(' ') || '';

          if (!currentFirstName && metaFirstName) {
            currentFirstName = metaFirstName;
            profileUpdated = true;
          }
          if (!currentLastName && metaLastName) {
            currentLastName = metaLastName;
            profileUpdated = true;
          }
          if (!currentEmail && googleEmail) {
            currentEmail = googleEmail;
            profileUpdated = true;
          }
        }

        setFirstName(currentFirstName);
        setLastName(currentLastName);
        setEmail(currentEmail);

        if (profileUpdated) {
          chrome.storage.local.set({
            profileFirstName: currentFirstName,
            profileLastName: currentLastName,
            profileEmail: currentEmail
          });
        }

        if (typeof result.authToken === 'string') {
          const token = result.authToken;
          setAuthToken(token);
          setIsLoggedIn(true);

          // Sync usage count and plan from cloud on load
          const cloudUrl = 'https://autofill-ai-proxy.vinaykondabattula.workers.dev';
          fetch(`${cloudUrl}/usage`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          })
            .then(res => {
              if (!res.ok) throw new Error('Unauthenticated or server error');
              return res.json();
            })
            .then(data => {
              if (data.userPlan) {
                setUserPlan(data.userPlan);
                chrome.storage.local.set({ userPlan: data.userPlan });
              }
              if (typeof data.usageCount === 'number') {
                setUsageCount(data.usageCount);
                chrome.storage.local.set({ usageCount: data.usageCount });
              }
              if (data.customerPortalUrl !== undefined) {
                setCustomerPortalUrl(data.customerPortalUrl);
                chrome.storage.local.set({ customerPortalUrl: data.customerPortalUrl });
              }
            })
            .catch(err => {
              console.log('Could not sync usage on load, possibly token expired:', err);
            });
        }
        if (typeof result.userEmail === 'string') setUserEmail(result.userEmail);
        if (typeof result.userPlan === 'string') setUserPlan(result.userPlan);
        if (typeof result.usageCount === 'number') setUsageCount(result.usageCount);
        if (typeof result.customerPortalUrl === 'string') setCustomerPortalUrl(result.customerPortalUrl);
        if (result.enableFloatingDock !== undefined) {
          setEnableFloatingDock(!!result.enableFloatingDock);
        }

        // PostHog Telemetry Identification on load
        if (loggedIn && typeof result.userId === 'string') {
          posthog.identify(result.userId);
          posthog.people.set({
            email: googleEmail,
            name: googleName,
            plan: result.userPlan as string || 'Free Tier'
          });
        }

        // Fetch dynamic checkout URL from active proxy URL
        const activeProxy = (result.cloudProxyUrl as string) || 'https://autofill-ai-proxy.vinaykondabattula.workers.dev';
        fetch(`${activeProxy}/config`, { method: 'GET' })
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data && data.checkoutUrl) {
              setCheckoutUrl(data.checkoutUrl);
            }
          })
          .catch(err => {
            console.log('Error fetching dynamic checkoutUrl:', err);
          });

        setLoadingSettings(false);
      });
    } else {
      setLoadingSettings(false);
    }

    const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes.usageCount) {
        setUsageCount(changes.usageCount.newValue as number || 0);
      }
      if (changes.userPlan) {
        setUserPlan(changes.userPlan.newValue as string || 'Free Tier');
      }
      if (changes.customerPortalUrl) {
        setCustomerPortalUrl(changes.customerPortalUrl.newValue as string || '');
      }
      if (changes.authToken) {
        const token = changes.authToken.newValue as string || '';
        setAuthToken(token);
        setIsLoggedIn(!!token);
      }
      if (changes.userEmail) {
        setUserEmail(changes.userEmail.newValue as string || '');
      }
      if (changes.userName) {
        setUserName(changes.userName.newValue as string || '');
      }
      if (changes.userAvatar) {
        setUserAvatar(changes.userAvatar.newValue as string || '');
      }
      if (changes.profileFirstName) {
        setFirstName(changes.profileFirstName.newValue as string || '');
      }
      if (changes.profileLastName) {
        setLastName(changes.profileLastName.newValue as string || '');
      }
      if (changes.profileEmail) {
        setEmail(changes.profileEmail.newValue as string || '');
      }
    };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange);
    }

    return () => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      }
    };
  }, []);

  // Check Chrome Local AI (Gemini Nano) capability on mount
  useEffect(() => {
    const checkLocalAI = async () => {
      try {
        const winAi = typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>).ai as Record<string, unknown> | undefined : undefined;
        const ai = (((self as unknown as Record<string, unknown>).ai || (chrome as unknown as Record<string, unknown>).aiOriginTrial || winAi)) as Record<string, unknown> | undefined;
        if (ai && typeof ai === 'object' && ai.languageModel && typeof ai.languageModel === 'object') {
          const lm = ai.languageModel as Record<string, unknown>;
          if (typeof lm.capabilities === 'function') {
            const caps = await (lm.capabilities as () => Promise<{ available: string }>)();
            if (caps && caps.available !== 'no') {
              setLocalAiStatus('available');
              return;
            }
          }
        }
        setLocalAiStatus('unavailable');
      } catch (err) {
        console.warn("Local AI capability check failed:", err);
        setLocalAiStatus('unavailable');
      }
    };
    checkLocalAI();
  }, []);

  // Auto-save all configuration states to chrome local storage when updated (debounced 600ms)
  useEffect(() => {
    if (loadingSettings) return;

    const delayDebounceFn = setTimeout(() => {
      chrome.storage.local.set({
        geminiApiKey: geminiKey,
        openaiApiKey: openaiKey,
        anthropicApiKey: anthropicKey,
        aiProvider: provider,
        cloudProxyUrl: proxyUrl,
        profileFirstName: firstName,
        profileLastName: lastName,
        profileEmail: email,
        profilePhone: phone,
        profileCompany: company,
        profileJobTitle: jobTitle,
        profileBio: bio,
        enableFloatingDock: enableFloatingDock
      }, () => {
        console.log("[AutoSave] Storage configuration synchronized.");
      });
    }, 600);

    return () => clearTimeout(delayDebounceFn);
  }, [
    geminiKey, openaiKey, anthropicKey, provider, proxyUrl,
    firstName, lastName, email, phone, company, jobTitle, bio,
    enableFloatingDock, loadingSettings
  ]);

  const testConnection = (providerId: string, apiKey: string, customUrl?: string) => {
    if (providerId === 'gemini' || providerId === 'openai' || providerId === 'anthropic') {
      let hostPattern = '';
      if (providerId === 'openai') hostPattern = 'https://api.openai.com/*';
      if (providerId === 'gemini') hostPattern = 'https://generativelanguage.googleapis.com/*';
      if (providerId === 'anthropic') hostPattern = 'https://api.anthropic.com/*';

      chrome.permissions.contains({
        origins: [hostPattern]
      }, (hasPermission) => {
        if (hasPermission) {
          executeTestConnection(providerId, apiKey, customUrl);
        } else {
          chrome.permissions.request({
            origins: [hostPattern]
          }, (granted) => {
            if (granted) {
              executeTestConnection(providerId, apiKey, customUrl);
            } else {
              triggerToast(`Permission denied for ${providerId} API host.`, 'error');
            }
          });
        }
      });
    } else {
      executeTestConnection(providerId, apiKey, customUrl);
    }
  };

  const executeTestConnection = (providerId: string, apiKey: string, customUrl?: string) => {
    setTestLoading(prev => ({ ...prev, [providerId]: true }));
    setTestResults(prev => ({ ...prev, [providerId]: null }));

    chrome.runtime.sendMessage({
      action: 'test_connection',
      provider: providerId,
      key: apiKey,
      proxyUrl: customUrl
    }, (response) => {
      setTestLoading(prev => ({ ...prev, [providerId]: false }));
      if (chrome.runtime.lastError) {
        setTestResults(prev => ({
          ...prev,
          [providerId]: { success: false, message: chrome.runtime.lastError?.message || "Failed to communicate with service worker." }
        }));
      } else if (response && response.success) {
        setTestResults(prev => ({
          ...prev,
          [providerId]: { success: true, message: response.message || "Connection verified successfully!" }
        }));
      } else {
        setTestResults(prev => ({
          ...prev,
          [providerId]: { success: false, message: response?.error || "Invalid response or authentication failure." }
        }));
      }
    });
  };

  const validatePhone = (num: string): boolean => {
    const clean = num.trim();
    if (!clean) return true; // optional
    const stripped = clean.replace(/[\s\-()]/g, '');
    return /^\+[1-9]\d{0,2}\d{10}$/.test(stripped);
  };

  const handlePhoneChange = (val: string) => {
    setPhone(val);
    if (!val.trim()) {
      setPhoneError('');
    }
  };

  const handlePhoneBlur = () => {
    if (phone.trim() && !validatePhone(phone)) {
      setPhoneError('Please enter a valid phone number with country code followed by 10 digits (e.g. +1 555-019-2834 or +91 98765-43210)');
    } else {
      setPhoneError('');
    }
  };

  const handleSave = () => {
    if (phone.trim() && !validatePhone(phone)) {
      setPhoneError('Please enter a valid phone number with country code followed by 10 digits (e.g. +1 555-019-2834 or +91 98765-43210)');
      triggerToast('Please fix validation errors first.', 'error');
      return;
    }
    chrome.storage.local.set({
      geminiApiKey: geminiKey,
      openaiApiKey: openaiKey,
      anthropicApiKey: anthropicKey,
      aiProvider: provider,
      cloudProxyUrl: proxyUrl,
      profileFirstName: firstName,
      profileLastName: lastName,
      profileEmail: email,
      profilePhone: phone,
      profileCompany: company,
      profileJobTitle: jobTitle,
      profileBio: bio,
      enableFloatingDock: enableFloatingDock
    }, () => {
      triggerToast('Settings saved successfully!');
      if (isOnboarding) {
        setProfileCompleted(true);
        setOnboardingStep('success');
      }
    });
  };

  const handleProviderChange = (newProvider: string) => {
    if (newProvider === 'openai' || newProvider === 'gemini' || newProvider === 'anthropic') {
      let hostPattern = '';
      if (newProvider === 'openai') hostPattern = 'https://api.openai.com/*';
      if (newProvider === 'gemini') hostPattern = 'https://generativelanguage.googleapis.com/*';
      if (newProvider === 'anthropic') hostPattern = 'https://api.anthropic.com/*';

      chrome.permissions.contains({
        origins: [hostPattern]
      }, (hasPermission) => {
        if (hasPermission) {
          setProvider(newProvider);
        } else {
          chrome.permissions.request({
            origins: [hostPattern]
          }, (granted) => {
            if (granted) {
              setProvider(newProvider);
            } else {
              triggerToast(`Permission denied for ${newProvider} API host.`, 'error');
            }
          });
        }
      });
    } else {
      setProvider(newProvider);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError('');
    setAuthLoading(true);
    const originalConsoleError = console.error;
    console.error = (...args) => {
      const isFetchError = args.some(arg =>
        (arg instanceof Error && (arg.message === 'Failed to fetch' || arg.message.toLowerCase().includes('failed to fetch'))) ||
        (typeof arg === 'string' && arg.toLowerCase().includes('failed to fetch'))
      );
      if (isFetchError) {
        const cleanArgs = args.map(arg => {
          if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
          return String(arg);
        });
        console.log('Supabase fetch failed silently (intercepted console.error to keep extensions dashboard clean):', ...cleanArgs);
        return;
      }
      originalConsoleError.apply(console, args);
    };

    try {
      const redirectToUrl = chrome.runtime.getURL('options.html');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectToUrl
        }
      });
      if (error) {
        let message = error.message;
        if (message === 'Failed to fetch' || message.toLowerCase().includes('failed to fetch')) {
          message = 'Could not connect to the authentication server. Please check your internet connection or verify if the Supabase project configuration is active.';
        }
        setAuthError(message);
        setAuthLoading(false);
      }
    } catch (err: unknown) {
      let message = err instanceof Error ? err.message : 'Google sign-in failed.';
      if (message === 'Failed to fetch' || message.toLowerCase().includes('failed to fetch')) {
        message = 'Could not connect to the authentication server. Please check your internet connection or verify if the Supabase project configuration is active.';
      }
      setAuthError(message);
      setAuthLoading(false);
    } finally {
      console.error = originalConsoleError;
    }
  };

  const handleLogout = () => {
    supabase.auth.signOut().finally(() => {
      chrome.storage.local.remove(['authToken', 'userEmail', 'userPlan', 'usageCount', 'userId', 'userName', 'userAvatar', 'customerPortalUrl'], () => {
        setAuthToken('');
        setUserEmail('');
        setUserPlan('Free Tier');
        setUsageCount(0);
        setUserId('');
        setUserName('');
        setUserAvatar('');
        setCustomerPortalUrl('');
        setIsLoggedIn(false);

        // Reset PostHog tracking profile on logout
        posthog.capture('user_logout');
        posthog.reset();

        triggerToast('Logged out successfully.');
      });
    });
  };

  const handleSkip = () => {
    setProfileCompleted(false);
    setOnboardingStep('success');
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#f8fafc] p-6 font-sans">
      <Card className="w-full max-w-lg shadow-2xl border-none overflow-hidden rounded-[32px] bg-white">
        <div className="h-3 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 w-full" />

        {isOnboarding ? (
          /* ONBOARDING FLOW */
          <OnboardingWizard
            onboardingStep={onboardingStep}
            setOnboardingStep={setOnboardingStep}
            previewPersona={previewPersona}
            setPreviewPersona={setPreviewPersona}
            profileCompleted={profileCompleted}
            handleSkip={handleSkip}
            firstName={firstName}
            setFirstName={setFirstName}
            lastName={lastName}
            setLastName={setLastName}
            email={email}
            setEmail={setEmail}
            phone={phone}
            handlePhoneChange={handlePhoneChange}
            handlePhoneBlur={handlePhoneBlur}
            phoneError={phoneError}
            company={company}
            setCompany={setCompany}
            jobTitle={jobTitle}
            setJobTitle={setJobTitle}
            bio={bio}
            setBio={setBio}
            handleSave={handleSave}
          />
        ) : (
          /* STANDARD SETTINGS & PROFILE FORM */
          <>
            <CardHeader className="space-y-3 pb-8 pt-10 px-10">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-indigo-600 border-indigo-100 bg-indigo-50/50 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase">
                  {activeTab === 'account' ? (isLoggedIn ? 'Account' : 'Sign In / Sign Up') : activeTab === 'profile' ? 'My Autofill Card' : 'Developer Controls'}
                </Badge>
                {isLoggedIn && activeTab === 'account' && (
                  <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 flex items-center gap-1 uppercase tracking-widest animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Active
                  </span>
                )}
              </div>
              <CardTitle className="text-4xl font-black tracking-tight text-slate-900 flex items-center gap-3">
                <Sparkles className="w-8 h-8 text-indigo-500 fill-indigo-50" />
                {activeTab === 'account' ? (isLoggedIn ? 'My Account' : 'Sign In / Sign Up') : activeTab === 'profile' ? 'My Profile' : 'AI Provider'}
              </CardTitle>
              <CardDescription className="text-slate-500 text-base font-medium">
                {activeTab === 'account'
                  ? (isLoggedIn
                    ? 'Manage your cloud usage quotas and account preferences.'
                    : 'Create a free cloud account to get 50 high-speed AI fills every month and sync profiles.')
                  : activeTab === 'profile'
                    ? 'Your personal details. Stored safely inside your browser, never shared unless you sync to cloud.'
                    : 'Configure custom APIs, private keys, and advanced options.'}
              </CardDescription>
              <div className="flex items-center gap-2 mt-2 px-3 py-1.5 bg-slate-100 rounded-xl w-fit text-[11px] font-bold text-slate-600 border border-slate-200/50">
                <Lock className="w-3.5 h-3.5 text-indigo-500" />
                <span>Local Sandbox: Data is kept inside your browser</span>
              </div>
            </CardHeader>

            {/* Premium Three-Tab Switcher */}
            <div className="px-10 pb-6">
              <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200/50 gap-1">
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-black rounded-xl transition-all cursor-pointer ${activeTab === 'profile'
                    ? 'bg-white text-slate-900 shadow-sm shadow-slate-200/80'
                    : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                  <User className={`w-4 h-4 transition-colors ${activeTab === 'profile' ? 'text-indigo-500' : 'text-slate-400'}`} />
                  Profile
                </button>
                <button
                  onClick={() => setActiveTab('account')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-black rounded-xl transition-all cursor-pointer ${activeTab === 'account'
                    ? 'bg-white text-slate-900 shadow-sm shadow-slate-200/80'
                    : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                  <Globe className={`w-4 h-4 transition-colors ${activeTab === 'account' ? 'text-indigo-500' : 'text-slate-400'}`} />
                  {isLoggedIn ? 'Account' : 'Sign In / Sign Up'}
                </button>
                <button
                  onClick={() => setActiveTab('advanced')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-black rounded-xl transition-all cursor-pointer ${activeTab === 'advanced'
                    ? 'bg-white text-slate-900 shadow-sm shadow-slate-200/80'
                    : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                  <Settings2 className={`w-4 h-4 transition-colors ${activeTab === 'advanced' ? 'text-indigo-500' : 'text-slate-400'}`} />
                  AI Provider
                </button>
              </div>
            </div>

            <CardContent className="space-y-8 px-10 pb-4">
              {activeTab === 'account' && (
                  <BillingAccount
                    isLoggedIn={isLoggedIn}
                    userEmail={userEmail}
                    userName={userName}
                    userAvatar={userAvatar}
                    userPlan={userPlan}
                    usageCount={usageCount}
                    usageLimit={usageLimit}
                    authToken={authToken}
                    userId={userId}
                    authLoading={authLoading}
                    authError={authError}
                    customerPortalUrl={customerPortalUrl}
                    checkoutUrl={checkoutUrl}
                    handleGoogleSignIn={handleGoogleSignIn}
                    handleLogout={handleLogout}
                    setActiveTab={setActiveTab}
                  />
                )}

              {activeTab === 'profile' && (
                <ProfileCardForm
                  firstName={firstName}
                  setFirstName={setFirstName}
                  lastName={lastName}
                  setLastName={setLastName}
                  email={email}
                  setEmail={setEmail}
                  phone={phone}
                  handlePhoneChange={handlePhoneChange}
                  handlePhoneBlur={handlePhoneBlur}
                  phoneError={phoneError}
                  company={company}
                  setCompany={setCompany}
                  jobTitle={jobTitle}
                  setJobTitle={setJobTitle}
                  bio={bio}
                  setBio={setBio}
                  handleSave={handleSave}
                  handleSkip={handleSkip}
                />
              )}

              {activeTab === 'advanced' && (
                <ProviderConfig
                  provider={provider}
                  handleProviderChange={handleProviderChange}
                  geminiKey={geminiKey}
                  setGeminiKey={setGeminiKey}
                  showGeminiKey={showGeminiKey}
                  setShowGeminiKey={setShowGeminiKey}
                  testConnection={testConnection}
                  testLoading={testLoading}
                  testResults={testResults}
                  openaiKey={openaiKey}
                  setOpenaiKey={setOpenaiKey}
                  showOpenaiKey={showOpenaiKey}
                  setShowOpenaiKey={setShowOpenaiKey}
                  anthropicKey={anthropicKey}
                  setAnthropicKey={setAnthropicKey}
                  showAnthropicKey={showAnthropicKey}
                  setShowAnthropicKey={setShowAnthropicKey}
                  proxyUrl={proxyUrl}
                  setProxyUrl={setProxyUrl}
                  localAiStatus={localAiStatus}
                  enableFloatingDock={enableFloatingDock}
                  setEnableFloatingDock={setEnableFloatingDock}
                  isLoggedIn={isLoggedIn}
                />
              )}
            </CardContent>

            <CardFooter className="flex flex-col gap-4 bg-slate-50/50 border-t border-slate-100 pt-8 pb-10 px-10">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
                  <Settings2 className="w-4 h-4 text-indigo-500/60" />
                  <span>Configure AI & Profile Options</span>
                </div>
                <div className="flex items-center gap-1.5 opacity-40">
                  <div className="w-1 h-1 rounded-full bg-slate-400" />
                  <p className="text-[10px] text-slate-500 font-black tracking-widest uppercase">
                    Version {typeof chrome !== 'undefined' && chrome.runtime?.getManifest ? chrome.runtime.getManifest().version : '1.0.0'}
                  </p>
                </div>
              </div>
            </CardFooter>
          </>
        )}
      </Card>

      <div className="fixed bottom-6 text-center opacity-30">
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em]">Built for efficiency</p>
      </div>

      {/* Premium Toast Notification */}
      <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl backdrop-blur-xl border shadow-2xl transition-all duration-300 transform ${showToast ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-6 opacity-0 scale-95 pointer-events-none'
        } ${toastType === 'success'
          ? 'bg-slate-900/95 border-slate-800 text-white shadow-slate-950/20'
          : 'bg-rose-950/95 border-rose-800 text-rose-100 shadow-rose-950/20'
        }`}>
        {toastType === 'success' ? (
          <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        ) : (
          <div className="w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-lg">
            <AlertCircle className="w-4 h-4" />
          </div>
        )}
        <div className="flex flex-col">
          <span className="text-xs font-black uppercase tracking-widest leading-none mb-1 text-slate-400">
            {toastType === 'success' ? 'Settings Saved' : 'Alert'}
          </span>
          <span className="text-sm font-bold leading-tight">{toastMessage}</span>
        </div>
      </div>
    </div>
  );
};
export default Options;
