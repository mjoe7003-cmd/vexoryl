import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CircleDollarSign, LockKeyhole, Radio, WalletCards } from 'lucide-react';
import { signInWithApi, signUpWithApi } from '../lib/api.js';
import { isSupabaseConfigured, supabase } from '../lib/supabase.js';

const steps = [
  { label: 'Account', icon: LockKeyhole },
  { label: 'Payouts', icon: WalletCards },
  { label: 'First stream', icon: Radio },
];

export default function CreatorOnboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ name: '', email: '', password: '', payout: 'bank', title: 'My first Vexoryl stream' });
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [loginMode, setLoginMode] = useState(false);
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  async function finishAccount() {
    setBusy(true); setStatus('');
    try {
      if (isSupabaseConfigured && supabase) {
        const redirectTo = import.meta.env.VITE_SUPABASE_REDIRECT_URL || `${window.location.origin}/`;
        const { data, error } = await supabase.auth.signUp({ email: form.email, password: form.password, options: { data: { full_name: form.name }, emailRedirectTo: redirectTo } });
        if (error) throw error;
        if (!data.session || !data.user) throw new Error('Check your email to confirm your account before signing in.');
        onComplete({ sub: data.user.id, name: form.name, email: form.email, role: 'creator' });
      } else {
        onComplete(await signUpWithApi(form.name, form.email, form.password));
      }
      window.localStorage.setItem('vexoryl_onboarding', JSON.stringify({ payout: form.payout, title: form.title }));
    } catch (error) { setStatus(error.message); } finally { setBusy(false); }
  }

  async function finishLogin() {
    setBusy(true); setStatus('');
    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
        if (error) throw error;
        onComplete({ sub: data.user.id, name: data.user.user_metadata?.full_name || form.email, email: data.user.email, role: data.user.user_metadata?.role || 'creator' });
      } else {
        onComplete(await signInWithApi(form.email, form.password));
      }
    } catch (error) { setStatus(error.message); } finally { setBusy(false); }
  }

  return <section className="onboarding-shell" aria-labelledby="onboarding-title"><div className="onboarding-intro"><p className="eyebrow">Creator launchpad</p><h1 id="onboarding-title">Make your first room feel like yours.</h1><p>Three short steps to set up your creator identity, payouts, and first broadcast.</p><button type="button" onClick={() => setLoginMode((current) => !current)}>{loginMode ? 'Create an account' : 'Already have an account? Sign in'}</button><div className="onboarding-steps">{steps.map(({ label, icon: Icon }, index) => <div className={index <= step ? 'onboarding-step current' : 'onboarding-step'} key={label}><span>{index < step ? <Check size={15} /> : <Icon size={15} />}</span><small>{label}</small></div>)}</div></div><form className="onboarding-panel" onSubmit={(event) => { event.preventDefault(); if (loginMode) finishLogin(); else if (step < 2) setStep(step + 1); else finishAccount(); }}><div className="onboarding-panel-top"><span>Step {step + 1} of 3</span><span>{steps[step].label}</span></div>{step === 0 && <div className="form-content"><h2>{loginMode ? 'Sign in to Vexoryl' : 'Start with your identity'}</h2>{!loginMode && <label>Display name<input name="name" value={form.name} onChange={update} placeholder="Your creator name" required /></label>}<label>Email address<input name="email" type="email" value={form.email} onChange={update} placeholder="you@example.com" required /></label><label>Password<input name="password" type="password" value={form.password} onChange={update} placeholder="At least 8 characters" minLength="8" required /></label></div>}{step === 1 && <div className="form-content"><h2>Choose your payout rail</h2><p className="form-hint">You can change this later in creator settings. Vexoryl keeps your payout preferences private.</p><label className="choice"><input type="radio" name="payout" value="bank" checked={form.payout === 'bank'} onChange={update} /><span><strong>Bank transfer</strong><small>Reliable weekly settlement</small></span><CircleDollarSign size={20} /></label><label className="choice"><input type="radio" name="payout" value="wallet" checked={form.payout === 'wallet'} onChange={update} /><span><strong>Digital wallet</strong><small>Fast, flexible withdrawals</small></span><WalletCards size={20} /></label></div>}{step === 2 && <div className="form-content"><h2>Shape your first broadcast</h2><p className="form-hint">We will save this as your launch checklist. Director Mode is ready when you are.</p><label>Stream title<input name="title" value={form.title} onChange={update} required /></label><div className="tutorial-callout"><Radio size={18} /><span><strong>Director Mode demo</strong><small>Viewer-funded prompts can trigger your next scene when the pool reaches its target.</small></span></div></div>}{status && <p className="form-error" role="alert">{status}</p>}<div className="onboarding-actions">{step > 0 && <button type="button" className="secondary-button" onClick={() => setStep(step - 1)}><ArrowLeft size={16} /> Back</button>}<button className="primary-button" type="submit" disabled={busy}>{busy ? 'Working...' : loginMode ? 'Sign in' : step === 2 ? 'Create creator account' : 'Continue'}{!busy && (loginMode || step === 2 ? <Check size={16} /> : <ArrowRight size={16} />)}</button></div></form></section>;
}
