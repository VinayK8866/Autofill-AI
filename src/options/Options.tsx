import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Lock, Settings2, CheckCircle2, AlertCircle, User, ArrowRight } from 'lucide-react';
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
    profiles,
    activeProfileId,
    handleSelectProfile,
    handleCreateProfile,
    handleDeleteProfile,
    handleRenameProfile,
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
    authLoading, setAuthLoading,
    handleAuthUrlOrParams
  } = useOptionsState();

  const [showSavedModal, setShowSavedModal] = useState(false);
  const [countdown, setCountdown] = useState(2);

  const handleCloseTab = () => {
    if (typeof chrome !== 'undefined' && chrome.tabs?.getCurrent) {
      chrome.tabs.getCurrent((tab) => {
        if (tab?.id) {
          chrome.tabs.remove(tab.id);
        } else {
          window.close();
        }
      });
    } else {
      window.close();
    }
  };

  useEffect(() => {
    if (!showSavedModal) return;
    if (countdown <= 0) {
      handleCloseTab();
      return;
    }
    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [showSavedModal, countdown]);

  useEffect(() => {
    // Ensure the browser tab always displays the official Filli AI logo favicon
    const iconUrl = typeof chrome !== 'undefined' && chrome?.runtime?.getURL
      ? chrome.runtime.getURL('icon-32.png')
      : '/icon-32.png';
    
    let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.type = 'image/png';
    link.href = iconUrl;
  }, []);

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
      profileFirstName: firstName,
      profileLastName: lastName,
      profileEmail: email,
      profilePhone: phone,
      profileCompany: company,
      profileJobTitle: jobTitle,
      profileBio: bio,
      savedProfiles: updatedProfiles,
      activeProfileId: activeProfileId,
      enableFloatingDock: enableFloatingDock
    }, () => {
      triggerToast('Settings saved successfully!');
      if (isOnboarding) {
        setProfileCompleted(true);
        setOnboardingStep('success');
        if (typeof chrome !== 'undefined') {
          chrome.storage?.sync?.set({ hasSeenWelcome: true, onboardingCompleted: true });
          chrome.storage?.local?.set({ hasSeenWelcome: true, onboardingCompleted: true });
        }
      } else {
        setShowSavedModal(true);
        setCountdown(2);
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

    try {
      const isIdentityAvailable = typeof chrome !== 'undefined' && !!chrome.identity?.launchWebAuthFlow;
      const redirectUrl = isIdentityAvailable && chrome.identity?.getRedirectURL
        ? chrome.identity.getRedirectURL()
        : (typeof chrome !== 'undefined' && chrome.runtime?.getURL ? chrome.runtime.getURL('options.html') : (typeof window !== 'undefined' ? window.location.href : ''));

      console.log('[Filli AI Auth] Initiating Google Sign-In with redirectUrl:', redirectUrl);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: isIdentityAvailable
        }
      });

      if (error) {
        throw error;
      }

      if (isIdentityAvailable && data?.url) {
        chrome.identity.launchWebAuthFlow(
          {
            url: data.url,
            interactive: true
          },
          async (callbackUrl) => {
            if (chrome.runtime.lastError) {
              const errMsg = chrome.runtime.lastError.message || 'Google sign-in was cancelled.';
              console.warn('[Filli AI Auth] launchWebAuthFlow response error:', errMsg);
              if (!errMsg.toLowerCase().includes('user cancelled') && !errMsg.toLowerCase().includes('canceled')) {
                setAuthError(errMsg);
              }
              setAuthLoading(false);
              return;
            }

            if (!callbackUrl) {
              setAuthLoading(false);
              return;
            }

            console.log('[Filli AI Auth] Callback received successfully:', callbackUrl);
            await handleAuthUrlOrParams(callbackUrl);
          }
        );
      } else if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: unknown) {
      let message = err instanceof Error ? err.message : 'Google sign-in failed.';
      if (message === 'Failed to fetch' || message.toLowerCase().includes('failed to fetch')) {
        message = 'Could not connect to the authentication server. Please check your internet connection or verify if the Supabase project configuration is active.';
      }
      setAuthError(message);
      setAuthLoading(false);
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
    if (isOnboarding) {
      setProfileCompleted(false);
      setOnboardingStep('success');
      if (typeof chrome !== 'undefined') {
        chrome.storage?.sync?.set({ hasSeenWelcome: true, onboardingCompleted: true });
        chrome.storage?.local?.set({ hasSeenWelcome: true, onboardingCompleted: true });
      }
    } else {
      handleCloseTab();
    }
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
                  {activeTab === 'account' ? (isLoggedIn ? 'Account' : 'Sign In / Sign Up') : activeTab === 'profile' ? 'My Filli Card' : 'API Models (BYOK)'}
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
                {activeTab === 'account' ? (isLoggedIn ? 'My Account' : 'Sign In / Sign Up') : activeTab === 'profile' ? 'My Profile' : 'BYOK & AI Provider Setup'}
              </CardTitle>
              <CardDescription className="text-slate-500 text-base font-medium">
                {activeTab === 'account'
                  ? (isLoggedIn
                    ? 'Manage your cloud usage quotas and account preferences.'
                    : 'Create a free cloud account to get 50 high-speed AI fills every month and sync profiles.')
                  : activeTab === 'profile'
                    ? 'Your personal details. Stored safely inside your browser, never shared unless you sync to cloud.'
                    : 'Use your own API keys. Your data stays on your machine.'}
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
                  <Logo size={16} className={`rounded-[3px] transition-transform ${activeTab === 'account' ? 'scale-110 shadow-sm' : 'opacity-70'}`} />
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
                  API Models (BYOK)
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
                  profiles={profiles}
                  activeProfileId={activeProfileId}
                  onSelectProfile={handleSelectProfile}
                  onCreateProfile={handleCreateProfile}
                  onDeleteProfile={handleDeleteProfile}
                  onRenameProfile={handleRenameProfile}
                  userPlan={userPlan}
                  onUpgradeClick={() => setActiveTab('account')}
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
      {/* Confirmation Modal on Profile Save */}
      {showSavedModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 text-center border border-slate-100 animate-in zoom-in-95 duration-200 relative">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center mx-auto mb-4 shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-black text-slate-900 mb-1">Profile Saved!</h3>
            <p className="text-xs text-slate-500 font-medium leading-relaxed mb-5">
              Your identity card has been updated. You can now use the "My Profile" persona to autofill forms with your details.
            </p>

            <div className="flex items-center justify-center gap-2 text-[11px] font-bold text-slate-500 mb-5 bg-slate-50 py-1.5 px-3 rounded-full w-fit mx-auto border border-slate-100">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Closing tab in {countdown}s...</span>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                onClick={handleCloseTab}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-11 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer border-none text-xs"
              >
                <span>Done & Close Page</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
              <button
                onClick={() => setShowSavedModal(false)}
                className="w-full text-slate-400 hover:text-slate-600 text-xs font-semibold py-2 transition-colors cursor-pointer bg-transparent border-none"
              >
                Stay on Page & Keep Editing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Options;
