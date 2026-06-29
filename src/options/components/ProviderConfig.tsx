import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, HelpCircle, Cpu, Loader2, Eye, EyeOff } from 'lucide-react';

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
  return (
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
  );
};
