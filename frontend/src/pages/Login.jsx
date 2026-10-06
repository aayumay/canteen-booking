import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { authApi } from "../api/authApi.js";
import { Spinner } from "../components/common/Spinner.jsx";
import Mascot from "../components/common/Mascot.jsx";
import ImageUploader from "../components/common/ImageUploader.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { homeForRole } from "../routes/ProtectedRoute.jsx";
import { playPop, playSuccess } from "../lib/sounds.js";

const OTP_LENGTH = 6;

function formatCleanPhone(raw) {
  let cleaned = raw.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+91")) {
    return cleaned;
  }
  if (cleaned.startsWith("91") && cleaned.length > 10) {
    return `+${cleaned}`;
  }
  if (!cleaned.startsWith("+")) {
    return `+91${cleaned.replace(/^0+/, "")}`;
  }
  return cleaned;
}

export default function Login() {
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Mode: "signin" | "register"
  const [mode, setMode] = useState("signin");
  // Role: "student" | "vendor" | "admin"
  const [role, setRole] = useState("student");
  // Step: "details" | "otp" | "name_required"
  const [step, setStep] = useState("details");

  // Form inputs
  const [phone, setPhone] = useState("9876543210");
  const [name, setName] = useState("");
  const [shopName, setShopName] = useState("");
  const [stallPhotoUrl, setStallPhotoUrl] = useState("");
  const [otpDigits, setOtpDigits] = useState(["1", "2", "3", "4", "5", "6"]);

  const [formError, setFormError] = useState(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resent, setResent] = useState(false);

  const otpRefs = useRef([]);
  const nameRef = useRef(null);

  const nextParam = searchParams.get("next");
  const expired = searchParams.get("expired") === "1";

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(safeNext(nextParam) ?? homeForRole(user.role), { replace: true });
    }
  }, [isAuthenticated, user, navigate, nextParam]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Auto-focus first OTP box when entering OTP step
  useEffect(() => {
    if (step === "otp") {
      setTimeout(() => {
        otpRefs.current[0]?.focus();
      }, 150);
    }
  }, [step]);

  // Request OTP Mutation (Sign In or Student Registration)
  const requestOtpMutation = useMutation({
    mutationFn: authApi.requestOtp,
    onSuccess: () => {
      playSuccess();
      setFormError(null);
      setResent(false);
      setOtpDigits(Array(OTP_LENGTH).fill(""));
      setStep("otp");
      setResendCooldown(30);
    },
    onError: (err) => setFormError(err),
  });

  // Vendor Register Mutation
  const registerVendorMutation = useMutation({
    mutationFn: authApi.registerVendor,
    onSuccess: () => {
      playSuccess();
      setFormError(null);
      setResent(false);
      setOtpDigits(Array(OTP_LENGTH).fill(""));
      setStep("otp");
      setResendCooldown(30);
    },
    onError: (err) => setFormError(err),
  });

  // Admin Register Mutation
  const registerAdminMutation = useMutation({
    mutationFn: authApi.registerAdmin,
    onSuccess: () => {
      playSuccess();
      setFormError(null);
      setResent(false);
      setOtpDigits(Array(OTP_LENGTH).fill(""));
      setStep("otp");
      setResendCooldown(30);
    },
    onError: (err) => setFormError(err),
  });

  // Verify OTP Mutation
  const verifyMutation = useMutation({
    mutationFn: authApi.verifyOtp,
    onSuccess: async (tokens) => {
      try {
        playSuccess();
        const me = await login(tokens);
        navigate(safeNext(nextParam) ?? homeForRole(me.role), { replace: true });
      } catch (err) {
        setFormError(err);
      }
    },
    onError: (err) => {
      if (/name is required/i.test(err?.message ?? "")) {
        setStep("name_required");
        setFormError(new Error("Please enter your name to complete registration."));
        setTimeout(() => nameRef.current?.focus(), 150);
      } else {
        setFormError(err);
      }
    },
  });

  const fullPhone = formatCleanPhone(phone);
  const busy =
    requestOtpMutation.isPending ||
    registerVendorMutation.isPending ||
    registerAdminMutation.isPending ||
    verifyMutation.isPending;

  // Handle Request / Registration Submit
  const handleInitiateAuth = (e) => {
    e?.preventDefault();
    setFormError(null);

    const rawDigits = phone.replace(/[^\d]/g, "");
    if (rawDigits.length < 10) {
      setFormError(new Error("Please enter a valid 10-digit mobile number."));
      return;
    }

    if (mode === "register") {
      if (role === "student") {
        if (!name.trim()) {
          setFormError(new Error("Please enter your full name."));
          return;
        }
        playPop();
        requestOtpMutation.mutate({ phone_number: fullPhone, role: "student" });
      } else if (role === "vendor") {
        if (!name.trim()) {
          setFormError(new Error("Please enter the stall manager or owner's name."));
          return;
        }
        if (!shopName.trim()) {
          setFormError(new Error("Please enter your canteen or food stall name."));
          return;
        }
        playPop();
        registerVendorMutation.mutate({
          phone_number: fullPhone,
          name: name.trim(),
          shop_name: shopName.trim(),
          stall_photo_url: stallPhotoUrl.trim() || undefined,
        });
      } else if (role === "admin") {
        if (!name.trim()) {
          setFormError(new Error("Please enter your full name."));
          return;
        }
        playPop();
        registerAdminMutation.mutate({
          phone_number: fullPhone,
          name: name.trim(),
        });
      }
    } else {
      // Sign in mode
      playPop();
      requestOtpMutation.mutate({ phone_number: fullPhone, role });
    }
  };

  // Handle Verify Submit
  const handleVerifyCode = (codeToVerify) => {
    const code = codeToVerify || otpDigits.join("");
    setFormError(null);

    if (code.length !== OTP_LENGTH) {
      setFormError(new Error(`Please enter the complete ${OTP_LENGTH}-digit code.`));
      return;
    }

    playPop();
    const isStudent = role === "student";
    const studentName = name.trim();

    verifyMutation.mutate({
      phone_number: fullPhone,
      otp_code: code,
      ...(isStudent && studentName ? { name: studentName } : {}),
    });
  };

  // OTP Digit Box Navigation & Typing Handlers
  const handleOtpChange = (index, value) => {
    const cleaned = value.replace(/[^\d]/g, "");
    if (!cleaned) {
      const nextDigits = [...otpDigits];
      nextDigits[index] = "";
      setOtpDigits(nextDigits);
      return;
    }

    // Handle single character
    const char = cleaned.slice(-1);
    const nextDigits = [...otpDigits];
    nextDigits[index] = char;
    setOtpDigits(nextDigits);

    // Auto-advance focus
    if (index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }

    // Auto-submit if all filled
    const completeCode = nextDigits.join("");
    if (completeCode.length === OTP_LENGTH && !nextDigits.includes("")) {
      handleVerifyCode(completeCode);
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      if (!otpDigits[index] && index > 0) {
        otpRefs.current[index - 1]?.focus();
        const nextDigits = [...otpDigits];
        nextDigits[index - 1] = "";
        setOtpDigits(nextDigits);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      otpRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/[^\d]/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;

    const nextDigits = Array(OTP_LENGTH).fill("");
    for (let i = 0; i < pasted.length; i++) {
      nextDigits[i] = pasted[i];
    }
    setOtpDigits(nextDigits);

    if (pasted.length === OTP_LENGTH) {
      otpRefs.current[OTP_LENGTH - 1]?.focus();
      handleVerifyCode(pasted);
    } else {
      otpRefs.current[pasted.length]?.focus();
    }
  };

  // Handle Resend
  const handleResend = () => {
    if (resendCooldown > 0 || busy) return;
    playPop();
    requestOtpMutation.mutate(
      { phone_number: fullPhone, role },
      {
        onSuccess: () => {
          setResent(true);
          setResendCooldown(30);
        },
      }
    );
  };

  return (
    <div className="auth-page-wrapper">
      {/* Decorative Organic Wave SVG Background */}
      <svg
        className="auth-wave-bg"
        viewBox="0 0 1440 280"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <path
          d="M0,64L48,80C96,96,192,128,288,122.7C384,117,480,75,576,80C672,85,768,139,864,149.3C960,160,1056,128,1152,106.7C1248,85,1344,75,1392,69.3L1440,64L1440,0L1392,0C1344,0,1248,0,1152,0C1056,0,960,0,864,0C768,0,672,0,576,0C480,0,384,0,288,0C192,0,96,0,48,0L0,0Z"
          fill="var(--color-forest)"
          fillOpacity="0.12"
        />
      </svg>

      <div className="auth-card-container">
        <motion.div
          className="auth-card"
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          {/* Header & Animated Mascot */}
          <div className="auth-hero">
            <div className="auth-mascot-anchor auth-mascot-floating">
              <Mascot size={56} variant="detailed" />
            </div>
            <div className="auth-brand-badge">Canteen Booking</div>
            <h1 className="auth-headline">Order ahead. Skip the queue.</h1>
            <p className="auth-subtext">
              {step === "otp"
                ? `Enter the 6-digit code sent to ${fullPhone}`
                : mode === "register"
                ? role === "vendor"
                  ? "Register your canteen stall for campus food orders"
                  : "Create your student account with instant mobile OTP"
                : "Sign in with your phone number"}
            </p>
          </div>

          {expired && !formError && step === "details" && (
            <div className="form-note" role="status" style={{ marginBottom: "16px" }}>
              Your previous session expired. Please sign in again.
            </div>
          )}

          {/* Mode Switcher: Sign In vs Create Account */}
          {step === "details" && (
            <div className="auth-mode-segmented">
              <button
                type="button"
                className={`auth-mode-btn ${mode === "signin" ? "active" : ""}`}
                onClick={() => {
                  playPop();
                  setMode("signin");
                  setFormError(null);
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`auth-mode-btn ${mode === "register" ? "active" : ""}`}
                onClick={() => {
                  playPop();
                  setMode("register");
                  setFormError(null);
                }}
              >
                Create Account
              </button>
            </div>
          )}

          {/* Role Switcher */}
          {step === "details" && (
            <div className="auth-role-tabs" role="radiogroup" aria-label="Account Role">
              <button
                type="button"
                className={`auth-role-btn ${role === "student" ? "active" : ""}`}
                onClick={() => {
                  playPop();
                  setRole("student");
                  setFormError(null);
                }}
                role="radio"
                aria-checked={role === "student"}
              >
                Student
              </button>
              <button
                type="button"
                className={`auth-role-btn ${role === "vendor" ? "active" : ""}`}
                onClick={() => {
                  playPop();
                  setRole("vendor");
                  setFormError(null);
                }}
                role="radio"
                aria-checked={role === "vendor"}
              >
                Canteen Partner
              </button>
              <button
                type="button"
                className={`auth-role-btn ${role === "admin" ? "active" : ""}`}
                onClick={() => {
                  playPop();
                  setRole("admin");
                  setFormError(null);
                }}
                role="radio"
                aria-checked={role === "admin"}
              >
                Admin
              </button>
            </div>
          )}

          {/* Horizontal Slide Animated Steps */}
          <AnimatePresence mode="wait">
            {step === "details" && (
              <motion.form
                key="step-details"
                className="auth-step-slide"
                onSubmit={handleInitiateAuth}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.22 }}
                noValidate
              >
                {/* Registration Fields */}
                {mode === "register" && (
                  <>
                    <label className="field">
                      <span className="field-label">
                        {role === "vendor" ? "Manager / Owner Name" : "Your Full Name"}
                      </span>
                      <input
                        className="input"
                        type="text"
                        placeholder={role === "vendor" ? "e.g. Ramesh Kumar" : "e.g. Aarav Sharma"}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        autoFocus
                      />
                    </label>

                    {role === "vendor" && (
                      <>
                        <label className="field">
                          <span className="field-label">Canteen Stall / Shop Name</span>
                          <input
                            className="input"
                            type="text"
                            placeholder="e.g. Campus Dosa Corner, Food Court #3"
                            value={shopName}
                            onChange={(e) => setShopName(e.target.value)}
                            required
                          />
                        </label>

                        <div style={{ marginBottom: "16px" }}>
                          <ImageUploader
                            label="Stall Photo (Optional)"
                            helperText="Show students your food counter or branding"
                            value={stallPhotoUrl}
                            onUploaded={(url) => setStallPhotoUrl(url)}
                            onRemove={() => setStallPhotoUrl("")}
                          />
                        </div>

                        <div className="auth-notice-card">
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ flexShrink: 0, marginTop: "2px" }}
                          >
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="16" x2="12" y2="12" />
                            <line x1="12" y1="8" x2="12.01" y2="8" />
                          </svg>
                          <p className="auth-notice-text">
                            <strong>Vendor Verification:</strong> Your stall account will be created instantly and submitted to campus institution admin for approval before going live to students.
                          </p>
                        </div>
                      </>
                    )}

                    {role === "admin" && (
                      <div className="auth-notice-card" style={{ borderColor: "rgba(139,105,20,0.4)", background: "var(--color-orange-soft)" }}>
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ flexShrink: 0, marginTop: "2px", color: "var(--color-orange)" }}
                        >
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                        <p className="auth-notice-text">
                          <strong>Admin Access:</strong> Admin accounts are activated immediately after phone verification.
                        </p>
                      </div>
                    )}
                  </>
                )}

                {/* Phone Number Input */}
                <label className="field">
                  <span className="field-label">Mobile Number</span>
                  <div className="auth-phone-input-wrap">
                    <span className="auth-phone-prefix">+91</span>
                    <input
                      className="auth-phone-input mono"
                      type="tel"
                      inputMode="numeric"
                      placeholder="98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      maxLength={14}
                      required
                      autoFocus={mode === "signin"}
                    />
                  </div>
                  <span className="field-hint">We'll text you a 6-digit one-time code</span>
                </label>

                {formError && (
                  <div className="form-error" role="alert" style={{ marginBottom: "14px" }}>
                    {formError.message}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary btn-block"
                  disabled={busy}
                  style={{ marginTop: "6px" }}
                >
                  {busy ? (
                    <Spinner size="sm" />
                  ) : mode === "register" ? (
                    role === "vendor" ? "Register Stall & Verify →" :
                    role === "admin" ? "Create Admin Account →" :
                    "Continue to Verify →"
                  ) : (
                    "Send One-Time Code →"
                  )}
                </button>
              </motion.form>
            )}

            {step === "otp" && (
              <motion.form
                key="step-otp"
                className="auth-step-slide"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleVerifyCode();
                }}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.22 }}
                noValidate
              >
                <div className="auth-step-note" style={{ textAlign: "center", marginBottom: "8px" }}>
                  <span>Code sent to </span>
                  <strong className="mono">{fullPhone}</strong>{" "}
                  <button
                    type="button"
                    className="linklike"
                    onClick={() => {
                      playPop();
                      setStep("details");
                      setFormError(null);
                    }}
                    style={{ marginLeft: "4px" }}
                  >
                    Change
                  </button>
                </div>

                {/* 6 Individual OTP Digit Boxes */}
                <div className="otp-boxes-wrapper" onPaste={handleOtpPaste}>
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (otpRefs.current[idx] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      className={`otp-digit-box ${digit ? "filled" : ""}`}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      autoComplete="one-time-code"
                      aria-label={`Digit ${idx + 1}`}
                    />
                  ))}
                </div>

                {formError && (
                  <div className="form-error" role="alert" style={{ marginBottom: "14px" }}>
                    {formError.message}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary btn-block"
                  disabled={busy || otpDigits.join("").length !== OTP_LENGTH}
                >
                  {verifyMutation.isPending ? <Spinner size="sm" /> : "Verify & Sign In →"}
                </button>

                <div style={{ marginTop: "12px", textAlign: "center" }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-block"
                    onClick={handleResend}
                    disabled={busy || resendCooldown > 0}
                  >
                    {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
                  </button>
                  {resent && !formError && resendCooldown > 0 && (
                    <p className="muted small" role="status" style={{ marginTop: "6px" }}>
                      A fresh one-time verification code has been dispatched.
                    </p>
                  )}
                </div>
              </motion.form>
            )}

            {step === "name_required" && (
              <motion.form
                key="step-name"
                className="auth-step-slide"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleVerifyCode();
                }}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.22 }}
                noValidate
              >
                <div className="form-note" style={{ marginBottom: "14px" }}>
                  Welcome to Canteen Booking! Please enter your name to complete your new student profile.
                </div>

                <label className="field">
                  <span className="field-label">Full Name</span>
                  <input
                    ref={nameRef}
                    className="input"
                    type="text"
                    placeholder="e.g. Aarav Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoFocus
                  />
                </label>

                {formError && (
                  <div className="form-error" role="alert" style={{ marginBottom: "14px" }}>
                    {formError.message}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary btn-block"
                  disabled={busy || !name.trim()}
                >
                  {busy ? <Spinner size="sm" /> : "Complete Sign Up →"}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>

        <div className="auth-footer-help">
          Protected by institution phone verification • Pickup only
        </div>
      </div>
    </div>
  );
}

function safeNext(next) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : null;
}
