import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Sparkles, User, AlertCircle, Globe, CheckCircle2, Lock, ArrowRight } from 'lucide-react';

interface OnboardingWizardProps {
  onboardingStep: 'walkthrough' | 'profile' | 'success';
  setOnboardingStep: (step: 'walkthrough' | 'profile' | 'success') => void;
  previewPersona: 'default' | 'profile' | 'qa' | 'b2b';
  setPreviewPersona: (persona: 'default' | 'profile' | 'qa' | 'b2b') => void;
  profileCompleted: boolean;
  handleSkip: () => void;
  firstName: string;
  setFirstName: (val: string) => void;
  lastName: string;
  setLastName: (val: string) => void;
  email: string;
  setEmail: (val: string) => void;
  phone: string;
  handlePhoneChange: (val: string) => void;
  handlePhoneBlur: () => void;
  phoneError: string;
  company: string;
  setCompany: (val: string) => void;
  jobTitle: string;
  setJobTitle: (val: string) => void;
  bio: string;
  setBio: (val: string) => void;
  handleSave: () => void;
}

export const OnboardingWizard = ({
  onboardingStep,
  setOnboardingStep,
  previewPersona,
  setPreviewPersona,
  profileCompleted,
  handleSkip,
  firstName,
  setFirstName,
  lastName,
  setLastName,
  email,
  setEmail,
  phone,
  handlePhoneChange,
  handlePhoneBlur,
  phoneError,
  company,
  setCompany,
  jobTitle,
  setJobTitle,
  bio,
  setBio,
  handleSave
}: OnboardingWizardProps) => {
  if (onboardingStep === 'walkthrough') {
    return (
      <>
        <div className="space-y-3 pb-6 pt-10 px-10 text-center">
          <Badge variant="outline" className="mx-auto text-indigo-600 border-indigo-100 bg-indigo-50/50 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase w-fit">
            Getting Started
          </Badge>
          <h2 className="text-3xl font-black tracking-tight text-slate-900 justify-center flex items-center gap-3">
            <Sparkles className="w-7 h-7 text-indigo-500 fill-indigo-50" />
            How AutoFill Works
          </h2>
          <p className="text-slate-500 text-sm font-medium">
            When you visit any page with a form, a floating side dock will appear. Click on the preview buttons below to see how each persona behaves:
          </p>
        </div>

        <div className="space-y-6 px-10 pb-4 text-center">
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
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-12 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer border-none"
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
        </div>
      </>
    );
  }

  if (onboardingStep === 'profile') {
    return (
      <>
        <div className="space-y-3 pb-6 pt-10 px-10">
          <Badge variant="outline" className="text-indigo-600 border-indigo-100 bg-indigo-50/50 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase w-fit animate-none">
            Profile Setup
          </Badge>
          <h2 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            <User className="w-7 h-7 text-indigo-500 fill-indigo-50" />
            My Identity Profile
          </h2>
          <p className="text-slate-500 text-sm font-medium">
            Stored safely inside your browser, never shared. Left blank, the extension falls back to random mocking.
          </p>
        </div>

        <div className="space-y-6 px-10 pb-6">
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
                className="w-full text-sm rounded-xl border border-slate-200 focus:border-indigo-500 focus:outline-none p-3 resize-none font-sans placeholder:text-slate-400/70 bg-white"
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
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold h-11 rounded-xl transition-all shadow-md cursor-pointer border-none"
              >
                Save & Finish
              </Button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="space-y-3 pb-6 pt-10 px-10 text-center animate-in fade-in duration-300">
        <Badge variant="outline" className="mx-auto text-emerald-600 border-emerald-100 bg-emerald-50 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase w-fit">
          Onboarding Complete
        </Badge>
        <h2 className="text-3xl font-black tracking-tight text-slate-900 justify-center flex items-center gap-3">
          <CheckCircle2 className="w-7 h-7 text-emerald-500 fill-emerald-50" />
          You're Ready to Fill!
        </h2>
        <p className="text-slate-500 text-sm font-medium">
          {profileCompleted
            ? "Your identity card has been set up. The extension will default to your saved details, but you can still choose the 'Default' persona in the side dock to fill forms with random mock details anytime."
            : "No problem! The extension is configured to generate completely random, realistic mock details."}
        </p>
      </div>

      <div className="space-y-6 px-10 pb-4 text-center animate-in fade-in duration-500">
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
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-12 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer border-none"
          >
            <span>Done & Close Settings</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
          <button
            onClick={() => setOnboardingStep(profileCompleted ? 'profile' : 'walkthrough')}
            className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer block mx-auto bg-transparent border-none"
          >
            ← Go Back
          </button>
        </div>
      </div>
    </>
  );
};
