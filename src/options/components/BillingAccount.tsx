import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, LogOut, Zap, Sparkles } from 'lucide-react';

interface BillingAccountProps {
  isLoggedIn: boolean;
  userEmail: string;
  userName: string;
  userAvatar: string;
  userPlan: string;
  usageCount: number;
  usageLimit: number;
  authToken: string;
  userId: string;
  authLoading: boolean;
  authError: string;
  customerPortalUrl?: string;
  checkoutUrl?: string;
  handleGoogleSignIn: () => void;
  handleLogout: () => void;
  setActiveTab: (tab: 'account' | 'profile' | 'advanced') => void;
}

export const BillingAccount = ({
  isLoggedIn,
  userEmail,
  userName,
  userAvatar,
  userPlan,
  usageCount,
  usageLimit,
  authToken,
  userId,
  authLoading,
  authError,
  customerPortalUrl,
  checkoutUrl,
  handleGoogleSignIn,
  handleLogout,
  setActiveTab
}: BillingAccountProps) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Promo/Warning Banner for anonymous users */}
      {!isLoggedIn && (
        <div className={`p-6 rounded-2xl border text-amber-950 shadow-inner space-y-3 relative overflow-hidden mb-2 ${usageCount >= 10 
          ? 'bg-gradient-to-r from-red-500/15 via-orange-500/10 to-transparent border-red-200' 
          : 'bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-transparent border-amber-200'
        }`}>
          <div className="absolute -right-8 -top-8 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl" />
          <div className="flex items-start gap-4">
            <div className={`p-2.5 rounded-xl shrink-0 shadow-md text-white ${usageCount >= 10 ? 'bg-red-500' : 'bg-amber-600'}`}>
              {usageCount >= 10 ? <Zap className="w-5 h-5 animate-bounce" /> : <Sparkles className="w-5 h-5" />}
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-black tracking-tight uppercase leading-snug">
                {usageCount >= 10 
                  ? "Anonymous Limit Reached (10/10 Fills)!" 
                  : `Using Anonymous Cloud Tier (${Math.max(0, 10 - usageCount)}/10 Fills Left)`
                }
              </h4>
              <p className="text-xs font-semibold leading-relaxed text-slate-600">
                {usageCount >= 10 
                  ? "You have completed your free limit of 10 anonymous cloud fills. Sign in or register a free account to instantly unlock 50 high-speed cloud fills every month!" 
                  : "You are currently running in anonymous cloud mode. Create a free account to instantly unlock 50 fast cloud fills every month, back up your profile card, and sync settings across browsers."
                }
              </p>
              {/* <div className="text-[11px] font-bold text-indigo-600 mt-2.5">
                💡 Tech-savvy? Avoid cloud registration entirely by entering your own private API key in the{' '}
                <button
                  onClick={() => setActiveTab('advanced')}
                  className="text-indigo-600 font-extrabold hover:underline bg-transparent border-none p-0 inline cursor-pointer"
                >
                  AI Provider
                </button>{' '}
                tab for unlimited local fills.
              </div> */}
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
              {/* <div className="text-[11px] font-bold text-amber-950 mt-2.5">
                💡 Developer bypass: You can also enter your private API keys in the{' '}
                <button
                  onClick={() => setActiveTab('advanced')}
                  className="text-amber-950 font-extrabold hover:underline bg-transparent border-none p-0 inline cursor-pointer"
                >
                  AI Provider
                </button>{' '}
                tab to get unlimited fills directly from Google, OpenAI, or Claude.
              </div> */}
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
              className="p-2.5 rounded-xl bg-white hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all border border-slate-100 shadow-sm cursor-pointer"
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

          {userPlan === 'Pro Plan' && (
            <div className="bg-indigo-50/20 border border-indigo-100/50 rounded-2xl p-5 space-y-3.5 animate-in fade-in">
              <div className="flex justify-between items-start gap-4">
                <div className="space-y-1">
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">Subscription Management</h4>
                  <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                    Manage your billing details, update your payment methods, or download invoices safely through our secure portal.
                  </p>
                </div>
              </div>
              <Button
                onClick={() => {
                  const portalUrl = customerPortalUrl || 'https://autofill-ai.lemonsqueezy.com/billing';
                  window.open(portalUrl, '_blank');
                }}
                variant="outline"
                className="w-full border-slate-200 hover:bg-slate-100 text-slate-700 font-bold h-10 rounded-xl cursor-pointer flex items-center justify-center gap-2 transition-all bg-white"
              >
                <span>Open Customer Billing Portal</span>
              </Button>
            </div>
          )}

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
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  <span>Unlimited form generations</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  <span>Priority high-speed Gemini 3 Flash execution</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  <span>Exclusive B2B & QA Persona expansion packs</span>
                </li>
              </ul>

              <Button
                onClick={() => {
                  const activeCheckoutUrl = checkoutUrl || import.meta.env.VITE_LEMON_SQUEEZY_CHECKOUT_URL || 'https://autofill-ai.lemonsqueezy.com/buy/mock-variant-id';
                  const lemonSqueezyUrl = `${activeCheckoutUrl}?checkout[custom][user_id]=${userId}&checkout[email]=${encodeURIComponent(userEmail)}`;
                  window.open(lemonSqueezyUrl, '_blank');
                }}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 rounded-xl shadow-lg border-none mt-2 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Zap className="w-4 h-4 fill-amber-300 text-amber-300 animate-pulse" />
                <span>Upgrade to Unlimited Pro</span>
              </Button>

              {/* <div className="text-[10px] text-slate-400 font-semibold mt-3 text-center leading-relaxed pt-2 border-t border-slate-700/50">
                💡 Are you a Tech-savvy? Switch your database connection to your own private API keys under the{' '}
                <button
                  onClick={() => setActiveTab('advanced')}
                  className="text-indigo-400 hover:text-indigo-300 font-bold hover:underline bg-transparent border-none p-0 inline cursor-pointer"
                >
                  AI Provider
                </button>{' '}
                tab for unlimited local fillings.
              </div> */}
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
  );
};
