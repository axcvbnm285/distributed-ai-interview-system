import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../services/api";

function Dashboard() {
  const navigate = useNavigate();
  const [roomCode,       setRoomCode]       = useState("");
  const [loadingCreate,  setLoadingCreate]  = useState(false);
  const [loadingJoin,    setLoadingJoin]    = useState(false);
  const [error,          setError]          = useState("");

  const user         = JSON.parse(localStorage.getItem("user") || "{}");
  const isInterviewer = user.role === "INTERVIEWER";
  const getToken     = () => localStorage.getItem("token");

  const createRoom = async () => {
    setLoadingCreate(true);
    setError("");
    try {
      const response = await api.post("/rooms", {}, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      navigate(`/room/${response.data.roomCode}`);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create room.");
      setLoadingCreate(false);
    }
  };

  const joinRoom = async () => {
    if (!roomCode.trim()) { setError("Please enter a room code."); return; }
    setLoadingJoin(true);
    setError("");
    try {
      await api.post(`/rooms/${roomCode}/join`, {}, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      navigate(`/room/${roomCode}`);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to join room. Check the code and try again.");
      setLoadingJoin(false);
    }
  };

  const logout = () => { localStorage.clear(); navigate("/"); };

  return (
    <div className="min-h-screen bg-[#0f0f13] grid-bg text-white relative overflow-hidden">

      <div className="absolute top-[-160px] left-[-160px] w-[500px] h-[500px] bg-violet-700/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-100px] right-[-100px] w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Navbar */}
      <nav className="relative z-10 border-b border-[#2a2a38] bg-[#0f0f13]/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
              <svg className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
            <span className="font-bold text-white">Interview<span className="shimmer-text">Flow</span></span>
          </div>
          <div className="flex items-center gap-4">
            {/* Role badge */}
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${
              isInterviewer
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-blue-500/10 border-blue-500/30 text-blue-400"
            }`}>
              <span>{isInterviewer ? "🟢" : "🔵"}</span>
              {isInterviewer ? "Interviewer" : "Interviewee"}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-violet-600/30 border border-violet-500/40 flex items-center justify-center text-xs font-bold text-violet-300">
                {user.name?.charAt(0).toUpperCase() || "U"}
              </div>
              <span className="text-sm text-gray-400 hidden sm:block">{user.name}</span>
            </div>
            <button onClick={logout}
              className="text-xs text-gray-500 hover:text-gray-300 border border-[#2a2a38] hover:border-gray-600 px-3 py-1.5 rounded-lg transition-all duration-200">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-16">

        {/* Hero */}
        <div className="text-center mb-16 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 bg-violet-600/10 border border-violet-500/20 rounded-full px-4 py-1.5 text-xs text-violet-400 font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            {isInterviewer ? "Interviewer Dashboard" : "Candidate Dashboard"}
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight mb-4">
            {isInterviewer ? "Conduct an " : "Join an "}
            <span className="shimmer-text">Interview</span>
          </h1>
          <p className="text-gray-500 max-w-md mx-auto text-base">
            {isInterviewer
              ? "Create a new interview room or resume an existing one."
              : "Enter your room code to join the interview session."}
          </p>
        </div>

        {error && (
          <div className="max-w-2xl mx-auto mb-8 flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-5 py-3.5 animate-fade-in">
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        <div className={`grid gap-6 max-w-2xl mx-auto ${isInterviewer ? "sm:grid-cols-2" : "grid-cols-1 max-w-md"}`}>

          {/* Create Room — Interviewer only */}
          {isInterviewer && (
            <div className="glass rounded-2xl p-7 flex flex-col gap-5 animate-fade-in-up delay-100 group hover:border-violet-500/30 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center group-hover:bg-violet-600/30 transition-all duration-300">
                <svg className="w-6 h-6 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-semibold text-lg mb-1">Create Room</h3>
                <p className="text-gray-500 text-sm">Start a new interview session and share the room code with your candidate.</p>
              </div>
              <button onClick={createRoom} disabled={loadingCreate}
                className="mt-auto w-full bg-violet-600 hover:bg-violet-500 disabled:bg-violet-800 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-violet-900/40 hover:-translate-y-0.5 active:translate-y-0">
                {loadingCreate ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Creating...
                  </>
                ) : "Create Room →"}
              </button>
            </div>
          )}

          {/* Join Room — both roles */}
          <div className="glass rounded-2xl p-7 flex flex-col gap-5 animate-fade-in-up delay-200 group hover:border-emerald-500/20 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center group-hover:bg-emerald-600/30 transition-all duration-300">
              <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
            <div>
              <h3 className="text-white font-semibold text-lg mb-1">Join Room</h3>
              <p className="text-gray-500 text-sm">
                {isInterviewer
                  ? "Rejoin an existing room using its code."
                  : "Enter the room code provided by your interviewer."}
              </p>
            </div>
            <div className="mt-auto space-y-3">
              <input
                placeholder="Enter room code"
                value={roomCode}
                onChange={e => setRoomCode(e.target.value)}
                onKeyDown={e => e.key === "Enter" && joinRoom()}
                className="w-full bg-[#0f0f13] border border-[#2a2a38] rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition-all duration-200 font-mono"
              />
              <button onClick={joinRoom} disabled={loadingJoin}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/40 hover:-translate-y-0.5 active:translate-y-0">
                {loadingJoin ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Joining...
                  </>
                ) : "Join Room →"}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-10 mt-20 animate-fade-in delay-300">
          {[
            { label: "Real-time sync", icon: "⚡" },
            { label: "Collaborative editor", icon: "✏️" },
            { label: "Live video call", icon: "📹" },
          ].map(f => (
            <div key={f.label} className="flex items-center gap-2 text-gray-600 text-sm">
              <span>{f.icon}</span><span>{f.label}</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
