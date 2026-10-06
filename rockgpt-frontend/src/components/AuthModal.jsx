import React, { useState, useEffect } from "react";
import Logo from "./Logo.jsx";
import { GoogleLogin } from "@react-oauth/google";
import { isGoogleConfigured } from "../config/googleAuth.js";

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
  </svg>
);

export default function AuthModal({
  isOpen,
  initialMode = "in",
  onClose,
  onSignIn,
  onSignUp,
  onVerifyOtp,
  onForgotPassword,
  onResetPassword,
  onGoogleSuccess,
}) {
  const [mode, setMode] = useState(initialMode); // 'in', 'up', 'code', 'forgot', 'reset'
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [rememberSession, setRememberSession] = useState(true);
  const [agreedTos, setAgreedTos] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setErrorMessage("");
      setSuccessMessage("");
      setOtpCode("");
    }
  }, [isOpen, initialMode]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const validateEmail = (val) => /^\S+@\S+\.\S+$/.test(val);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    try {
      if (mode === "in") {
        if (!validateEmail(email)) throw new Error("Enter a valid email address.");
        if (!password) throw new Error("Enter your password.");

        setIsSubmitting(true);
        await onSignIn(email, password, rememberSession);
        onClose();
      } else if (mode === "up") {
        if (!name.trim()) throw new Error("Enter your full name.");
        if (!validateEmail(email)) throw new Error("Enter a valid email address.");
        if (password.length < 8) throw new Error("Password must be at least 8 characters.");
        if (password !== passwordConfirm) throw new Error("Passwords do not match.");
        if (!agreedTos) throw new Error("Please accept the Terms of Service and Privacy Policy.");

        setIsSubmitting(true);
        await onSignUp(name.trim(), email, password);
        setMode("code");
        setSuccessMessage(`Verification code sent to ${email}. You have 3 attempts.`);
      } else if (mode === "code") {
        if (!/^\d{6}$/.test(otpCode.trim())) {
          throw new Error("Enter the 6-digit verification code.");
        }

        setIsSubmitting(true);
        await onVerifyOtp(email, otpCode.trim());
        onClose();
      } else if (mode === "forgot") {
        if (!validateEmail(email)) throw new Error("Enter your registered email address.");

        setIsSubmitting(true);
        await onForgotPassword(email);
        setMode("reset");
        setSuccessMessage(`6-digit reset code sent to ${email}. You have 3 attempts.`);
      } else if (mode === "reset") {
        if (!/^\d{6}$/.test(otpCode.trim())) {
          throw new Error("Enter the 6-digit reset code.");
        }
        if (password.length < 8) {
          throw new Error("New password must be at least 8 characters.");
        }
        if (password !== passwordConfirm) {
          throw new Error("Passwords do not match.");
        }

        setIsSubmitting(true);
        await onResetPassword(email, otpCode.trim(), password);
        onClose();
      }
    } catch (err) {
      setErrorMessage(err.message || "Authentication failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    try {
      setIsSubmitting(true);
      setErrorMessage("");
      if (mode === "code") {
        await onSignUp(name.trim() || "User", email, password || "Temp123456");
        setSuccessMessage(`Fresh verification code sent to ${email}.`);
      } else if (mode === "reset") {
        await onForgotPassword(email);
        setSuccessMessage(`Fresh reset code sent to ${email}.`);
      }
    } catch (err) {
      setErrorMessage(err.message || "Failed to resend code.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="modal"
      className="on"
      onClick={(e) => {
        if (e.target.id === "modal") onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="card">
        {/* Header */}
        <div className="mh">
          <span className="lg">
            <Logo size={19} />
          </span>
          ROCKGPT SECURITY AUTH
          <button
            className="ib"
            onClick={onClose}
            type="button"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        {/* Tab switcher */}
        {(mode === "in" || mode === "up") && (
          <div className="tabs" data-m={mode}>
            <button
              className={mode === "in" ? "on" : ""}
              onClick={() => {
                setMode("in");
                setErrorMessage("");
                setSuccessMessage("");
              }}
              type="button"
            >
              Sign In
            </button>
            <button
              className={mode === "up" ? "on" : ""}
              onClick={() => {
                setMode("up");
                setErrorMessage("");
                setSuccessMessage("");
              }}
              type="button"
            >
              Create Account
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Mode 1: Sign In */}
          {mode === "in" && (
            <>
              <div className="hero">
                <div className="shield">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
                  </svg>
                </div>
                <h3>Welcome Back</h3>
                <p>Sign in with your email and password to access your chats.</p>
              </div>

              <label className="fld">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="M3 7l9 6 9-6" />
                </svg>
                <input
                  type="email"
                  placeholder="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </label>

              <label className="fld">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="8" cy="15" r="4" />
                  <path d="M11 12l9-9M16 7l3 3" />
                </svg>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="eye"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Show or hide password"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              </label>

              <div className="chk">
                <label>
                  <input
                    type="checkbox"
                    checked={rememberSession}
                    onChange={(e) => setRememberSession(e.target.checked)}
                  />
                  Remember session
                </label>
                <button
                  type="button"
                  className="lk"
                  onClick={() => {
                    setMode("forgot");
                    setErrorMessage("");
                    setSuccessMessage("");
                  }}
                >
                  Forgot password?
                </button>
              </div>

              {errorMessage && <div className="err">{errorMessage}</div>}
              {successMessage && <div className="err ok">{successMessage}</div>}

              <button className="pbtn" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Signing In…" : "Sign In →"}
              </button>

              <div className="or">OR CONTINUE WITH</div>

              {isGoogleConfigured && onGoogleSuccess ? (
                <div style={{ display: "flex", justifyContent: "center", marginBottom: "8px" }}>
                  <GoogleLogin
                    onSuccess={onGoogleSuccess}
                    onError={() => setErrorMessage("Google Sign-In failed.")}
                    theme="outline"
                    shape="pill"
                    width="100%"
                  />
                </div>
              ) : (
                <button
                  className="pbtn g"
                  type="button"
                  onClick={() => {
                    onSignIn("demo@rockgpt.ai", "demo1234", true);
                    onClose();
                  }}
                >
                  <GoogleIcon /> Continue with Google
                </button>
              )}

              <div className="sw">
                Don't have an account?{" "}
                <button
                  type="button"
                  className="lk"
                  onClick={() => {
                    setMode("up");
                    setErrorMessage("");
                    setSuccessMessage("");
                  }}
                >
                  Sign Up
                </button>
              </div>

              <div className="sw">
                <button type="button" className="lk quiet" onClick={onClose}>
                  Continue as guest
                </button>
              </div>
            </>
          )}

          {/* Mode 2: Sign Up */}
          {mode === "up" && (
            <>
              <div className="hero">
                <div className="shield">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
                  </svg>
                </div>
                <h3>Create Your Account</h3>
                <p>Unlock cloud sync, personal memory, and faster neural replies.</p>
              </div>

              <label className="fld">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-1a4 4 0 00-4-4H8a4 4 0 00-4 4v1" />
                  <circle cx="12" cy="8" r="4" />
                </svg>
                <input
                  type="text"
                  placeholder="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </label>

              <label className="fld">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="M3 7l9 6 9-6" />
                </svg>
                <input
                  type="email"
                  placeholder="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </label>

              <label className="fld">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="8" cy="15" r="4" />
                  <path d="M11 12l9-9M16 7l3 3" />
                </svg>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Create password (min 8 chars)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="eye"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              </label>

              <label className="fld">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="8" cy="15" r="4" />
                  <path d="M11 12l9-9M16 7l3 3" />
                </svg>
                <input
                  type={showPasswordConfirm ? "text" : "password"}
                  placeholder="Confirm password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="eye"
                  onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              </label>

              <div className="chk">
                <label>
                  <input
                    type="checkbox"
                    checked={agreedTos}
                    onChange={(e) => setAgreedTos(e.target.checked)}
                  />
                  I agree to the Terms of Service & Privacy Policy.
                </label>
              </div>

              {errorMessage && <div className="err">{errorMessage}</div>}
              {successMessage && <div className="err ok">{successMessage}</div>}

              <button className="pbtn" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Sending verification code…" : "Send Verification Code →"}
              </button>

              <div className="or">OR CONTINUE WITH</div>

              {isGoogleConfigured && onGoogleSuccess ? (
                <div style={{ display: "flex", justifyContent: "center", marginBottom: "8px" }}>
                  <GoogleLogin
                    onSuccess={onGoogleSuccess}
                    onError={() => setErrorMessage("Google Sign-Up failed.")}
                    theme="outline"
                    shape="pill"
                    width="100%"
                  />
                </div>
              ) : (
                <button
                  className="pbtn g"
                  type="button"
                  onClick={() => {
                    onSignIn("demo@rockgpt.ai", "demo1234", true);
                    onClose();
                  }}
                >
                  <GoogleIcon /> Continue with Google
                </button>
              )}

              <div className="sw">
                Already have an account?{" "}
                <button
                  type="button"
                  className="lk"
                  onClick={() => {
                    setMode("in");
                    setErrorMessage("");
                    setSuccessMessage("");
                  }}
                >
                  Sign In
                </button>
              </div>
            </>
          )}

          {/* Mode 3: Code Verification (Sign Up OTP) */}
          {mode === "code" && (
            <>
              <div className="hero">
                <div className="shield">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
                  </svg>
                </div>
                <h3>Check your email</h3>
                <p>Enter the 6-digit verification code sent to <b>{email}</b>.</p>
                <div style={{ marginTop: "10px", fontSize: "12px", color: "var(--muted)" }}>
                  🔒 Maximum 3 attempts allowed &bull; 24h lockout on failure
                </div>
              </div>

              <label className="fld">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
                </svg>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="6-digit code"
                  autoComplete="one-time-code"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  required
                />
              </label>

              {errorMessage && <div className="err">{errorMessage}</div>}
              {successMessage && <div className="err ok">{successMessage}</div>}

              <button className="pbtn" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Verifying…" : "Verify & Create Account →"}
              </button>

              <div className="sw" style={{ display: "flex", justifyContent: "space-between", marginTop: "16px" }}>
                <button type="button" className="lk" onClick={handleResendOtp} disabled={isSubmitting}>
                  Resend code
                </button>
                <button
                  type="button"
                  className="lk"
                  onClick={() => {
                    setMode("up");
                    setErrorMessage("");
                  }}
                >
                  Wrong email? Go back
                </button>
              </div>
            </>
          )}

          {/* Mode 4: Forgot Password Request */}
          {mode === "forgot" && (
            <>
              <div className="hero">
                <div className="shield">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="8" cy="15" r="4" />
                    <path d="M11 12l9-9M16 7l3 3" />
                  </svg>
                </div>
                <h3>Reset Password</h3>
                <p>Enter your email to receive a 6-digit recovery code.</p>
              </div>

              <label className="fld">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="M3 7l9 6 9-6" />
                </svg>
                <input
                  type="email"
                  placeholder="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>

              {errorMessage && <div className="err">{errorMessage}</div>}
              {successMessage && <div className="err ok">{successMessage}</div>}

              <button className="pbtn" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Sending Recovery Code…" : "Send Recovery Code →"}
              </button>

              <div className="sw">
                Remember your password?{" "}
                <button
                  type="button"
                  className="lk"
                  onClick={() => {
                    setMode("in");
                    setErrorMessage("");
                    setSuccessMessage("");
                  }}
                >
                  Back to Sign In
                </button>
              </div>
            </>
          )}

          {/* Mode 5: Reset Password with OTP Code */}
          {mode === "reset" && (
            <>
              <div className="hero">
                <div className="shield">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="8" cy="15" r="4" />
                    <path d="M11 12l9-9M16 7l3 3" />
                  </svg>
                </div>
                <h3>Enter Recovery Code</h3>
                <p>We sent a 6-digit code to <b>{email}</b>. Enter it below with your new password.</p>
                <div style={{ marginTop: "10px", fontSize: "12px", color: "var(--muted)" }}>
                  🔒 Maximum 3 attempts allowed &bull; 24h lockout on failure
                </div>
              </div>

              {/* OTP Code Input */}
              <label className="fld">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
                </svg>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="6-digit reset code"
                  autoComplete="one-time-code"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  required
                />
              </label>

              {/* New Password */}
              <label className="fld">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="8" cy="15" r="4" />
                  <path d="M11 12l9-9M16 7l3 3" />
                </svg>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="New Password (min 8 chars)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="eye"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              </label>

              {/* Confirm New Password */}
              <label className="fld">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="8" cy="15" r="4" />
                  <path d="M11 12l9-9M16 7l3 3" />
                </svg>
                <input
                  type={showPasswordConfirm ? "text" : "password"}
                  placeholder="Confirm New Password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="eye"
                  onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              </label>

              {errorMessage && <div className="err">{errorMessage}</div>}
              {successMessage && <div className="err ok">{successMessage}</div>}

              <button className="pbtn" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Resetting Password…" : "Reset Password & Log In →"}
              </button>

              <div className="sw" style={{ display: "flex", justifyContent: "space-between", marginTop: "16px" }}>
                <button type="button" className="lk" onClick={handleResendOtp} disabled={isSubmitting}>
                  Resend reset code
                </button>
                <button
                  type="button"
                  className="lk"
                  onClick={() => {
                    setMode("in");
                    setErrorMessage("");
                    setSuccessMessage("");
                  }}
                >
                  Back to Sign In
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
