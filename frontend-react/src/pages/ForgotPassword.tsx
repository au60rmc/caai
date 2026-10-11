import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, BookMarked, Sparkles, Eye, EyeOff } from "lucide-react";
import { Button, Input, Field } from "../components/ui";
import { api } from "../lib/api";

export function ForgotPassword() {
  const nav = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSendOTP(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const res = await api.post("/auth/forgot-password-otp", { email });
      if (res.data.status === "SUCCESS") {
        setSuccess("OTP has been sent to your email.");
        setStep(2);
      } else {
        setError(res.data.message || "Failed to send OTP.");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "An error occurred.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyOTP(e: React.FormEvent) {
    e.preventDefault();
    if (!otp.trim()) {
      setError("Enter the OTP sent to your email.");
      return;
    }
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const res = await api.post("/auth/verify-otp", { email, otp });
      if (res.data.status === "SUCCESS") {
        setSuccess("OTP verified! Create your new password.");
        setStep(3);
      } else {
        setError(res.data.message || "Invalid OTP.");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Invalid OTP.");
    } finally {
      setBusy(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const res = await api.post("/auth/reset-password-otp", { email, otp, new_password: newPassword });
      if (res.data.status === "SUCCESS") {
        setSuccess("Password updated successfully! Redirecting to login...");
        setTimeout(() => nav("/login"), 2500);
      } else {
        setError(res.data.message || "Failed to reset password.");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to reset password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center p-4 relative bg-[#0a0f1c] overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-teal-500/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/20 blur-[120px] pointer-events-none" />
      
      <Link
        to="/login"
        className="absolute top-6 left-6 z-10 inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to login
      </Link>
      
      <div className="w-full max-w-sm z-10 fade-up">
        <div className="flex flex-col items-center justify-center mb-8 gap-3">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-teal-400 to-indigo-500 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200" />
            <span className="relative flex h-14 w-14 items-center justify-center rounded-xl bg-[#0c6b62] shadow-2xl ring-1 ring-white/10">
              <BookMarked className="h-7 w-7 text-white" />
            </span>
          </div>
          <div className="text-center mt-2">
            <div className="text-white font-bold text-2xl tracking-tight flex items-center justify-center gap-2">
              ImmBiz Books
              <Sparkles className="w-4 h-4 text-teal-400" />
            </div>
          </div>
        </div>

        <div className="backdrop-blur-xl bg-white/5 border border-white/10 p-8 rounded-2xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-teal-500/50 to-transparent" />
          
          <h1 className="text-2xl font-bold text-white mb-2">Reset Password</h1>
          <p className="text-sm text-slate-400 mb-6">
            {step === 1 && "Enter your email to receive an OTP."}
            {step === 2 && "Enter the 6-digit OTP sent to your email."}
            {step === 3 && "Create a new strong password."}
          </p>
          
          {step === 1 && (
            <form onSubmit={handleSendOTP} className="space-y-5">
              <Field label="Email Address" htmlFor="reset-email">
                <Input
                  id="reset-email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  className="bg-black/20 border-white/10 text-white placeholder:text-slate-500 focus-visible:ring-teal-500/50 focus-visible:border-teal-500/50"
                />
              </Field>
              <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-500 text-white shadow-[0_0_15px_rgba(12,107,98,0.3)] transition-all font-semibold rounded-lg h-11 mt-2" disabled={busy}>
                {busy ? "Sending..." : "Send OTP"}
              </Button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleVerifyOTP} className="space-y-5">
              <Field label="6-Digit OTP" htmlFor="reset-otp">
                <Input
                  id="reset-otp"
                  name="otp"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  autoFocus
                  className="bg-black/20 border-white/10 text-white placeholder:text-slate-500 focus-visible:ring-teal-500/50 focus-visible:border-teal-500/50 text-center tracking-widest text-lg"
                />
              </Field>
              <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-500 text-white shadow-[0_0_15px_rgba(12,107,98,0.3)] transition-all font-semibold rounded-lg h-11 mt-2" disabled={busy}>
                {busy ? "Verifying..." : "Verify OTP"}
              </Button>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <Field label="New Password" htmlFor="reset-new-password">
                <div className="relative">
                  <Input
                    id="reset-new-password"
                    name="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoFocus
                    className="bg-black/20 border-white/10 text-white placeholder:text-slate-500 focus-visible:ring-teal-500/50 focus-visible:border-teal-500/50 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </Field>
              <Field label="Confirm Password" htmlFor="reset-confirm-password">
                <div className="relative">
                  <Input
                    id="reset-confirm-password"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="bg-black/20 border-white/10 text-white placeholder:text-slate-500 focus-visible:ring-teal-500/50 focus-visible:border-teal-500/50 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </Field>
              <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-500 text-white shadow-[0_0_15px_rgba(12,107,98,0.3)] transition-all font-semibold rounded-lg h-11 mt-2" disabled={busy}>
                {busy ? "Resetting..." : "Reset Password"}
              </Button>
            </form>
          )}

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg fade-up mt-4">
              <p className="text-sm text-red-400 font-medium" role="alert">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-3 bg-teal-500/10 border border-teal-500/20 rounded-lg fade-up mt-4">
              <p className="text-sm text-teal-400 font-medium" role="alert">{success}</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
