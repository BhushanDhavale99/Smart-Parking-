import { useState } from "react";
import { supabase, authStorage } from "@/integrations/supabase/client";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowRight,
  CarFront,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  RefreshCw,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import parkGridLogo from "@/assets/parkgrid-logo.png";
import { soundFX } from "@/components/effects/soundEffects";
import "./LoginPage.css";

interface LoginPageProps {
  onLoginSuccess?: () => void;
  standalone?: boolean;
}

export function LoginPage({ onLoginSuccess, standalone = false }: LoginPageProps) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status & validation states
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMethod, setLoadingMethod] = useState<"email" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isExiting, setIsExiting] = useState(false);

  // Forgot password modal state
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  const validateEmail = (val: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  };

  const handleCompleteAuth = (userName: string) => {
    setIsLoading(false);
    setLoadingMethod(null);
    setErrorMessage(null);
    setSuccessMessage(`Access Granted · Welcome, ${userName}`);
    soundFX.playGateUnlock();

    // Trigger subtle exit transition into intro animation.
    // Session is already persisted by supabase-js (localStorage or sessionStorage
    // depending on what authStorage.use() was called with before sign-in).
    setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => {
        if (onLoginSuccess) {
          onLoginSuccess();
        } else if (standalone) {
          navigate({ to: "/" });
        }
      }, 500);
    }, 600);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Client-side validation (hand-written, no library).
    if (!email.trim()) {
      setErrorMessage("Please enter your email address.");
      return;
    }
    if (!validateEmail(email)) {
      setErrorMessage("Please enter a valid email address (e.g. name@domain.com).");
      return;
    }
    if (!password) {
      setErrorMessage("Please enter your password.");
      return;
    }
    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }

    if (mode === "signup") {
      if (!name.trim()) {
        setErrorMessage("Please provide your full name.");
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage("Passwords do not match.");
        return;
      }
      if (!agreeTerms) {
        setErrorMessage("Please agree to the ParkGrid Terms & Privacy Policy.");
        return;
      }
    }

    setIsLoading(true);
    setLoadingMethod("email");

    // Switch the supabase-js storage backend BEFORE signing in so new tokens
    // land in the right store (localStorage = remember, sessionStorage = forget on close).
    authStorage.use(rememberMe ? localStorage : sessionStorage);

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setIsLoading(false);
        setLoadingMethod(null);
        // Generic message: do not reveal whether the email exists.
        setErrorMessage("Invalid email or password. Please try again.");
        return;
      }

      handleCompleteAuth(email.split("@")[0] ?? "User");
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: name.trim() },
        },
      });

      if (error) {
        setIsLoading(false);
        setLoadingMethod(null);
        // Generic message: do not reveal whether the email already exists.
        setErrorMessage("Sign up failed. Please try again or use a different email.");
        return;
      }

      if (!data.session) {
        // Email confirmation is enabled — let the user know.
        setIsLoading(false);
        setLoadingMethod(null);
        setSuccessMessage("Account created! Please check your email to confirm your account.");
        return;
      }

      handleCompleteAuth(name);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim() || !validateEmail(forgotEmail)) {
      return;
    }

    // Always show success — do not reveal whether the email exists.
    await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    setForgotSent(true);
    setTimeout(() => {
      setForgotModalOpen(false);
      setForgotSent(false);
      setForgotEmail("");
    }, 2500);
  };

  return (
    <div className={`login-page-container ${isExiting ? "login-exit-animation" : ""}`}>
      {/* ── Background Aesthetics ── */}
      <div className="login-grid-bg" aria-hidden="true" />
      <div className="login-glow-primary" aria-hidden="true" />
      <div className="login-glow-secondary" aria-hidden="true" />
      <div className="login-road-stripes" aria-hidden="true" />

      {/* ── Main Glassmorphic Login Card ── */}
      <div className="login-glass-card" role="region" aria-label="Sign In to ParkGrid">
        {/* Top Branding Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center p-2 rounded-xl bg-background/60 border border-primary/40 shadow-[0_0_24px_rgba(0,242,254,0.2)] mb-3.5">
            <img src={parkGridLogo} alt="ParkGrid" className="size-10 object-contain" />
          </div>

          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-primary flex items-center justify-center gap-1.5 mb-1.5">
            <span className="live-dot" aria-hidden="true" />
            ParkGrid Secure Access // BKC • Mumbai
          </p>

          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
            {mode === "signin" ? "Welcome back to ParkGrid" : "Create your ParkGrid Account"}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground italic font-mono">
            Smart parking. Simple. Fast. Secure.
          </p>
        </div>

        {/* Success or Error Banners */}
        {errorMessage && (
          <div className="mb-4 flex items-center gap-2 p-3 text-xs rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-300 animate-in fade-in duration-200">
            <AlertCircle className="size-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 flex items-center gap-2 p-3 text-xs rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 animate-in fade-in duration-200">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
            <span className="font-semibold">{successMessage}</span>
          </div>
        )}

        {/* ── Email & Password Form ── */}
        <form onSubmit={handleEmailSubmit} className="space-y-3.5">
          {mode === "signup" && (
            <>
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                  Full Name <span className="text-primary">*</span>
                </label>
                <div className="login-input-wrap">
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Bhushan Dhavale"
                    className="login-input"
                  />
                  <User className="login-input-icon" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                  Preferred Vehicle Plate{" "}
                  <span className="text-muted-foreground/60">(Optional)</span>
                </label>
                <div className="login-input-wrap">
                  <input
                    type="text"
                    value={vehicle}
                    onChange={(e) => setVehicle(e.target.value)}
                    placeholder="MH 12 AB 1234"
                    className="login-input uppercase"
                  />
                  <CarFront className="login-input-icon" />
                </div>
              </div>
            </>
          )}

          {/* Email Input */}
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
              Email Address <span className="text-primary">*</span>
            </label>
            <div className="login-input-wrap">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="login-input"
                autoComplete="email"
              />
              <Mail className="login-input-icon" />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                Password <span className="text-primary">*</span>
              </label>
              {mode === "signin" && (
                <button
                  type="button"
                  onClick={() => setForgotModalOpen(true)}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="login-input-wrap">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="login-input"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
              <Lock className="login-input-icon" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="login-toggle-eye"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password (Sign up only) */}
          {mode === "signup" && (
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                Confirm Password <span className="text-primary">*</span>
              </label>
              <div className="login-input-wrap">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="login-input"
                  autoComplete="new-password"
                />
                <KeyRound className="login-input-icon" />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="login-toggle-eye"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Remember Me / Terms Checkbox */}
          <div className="flex items-center justify-between pt-1">
            {mode === "signin" ? (
              <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="size-3.5 rounded border-white/20 bg-background/80 text-primary focus:ring-1 focus:ring-primary accent-cyan-400"
                />
                <span>Remember this terminal</span>
              </label>
            ) : (
              <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground select-none">
                <input
                  type="checkbox"
                  required
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="size-3.5 rounded border-white/20 bg-background/80 text-primary focus:ring-1 focus:ring-primary accent-cyan-400"
                />
                <span>Agree to ParkGrid Terms &amp; Privacy Policy</span>
              </label>
            )}
          </div>

          {/* Primary Submit Button */}
          <button type="submit" disabled={isLoading} className="login-submit-btn mt-4">
            {isLoading && loadingMethod === "email" ? (
              <>
                <RefreshCw className="size-4 animate-spin text-slate-900" />
                <span>Authenticating with ParkGrid Hub...</span>
              </>
            ) : mode === "signin" ? (
              <>
                <span>Login to ParkGrid</span>
                <ArrowRight className="size-4" />
              </>
            ) : (
              <>
                <span>Create Account</span>
                <ShieldCheck className="size-4" />
              </>
            )}
          </button>
        </form>

        {/* 256-bit encrypted label */}
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-end text-xs">
          <span className="text-[10px] font-mono text-muted-foreground/70">256-Bit Encrypted</span>
        </div>

        {/* ── Mode Switcher Footer ── */}
        <div className="mt-4 text-center">
          {mode === "signin" ? (
            <p className="text-xs text-muted-foreground">
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setErrorMessage(null);
                }}
                className="text-cyan-400 hover:text-cyan-300 font-medium underline underline-offset-4 transition-colors"
              >
                Sign up
              </button>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setErrorMessage(null);
                }}
                className="text-cyan-400 hover:text-cyan-300 font-medium underline underline-offset-4 transition-colors"
              >
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>

      {/* ── Forgot Password Dialog ── */}
      {forgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-sm p-6 bg-slate-900 border border-cyan-500/30 rounded-xl shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-semibold text-white">Reset Password</h3>
              <button
                type="button"
                onClick={() => setForgotModalOpen(false)}
                className="text-muted-foreground hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>

            {forgotSent ? (
              <div className="p-4 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
                Password recovery instructions have been sent to <strong>{forgotEmail}</strong>.
                Please check your inbox.
              </div>
            ) : (
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Enter your registered ParkGrid email address and we'll send you an encrypted reset
                  link.
                </p>
                <div>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3 py-2 text-sm bg-slate-950 border border-white/20 rounded-md text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotModalOpen(false)}
                    className="px-3 py-1.5 text-xs text-muted-foreground hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-semibold bg-cyan-400 text-slate-950 rounded-md hover:bg-cyan-300"
                  >
                    Send Reset Link
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
