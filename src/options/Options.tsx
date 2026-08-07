import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lock, Settings2, CheckCircle2, AlertCircle, User, Globe } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { posthog } from '@/lib/posthog';
import { Logo } from '@/components/Logo';

import { useOptionsState } from './hooks/useOptionsState';
import { OnboardingWizard } from './components/OnboardingWizard';
import { ProfileCardForm } from './components/ProfileCardForm';
import { BillingAccount } from './components/BillingAccount';
import { ProviderConfig } from './components/ProviderConfig';

export const Options = () => {
  const {
    activeTab, setActiveTab,
    provider, setProvider,
    geminiKey, setGeminiKey,
    openaiKey, setOpenaiKey,
    anthropicKey, setAnthropicKey,
    proxyUrl, setProxyUrl,
    phoneError, setPhoneError,
    showToast,
    toastMessage,
    toastType,
    triggerToast,
    isOnboarding,
    onboardingStep, setOnboardingStep,
    previewPersona, setPreviewPersona,
    profileCompleted, setProfileCompleted,
    enableFloatingDock, setEnableFloatingDock,
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
    checkoutUrl,
    authError, setAuthError,
    authLoading, setAuthLoading
  } = useOptionsState();

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
    if (!clean) return true;
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
          <>
            <CardHeader className="space-y-3 pb-8 pt-10 px-10">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-indigo-600 border-indigo-100 bg-indigo-50/50 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase">
                  {activeTab === 'account' ? (isLoggedIn ? 'Account' : 'Sign In / Sign Up') : activeTab === 'profile' ? 'My Filli Card' : 'Developer Controls'}
                </Badge>
                {isLoggedIn && activeTab === 'account' && (
                  <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 flex items-center gap-1 uppercase tracking-widest animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Active
                  </span>
                )}
              </div>
              <CardTitle className="text-4xl font-black tracking-tight text-slate-900 flex items-center gap-3">
                <Logo size={32} />
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
