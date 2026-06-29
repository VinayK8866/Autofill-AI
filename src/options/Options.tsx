import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Sparkles, Globe, Lock, Settings2, Cpu, Zap, User, LogOut, ArrowRight, AlertCircle, Eye, EyeOff, HelpCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { posthog } from '@/lib/posthog';

// Brand-specific SVG Icons for AI engines
const GeminiIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C12 2 12.5 8.5 15.5 11.5C18.5 14.5 22 15 22 15C22 15 18.5 15.5 15.5 18.5C12.5 21.5 12 22 12 22C12 22 11.5 21.5 8.5 18.5C5.5 15.5 2 15 2 15C2 15 5.5 14.5 8.5 11.5C11.5 8.5 12 2 12 2Z" fill="currentColor" />
    <path d="M12 7C12 7 12.2 9.2 13.2 10.2C14.2 11.2 15.5 11.5 15.5 11.5C15.5 11.5 14.2 11.8 13.2 12.8C12.2 13.8 12 14.5 12 14.5C12 14.5 11.8 13.8 10.8 12.8C9.8 11.8 8.5 11.5 8.5 11.5C8.5 11.5 9.8 11.2 10.8 10.2C11.8 9.2 12 7 12 7Z" fill="#a5b4fc" />
  </svg>
);

const OpenAiIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M21.28 10.96a4.83 4.83 0 0 0-1.86-3.83 4.87 4.87 0 0 0-4.63-.53 4.82 4.82 0 0 0-3.32-3.14 4.88 4.88 0 0 0-4.81 1.7 4.82 4.82 0 0 0-4.63 2.65 4.88 4.88 0 0 0 .18 5.16 4.83 4.83 0 0 0 1.86 3.83 4.87 4.87 0 0 0 4.63.53 4.82 4.82 0 0 0 3.32 3.14 4.88 4.88 0 0 0 4.81-1.7 4.82 4.82 0 0 0 4.63-2.65 4.88 4.88 0 0 0-.18-5.16zm-7.6 6.84a3 3 0 0 1-1.54-.42l3.41-1.97a.5.5 0 0 0 .25-.43v-4.87l1.52.88a.07.07 0 0 1 .04.06v3.91a4.23 4.23 0 0 1-3.68 2.84zM7.5 14.5a3 3 0 0 1 0-1.6l3.41 1.97v1.72a.07.07 0 0 1-.06.04h-3.39A4.23 4.23 0 0 1 7.5 14.5zm-.96-5.83A3 3 0 0 1 8.08 7.5l3.4 1.97a.5.5 0 0 0 .5 0l4.22-2.43 1.52.87a.07.07 0 0 1 .04.06V10a4.23 4.23 0 0 1-3.68 2.84l-3.41-1.97a.5.5 0 0 0-.5 0L6.54 8.67zM12 9.17a3 3 0 0 1 1.54.42L10.13 11.56a.5.5 0 0 0-.25.43v-4.87L8.36 15.98a.07.07 0 0 1-.04-.06v-3.91A4.23 4.23 0 0 1 12 9.17zm4.5 1.33a3 3 0 0 1 0 1.6l-3.41-1.97V9.01a.07.07 0 0 1 .06-.04h3.39c1.9 0 3.52 1.25 3.68 2.84l-3.72-2.31zm-5.46-1.5a.5.5 0 0 0-.25-.43v-4.87l1.52.88c.03.01.04.04.04.06v3.91c0 1.9-1.25 3.52-2.84 3.68l3.41-1.97a.5.5 0 0 0 .25-.43v-3.83z" fill="currentColor" />
  </svg>
);

const ClaudeIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 3L4 21H8.5L10 17.5H14L15.5 21H20L12 3ZM10.8 15.5L12 12.5L13.2 15.5H10.8Z" fill="currentColor" />
  </svg>
);

const CloudExpressIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.5 19A3.5 3.5 0 0 0 21 15.5c0-2.79-2.54-4.5-5-4.5-.7-2.1-2.79-4-5-4-3.15 0-5.69 2.54-5.69 5.69 0 .42.06.84.19 1.25A4.5 4.5 0 0 0 7.5 19H17.5Z" />
    <path d="M12 11l-2 3h4l-2 3" fill="currentColor" stroke="none" />
  </svg>
);

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
                  userAvatar: avatar
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
        'activeTabOnOpen'
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
            })
            .catch(err => {
              console.log('Could not sync usage on load, possibly token expired:', err);
            });
        }
        if (typeof result.userEmail === 'string') setUserEmail(result.userEmail);
        if (typeof result.userPlan === 'string') setUserPlan(result.userPlan);
        if (typeof result.usageCount === 'number') setUsageCount(result.usageCount);
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
      chrome.storage.local.remove(['authToken', 'userEmail', 'userPlan', 'usageCount', 'userId', 'userName', 'userAvatar'], () => {
        setAuthToken('');
        setUserEmail('');
        setUserPlan('Free Tier');
        setUsageCount(0);
        setUserId('');
        setUserName('');
        setUserAvatar('');
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
          onboardingStep === 'walkthrough' ? (
            /* WALKTHROUGH STEP */
            <>
              <CardHeader className="space-y-3 pb-6 pt-10 px-10 text-center">
                <Badge variant="outline" className="mx-auto text-indigo-600 border-indigo-100 bg-indigo-50/50 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase w-fit">
                  Getting Started
                </Badge>
                <CardTitle className="text-3xl font-black tracking-tight text-slate-900 justify-center flex items-center gap-3">
                  <Sparkles className="w-7 h-7 text-indigo-500 fill-indigo-50" />
                  How AutoFill Works
                </CardTitle>
                <CardDescription className="text-slate-500 text-sm font-medium">
                  When you visit any page with a form, a floating side dock will appear. Click on the preview buttons below to see how each persona behaves:
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6 px-10 pb-4 text-center">
                {/* Simulated In-Page Dock Visual */}
                <div className="border border-slate-200/80 rounded-2xl p-4 bg-slate-50/50 shadow-inner relative max-w-sm mx-auto">
                  <div className="absolute -top-3 left-4 px-2 py-0.5 bg-indigo-600 text-white rounded text-[9px] font-black uppercase tracking-wider shadow">Simulated In-Page Dock</div>

                  <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm space-y-4 text-left mt-2 animate-in fade-in zoom-in-95 duration-500">
                    {/* Header */}
                    <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
                      <div className="flex items-center gap-1.5 font-black text-slate-800 text-xs">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-500 fill-indigo-50" />
                        <span>AutoFill AI</span>
                      </div>
                      <span className="text-[9px] bg-indigo-50 text-indigo-600 font-bold px-1.5 py-0.5 rounded">3 fields found</span>
                    </div>

                    {/* Persona Selector Grid */}
                    <div className="space-y-1.5">
                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Filling Persona</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          onClick={() => setPreviewPersona('default')}
                          className={`p-2 rounded-lg text-center text-[10px] font-black border transition-all cursor-pointer ${previewPersona === 'default'
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-100'
                            : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                          ✨ Default (Mock)
                        </button>
                        <button
                          onClick={() => setPreviewPersona('profile')}
                          className={`p-2 rounded-lg text-center text-[10px] font-black border transition-all cursor-pointer ${previewPersona === 'profile'
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-100'
                            : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                          👤 My Profile
                        </button>
                        <button
                          onClick={() => setPreviewPersona('qa')}
                          className={`p-2 rounded-lg text-center text-[10px] font-black border transition-all cursor-pointer ${previewPersona === 'qa'
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-100'
                            : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                          ⚠️ QA Test
                        </button>
                        <button
                          onClick={() => setPreviewPersona('b2b')}
                          className={`p-2 rounded-lg text-center text-[10px] font-black border transition-all cursor-pointer ${previewPersona === 'b2b'
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-100'
                            : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                          🏢 B2B Corp
                        </button>
                      </div>
                    </div>

                    {/* Fill Button Action */}
                    <div className="pt-1">
                      <div className="bg-indigo-600 text-white text-[11px] font-black p-2.5 rounded-lg flex items-center justify-center gap-2 cursor-default select-none shadow shadow-indigo-100">
                        <span>Magically Fill Form</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dynamic Preview Explanation Card */}
                <div className="bg-indigo-50/50 border border-indigo-100/80 p-4 rounded-2xl text-left max-w-sm mx-auto animate-in fade-in duration-300">
                  {previewPersona === 'default' && (
                    <div className="space-y-1">
                      <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-500 fill-indigo-50" />
                        Default Mocking
                      </h5>
                      <p className="text-xs text-slate-600 leading-relaxed font-medium">
                        Generates random, highly coherent fake details (names, emails, countries, addresses) matching the form fields. Active immediately without any setup!
                      </p>
                    </div>
                  )}
                  {previewPersona === 'profile' && (
                    <div className="space-y-1">
                      <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-indigo-500 fill-indigo-50" />
                        My Personal Card
                      </h5>
                      <p className="text-xs text-slate-600 leading-relaxed font-medium">
                        Autofills forms with your actual saved info. You must configure your profile card details for this option to work.
                      </p>
                    </div>
                  )}
                  {previewPersona === 'qa' && (
                    <div className="space-y-1">
                      <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-indigo-500 fill-indigo-50" />
                        QA Stress Testing
                      </h5>
                      <p className="text-xs text-slate-600 leading-relaxed font-medium">
                        Fills inputs with edge cases, long strings, negative numbers, and security payloads (SQL injections, XSS scripts) to stress-test validation logic.
                      </p>
                    </div>
                  )}
                  {previewPersona === 'b2b' && (
                    <div className="space-y-1">
                      <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-indigo-500 fill-indigo-50" />
                        B2B Corporate Mode
                      </h5>
                      <p className="text-xs text-slate-600 leading-relaxed font-medium">
                        Generates professional corporate contacts: business domain emails (e.g. name@corporate.com), realistic company names, and senior job titles.
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-3 pt-4">
                  <Button
                    onClick={() => setOnboardingStep('profile')}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-12 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Configure Profile Card (Optional)</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={handleSkip}
                    variant="outline"
                    className="w-full border-slate-200 hover:bg-slate-50 text-slate-600 font-bold h-12 rounded-xl cursor-pointer"
                  >
                    Skip & Start Autofilling
                  </Button>
                </div>
              </CardContent>
            </>
          ) : onboardingStep === 'profile' ? (
            /* PROFILE SETUP STEP */
            <>
              <CardHeader className="space-y-3 pb-6 pt-10 px-10">
                <Badge variant="outline" className="text-indigo-600 border-indigo-100 bg-indigo-50/50 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase w-fit">
                  Profile Setup
                </Badge>
                <CardTitle className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
                  <User className="w-7 h-7 text-indigo-500 fill-indigo-50" />
                  My Identity Profile
                </CardTitle>
                <CardDescription className="text-slate-500 text-sm font-medium">
                  Stored safely inside your browser, never shared. Left blank, the extension falls back to random mocking.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6 px-10 pb-6">
                <div className="space-y-4">
                  {phoneError && (
                    <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-100/80 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
                      <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <h5 className="text-[10px] font-black text-rose-800 uppercase tracking-widest leading-none mb-1">Validation Error</h5>
                        <p className="text-xs text-rose-700 font-semibold leading-relaxed">
                          {phoneError}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-700">First Name <span className="text-slate-400 font-normal">(Optional)</span></Label>
                      <Input placeholder="John" value={firstName} onChange={e => setFirstName(e.target.value)} className="h-10 rounded-xl border-slate-200 px-3.5 text-sm" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-700">Last Name <span className="text-slate-400 font-normal">(Optional)</span></Label>
                      <Input placeholder="Doe" value={lastName} onChange={e => setLastName(e.target.value)} className="h-10 rounded-xl border-slate-200 px-3.5 text-sm" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-700">Email Address <span className="text-slate-400 font-normal">(Optional)</span></Label>
                      <Input type="email" placeholder="john.doe@example.com" value={email} onChange={e => setEmail(e.target.value)} className="h-10 rounded-xl border-slate-200 px-3.5 text-sm" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-700">Phone Number <span className="text-slate-400 font-normal">(Optional)</span></Label>
                      <Input
                        placeholder="+1 (555) 019-2834"
                        value={phone}
                        onChange={e => handlePhoneChange(e.target.value)}
                        onBlur={handlePhoneBlur}
                        className={`h-10 rounded-xl px-3.5 text-sm ${phoneError ? 'border-red-400 focus-visible:ring-red-400' : 'border-slate-200'}`}
                      />
                      {phoneError && <p className="text-[10px] text-red-500 font-semibold mt-0.5">{phoneError}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-700">Company Name <span className="text-slate-400 font-normal">(Optional)</span></Label>
                      <Input placeholder="Acme Corp" value={company} onChange={e => setCompany(e.target.value)} className="h-10 rounded-xl border-slate-200 px-3.5 text-sm" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-700">Job Title <span className="text-slate-400 font-normal">(Optional)</span></Label>
                      <Input placeholder="Senior Software Engineer" value={jobTitle} onChange={e => setJobTitle(e.target.value)} className="h-10 rounded-xl border-slate-200 px-3.5 text-sm" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-700">Custom Profile Bio & Context <span className="text-slate-400 font-normal">(Optional)</span></Label>
                    <textarea
                      placeholder="e.g. A web developer based in Seattle who enjoys building tools, hiking, and tea..."
                      value={bio}
                      onChange={e => setBio(e.target.value)}
                      rows={3}
                      className="w-full text-sm rounded-xl border border-slate-200 focus:border-indigo-500 focus:outline-none p-3 resize-none font-sans placeholder:text-slate-400/70"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button
                      onClick={() => setOnboardingStep('walkthrough')}
                      variant="outline"
                      className="flex-1 border-slate-200 hover:bg-slate-50 text-slate-600 font-bold h-11 rounded-xl cursor-pointer"
                    >
                      Back
                    </Button>
                    <Button
                      onClick={handleSave}
                      className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold h-11 rounded-xl transition-all shadow-md cursor-pointer"
                    >
                      Save & Finish
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            /* SUCCESS ONBOARDING GUIDE STEP */
            <>
              <CardHeader className="space-y-3 pb-6 pt-10 px-10 text-center animate-in fade-in duration-300">
                <Badge variant="outline" className="mx-auto text-emerald-600 border-emerald-100 bg-emerald-50 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase w-fit">
                  Onboarding Complete
                </Badge>
                <CardTitle className="text-3xl font-black tracking-tight text-slate-900 justify-center flex items-center gap-3">
                  <CheckCircle2 className="w-7 h-7 text-emerald-500 fill-emerald-50" />
                  You're Ready to Fill!
                </CardTitle>
                <CardDescription className="text-slate-500 text-sm font-medium">
                  {profileCompleted
                    ? "Your identity card has been set up. The extension will default to your saved details, but you can still choose the 'Default' persona in the side dock to fill forms with random mock details anytime."
                    : "No problem! The extension is configured to generate completely random, realistic mock details."}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6 px-10 pb-4 text-center animate-in fade-in duration-500">
                {/* Visual chrome pin tutorial box */}
                <div className="p-5 rounded-2xl bg-indigo-50/50 border border-indigo-100/60 text-left space-y-3 max-w-sm mx-auto">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-indigo-500" />
                    Important: Pin the extension!
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    Chrome hides new extensions by default. Follow these steps so it's always handy:
                  </p>
                  <div className="text-[11px] text-slate-500 space-y-2 font-medium leading-relaxed pl-1">
                    <p>
                      🧩 1. Click the **Extensions puzzle piece** icon in your browser's top-right toolbar.
                    </p>
                    <p>
                      📌 2. Find **AutoFill AI** and click the **Pin** icon next to it so it stays visible.
                    </p>
                  </div>
                </div>

                {/* 3 Step Walkthrough */}
                <div className="space-y-3 max-w-sm mx-auto text-left pt-2">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">How to fill forms:</h4>
                  <ol className="text-xs text-slate-600 font-semibold space-y-3 leading-relaxed pl-1">
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-800 font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                      <span>Go to any webpage containing a form (e.g. registration page).</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-800 font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                      <span>Click the floating ✨ bubble on the side of the page, or right-click any field and select ✨ AutoFill AI.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-800 font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                      <span>Click <strong>Magically Fill Form</strong> in the dock, or press <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[9px] font-bold">Alt + F</kbd> shortcut.</span>
                    </li>
                  </ol>
                </div>

                <div className="space-y-3 pt-2">
                  <Button
                    onClick={() => window.close()}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-12 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Done & Close Settings</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                  <button
                    onClick={() => setOnboardingStep(profileCompleted ? 'profile' : 'walkthrough')}
                    className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer block mx-auto"
                  >
                    ← Go Back
                  </button>
                </div>
              </CardContent>
            </>
          )
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
              {/* TAB 1: SaaS Cloud Account */}
              {activeTab === 'account' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  {/* Promo/Warning Banner for anonymous users */}
                  {!isLoggedIn && (
                    <div className="p-6 rounded-2xl border bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-transparent border-amber-200 text-amber-950 shadow-inner space-y-3 relative overflow-hidden mb-2">
                      <div className="absolute -right-8 -top-8 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl" />
                      <div className="flex items-start gap-4">
                        <div className="p-2.5 rounded-xl bg-amber-600 text-white shrink-0 shadow-md">
                          <Sparkles className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-sm font-black tracking-tight uppercase leading-snug">
                            Autofill AI requires Authentication
                          </h4>
                          <p className="text-xs font-semibold leading-relaxed text-slate-600">
                            To prevent API abuse and control server costs, unauthenticated requests to the Autofill AI are disabled. Sign in or register a free account to instantly unlock 50 fast cloud fills every month, or use Local AI / Private API keys for unlimited free fills.
                          </p>
                          <div className="text-[11px] font-bold text-indigo-600 mt-2.5">
                            💡 Tech-savvy? Avoid cloud registration entirely by entering your own private API key in the{' '}
                            <button
                              onClick={() => setActiveTab('advanced')}
                              className="text-indigo-600 font-extrabold hover:underline bg-transparent border-none p-0 inline cursor-pointer"
                            >
                              AI Provider
                            </button>{' '}
                            tab for unlimited local fills.
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Limit reached warning banner for logged-in free tier users */}
                  {isLoggedIn && userPlan === 'Free Tier' && usageCount >= 50 && (
                    <div className="p-6 rounded-2xl border bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-transparent border-amber-200 text-amber-950 space-y-3 relative overflow-hidden mb-2 animate-in fade-in">
                      <div className="flex items-start gap-4">
                        <div className="p-2.5 rounded-xl bg-amber-500 text-white shrink-0 shadow-md">
                          <Zap className="w-5 h-5 animate-bounce" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-sm font-black tracking-tight uppercase leading-snug">
                            Monthly Quota Limit Reached (50/50 Fills)!
                          </h4>
                          <p className="text-xs font-semibold leading-relaxed text-slate-600">
                            You have completed your monthly free limit of 50 fast cloud fills. Upgrade to Pro for unlimited fills, high-speed execution, and exclusive persona packs!
                          </p>
                          <div className="text-[11px] font-bold text-amber-950 mt-2.5">
                            💡 Developer bypass: You can also enter your private API keys in the{' '}
                            <button
                              onClick={() => setActiveTab('advanced')}
                              className="text-amber-950 font-extrabold hover:underline bg-transparent border-none p-0 inline cursor-pointer"
                            >
                              AI Provider
                            </button>{' '}
                            tab to get unlimited fills directly from Google, OpenAI, or Claude.
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {isLoggedIn ? (
                    /* Authenticated User Panel */
                    <div data-token={authToken} className="space-y-6">
                      <div className="p-6 rounded-2xl bg-indigo-50/50 border border-indigo-100/80 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg overflow-hidden shrink-0 border-2 border-white">
                            {userAvatar ? (
                              <img src={userAvatar} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <User className="w-6 h-6" />
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-black text-indigo-600/70 uppercase tracking-widest">Signed In As</p>
                            <p className="text-sm font-bold text-slate-800 leading-tight mt-0.5">{userName || userEmail}</p>
                            {userName && <p className="text-xs text-slate-500 font-semibold mt-0.5">{userEmail}</p>}
                            <Badge className="bg-indigo-600 text-white border-none text-[9px] font-black uppercase tracking-wider mt-1.5 px-2 py-0.5 rounded-full">
                              {userPlan}
                            </Badge>
                          </div>
                        </div>
                        <button
                          onClick={handleLogout}
                          className="p-2.5 rounded-xl bg-white hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all border border-slate-100 shadow-sm"
                          title="Sign Out"
                        >
                          <LogOut className="w-4 h-4" />
                        </button>
                      </div>

                      {/* usage tracker card */}
                      <div className="border border-slate-100 rounded-2xl p-5 space-y-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Cloud Usage Counter</h4>
                            <p className="text-xl font-black text-slate-800 mt-1">
                              {userPlan === 'Pro Plan' ? `${usageCount} / Unlimited Fills` : `${usageCount} / ${usageLimit} Fills`}
                            </p>
                          </div>
                          <Badge className={`font-bold px-2.5 py-0.5 rounded text-[10px] ${userPlan === 'Pro Plan'
                            ? 'bg-indigo-50 border border-indigo-100 text-indigo-600'
                            : 'bg-slate-100 text-slate-600'
                            }`}>
                            {userPlan === 'Pro Plan' ? 'Pro Plan Active' : 'Resets Monthly'}
                          </Badge>
                        </div>

                        {/* Progress bar */}
                        {userPlan !== 'Pro Plan' && (
                          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                            <div
                              className="bg-indigo-600 h-full transition-all duration-500 rounded-full"
                              style={{ width: `${Math.min((usageCount / usageLimit) * 100, 100)}%` }}
                            />
                          </div>
                        )}

                        <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                          {userPlan === 'Pro Plan'
                            ? 'Thank you for supporting AutoFill AI! Your Pro Plan is active and provides unlimited high-speed cloud generation with zero rate limits.'
                            : 'Your premium Cloud account grants you 50 fast, high-quality form fills every month completely free. For unlimited fills, switch to "Local Nano" or enter your own private API keys in the '}
                          {userPlan !== 'Pro Plan' && (
                            <button
                              onClick={() => setActiveTab('advanced')}
                              className="text-indigo-600 hover:text-indigo-700 font-bold hover:underline bg-transparent border-none p-0 inline cursor-pointer"
                            >
                              AI Provider
                            </button>
                          )}
                          {userPlan !== 'Pro Plan' && ' tab.'}
                        </p>
                      </div>

                      {userPlan === 'Free Tier' && (
                        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-6 space-y-4 shadow-xl border border-slate-700/50 relative overflow-hidden animate-in fade-in duration-500">
                          <div className="absolute -top-10 -right-10 w-24 h-24 bg-indigo-500/20 blur-2xl rounded-full" />

                          <div className="flex justify-between items-start">
                            <div>
                              <Badge className="bg-indigo-600 text-white border-none text-[9px] uppercase tracking-widest font-black px-2.5 py-0.5 rounded-full mb-1">
                                SaaS Upgrade
                              </Badge>
                              <h3 className="text-lg font-black tracking-tight leading-snug">Go Unlimited with Pro</h3>
                            </div>
                            <p className="text-2xl font-black tracking-tight text-amber-300">$9<span className="text-xs font-normal text-slate-400">/mo</span></p>
                          </div>

                          <ul className="text-xs text-slate-300 space-y-2 font-medium">
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span>Unlimited form generations</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span>Priority high-speed Gemini 3 Flash execution</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span>Exclusive B2B & QA Persona expansion packs</span>
                            </li>
                          </ul>

                          <Button
                            onClick={() => {
                              const paymentLink = import.meta.env.VITE_RAZORPAY_PAYMENT_LINK || 'https://rzp.io/l/mock-razorpay-link';
                              const razorpayUrl = `${paymentLink}?notes[userId]=${userId}&email=${encodeURIComponent(userEmail)}`;
                              window.open(razorpayUrl, '_blank');
                            }}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 rounded-xl shadow-lg border-none mt-2 flex items-center justify-center gap-2 cursor-pointer transition-all"
                          >
                            <Zap className="w-4 h-4 fill-amber-300 text-amber-300 animate-pulse" />
                            <span>Upgrade to Unlimited Pro</span>
                          </Button>

                          <div className="text-[10px] text-slate-400 font-semibold mt-3 text-center leading-relaxed pt-2 border-t border-slate-700/50">
                            💡 Are you a  Tech-savvy? Switch your database connection to your own private API keys under the{' '}
                            <button
                              onClick={() => setActiveTab('advanced')}
                              className="text-indigo-400 hover:text-indigo-300 font-bold hover:underline bg-transparent border-none p-0 inline cursor-pointer"
                            >
                              AI Provider
                            </button>{' '}
                            tab for unlimited local fillings.
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Google Sign In Call to Action */
                    <div className="space-y-6 text-center animate-in fade-in duration-300">
                      <div className="p-6 rounded-2xl bg-indigo-50/50 border border-indigo-100/80 space-y-3.5">
                        <div className="flex gap-3 text-left">
                          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 shrink-0">
                            <Sparkles className="w-5 h-5" />
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-sm font-black text-slate-800 tracking-tight">Access Cloud Features</h4>
                            <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                              Sign up or sign in securely with Google to immediately unlock:
                            </p>
                          </div>
                        </div>
                        <ul className="text-xs text-slate-600 space-y-2 font-medium text-left pl-11">
                          <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                            <span>50 fast, high-quality AI form fills every month</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                            <span>Automatic settings & profile card backup</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                            <span>Sync across all your browsers instantly</span>
                          </li>
                        </ul>
                      </div>

                      {authError && (
                        <p className="text-xs text-red-500 font-semibold bg-red-50 p-2.5 rounded-xl border border-red-100 text-left">
                          {authError}
                        </p>
                      )}

                      {/* Google Sign In Button */}
                      <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={authLoading}
                        className="w-full bg-white hover:bg-slate-50 text-slate-700 font-bold h-12 rounded-xl border border-slate-200 shadow-sm flex items-center justify-center gap-3 cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50 hover:shadow-md"
                      >
                        {authLoading ? (
                          <div className="w-5 h-5 border-[3px] border-slate-300 border-t-indigo-600 rounded-full animate-spin" />
                        ) : (
                          <>
                            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                            </svg>
                            <span>Continue with Google</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: Identity Profile */}
              {activeTab === 'profile' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  {/* Optional Profile Onboarding Banner */}
                  <div className="p-5 rounded-2xl bg-indigo-50/50 border border-indigo-100/80 space-y-3.5">
                    <div className="flex gap-3">
                      <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 shrink-0">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-black text-slate-800 tracking-tight">Why enter details?</h4>
                        <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                          You don't have to! Leaving this profile blank is the default way to use the extension.
                        </p>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-500 pl-11 space-y-2 font-medium leading-relaxed">
                      <p>
                        ✨ <strong>Blank (Default):</strong> If you leave profile blank, the AI will dynamically generate random, highly realistic personas (e.g., "Jane Miller", "+1 555-019-2834") on every fill. Perfect for general testing.
                      </p>
                      <p>
                        👤 <strong>Filled:</strong> The extension will autofill forms using your actual saved personal or QA credentials in one click whenever they are requested.
                      </p>
                      <p>
                        🔒 <strong>Privacy:</strong> All inputs remain completely local inside your browser's private settings.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">My Identity Profile</Label>

                    {phoneError && (
                      <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-100/80 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
                        <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <h5 className="text-[10px] font-black text-rose-800 uppercase tracking-widest leading-none mb-1">Validation Error</h5>
                          <p className="text-xs text-rose-700 font-semibold leading-relaxed">
                            {phoneError}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-700">First Name <span className="text-slate-400 font-normal">(Optional)</span></Label>
                        <Input placeholder="John" value={firstName} onChange={e => setFirstName(e.target.value)} className="h-10 rounded-xl border-slate-200 px-3.5 text-sm" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-700">Last Name <span className="text-slate-400 font-normal">(Optional)</span></Label>
                        <Input placeholder="Doe" value={lastName} onChange={e => setLastName(e.target.value)} className="h-10 rounded-xl border-slate-200 px-3.5 text-sm" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-700">Email Address <span className="text-slate-400 font-normal">(Optional)</span></Label>
                        <Input type="email" placeholder="john.doe@example.com" value={email} onChange={e => setEmail(e.target.value)} className="h-10 rounded-xl border-slate-200 px-3.5 text-sm" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-700">Phone Number <span className="text-slate-400 font-normal">(Optional)</span></Label>
                        <Input
                          placeholder="+1 (555) 019-2834"
                          value={phone}
                          onChange={e => handlePhoneChange(e.target.value)}
                          onBlur={handlePhoneBlur}
                          className={`h-10 rounded-xl px-3.5 text-sm ${phoneError ? 'border-red-400 focus-visible:ring-red-400' : 'border-slate-200'}`}
                        />
                        {phoneError && <p className="text-[10px] text-red-500 font-semibold mt-0.5">{phoneError}</p>}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-700">Company Name <span className="text-slate-400 font-normal">(Optional)</span></Label>
                        <Input placeholder="Acme Corp" value={company} onChange={e => setCompany(e.target.value)} className="h-10 rounded-xl border-slate-200 px-3.5 text-sm" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-700">Job Title <span className="text-slate-400 font-normal">(Optional)</span></Label>
                        <Input placeholder="Senior Software Engineer" value={jobTitle} onChange={e => setJobTitle(e.target.value)} className="h-10 rounded-xl border-slate-200 px-3.5 text-sm" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-700">Custom Profile Bio & Context <span className="text-slate-400 font-normal">(Optional)</span></Label>
                      <textarea
                        placeholder="e.g. A web developer based in Seattle who enjoys building tools, hiking, and tea..."
                        value={bio}
                        onChange={e => setBio(e.target.value)}
                        rows={3}
                        className="w-full text-sm rounded-xl border border-slate-200 focus:border-indigo-500 focus:outline-none p-3 resize-none font-sans placeholder:text-slate-400/70"
                      />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button
                        onClick={handleSkip}
                        variant="outline"
                        className="flex-1 border-slate-200 hover:bg-slate-50 text-slate-600 font-bold h-11 rounded-xl cursor-pointer"
                      >
                        Skip & Start Filling
                      </Button>
                      <Button
                        onClick={handleSave}
                        className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold h-11 rounded-xl transition-all shadow-md cursor-pointer"
                      >
                        Save Profile
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: Expert Controls */}
              {activeTab === 'advanced' && (
                <div className="space-y-8 pt-2 animate-in fade-in zoom-in-95 duration-300">
                  <div className="space-y-4">
                    <Label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Intelligence Source</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: 'cloud', label: 'Express Mode', icon: <CloudExpressIcon className="w-4.5 h-4.5" />, desc: isLoggedIn ? 'Fast Cloud Fills' : 'Login Required' },
                        { id: 'local', label: 'Local Nano', icon: <Cpu className="w-4.5 h-4.5" />, desc: 'Private & offline' },
                        { id: 'gemini', label: 'Google Gemini', icon: <GeminiIcon className="w-4.5 h-4.5" />, desc: 'Personal key' },
                        { id: 'openai', label: 'OpenAI GPT', icon: <OpenAiIcon className="w-4.5 h-4.5" />, desc: 'Personal key' },
                        { id: 'anthropic', label: 'Claude AI', icon: <ClaudeIcon className="w-4.5 h-4.5" />, desc: 'Personal key' }
                      ].map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleProviderChange(p.id)}
                          className={`flex flex-col items-start p-4 text-left rounded-2xl border-2 transition-all group cursor-pointer ${provider === p.id
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100'
                            : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-200 hover:bg-slate-50'
                            }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`p-1.5 rounded-lg transition-colors ${provider === p.id
                              ? 'bg-white/20 text-white'
                              : 'bg-slate-100 text-indigo-500 group-hover:bg-indigo-50 group-hover:text-indigo-600'
                              }`}>
                              {p.icon}
                            </div>
                            <span className="text-sm font-bold">{p.label}</span>
                          </div>
                          <span className={`text-[10px] font-medium ${provider === p.id ? 'text-indigo-100/80' : 'text-slate-400'}`}>{p.desc}</span>
                        </button>
                      ))}
                    </div>

                    {/* Dynamic Explainer Card */}
                    <div className="p-4 rounded-2xl bg-indigo-50/30 border border-indigo-100/50 backdrop-blur-md shadow-sm space-y-2">
                      <div className="flex items-center gap-2 text-indigo-900">
                        <HelpCircle className="w-4.5 h-4.5 text-indigo-500 shrink-0" />
                        <span className="text-xs font-bold uppercase tracking-wider">
                          About {
                            provider === 'cloud' ? 'Express Mode' :
                              provider === 'local' ? 'Local Nano AI' :
                                provider === 'gemini' ? 'Google Gemini' :
                                  provider === 'openai' ? 'OpenAI GPT-4o-mini' :
                                    provider === 'anthropic' ? 'Anthropic Claude AI' : 'Active Provider'
                          }
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 font-medium leading-relaxed">
                        {provider === 'cloud' && "Uses our optimized hosted Cloud API (Gemini 1.5 Flash). Requires a signed-in account. Free accounts get 50 monthly fills. Upgrade to Pro for unlimited fills. Unauthenticated calls are disabled to prevent server abuse."}
                        {provider === 'local' && "Runs 100% locally and privately inside your browser using Chrome's built-in Gemini Nano. Entirely free and offline. Requires Chrome Dev/Canary (v127+) with optimization guide flags enabled."}
                        {provider === 'gemini' && "Connects directly to Google's generative models using your private API key. Highly customizable, extremely fast, and billed directly by Google per token."}
                        {provider === 'openai' && "Connects directly to OpenAI's completion servers using your private API key. Highly reliable formatting using GPT-4o-mini, billed directly by OpenAI."}
                        {provider === 'anthropic' && "Connects directly to Anthropic's endpoints using your private API key. Uses Claude 3.5 Sonnet, providing state-of-the-art capability for complex forms."}
                      </p>

                      {provider === 'local' && (
                        <div className="mt-3 p-3 bg-slate-100/60 rounded-xl border border-slate-200/50 text-[10.5px] text-slate-500 space-y-1.5 font-medium leading-relaxed">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${localAiStatus === 'available' ? 'bg-emerald-500 animate-pulse' : localAiStatus === 'checking' ? 'bg-amber-400' : 'bg-rose-500'}`} />
                            <span className="font-bold text-slate-700">
                              Local AI Engine: {localAiStatus === 'available' ? 'Ready & Available' : localAiStatus === 'checking' ? 'Checking capabilities...' : 'Unsupported / Not Enabled'}
                            </span>
                          </div>
                          {localAiStatus !== 'available' && (
                            <p>
                              To enable Local AI: 1) Use Chrome v127+ or Canary. 2) Enable <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[9.5px]">#optimization-guide-on-device-model</code> and <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[9.5px]">#prompt-api-for-gemini-nano</code> in <code className="text-indigo-600 font-bold font-mono">chrome://flags</code>.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Configuration Forms - Shown only when an active model mode is selected */}
                  {provider !== 'local' && (
                    <div className="space-y-6 pt-2 border-t border-slate-100 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="space-y-1">
                        <Label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                          {provider === 'cloud' ? 'Server Configuration' : 'API Key Configuration'}
                        </Label>
                        <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                          {provider === 'cloud'
                            ? 'Configure an optional custom proxy server for Express Mode.'
                            : `Provide your private API key to connect directly to ${provider === 'gemini' ? 'Google Gemini' : provider === 'openai' ? 'OpenAI' : 'Anthropic Claude'}.`}
                        </p>
                      </div>

                      <div className="space-y-4">
                        {/* Gemini Key Input */}
                        {provider === 'gemini' && (
                          <div className="space-y-2 p-4 bg-slate-50/30 rounded-2xl border border-slate-200/30">
                            <div className="flex justify-between items-center mb-1">
                              <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                <span>Google Gemini API Key</span>
                                <Badge className="bg-emerald-100 border border-emerald-200 text-emerald-700 text-[8.5px] py-0 px-1.5 rounded-full font-bold">Active Provider</Badge>
                              </Label>
                              {geminiKey && (
                                <button
                                  type="button"
                                  onClick={() => testConnection('gemini', geminiKey)}
                                  disabled={testLoading['gemini']}
                                  className="text-[10px] font-black uppercase tracking-wider text-indigo-600 hover:text-indigo-800 disabled:opacity-50 flex items-center gap-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 shadow-sm transition-all cursor-pointer"
                                >
                                  {testLoading['gemini'] ? <Loader2 className="w-3 h-3 animate-spin text-indigo-600" /> : 'Test Key'}
                                </button>
                              )}
                            </div>
                            <div className="relative flex items-center">
                              <Input
                                type={showGeminiKey ? 'text' : 'password'}
                                placeholder={geminiKey ? "••••••••••••••••••••••••••••••••" : "Paste your Google AI Studio API key (AIzaSy...)"}
                                value={geminiKey}
                                onChange={(e) => setGeminiKey(e.target.value)}
                                className="h-11 rounded-xl border-slate-200 pr-10 text-sm focus-visible:ring-indigo-500 bg-white"
                              />
                              <button
                                type="button"
                                onClick={() => setShowGeminiKey(!showGeminiKey)}
                                className="absolute right-3.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                              >
                                {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                            {testResults['gemini'] && (
                              <div className={`text-[10.5px] font-semibold mt-1 flex items-center gap-1 ${testResults['gemini'].success ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {testResults['gemini'].success ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                                <span>{testResults['gemini'].message}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* OpenAI Key Input */}
                        {provider === 'openai' && (
                          <div className="space-y-2 p-4 bg-slate-50/30 rounded-2xl border border-slate-200/30">
                            <div className="flex justify-between items-center mb-1">
                              <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                <span>OpenAI API Key</span>
                                <Badge className="bg-emerald-100 border border-emerald-200 text-emerald-700 text-[8.5px] py-0 px-1.5 rounded-full font-bold">Active Provider</Badge>
                              </Label>
                              {openaiKey && (
                                <button
                                  type="button"
                                  onClick={() => testConnection('openai', openaiKey)}
                                  disabled={testLoading['openai']}
                                  className="text-[10px] font-black uppercase tracking-wider text-indigo-600 hover:text-indigo-800 disabled:opacity-50 flex items-center gap-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 shadow-sm transition-all cursor-pointer"
                                >
                                  {testLoading['openai'] ? <Loader2 className="w-3 h-3 animate-spin text-indigo-600" /> : 'Test Key'}
                                </button>
                              )}
                            </div>
                            <div className="relative flex items-center">
                              <Input
                                type={showOpenaiKey ? 'text' : 'password'}
                                placeholder={openaiKey ? "••••••••••••••••••••••••••••••••" : "Paste your OpenAI platform key (sk-proj-...)"}
                                value={openaiKey}
                                onChange={(e) => setOpenaiKey(e.target.value)}
                                className="h-11 rounded-xl border-slate-200 pr-10 text-sm focus-visible:ring-indigo-500 bg-white"
                              />
                              <button
                                type="button"
                                onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                                className="absolute right-3.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                              >
                                {showOpenaiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                            {testResults['openai'] && (
                              <div className={`text-[10.5px] font-semibold mt-1 flex items-center gap-1 ${testResults['openai'].success ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {testResults['openai'].success ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                                <span>{testResults['openai'].message}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Anthropic Key Input */}
                        {provider === 'anthropic' && (
                          <div className="space-y-2 p-4 bg-slate-50/30 rounded-2xl border border-slate-200/30">
                            <div className="flex justify-between items-center mb-1">
                              <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                <span>Anthropic Claude API Key</span>
                                <Badge className="bg-emerald-100 border border-emerald-200 text-emerald-700 text-[8.5px] py-0 px-1.5 rounded-full font-bold">Active Provider</Badge>
                              </Label>
                              {anthropicKey && (
                                <button
                                  type="button"
                                  onClick={() => testConnection('anthropic', anthropicKey)}
                                  disabled={testLoading['anthropic']}
                                  className="text-[10px] font-black uppercase tracking-wider text-indigo-600 hover:text-indigo-800 disabled:opacity-50 flex items-center gap-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 shadow-sm transition-all cursor-pointer"
                                >
                                  {testLoading['anthropic'] ? <Loader2 className="w-3 h-3 animate-spin text-indigo-600" /> : 'Test Key'}
                                </button>
                              )}
                            </div>
                            <div className="relative flex items-center">
                              <Input
                                type={showAnthropicKey ? 'text' : 'password'}
                                placeholder={anthropicKey ? "••••••••••••••••••••••••••••••••" : "Paste your Anthropic console key (sk-ant-...)"}
                                value={anthropicKey}
                                onChange={(e) => setAnthropicKey(e.target.value)}
                                className="h-11 rounded-xl border-slate-200 pr-10 text-sm focus-visible:ring-indigo-500 bg-white"
                              />
                              <button
                                type="button"
                                onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                                className="absolute right-3.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                              >
                                {showAnthropicKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                            {testResults['anthropic'] && (
                              <div className={`text-[10.5px] font-semibold mt-1 flex items-center gap-1 ${testResults['anthropic'].success ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {testResults['anthropic'].success ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                                <span>{testResults['anthropic'].message}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Custom Cloud Server Input */}
                        {provider === 'cloud' && (
                          <div className="space-y-2 p-4 bg-slate-50/30 rounded-2xl border border-slate-200/30">
                            <div className="flex justify-between items-center mb-1">
                              <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                <span>Custom Cloud Proxy Server</span>
                                <Badge className="bg-emerald-100 border border-emerald-200 text-emerald-700 text-[8.5px] py-0 px-1.5 rounded-full font-bold">Active Provider</Badge>
                              </Label>
                              <button
                                type="button"
                                onClick={() => testConnection('cloud', '', proxyUrl)}
                                disabled={testLoading['cloud']}
                                className="text-[10px] font-black uppercase tracking-wider text-indigo-600 hover:text-indigo-800 disabled:opacity-50 flex items-center gap-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 shadow-sm transition-all cursor-pointer"
                              >
                                {testLoading['cloud'] ? <Loader2 className="w-3 h-3 animate-spin text-indigo-600" /> : 'Test Connection'}
                              </button>
                            </div>
                            <Input
                              placeholder="https://your-custom-proxy.workers.dev (Optional)"
                              value={proxyUrl}
                              onChange={(e) => setProxyUrl(e.target.value)}
                              className="h-11 rounded-xl border-slate-200 text-sm focus-visible:ring-indigo-500 bg-white px-3.5"
                            />
                            <p className="text-[10px] text-slate-400 font-medium leading-relaxed pl-1">
                              Leave empty to use AutoFill AI's fast cloud infrastructure proxy.
                            </p>
                            {testResults['cloud'] && (
                              <div className={`text-[10.5px] font-semibold mt-1 flex items-center gap-1 ${testResults['cloud'].success ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {testResults['cloud'].success ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                                <span>{testResults['cloud'].message}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Interface settings with toggle switch */}
                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <Label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Interface Preferences</Label>
                    <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-200/50">
                      <div className="space-y-0.5 max-w-[80%]">
                        <h4 className="text-sm font-bold text-slate-800">Show In-Page Shortcut Dock</h4>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed">
                          Displays a floating AI command dock in the bottom-right corner when forms are detected for single-click filling.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEnableFloatingDock(!enableFloatingDock)}
                        className={`w-10 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none cursor-pointer flex items-center ${enableFloatingDock ? 'bg-indigo-600' : 'bg-slate-300'
                          }`}
                        aria-label="Toggle In-Page Shortcut Dock"
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${enableFloatingDock ? 'translate-x-4' : 'translate-x-0'
                            }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Auto-save visual indicator */}
                  <div className="flex items-center justify-between mt-4 p-4 bg-emerald-50/40 border border-emerald-100/50 rounded-2xl shadow-sm shadow-emerald-50/50">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-semibold text-emerald-800">Settings auto-save is active</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-semibold font-sans">Saves immediately to local storage</span>
                  </div>
                </div>
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


