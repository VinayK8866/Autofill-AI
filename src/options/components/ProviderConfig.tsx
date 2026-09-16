import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, ShieldCheck, Lock, Loader2, Eye, EyeOff, Globe, Trash2 } from 'lucide-react';
import { type DomainRule, getAllDomainPrompts, deleteDomainPrompt } from '@/lib/domainPromptManager';

// Brand-specific SVG Icons for AI engines matching Slide 4 specifications
const OpenAiLogo = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1683a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4947zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1683a.0757.0757 0 0 1-.071 0l-4.8303-2.7866A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1636a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813v6.7227zm1.145-2.0011l3.0334-1.7482 3.0334 1.7482v3.4965l-3.0334 1.7482-3.0334-1.7482z" />
  </svg>
);

const AnthropicLogo = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M13.832 4.5H10.168L4.5 19.5H8.384L9.564 16.2H14.436L15.616 19.5H19.5L13.832 4.5ZM10.714 13.08L12 9.48L13.286 13.08H10.714Z" />
    <path d="M17.85 16.2L15.25 9.12L16.92 4.5H19.5L22 19.5H18.9L17.85 16.2Z" opacity="0.9" />
  </svg>
);

const GeminiOfficialLogo = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M14 28C14 20.268 7.73199 14 0 14C7.73199 14 14 7.73199 14 0C14 7.73199 20.268 14 28 14C20.268 14 14 20.268 14 28Z"
      fill="url(#gemini_official_gradient)"
    />
    <defs>
      <linearGradient id="gemini_official_gradient" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#1B73E8" />
        <stop offset="35%" stopColor="#4285F4" />
        <stop offset="70%" stopColor="#9B51E0" />
        <stop offset="100%" stopColor="#FA5587" />
      </linearGradient>
    </defs>
  </svg>
);

const CloudExpressLogo = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.5 19A3.5 3.5 0 0 0 21 15.5c0-2.79-2.54-4.5-5-4.5-.7-2.1-2.79-4-5-4-3.15 0-5.69 2.54-5.69 5.69 0 .42.06.84.19 1.25A4.5 4.5 0 0 0 7.5 19H17.5Z" />
    <path d="M12 11l-2 3h4l-2 3" fill="currentColor" stroke="none" />
  </svg>
);

const ChromeNanoLogo = ({ className = "w-11 h-11" }: { className?: string }) => {
  const iconUrl = typeof chrome !== 'undefined' && chrome?.runtime?.getURL
    ? chrome.runtime.getURL('Chrome Gemini nano.png')
    : '/Chrome Gemini nano.png';

  return (
    <div className={`${className} rounded-2xl overflow-hidden shrink-0 shadow-sm border border-slate-200/80 bg-white flex items-center justify-center p-0.5`}>
      <img
        src={iconUrl}
        alt="Chrome Gemini Nano"
        className="w-full h-full object-cover rounded-xl"
      />
    </div>
  );
};

interface ProviderConfigProps {
  provider: string;
  handleProviderChange: (provider: string) => void;
  geminiKey: string;
  setGeminiKey: (val: string) => void;
  showGeminiKey: boolean;
  setShowGeminiKey: (val: boolean) => void;
  testConnection: (provider: string, key: string, proxyUrl?: string) => void;
  testLoading: Record<string, boolean>;
  testResults: Record<string, { success: boolean; message: string } | null>;
  openaiKey: string;
  setOpenaiKey: (val: string) => void;
  showOpenaiKey: boolean;
  setShowOpenaiKey: (val: boolean) => void;
  anthropicKey: string;
  setAnthropicKey: (val: string) => void;
  showAnthropicKey: boolean;
  setShowAnthropicKey: (val: boolean) => void;
  proxyUrl: string;
  setProxyUrl: (val: string) => void;
  localAiStatus: 'checking' | 'available' | 'unavailable';
  enableFloatingDock: boolean;
  setEnableFloatingDock: (val: boolean) => void;
  isLoggedIn: boolean;
}

