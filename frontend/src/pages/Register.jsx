import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../services/api";

function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "" });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setError(""); };

  const handleRegister = async () => {
    if (!form.name || !form.email || !form.password || !form.role) {
      setError("All fields are required."); return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters."); return;
    }
    setLoading(true);
    try {
      await api.post("/auth/register", form);
      navigate("/", { state: { registered: true } });
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f13] grid-bg flex items-center justify-center p-4 relative overflow-hidden">

      {/* Ambient blobs */}
      <div className="absolute top-[-120px] left-[-120px] w-[420px] h-[420px] bg-violet-700/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-80px] right-[-80px] w-[320px] h-[320px] bg-purple-600/15 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute top-1/4 right-1/4 w-64 h-64 border border-violet-500/10 rounded-full animate-spin-slow pointer-events-none" />

      <div className="w-full max-w-md animate-fade-in-up">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-violet-600/20 border border-violet-500/30 mb-5 animate-pulse-glow">
            <svg className="w-8 h-8 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Interview<span className="shimmer-text">Flow</span>
          </h1>
          <p className="text-gray-500 text-sm mt-2">Create your account to get started</p>
        </div>

        {/* Card */}
        <div className="glass rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-1">Create account</h2>
          <p className="text-gray-500 text-sm mb-7">Choose your role carefully — it cannot be changed later</p>

          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 mb-6 animate-fade-in">
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          <div className="space-y-4">

            {/* Role selector — shown first, most important */}
            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3 block">I am a...</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    value: "INTERVIEWER",
                    icon: "🟢",
                    title: "Interviewer",
                    desc: "Conduct interviews, create rooms, assign questions",
                  },
                  {
                    value: "INTERVIEWEE",
                    icon: "🔵",
                    title: "Interviewee",
                    desc: "Join interview sessions and solve problems",
                  },
                ].map(({ value, icon, title, desc }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => set("role", value)}
                    className={`flex flex-col items-start gap-2 p-4 rounded-xl border text-left transition-all duration-200 ${
                      form.role === value
                        ? value === "INTERVIEWER"
                          ? "bg-emerald-500/10 border-emerald-500/50 shadow-lg shadow-emerald-900/20"
                          : "bg-blue-500/10 border-blue-500/50 shadow-lg shadow-blue-900/20"
                        : "bg-[#1e1e2a]/50 border-[#2a2a38] hover:border-gray-600"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{icon}</span>
                      <span className={`text-sm font-semibold ${
                        form.role === value
                          ? value === "INTERVIEWER" ? "text-emerald-400" : "text-blue-400"
                          : "text-gray-300"
                      }`}>{title}</span>
                      {form.role === value && (
                        <svg className={`w-3.5 h-3.5 ml-auto ${value === "INTERVIEWER" ? "text-emerald-400" : "text-blue-400"}`} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">{desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">Full Name</label>
              <input
                type="text"
                placeholder="John Doe"
                value={form.name}
                onChange={e => set("name", e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleRegister()}
                className="w-full bg-[#0f0f13] border border-[#2a2a38] rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all duration-200"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={e => set("email", e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleRegister()}
                className="w-full bg-[#0f0f13] border border-[#2a2a38] rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all duration-200"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">Password</label>
              <input
                type="password"
                placeholder="Min. 6 characters"
                value={form.password}
                onChange={e => set("password", e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleRegister()}
                className="w-full bg-[#0f0f13] border border-[#2a2a38] rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all duration-200"
              />
            </div>

            <button
              onClick={handleRegister}
              disabled={loading}
              className="w-full mt-2 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-800 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-violet-900/40 hover:-translate-y-0.5 active:translate-y-0"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating account...
                </>
              ) : "Create Account →"}
            </button>
          </div>
        </div>

        <p className="text-center text-gray-600 text-sm mt-6">
          Already have an account?{" "}
          <Link to="/" className="text-violet-400 hover:text-violet-300 transition-colors font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Register;
