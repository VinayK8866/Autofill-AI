import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { posthog } from '@/lib/posthog';
import { ENV } from '@/config/env';
import { type SavedProfile, DEFAULT_PROFILE_ID, loadSavedProfiles, syncActiveProfileToStorage } from '@/lib/profileManager';

export function useOptionsState() {
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

  // Personal Profile state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [bio, setBio] = useState('');

  // Multi-Profile Vault state
  const [profiles, setProfiles] = useState<SavedProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string>(DEFAULT_PROFILE_ID);

  // SaaS Account Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [userAvatar, setUserAvatar] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [userPlan, setUserPlan] = useState('Free Tier');
  const [usageCount, setUsageCount] = useState(0);
  const [usageLimit] = useState(50);
  const [userId, setUserId] = useState('');
  const [customerPortalUrl, setCustomerPortalUrl] = useState('');
  const [checkoutUrl, setCheckoutUrl] = useState('');

  // Auth state
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const triggerToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const processAuthUser = async (accessToken: string, user: any, showToastNotification = true) => {
    const avatar = user.user_metadata?.avatar_url || '';
    const fullName = user.user_metadata?.full_name || '';
    const cloudUrl = ENV.CLOUD_PROXY_URL;
    let plan = 'Free Tier';
    let usage = 0;
    let portalUrl = '';

    try {
      const res = await fetch(`${cloudUrl}/usage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data) {
          plan = data.userPlan || 'Free Tier';
          usage = data.usageCount || 0;
          portalUrl = data.customerPortalUrl || '';
        }
      }
    } catch (err) {
      console.log('Error fetching usage on auth callback:', err);
    }

    return new Promise<void>((resolve) => {
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
        if (!res.profileFirstName && metaFirstName) {
          updateObj.profileFirstName = metaFirstName;
          setFirstName(metaFirstName);
          changedProfile = true;
        }
        if (!res.profileLastName && metaLastName) {
          updateObj.profileLastName = metaLastName;
          setLastName(metaLastName);
          changedProfile = true;
        }
        if (!res.profileEmail && metaEmail) {
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
          setAuthError('');

          // PostHog Telemetry Identification
          posthog.identify(user.id);
          posthog.people.set({
            email: user.email,
            name: fullName,
            plan: plan
          });
          posthog.capture('user_login_success', { method: 'oauth_google' });

          setActiveTab('account');
          if (showToastNotification) {
            triggerToast(changedProfile ? 'Signed in successfully! Profile details imported from Google.' : 'Signed in successfully!');
          }
          if (typeof window !== 'undefined' && (window.location.search || window.location.hash)) {
            window.history.replaceState(null, '', window.location.pathname);
          }
          resolve();
        });
      });
    });
  };

  const handleAuthUrlOrParams = async (urlOrParams: string): Promise<boolean> => {
    try {
      let code: string | null = null;
      let accessToken: string | null = null;
      let errorDesc: string | null = null;

      if (urlOrParams.includes('?') || urlOrParams.includes('#')) {
        const parsedUrl = new URL(urlOrParams.startsWith('http') ? urlOrParams : `https://filliai.local/${urlOrParams.replace(/^\?/, '')}`);
        code = parsedUrl.searchParams.get('code');
        errorDesc = parsedUrl.searchParams.get('error_description') || parsedUrl.searchParams.get('error');

        if (!code && parsedUrl.hash) {
          const hashParams = new URLSearchParams(parsedUrl.hash.replace(/^#/, ''));
          accessToken = hashParams.get('access_token');
          if (!errorDesc) errorDesc = hashParams.get('error_description');
        }
      }

      if (errorDesc) {
        const decoded = decodeURIComponent(errorDesc);
        triggerToast(decoded, 'error');
        setAuthError(decoded);
        setAuthLoading(false);
        return false;
      }

      if (code) {
        setAuthLoading(true);
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          triggerToast(error.message || 'Authentication exchange failed.', 'error');
          setAuthError(error.message);
          setAuthLoading(false);
          return false;
        }
        if (data.session) {
          await processAuthUser(data.session.access_token, data.session.user);
          return true;
        }
      } else if (accessToken) {
        setAuthLoading(true);
        const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
        if (userError || !userData.user) {
          const msg = userError?.message || 'Failed to retrieve user profile.';
          triggerToast(msg, 'error');
          setAuthError(msg);
          setAuthLoading(false);
          return false;
        }
        await processAuthUser(accessToken, userData.user);
        return true;
      }
      return false;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed.';
      triggerToast(msg, 'error');
      setAuthError(msg);
      setAuthLoading(false);
      return false;
    }
  };

  useEffect(() => {
    // Check if opened with session callback in URL search (PKCE code) or hash (tokens)
    if (typeof window !== 'undefined' && (window.location.search || window.location.hash)) {
      const currentUrl = window.location.href;
      if (currentUrl.includes('code=') || currentUrl.includes('access_token=') || currentUrl.includes('error=')) {
        handleAuthUrlOrParams(currentUrl);
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

        loadSavedProfiles().then(({ profiles: loadedProfiles, activeId }) => {
          setProfiles(loadedProfiles);
          setActiveProfileId(activeId);
          const active = loadedProfiles.find(p => p.id === activeId) || loadedProfiles[0];
          if (active) {
            setFirstName(active.firstName);
            setLastName(active.lastName);
            setEmail(active.email);
            setPhone(active.phone);
            setCompany(active.company);
            setJobTitle(active.jobTitle);
            setBio(active.bio);
          }
        });

        if (typeof result.authToken === 'string') {
          const token = result.authToken;
          setAuthToken(token);
          setIsLoggedIn(true);

          const cloudUrl = ENV.CLOUD_PROXY_URL;
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

        if (loggedIn && typeof result.userId === 'string') {
          posthog.identify(result.userId);
          posthog.people.set({
            email: googleEmail,
            name: googleName,
            plan: result.userPlan as string || 'Free Tier'
          });
        }

        const activeProxy = (result.cloudProxyUrl as string) || ENV.CLOUD_PROXY_URL;
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
      if (changes.usageCount) setUsageCount(changes.usageCount.newValue as number || 0);
      if (changes.userPlan) setUserPlan(changes.userPlan.newValue as string || 'Free Tier');
      if (changes.customerPortalUrl) setCustomerPortalUrl(changes.customerPortalUrl.newValue as string || '');
      if (changes.authToken) {
        const token = changes.authToken.newValue as string || '';
        setAuthToken(token);
        setIsLoggedIn(!!token);
      }
      if (changes.userEmail) setUserEmail(changes.userEmail.newValue as string || '');
      if (changes.userName) setUserName(changes.userName.newValue as string || '');
      if (changes.userAvatar) setUserAvatar(changes.userAvatar.newValue as string || '');
      if (changes.profileFirstName) setFirstName(changes.profileFirstName.newValue as string || '');
      if (changes.profileLastName) setLastName(changes.profileLastName.newValue as string || '');
      if (changes.profileEmail) setEmail(changes.profileEmail.newValue as string || '');
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

  const handleSelectProfile = (id: string) => {
    const target = profiles.find(p => p.id === id);
    if (!target) return;
    setActiveProfileId(id);
    setFirstName(target.firstName);
    setLastName(target.lastName);
    setEmail(target.email);
    setPhone(target.phone);
    setCompany(target.company);
    setJobTitle(target.jobTitle);
    setBio(target.bio);
    setPhoneError('');
    syncActiveProfileToStorage(target);
  };

  const handleCreateProfile = (name: string): boolean => {
    if (userPlan !== 'Pro Plan' && profiles.length >= 1) {
      return false;
    }
    const newProfile: SavedProfile = {
      id: `profile_${Date.now()}`,
      name: name.trim() || `Profile ${profiles.length + 1}`,
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      company: '',
      jobTitle: '',
      bio: '',
      createdAt: Date.now()
    };
    const updated = [...profiles, newProfile];
    setProfiles(updated);
    setActiveProfileId(newProfile.id);
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setCompany('');
    setJobTitle('');
    setBio('');
    setPhoneError('');
    chrome.storage.local.set({
      savedProfiles: updated,
      activeProfileId: newProfile.id
    });
    syncActiveProfileToStorage(newProfile);
    return true;
  };

  const handleDeleteProfile = (id: string) => {
    if (profiles.length <= 1) return;
    const updated = profiles.filter(p => p.id !== id);
    setProfiles(updated);
    let newActiveId = activeProfileId;
    if (activeProfileId === id) {
      newActiveId = updated[0].id;
      const newActive = updated[0];
      setActiveProfileId(newActiveId);
      setFirstName(newActive.firstName);
      setLastName(newActive.lastName);
      setEmail(newActive.email);
      setPhone(newActive.phone);
      setCompany(newActive.company);
      setJobTitle(newActive.jobTitle);
      setBio(newActive.bio);
      syncActiveProfileToStorage(newActive);
    }
    chrome.storage.local.set({
      savedProfiles: updated,
      activeProfileId: newActiveId
    });
  };

  const handleRenameProfile = (id: string, newName: string) => {
    const updated = profiles.map(p => p.id === id ? { ...p, name: newName } : p);
    setProfiles(updated);
    chrome.storage.local.set({ savedProfiles: updated });
  };

  useEffect(() => {
    if (loadingSettings) return;

    const delayDebounceFn = setTimeout(() => {
      // Also update the active profile in profiles list
      const updatedProfiles = profiles.map(p => {
        if (p.id === activeProfileId) {
          return {
            ...p,
            firstName,
            lastName,
            email,
            phone,
            company,
            jobTitle,
            bio
          };
        }
        return p;
      });

      chrome.storage.local.set({
        geminiApiKey: geminiKey,
        openaiApiKey: openaiKey,
        anthropicApiKey: anthropicKey,
        aiProvider: provider,
        cloudProxyUrl: proxyUrl,
        savedProfiles: updatedProfiles,
        activeProfileId: activeProfileId,
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

  return {
    activeTab, setActiveTab,
    provider, setProvider,
    geminiKey, setGeminiKey,
    openaiKey, setOpenaiKey,
    anthropicKey, setAnthropicKey,
    proxyUrl, setProxyUrl,
    phoneError, setPhoneError,
    showToast, setShowToast,
    toastMessage, setToastMessage,
    toastType, setToastType,
    triggerToast,
    isOnboarding,
    onboardingStep, setOnboardingStep,
    previewPersona, setPreviewPersona,
    profileCompleted, setProfileCompleted,
    enableFloatingDock, setEnableFloatingDock,
    loadingSettings,
    localAiStatus,
    showGeminiKey, setShowGeminiKey,
    showOpenaiKey, setShowOpenaiKey,
    showAnthropicKey, setShowAnthropicKey,
    testLoading, setTestLoading,
    testResults, setTestResults,
    firstName, setFirstName,
    lastName, setLastName,
    email, setEmail,
    phone, setPhone,
    company, setCompany,
    jobTitle, setJobTitle,
    bio, setBio,
    isLoggedIn, setIsLoggedIn,
    userEmail, setUserEmail,
    userName, setUserName,
    userAvatar, setUserAvatar,
    authToken, setAuthToken,
    userPlan, setUserPlan,
    usageCount, setUsageCount,
    usageLimit,
    userId, setUserId,
    customerPortalUrl, setCustomerPortalUrl,
    checkoutUrl, setCheckoutUrl,
    authError, setAuthError,
    authLoading, setAuthLoading,
    handleAuthUrlOrParams,
    profiles, setProfiles,
    activeProfileId, setActiveProfileId,
    handleSelectProfile,
    handleCreateProfile,
    handleDeleteProfile,
    handleRenameProfile
  };
}
