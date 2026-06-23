import { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import api from "../services/api";

function Login() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const justRegistered = location.state?.registered;

  const handleLogin = async () => {
    if (!email || !password) { setError("Please fill in all fields."); return; }
    setLoading(true);
    setError("");
    try {
      const response = await api.post("/auth/login", { email: email.trim(), password });
      localStorage.setItem("token", response.data.token);
      localStorage.setItem("user",  JSON.stringify(response.data.user));
      navigate("/dashboard");
    } catch {
      setError("Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f13] grid-bg flex items-center justify-center p-4 relative overflow-hidden">

      <div className="absolute top-[-120px] left-[-120px] w-[420px] h-[420px] bg-violet-700/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-80px] right-[-80px] w-[320px] h-[320px] bg-purple-600/15 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute top-1/4 right-1/4 w-64 h-64 border border-violet-500/10 rounded-full animate-spin-slow pointer-events-none" />
      <div className="absolute top-1/3 right-1/3 w-40 h-40 border border-violet-500/10 rounded-full animate-spin-slow pointer-events-none" style={{ animationDirection: "reverse", animationDuration: "20s" }} />

      <div className="w-full max-w-md animate-fade-in-up">

        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-violet-600/20 border border-violet-500/30 mb-5 animate-pulse-glow">
            <svg className="w-8 h-8 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Interview<span className="shimmer-text">Flow</span>
          </h1>
          <p className="text-gray-500 text-sm mt-2">Real-time collaborative interviewing platform</p>
        </div>

        <div className="glass rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-1">Welcome back</h2>
          <p className="text-gray-500 text-sm mb-7">Sign in to continue to your dashboard</p>

          {justRegistered && (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm rounded-lg px-4 py-3 mb-6 animate-fade-in">
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Account created! Sign in below.
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 mb-6 animate-fade-in">
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">Email</label>
              <input type="email" placeholder="you@example.com" value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                className="w-full bg-[#0f0f13] border border-[#2a2a38] rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all duration-200" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider block">Password</label>
                <Link to="/forgot-password" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
                  Forgot password?
                </Link>
              </div>
              <input type="password" placeholder="••••••••" value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                className="w-full bg-[#0f0f13] border border-[#2a2a38] rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all duration-200" />
            </div>

            <button onClick={handleLogin} disabled={loading}
              className="w-full mt-2 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-800 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-violet-900/40 hover:-translate-y-0.5 active:translate-y-0">
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </>
              ) : "Sign In →"}
            </button>
          </div>
        </div>

        <p className="text-center text-gray-600 text-sm mt-6">
          Don't have an account?{" "}
          <Link to="/register" className="text-violet-400 hover:text-violet-300 transition-colors font-medium">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
