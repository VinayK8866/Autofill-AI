import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sparkles, AlertCircle, User, Plus, Trash2, Edit2, Check, Lock } from 'lucide-react';
import { type SavedProfile } from '@/lib/profileManager';

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
  profiles: SavedProfile[];
  activeProfileId: string;
  onSelectProfile: (id: string) => void;
  onCreateProfile: (name: string) => boolean;
  onDeleteProfile: (id: string) => void;
  onRenameProfile: (id: string, newName: string) => void;
  userPlan: string;
  onUpgradeClick: () => void;
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
  handleSkip,
  profiles,
  activeProfileId,
  onSelectProfile,
  onCreateProfile,
  onDeleteProfile,
  onRenameProfile,
  userPlan,
  onUpgradeClick
}: ProfileCardFormProps) => {
  const [showProModal, setShowProModal] = useState(false);
  const [isCreatingInline, setIsCreatingInline] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const isPro = userPlan === 'Pro Plan';

  const handleAddClick = () => {
    if (!isPro && profiles.length >= 1) {
      setShowProModal(true);
      return;
    }
    setIsCreatingInline(true);
    setNewProfileName(`Persona ${profiles.length + 1}`);
  };

  const handleConfirmCreate = () => {
    if (!newProfileName.trim()) {
      setIsCreatingInline(false);
      return;
    }
    const created = onCreateProfile(newProfileName.trim());
    if (!created) {
      setShowProModal(true);
    }
    setIsCreatingInline(false);
    setNewProfileName('');
  };

  const handleStartRename = (profile: SavedProfile) => {
    setRenamingId(profile.id);
    setRenameValue(profile.name);
  };

  const handleConfirmRename = (id: string) => {
    if (renameValue.trim()) {
      onRenameProfile(id, renameValue.trim());
    }
    setRenamingId(null);
  };

  const activeProfile = profiles.find(p => p.id === activeProfileId) || profiles[0];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Multi-Profile Vault Selector Bar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Multi-Profile Vault</h4>
              <p className="text-[10px] text-slate-400 font-medium">Switch or create custom personas for different test environments</p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-slate-400">
            {profiles.length} {profiles.length === 1 ? 'Profile' : 'Profiles'} {isPro ? '• Unlimited' : '• Free Plan (1 Vault)'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {profiles.map(p => {
            const isActive = p.id === activeProfileId;
            const isRenaming = renamingId === p.id;

            return (
              <div
                key={p.id}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-indigo-100 border border-indigo-600'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                {isRenaming ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleConfirmRename(p.id)}
                      className="h-6 w-28 px-1.5 text-xs text-slate-900 bg-white rounded border border-slate-300 focus:outline-none"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => handleConfirmRename(p.id)}
                      className="p-1 hover:text-emerald-300 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelectProfile(p.id)}
                    className="flex items-center gap-1.5 cursor-pointer text-left"
                  >
                    <span>{p.name}</span>
                    {isActive && <span className="text-[9px] opacity-75 font-normal">(Active)</span>}
                  </button>
                )}

                {isActive && !isRenaming && (
                  <button
                    type="button"
                    onClick={() => handleStartRename(p)}
                    className="opacity-60 hover:opacity-100 ml-1 p-0.5 cursor-pointer"
                    title="Rename Profile"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                )}

                {profiles.length > 1 && !isRenaming && (
                  <button
                    type="button"
                    onClick={() => onDeleteProfile(p.id)}
                    className="opacity-60 hover:opacity-100 hover:text-rose-300 ml-0.5 p-0.5 cursor-pointer"
                    title="Delete Profile"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}

          {isCreatingInline ? (
            <div className="flex items-center gap-1.5 p-1 bg-white rounded-xl border border-indigo-200">
              <input
                type="text"
                placeholder="Profile Name"
                value={newProfileName}
                onChange={e => setNewProfileName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleConfirmCreate()}
                className="h-7 w-32 px-2 text-xs font-semibold rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                autoFocus
              />
              <button
                type="button"
                onClick={handleConfirmCreate}
                className="px-2 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 cursor-pointer"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setIsCreatingInline(false)}
                className="px-2 py-1 text-slate-500 hover:text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleAddClick}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/30 hover:bg-indigo-50 text-indigo-600 text-xs font-bold transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Profile</span>
              {!isPro && (
                <span className="ml-1 bg-amber-100 border border-amber-200 text-amber-800 text-[8.5px] px-1 py-0.2 rounded font-black tracking-wider">
                  PRO
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Pro Plan Gate Modal */}
      {showProModal && (
        <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-900 to-slate-900 text-white shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-200 border border-indigo-700/50">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-amber-300 shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black tracking-tight flex items-center gap-1.5">
                  <span>Multi-Profile Vault Requires Pro</span>
                  <span className="bg-amber-400 text-slate-950 text-[9px] px-1.5 py-0.5 rounded font-black">PRO</span>
                </h4>
                <p className="text-xs text-indigo-200/90 font-medium leading-relaxed mt-0.5">
                  Free accounts include 1 active profile. Upgrade to Pro to save unlimited dedicated personas for QA testing, work staging, and personal applications.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => setShowProModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              Maybe Later
            </button>
            <button
              type="button"
              onClick={() => {
                setShowProModal(false);
                onUpgradeClick();
              }}
              className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition-all shadow-md cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 fill-slate-950" />
              <span>Upgrade to Pro</span>
            </button>
          </div>
        </div>
      )}

      {/* Profile Form Details */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
            Editing Profile: <span className="text-indigo-600 font-bold">{activeProfile?.name || 'Personal Card'}</span>
          </Label>
        </div>

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