export const ProviderConfig = ({
  provider,
  handleProviderChange,
  geminiKey,
  setGeminiKey,
  showGeminiKey,
  setShowGeminiKey,
  testConnection,
  testLoading,
  testResults,
  openaiKey,
  setOpenaiKey,
  showOpenaiKey,
  setShowOpenaiKey,
  anthropicKey,
  setAnthropicKey,
  showAnthropicKey,
  setShowAnthropicKey,
  proxyUrl,
  setProxyUrl,
  localAiStatus,
  enableFloatingDock,
  setEnableFloatingDock,
  isLoggedIn
}: ProviderConfigProps) => {
  // Track expanded card for advanced preferences; defaults to currently active provider
  const [expandedCard, setExpandedCard] = useState<string | null>(provider);
  const [domainRules, setDomainRules] = useState<DomainRule[]>([]);

  useEffect(() => {
    getAllDomainPrompts().then(setDomainRules);
  }, []);

  const handleDeleteRule = async (domain: string) => {
    await deleteDomainPrompt(domain);
    setDomainRules(prev => prev.filter(r => r.domain !== domain));
  };

  const toggleCardExpansion = (id: string) => {
    setExpandedCard(prev => (prev === id ? null : id));
  };

  const handleConfigureClick = (id: string) => {
    handleProviderChange(id);
    setExpandedCard(id);
  };

  return (
    <div className="space-y-6 pt-1 animate-in fade-in zoom-in-95 duration-300">
      {/* Top Banner: Direct Client-to-API notice (Slide 4 style) */}
      <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/60 text-emerald-950 shadow-xs">
        <div className="w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0 text-emerald-600 mt-0.5">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="space-y-0.5">
          <h4 className="text-xs font-bold text-emerald-900 tracking-tight">Direct Client-to-API — No Intermediary Server</h4>
          <p className="text-[11.5px] text-emerald-800/80 leading-relaxed font-medium">
            All requests go directly from your browser to the AI provider. We do not route, store, or log your data.
          </p>
        </div>
      </div>

      {/* Model Cards Stack */}
      <div className="space-y-3.5">
        {/* OpenAI Card */}
        <div
          className={`bg-white rounded-2xl border p-4 sm:p-5 transition-all shadow-xs ${
            provider === 'openai'
              ? 'border-indigo-300 ring-2 ring-indigo-500/10 shadow-sm'
              : 'border-slate-200/90 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[#10A37F] text-white flex items-center justify-center shrink-0 shadow-sm shadow-emerald-500/20">
                <OpenAiLogo className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">OpenAI</h4>
                <p className="text-xs text-slate-400 font-medium mt-0.5">GPT-4o, GPT-4-turbo, GPT-3.5</p>
              </div>
            </div>

            {provider === 'openai' ? (
              <button
                type="button"
                onClick={() => toggleCardExpansion('openai')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold shadow-xs cursor-pointer hover:bg-emerald-100/60 transition-all"
                title="Active provider (Click to toggle details)"
              >
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Active</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleConfigureClick('openai')}
                className="px-4 py-1.5 rounded-full border border-indigo-200 hover:border-indigo-400 bg-white hover:bg-indigo-50/60 text-indigo-600 text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                Configure
              </button>
            )}
          </div>

          {/* API Key Input Row */}
          <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <span className="text-xs font-semibold text-slate-500 sm:w-16 shrink-0">API Key</span>
            <div className="relative flex-1 flex items-center">
              <Input
                type={showOpenaiKey ? 'text' : 'password'}
                placeholder={openaiKey ? "••••••••••••••••••••••••••••••••" : "Paste your OpenAI platform key (sk-proj-...)"}
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                className="h-10 rounded-xl border-slate-200 pr-10 text-xs font-mono bg-slate-50/50 focus-visible:bg-white focus-visible:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                className="absolute right-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                title={showOpenaiKey ? "Hide key" : "Show key"}
              >
                {showOpenaiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {openaiKey && (
              <button
                type="button"
                onClick={() => testConnection('openai', openaiKey)}
                disabled={testLoading['openai']}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 disabled:opacity-50 flex items-center justify-center gap-1.5 bg-indigo-50/60 hover:bg-indigo-100 border border-indigo-200/80 rounded-xl px-3.5 h-10 transition-all cursor-pointer shrink-0"
              >
                {testLoading['openai'] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Test Key'}
              </button>
            )}
          </div>

          {/* Subtle Inline Validation Status */}
          {testLoading['openai'] && (
            <div className="flex items-center gap-1.5 mt-2 pl-0 sm:pl-[76px] text-[11px] text-indigo-600 font-medium">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Verifying API key with OpenAI...</span>
            </div>
          )}
          {testResults['openai'] && !testLoading['openai'] && (
            <div className={`flex items-center gap-1.5 mt-2 pl-0 sm:pl-[76px] text-[11px] font-semibold ${testResults['openai']?.success ? 'text-emerald-600' : 'text-rose-600'}`}>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${testResults['openai']?.success ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              <span>{testResults['openai']?.message}</span>
            </div>
          )}

          {/* Optional Expanded Details */}
          {expandedCard === 'openai' && (
            <div className="mt-3 pt-3 border-t border-dashed border-slate-100 pl-0 sm:pl-[76px] text-[11px] text-slate-500 font-medium leading-relaxed">
              Connects directly to OpenAI's completion servers using your private API key. Highly reliable formatting using GPT-4o-mini, billed directly by OpenAI.
            </div>
          )}
        </div>

        {/* Anthropic Card */}
        <div
          className={`bg-white rounded-2xl border p-4 sm:p-5 transition-all shadow-xs ${
            provider === 'anthropic'
              ? 'border-indigo-300 ring-2 ring-indigo-500/10 shadow-sm'
              : 'border-slate-200/90 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[#CC785C] text-white flex items-center justify-center shrink-0 shadow-sm shadow-orange-500/20">
                <AnthropicLogo className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Anthropic</h4>
                <p className="text-xs text-slate-400 font-medium mt-0.5">Claude 3.5 Sonnet, Claude 3 Opus</p>
              </div>
            </div>

            {provider === 'anthropic' ? (
              <button
                type="button"
                onClick={() => toggleCardExpansion('anthropic')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold shadow-xs cursor-pointer hover:bg-emerald-100/60 transition-all"
                title="Active provider (Click to toggle details)"
              >
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Active</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleConfigureClick('anthropic')}
                className="px-4 py-1.5 rounded-full border border-indigo-200 hover:border-indigo-400 bg-white hover:bg-indigo-50/60 text-indigo-600 text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                Configure
              </button>
            )}
          </div>

          {/* API Key Input Row */}
          <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <span className="text-xs font-semibold text-slate-500 sm:w-16 shrink-0">API Key</span>
            <div className="relative flex-1 flex items-center">
              <Input
                type={showAnthropicKey ? 'text' : 'password'}
                placeholder={anthropicKey ? "••••••••••••••••••••••••••••••••" : "Paste your Anthropic console key (sk-ant-...)"}
                value={anthropicKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
                className="h-10 rounded-xl border-slate-200 pr-10 text-xs font-mono bg-slate-50/50 focus-visible:bg-white focus-visible:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                className="absolute right-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                title={showAnthropicKey ? "Hide key" : "Show key"}
              >
                {showAnthropicKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {anthropicKey && (
              <button
                type="button"
                onClick={() => testConnection('anthropic', anthropicKey)}
                disabled={testLoading['anthropic']}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 disabled:opacity-50 flex items-center justify-center gap-1.5 bg-indigo-50/60 hover:bg-indigo-100 border border-indigo-200/80 rounded-xl px-3.5 h-10 transition-all cursor-pointer shrink-0"
              >
                {testLoading['anthropic'] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Test Key'}
              </button>
            )}
          </div>

          {/* Subtle Inline Validation Status */}
          {testLoading['anthropic'] && (
            <div className="flex items-center gap-1.5 mt-2 pl-0 sm:pl-[76px] text-[11px] text-indigo-600 font-medium">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Verifying API key with Anthropic...</span>
            </div>
          )}
          {testResults['anthropic'] && !testLoading['anthropic'] && (
            <div className={`flex items-center gap-1.5 mt-2 pl-0 sm:pl-[76px] text-[11px] font-semibold ${testResults['anthropic']?.success ? 'text-emerald-600' : 'text-rose-600'}`}>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${testResults['anthropic']?.success ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              <span>{testResults['anthropic']?.message}</span>
            </div>
          )}

          {/* Optional Expanded Details */}
          {expandedCard === 'anthropic' && (
            <div className="mt-3 pt-3 border-t border-dashed border-slate-100 pl-0 sm:pl-[76px] text-[11px] text-slate-500 font-medium leading-relaxed">
              Connects directly to Anthropic's endpoints using your private API key. Uses Claude 3.5 Sonnet, providing state-of-the-art reasoning for complex, multi-page forms.
            </div>
          )}
        </div>

        {/* Google Gemini Card */}
        <div
          className={`bg-white rounded-2xl border p-4 sm:p-5 transition-all shadow-xs ${
            provider === 'gemini'
              ? 'border-indigo-300 ring-2 ring-indigo-500/10 shadow-sm'
              : 'border-slate-200/90 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-center shrink-0 shadow-sm p-2">
                <GeminiOfficialLogo className="w-full h-full" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Google Gemini</h4>
                <p className="text-xs text-slate-400 font-medium mt-0.5">Gemini 1.5 Pro, Gemini 1.5 Flash</p>
              </div>
            </div>

            {provider === 'gemini' ? (
              <button
                type="button"
                onClick={() => toggleCardExpansion('gemini')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold shadow-xs cursor-pointer hover:bg-emerald-100/60 transition-all"
                title="Active provider (Click to toggle details)"
              >
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Active</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleConfigureClick('gemini')}
                className="px-4 py-1.5 rounded-full border border-indigo-200 hover:border-indigo-400 bg-white hover:bg-indigo-50/60 text-indigo-600 text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                Configure
              </button>
            )}
          </div>

          {/* API Key Input Row */}
          <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <span className="text-xs font-semibold text-slate-500 sm:w-16 shrink-0">API Key</span>
            <div className="relative flex-1 flex items-center">
              <Input
                type={showGeminiKey ? 'text' : 'password'}
                placeholder={geminiKey ? "••••••••••••••••••••••••••••••••" : "Paste your Google AI Studio API key (AIzaSy...)"}
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                className="h-10 rounded-xl border-slate-200 pr-10 text-xs font-mono bg-slate-50/50 focus-visible:bg-white focus-visible:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowGeminiKey(!showGeminiKey)}
                className="absolute right-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                title={showGeminiKey ? "Hide key" : "Show key"}
              >
                {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {geminiKey && (
              <button
                type="button"
                onClick={() => testConnection('gemini', geminiKey)}
                disabled={testLoading['gemini']}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 disabled:opacity-50 flex items-center justify-center gap-1.5 bg-indigo-50/60 hover:bg-indigo-100 border border-indigo-200/80 rounded-xl px-3.5 h-10 transition-all cursor-pointer shrink-0"
              >
                {testLoading['gemini'] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Test Key'}
              </button>
            )}
          </div>

          {/* Subtle Inline Validation Status */}
          {testLoading['gemini'] && (
            <div className="flex items-center gap-1.5 mt-2 pl-0 sm:pl-[76px] text-[11px] text-indigo-600 font-medium">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Verifying API key with Google AI Studio...</span>
            </div>
          )}
          {testResults['gemini'] && !testLoading['gemini'] && (
            <div className={`flex items-center gap-1.5 mt-2 pl-0 sm:pl-[76px] text-[11px] font-semibold ${testResults['gemini']?.success ? 'text-emerald-600' : 'text-rose-600'}`}>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${testResults['gemini']?.success ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              <span>{testResults['gemini']?.message}</span>
            </div>
          )}

          {/* Optional Expanded Details */}
          {expandedCard === 'gemini' && (
            <div className="mt-3 pt-3 border-t border-dashed border-slate-100 pl-0 sm:pl-[76px] text-[11px] text-slate-500 font-medium leading-relaxed">
              Connects directly to Google's generative models using your private API key. Highly customizable, extremely fast, and billed directly by Google per token.
            </div>
          )}
        </div>

        {/* Filli Express Cloud Card */}
        <div
          className={`bg-white rounded-2xl border p-4 sm:p-5 transition-all shadow-xs ${
            provider === 'cloud'
              ? 'border-indigo-300 ring-2 ring-indigo-500/10 shadow-sm'
              : 'border-slate-200/90 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-indigo-500/20">
                <CloudExpressLogo className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Filli Express Cloud</h4>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Hosted Gemini 1.5 Flash · 50 Free Fills/Mo · Zero API Key Needed
                </p>
              </div>
            </div>

            {provider === 'cloud' ? (
              <button
                type="button"
                onClick={() => toggleCardExpansion('cloud')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold shadow-xs cursor-pointer hover:bg-emerald-100/60 transition-all"
                title="Active provider (Click to toggle details)"
              >
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Active</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleConfigureClick('cloud')}
                className="px-4 py-1.5 rounded-full border border-indigo-200 hover:border-indigo-400 bg-white hover:bg-indigo-50/60 text-indigo-600 text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                Configure
              </button>
            )}
          </div>

          {/* Express Cloud Details */}
          <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-xs pl-0 sm:pl-[60px]">
              <span className="text-slate-500 font-medium">Cloud Tier Status:</span>
              <span className="font-bold text-slate-700">
                {isLoggedIn ? 'Signed In (50 Cloud fills/month)' : 'Guest Mode (10 initial fills)'}
              </span>
            </div>

            {/* Custom proxy input option */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 pl-0 sm:pl-[60px] pt-1">
              <span className="text-xs font-semibold text-slate-500 sm:w-16 shrink-0">Proxy URL</span>
              <Input
                type="text"
                placeholder="https://your-custom-proxy.workers.dev (Optional)"
                value={proxyUrl}
                onChange={(e) => setProxyUrl(e.target.value)}
                className="h-10 rounded-xl border-slate-200 text-xs bg-slate-50/50 focus-visible:bg-white flex-1"
              />
              <button
                type="button"
                onClick={() => testConnection('cloud', '', proxyUrl)}
                disabled={testLoading['cloud']}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 disabled:opacity-50 flex items-center justify-center gap-1.5 bg-indigo-50/60 hover:bg-indigo-100 border border-indigo-200/80 rounded-xl px-3.5 h-10 transition-all cursor-pointer shrink-0"
              >
                {testLoading['cloud'] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Test Cloud'}
              </button>
            </div>

            {/* Subtle Inline Validation Status */}
            {testLoading['cloud'] && (
              <div className="flex items-center gap-1.5 pl-0 sm:pl-[76px] text-[11px] text-indigo-600 font-medium">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Checking cloud proxy endpoint latency...</span>
              </div>
            )}
            {testResults['cloud'] && !testLoading['cloud'] && (
              <div className={`flex items-center gap-1.5 pl-0 sm:pl-[76px] text-[11px] font-semibold ${testResults['cloud']?.success ? 'text-emerald-600' : 'text-rose-600'}`}>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${testResults['cloud']?.success ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                <span>{testResults['cloud']?.message}</span>
              </div>
            )}
          </div>
        </div>

        {/* Chrome Gemini Nano (Local) Card */}
        <div
          className={`bg-white rounded-2xl border p-4 sm:p-5 transition-all shadow-xs ${
            provider === 'local'
              ? 'border-indigo-300 ring-2 ring-indigo-500/10 shadow-sm'
              : 'border-slate-200/90 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <ChromeNanoLogo className="w-11 h-11" />
              <div>
                <h4 className="text-sm font-bold text-slate-900">Chrome Gemini Nano</h4>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  On-Device AI · 100% Offline & Private · Free Unlimited
                </p>
              </div>
            </div>

            {provider === 'local' ? (
              <button
                type="button"
                onClick={() => toggleCardExpansion('local')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold shadow-xs cursor-pointer hover:bg-emerald-100/60 transition-all"
                title="Active provider (Click to toggle details)"
              >
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Active</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleConfigureClick('local')}
                className="px-4 py-1.5 rounded-full border border-indigo-200 hover:border-indigo-400 bg-white hover:bg-indigo-50/60 text-indigo-600 text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                Configure
              </button>
            )}
          </div>

          {/* Local Nano Status Details */}
          <div className="mt-4 pt-3.5 border-t border-slate-100 space-y-2 pl-0 sm:pl-[60px]">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className={`w-2 h-2 rounded-full ${localAiStatus === 'available' ? 'bg-emerald-500 animate-pulse' : localAiStatus === 'checking' ? 'bg-amber-400' : 'bg-rose-500'}`} />
              <span className="text-slate-700">
                Engine Status: {localAiStatus === 'available' ? 'Ready & Available on this machine' : localAiStatus === 'checking' ? 'Detecting Chrome built-in model...' : 'Not Enabled / Chrome Canary Required'}
              </span>
            </div>
            {localAiStatus !== 'available' && (
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Runs 100% locally and privately inside your browser using Chrome's built-in Gemini Nano. Requires Chrome Dev/Canary v127+. Enable <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[10px]">#optimization-guide-on-device-model</code> and <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[10px]">#prompt-api-for-gemini-nano</code> in <code className="text-indigo-600 font-mono font-bold">chrome://flags</code>.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Banner: Zero logs stored notice (Slide 4 style) */}
      <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-indigo-50/40 border border-indigo-100/60 text-slate-800 shadow-xs">
        <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0 text-indigo-600 mt-0.5">
          <Lock className="w-4 h-4" />
        </div>
        <div className="space-y-0.5">
          <h4 className="text-xs font-bold text-indigo-950 tracking-tight">Zero logs stored. Form data is evaluated ephemerally in memory.</h4>
          <p className="text-[11.5px] text-slate-600 leading-relaxed font-medium">
            Your API keys, form data, and generated content never leave your browser.
          </p>
        </div>
      </div>

      {/* Per-Domain Custom Prompt Memory section */}
      <div className="space-y-4 pt-2 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Site Memory (Domain Rules)</Label>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Domain-specific instructions automatically attached when autofilling forms on specific sites.
            </p>
          </div>
          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
            {domainRules.length} Saved
          </span>
        </div>

        {domainRules.length === 0 ? (
          <div className="p-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 text-center">
            <p className="text-xs font-semibold text-slate-500">No domain memory rules saved yet.</p>
            <p className="text-[11px] text-slate-400 mt-1">
              When autofilling on any website, open the popup and click "📌 Remember for site" to save custom instructions.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {domainRules.map(rule => (
              <div key={rule.domain} className="p-3 bg-slate-50/80 rounded-2xl border border-slate-200/60 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Globe className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span className="text-xs font-black text-slate-800 truncate">{rule.domain}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 font-medium truncate font-sans">
                    "{rule.prompt}"
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteRule(rule.domain)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                  title="Delete domain rule"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Interface preferences with toggle switch */}
      <div className="space-y-4 pt-2 border-t border-slate-100">
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
      <div className="flex items-center justify-between mt-2 p-3.5 bg-emerald-50/40 border border-emerald-100/50 rounded-2xl shadow-xs">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold text-emerald-800">Settings auto-save is active</span>
        </div>
        <span className="text-[10px] text-slate-400 font-semibold font-sans">Saves immediately to local storage</span>
      </div>
    </div>
  );
};
