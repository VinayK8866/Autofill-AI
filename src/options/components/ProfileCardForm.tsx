import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sparkles, AlertCircle } from 'lucide-react';

interface ProfileCardFormProps {
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
  handleSkip: () => void;
}

export const ProfileCardForm = ({
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
  handleSave,
  handleSkip
}: ProfileCardFormProps) => {
  return (
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
            className="w-full text-sm rounded-xl border border-slate-200 focus:border-indigo-500 focus:outline-none p-3 resize-none font-sans placeholder:text-slate-400/70 bg-white"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            onClick={handleSkip}
            variant="outline"
            className="flex-1 border-slate-200 hover:bg-slate-50 text-slate-600 font-bold h-11 rounded-xl cursor-pointer font-sans text-xs"
          >
            Skip & Start Filling
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold h-11 rounded-xl transition-all shadow-md cursor-pointer border-none font-sans text-xs"
          >
            Save Profile
          </Button>
        </div>
      </div>
    </div>
  );
};
