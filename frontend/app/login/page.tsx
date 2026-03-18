"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

// ─── ChipSVG (unchanged) ─────────────────────────────────────────────────────

function ChipSVG() {
  return (
    <svg
      viewBox="0 0 400 400"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
    >
      <defs>
        <radialGradient id="loginBgGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#E8561B" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#E8561B" stopOpacity="0" />
        </radialGradient>
        <filter id="loginGlow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <linearGradient id="loginTraceH" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#E8561B" stopOpacity="0" />
          <stop offset="50%" stopColor="#E8561B" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#E8561B" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="loginTraceV" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#E8561B" stopOpacity="0" />
          <stop offset="50%" stopColor="#E8561B" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#E8561B" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="loginChipGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2a1810" />
          <stop offset="100%" stopColor="#1a0f08" />
        </linearGradient>
      </defs>

      <circle cx="200" cy="200" r="180" fill="url(#loginBgGlow)" />

      {[80, 120, 160, 240, 280, 320].map((y) => (
        <line key={`lh${y}`} x1="30" y1={y} x2="370" y2={y} stroke="url(#loginTraceH)" strokeWidth="1.5" />
      ))}
      {[80, 120, 160, 240, 280, 320].map((x) => (
        <line key={`lv${x}`} x1={x} y1="30" x2={x} y2="370" stroke="url(#loginTraceV)" strokeWidth="1.5" />
      ))}

      {[
        [80, 80], [80, 160], [80, 240], [80, 320],
        [160, 80], [160, 320],
        [240, 80], [240, 320],
        [320, 80], [320, 160], [320, 240], [320, 320],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="3.5" fill="#E8561B" fillOpacity="0.5" />
      ))}

      <rect x="120" y="120" width="160" height="160" rx="14" fill="url(#loginChipGrad)" stroke="#E8561B" strokeOpacity="0.5" strokeWidth="1.5" />

      {[0,1,2,3,4].map((row) =>
        [0,1,2,3,4].map((col) => (
          <rect
            key={`g${row}${col}`}
            x={132 + col * 28}
            y={132 + row * 28}
            width="18"
            height="18"
            rx="3"
            fill="#E8561B"
            fillOpacity="0.08"
          />
        ))
      )}

      <rect x="164" y="174" width="72" height="52" rx="8" fill="#E8561B" fillOpacity="0.18" />
      <text x="200" y="197" textAnchor="middle" fill="#E8561B" fontSize="11" fontWeight="700" letterSpacing="2" filter="url(#loginGlow)">AI</text>
      <text x="200" y="213" textAnchor="middle" fill="#E8561B" fontSize="7" fontWeight="500" opacity="0.8">SPECFLOW</text>

      {[[120,120],[280,120],[120,280],[280,280]].map(([cx,cy],i)=>(
        <circle key={i} cx={cx} cy={cy} r="5" fill="#E8561B" fillOpacity="0.7" />
      ))}

      <circle cx="200" cy="200" r="8" fill="#E8561B" fillOpacity="0.5" filter="url(#loginGlow)">
        <animate attributeName="r" values="6;10;6" dur="2s" repeatCount="indefinite" />
        <animate attributeName="fillOpacity" values="0.4;0.8;0.4" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

// ─── Login Page ───────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  function switchMode(next: "login" | "register") {
    setMode(next);
    setError(null);
    setSuccessMsg(null);
    setPassword("");
    setConfirmPassword("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }

    if (mode === "register") {
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setLoading(true);

    if (mode === "login") {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } else {
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
        },
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      // If email confirmation is disabled, user is immediately signed in
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push("/onboarding");
        router.refresh();
      } else {
        setSuccessMsg("Check your email to confirm your account, then log in.");
        setLoading(false);
        switchMode("login");
      }
    }
  }

  async function handleGoogleLogin() {
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (authError) setError(authError.message);
  }

  return (
    <main className="flex min-h-screen">
      {/* ─── Left Panel — Form ─────────────────────────── */}
      <div className="flex flex-col justify-center items-center w-full lg:w-[45%] bg-white px-8 sm:px-12 py-12">
        <div className="w-full max-w-[400px]">
          {/* Back to home */}
          <a
            href="/"
            className="inline-flex items-center gap-2 mb-10"
            style={{ textDecoration: "none" }}
          >
            <div
              className="relative overflow-hidden rounded-md"
              style={{ width: 24, height: 24 }}
            >
              <Image
                src="/logo.jpeg"
                alt="SpecFlow"
                fill
                className="object-cover"
              />
            </div>
            <span
              className="font-sans font-semibold text-[14px]"
              style={{ color: "#0D0D0D", letterSpacing: "-0.02em" }}
            >
              SpecFlow
            </span>
          </a>

          {/* Heading */}
          <h1
            className="font-display mb-2"
            style={{
              fontSize: "clamp(2rem, 4vw, 2.6rem)",
              fontWeight: 400,
              letterSpacing: "-0.02em",
              lineHeight: 1.15,
              color: "#0D0D0D",
            }}
          >
            {mode === "login" ? "Welcome back!" : "Create your account."}
          </h1>
          <p className="font-sans text-[0.9375rem] mb-8" style={{ color: "#6B6B6B", lineHeight: 1.6 }}>
            {mode === "login"
              ? <>Simplify your workflow and ship specs faster with{" "}<span style={{ color: "#E8561B", fontWeight: 500 }}>SpecFlow AI</span>.</>
              : "Start for free. No credit card required."}
          </p>

          {/* Error / success banner */}
          {error && (
            <div
              className="mb-4 px-4 py-3 rounded-lg font-sans text-[0.875rem]"
              style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.25)",
                color: "#DC2626",
              }}
            >
              {error}
            </div>
          )}
          {successMsg && (
            <div
              className="mb-4 px-4 py-3 rounded-lg font-sans text-[0.875rem]"
              style={{
                background: "rgba(34,197,94,0.08)",
                border: "1px solid rgba(34,197,94,0.25)",
                color: "#16A34A",
              }}
            >
              {successMsg}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Email */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#9a9085" }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <rect x="2" y="4" width="20" height="16" rx="3" />
                  <path d="M2 8l10 6 10-6" />
                </svg>
              </span>
              <input
                type="email"
                placeholder="Email address"
                className="form-input"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Password */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#9a9085" }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <rect x="3" y="11" width="18" height="11" rx="3" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
              </span>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                className="form-input"
                style={{ paddingRight: "2.75rem" }}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: "#9a9085", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>

            {/* Confirm password — register only */}
            {mode === "register" && (
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#9a9085" }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <rect x="3" y="11" width="18" height="11" rx="3" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Confirm password"
                  className="form-input"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            )}

            {/* Forgot password — login only */}
            {mode === "login" && (
              <div className="flex justify-end -mt-1">
                <a
                  href="#"
                  className="font-sans text-[0.8125rem] font-medium"
                  style={{ color: "#E8561B", textDecoration: "none" }}
                  onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                  onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                >
                  Forgot Password?
                </a>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="btn-dark w-full justify-center text-[0.9375rem] py-3"
              style={{ opacity: loading ? 0.65 : 1, cursor: loading ? "not-allowed" : "pointer" }}
            >
              {loading
                ? mode === "login" ? "Signing in…" : "Creating account…"
                : mode === "login" ? "Log in" : "Create account"}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-1">
              <hr style={{ flex: 1, borderColor: "#E4DDD4" }} />
              <span className="font-sans text-[0.8125rem]" style={{ color: "#9a9085", whiteSpace: "nowrap" }}>
                or continue with
              </span>
              <hr style={{ flex: 1, borderColor: "#E4DDD4" }} />
            </div>

            {/* Social buttons */}
            <div className="flex items-center justify-center gap-4">
              {/* Google */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-12 h-12 rounded-full flex items-center justify-center transition-colors"
                style={{ border: "1.5px solid #E4DDD4", background: "#fff", cursor: "pointer" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.04)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                aria-label="Continue with Google"
              >
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              </button>

              {/* GitHub */}
              <button
                type="button"
                className="w-12 h-12 rounded-full flex items-center justify-center transition-colors"
                style={{ border: "1.5px solid #E4DDD4", background: "#fff", cursor: "pointer" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.04)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                aria-label="Continue with GitHub"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#0D0D0D">
                  <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836a9.59 9.59 0 012.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                </svg>
              </button>
            </div>
          </form>

          {/* Mode toggle */}
          <p className="font-sans text-[0.875rem] text-center mt-8" style={{ color: "#6B6B6B" }}>
            {mode === "login" ? (
              <>
                Not a member?{" "}
                <button
                  onClick={() => switchMode("register")}
                  className="font-medium"
                  style={{ color: "#E8561B", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit", fontSize: "inherit" }}
                  onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                  onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                >
                  Register now
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  onClick={() => switchMode("login")}
                  className="font-medium"
                  style={{ color: "#E8561B", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit", fontSize: "inherit" }}
                  onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                  onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                >
                  Log in
                </button>
              </>
            )}
          </p>
        </div>
      </div>

      {/* ─── Right Panel — Visual ──────────────────────── */}
      <div
        className="hidden lg:flex flex-col items-center justify-center flex-1 relative overflow-hidden"
        style={{ background: "#F8F4EF" }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "linear-gradient(rgba(232,86,27,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(232,86,27,0.06) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div
          className="absolute pointer-events-none"
          style={{
            width: 480, height: 480,
            background: "radial-gradient(circle, rgba(232,86,27,0.18) 0%, transparent 70%)",
            borderRadius: "50%",
            animation: "glowPulse 4s ease-in-out infinite",
          }}
        />
        <div
          className="absolute pointer-events-none"
          style={{
            width: 320, height: 320,
            background: "radial-gradient(circle, rgba(232,86,27,0.28) 0%, transparent 65%)",
            borderRadius: "50%",
            animation: "glowPulse 3s ease-in-out 0.5s infinite",
          }}
        />
        <div className="float-label absolute" style={{ top: "20%", left: "8%", animation: "floatY 3.2s ease-in-out infinite" }}>
          <span style={{ color: "#E8561B", marginRight: 6 }}>◆</span>Requirements
        </div>
        <div className="float-label absolute" style={{ top: "35%", right: "6%", animation: "floatY 3.5s ease-in-out 0.5s infinite" }}>
          <span style={{ color: "#E8561B", marginRight: 6 }}>✦</span>AI Review
        </div>
        <div className="float-label absolute" style={{ bottom: "30%", left: "5%", animation: "floatY 3s ease-in-out 0.3s infinite" }}>
          <span style={{ color: "#22C55E", marginRight: 6 }}>●</span>Test Coverage
        </div>
        <div className="float-label absolute" style={{ bottom: "18%", right: "8%", animation: "floatY 3.3s ease-in-out 0.8s infinite" }}>
          <span style={{ color: "#8B5CF6", marginRight: 6 }}>⬡</span>Integrations
        </div>
        <div className="chip-container relative z-10" style={{ width: 300, height: 300 }}>
          <ChipSVG />
        </div>
        <div className="relative z-10 mt-8 text-center px-8">
          <p
            className="font-display"
            style={{
              fontSize: "clamp(1.5rem, 2.5vw, 2.2rem)",
              fontWeight: 400,
              letterSpacing: "-0.02em",
              lineHeight: 1.2,
              color: "#0D0D0D",
            }}
          >
            Build specs. Ship{" "}
            <span style={{ color: "#E8561B", fontStyle: "italic" }}>faster.</span>
          </p>
          <p className="font-sans mt-2 text-[0.9375rem]" style={{ color: "#6B6B6B" }}>
            Join 500+ teams automating their spec workflow.
          </p>
        </div>
      </div>
    </main>
  );
}
