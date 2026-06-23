import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const { data } = await api.post("/auth/forgot-password", {
        email: email.trim(),
      });
      setSuccess(data.message || "If an account exists for that email, a password reset link has been sent.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send password reset email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f13] grid-bg flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-[-120px] left-[-120px] w-[420px] h-[420px] bg-violet-700/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-80px] right-[-80px] w-[320px] h-[320px] bg-cyan-600/10 rounded-full blur-[80px] pointer-events-none" />

      <div className="w-full max-w-md animate-fade-in-up">
        <div className="glass rounded-2xl p-8 shadow-2xl">
          <h1 className="text-2xl font-semibold text-white mb-1">Forgot Password</h1>
          <p className="text-sm text-gray-500 mb-7">Enter your account email and we’ll send you a reset link.</p>

          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 mb-6">
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm rounded-lg px-4 py-3 mb-6">
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              {success}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && handleSubmit()}
                className="w-full bg-[#0f0f13] border border-[#2a2a38] rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all duration-200"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-500 disabled:bg-violet-800 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-violet-900/40"
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </div>
        </div>

        <p className="text-center text-gray-600 text-sm mt-6">
          Back to{" "}
          <Link to="/" className="text-violet-400 hover:text-violet-300 transition-colors font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default ForgotPassword;
