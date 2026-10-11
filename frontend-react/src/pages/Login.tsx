import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, BookMarked, Sparkles } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { Button, Input, Field } from "../components/ui";

export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Enter your username and password.");
      return;
    }
    setBusy(true);
    setError("");
    const r = await login(username, password);
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    const mustChange = localStorage.getItem("must_change_password") === "Y";
    nav(mustChange ? "/change-password" : "/app/dashboard");
  }

  const { demoLogin } = useAuth() || {};
  const handleDemo = async () => {
    const demoEmail = username.trim();
    if (!demoEmail || !/^\S+@\S+\.\S+$/.test(demoEmail)) {
      setError("Please enter a valid email above to try the demo.");
      return;
    }
    if (demoLogin) {
      setBusy(true);
      setError("");
      const res = await demoLogin(demoEmail);
      setBusy(false);
      if (res.ok) {
        nav("/app/dashboard");
      } else {
        setError(res.message);
      }
    }
  };

  return (
    <main className="min-h-screen grid place-items-center p-4 relative bg-[#0a0f1c] overflow-hidden">
      {/* Background ambient glowing orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-teal-500/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/20 blur-[120px] pointer-events-none" />
      
      <Link
        to="/"
        className="absolute top-6 left-6 z-10 inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to home
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
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-400 mt-1">CAAI Accounting</div>
          </div>
        </div>

        <div className="backdrop-blur-xl bg-white/5 border border-white/10 p-8 rounded-2xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-teal-500/50 to-transparent" />
          
          <h1 className="text-2xl font-bold text-white mb-2">Welcome back</h1>
          <p className="text-sm text-slate-400 mb-6">Sign in to your secure workspace.</p>
          
          <form onSubmit={onSubmit} className="space-y-5">
            <Field label="Username or Email" htmlFor="login-username">
              <Input
                id="login-username"
                name="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
                placeholder="name@company.com or username"
                className="bg-black/20 border-white/10 text-white placeholder:text-slate-500 focus-visible:ring-teal-500/50 focus-visible:border-teal-500/50"
              />
            </Field>
            
            <Field label="Password" htmlFor="login-password">
              <Input
                id="login-password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="bg-black/20 border-white/10 text-white placeholder:text-slate-500 focus-visible:ring-teal-500/50 focus-visible:border-teal-500/50"
              />
            </Field>
            
            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-xs text-teal-400 hover:text-teal-300 font-medium transition-colors">
                Forgot password?
              </Link>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg fade-up">
                <p className="text-sm text-red-400 font-medium" role="alert">
                  {error}
                </p>
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full bg-teal-600 hover:bg-teal-500 text-white shadow-[0_0_15px_rgba(12,107,98,0.3)] transition-all font-semibold rounded-lg h-11 mt-2" 
              disabled={busy}
            >
              {busy ? "Authenticating…" : "Sign in"}
            </Button>
            
            <div className="relative my-4 flex items-center">
              <div className="flex-grow border-t border-white/10"></div>
              <span className="flex-shrink-0 mx-4 text-xs text-slate-500 uppercase tracking-wider">or</span>
              <div className="flex-grow border-t border-white/10"></div>
            </div>

            <Button 
              type="button" 
              onClick={handleDemo}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white border border-white/10 transition-all font-semibold rounded-lg h-11" 
              disabled={busy}
            >
              Try Public Demo
            </Button>
          </form>
        </div>
        
        <p className="text-center text-xs font-medium text-slate-500 mt-6 flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
          End-to-end encrypted session
        </p>
      </div>
    </main>
  );
}
