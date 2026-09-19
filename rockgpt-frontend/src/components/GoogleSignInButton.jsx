import React, { useState, Component } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import { Loader2 } from "lucide-react";

export const rawGoogleClientId =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_GOOGLE_CLIENT_ID) || "";

export const isGoogleConfigured = Boolean(
  rawGoogleClientId &&
  typeof rawGoogleClientId === "string" &&
  rawGoogleClientId.trim().length > 5 &&
  !rawGoogleClientId.includes("your_google_client_id") &&
  !rawGoogleClientId.includes("dummy") &&
  !rawGoogleClientId.includes("unconfigured")
);

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://localhost:5000"
    : "https://rockgpt.onrender.com");

function GoogleIcon({ className = "w-5 h-5 flex-shrink-0" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

function FallbackGoogleSignInButton({
  onError,
  className = "",
  disabled = false,
  buttonText = "Continue with Google",
}) {
  const handleClick = (e) => {
    e.preventDefault();
    if (disabled) return;
    onError?.(
      "Google Sign-In is not configured yet. Please add VITE_GOOGLE_CLIENT_ID in your Vercel Project Settings > Environment Variables, or use email and password above."
    );
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-label={buttonText}
      className={`group relative flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-neutral-900 border border-neutral-200 shadow-md hover:bg-neutral-50 hover:shadow-lg active:scale-[0.98] transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-75 disabled:cursor-not-allowed ${className}`}
    >
      <div className="grid h-6 w-6 place-items-center rounded-full bg-white shadow-xs shrink-0">
        <GoogleIcon className="w-5 h-5 flex-shrink-0" />
      </div>
      <span className="text-sm font-bold tracking-tight text-neutral-900">{buttonText}</span>
    </button>
  );
}

function ActiveGoogleSignInButton({
  onSuccess,
  onRequire2FA,
  onError,
  backendUrl = BACKEND_URL,
  className = "",
  disabled = false,
  buttonText = "Continue with Google",
}) {
  const [isConnecting, setIsConnecting] = useState(false);

  const googleLogin = useGoogleLogin({
    flow: "auth-code",
    scope: "openid email profile",
    onSuccess: async (codeResponse) => {
      try {
        if (!codeResponse?.code) {
          throw new Error("No authorization code returned by Google.");
        }

        setIsConnecting(true);

        const res = await fetch(`${backendUrl}/api/auth/google`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code: codeResponse.code }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.error || "Google authentication failed.");
        }

        if (data?.require2FA) {
          onRequire2FA?.(data);
        } else if (data?.user && data?.token) {
          onSuccess?.(data.user, data.token);
        } else {
          throw new Error("Invalid response received from authentication server.");
        }
      } catch (err) {
        console.error("Google sign-in error:", err);
        onError?.(err?.message || "Google authentication failed. Please try again.");
      } finally {
        setIsConnecting(false);
      }
    },
    onError: (errorResponse) => {
      setIsConnecting(false);
      console.warn("Google OAuth popup error:", errorResponse);
      if (errorResponse?.error === "popup_closed_by_user") {
        onError?.("Google sign-in was cancelled (popup was closed).");
      } else if (errorResponse?.error_description) {
        onError?.(errorResponse.error_description);
      } else {
        onError?.("Google sign-in could not be completed. Please try again.");
      }
    },
    onNonOAuthError: (nonOAuthError) => {
      setIsConnecting(false);
      console.warn("Google OAuth non-oauth error:", nonOAuthError);
      onError?.(nonOAuthError?.message || "Google sign-in popup could not be opened.");
    },
  });

  const handleClick = (e) => {
    e.preventDefault();
    if (disabled || isConnecting) return;

    setIsConnecting(true);
    try {
      googleLogin();
    } catch (err) {
      setIsConnecting(false);
      onError?.(err?.message || "Failed to initialize Google Sign-In.");
    }
  };

  const isBusy = isConnecting || disabled;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isBusy}
      aria-label={buttonText}
      aria-busy={isConnecting}
      className={`group relative flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-neutral-900 border border-neutral-200 shadow-md hover:bg-neutral-50 hover:shadow-lg active:scale-[0.98] transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-75 disabled:cursor-not-allowed ${className}`}
    >
      {isConnecting ? (
        <>
          <Loader2 className="w-5 h-5 flex-shrink-0 animate-spin text-neutral-600" />
          <span className="text-sm font-semibold text-neutral-800">Connecting to Google...</span>
        </>
      ) : (
        <>
          <div className="grid h-6 w-6 place-items-center rounded-full bg-white shadow-xs shrink-0">
            <GoogleIcon className="w-5 h-5 flex-shrink-0" />
          </div>
          <span className="text-sm font-bold tracking-tight text-neutral-900">{buttonText}</span>
        </>
      )}
    </button>
  );
}

class GoogleButtonErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.warn("GoogleButtonErrorBoundary caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <FallbackGoogleSignInButton {...this.props} />;
    }
    return this.props.children;
  }
}

export default function GoogleSignInButton(props) {
  if (!isGoogleConfigured) {
    return <FallbackGoogleSignInButton {...props} />;
  }

  return (
    <GoogleButtonErrorBoundary {...props}>
      <ActiveGoogleSignInButton {...props} />
    </GoogleButtonErrorBoundary>
  );
}
