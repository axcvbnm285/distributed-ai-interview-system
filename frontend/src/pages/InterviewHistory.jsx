import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

function InterviewHistory() {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingRoomCode, setDeletingRoomCode] = useState("");

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const token = localStorage.getItem("token");
  const isInterviewer = user.role === "INTERVIEWER";

  useEffect(() => {
    if (!token) {
      navigate("/");
      return;
    }

    if (!isInterviewer) {
      navigate("/dashboard");
      return;
    }

    let ignore = false;

    const loadHistory = async () => {
      setLoading(true);
      setError("");

      try {
        const { data } = await api.get("/rooms/history", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!ignore) {
          setHistory(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.response?.data?.message || "Failed to load interview history.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadHistory();

    return () => {
      ignore = true;
    };
  }, [isInterviewer, navigate, token]);

  const summary = useMemo(() => {
    const interviewsWithNotes = history.filter((item) => item.notes?.trim()).length;
    const totalCandidates = history.reduce((count, item) => count + (item.interviewees?.length || 0), 0);
    const totalHintsUsed = history.reduce((count, item) => count + (item.hintCount || 0), 0);

    return {
      totalRooms: history.length,
      interviewsWithNotes,
      totalCandidates,
      totalHintsUsed,
    };
  }, [history]);

  const formatDate = (value) => {
    if (!value) return "Unknown";

    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  };

  const copyRoomCode = async (roomCode) => {
    try {
      await navigator.clipboard.writeText(roomCode);
    } catch (error) {
      console.error("Failed to copy room code", error);
    }
  };

  const deleteHistoryEntry = async (roomCode) => {
    const confirmed = window.confirm(
      `Delete interview history for room ${roomCode}? This will permanently remove notes, AI insights, messages, participants, and question history.`
    );

    if (!confirmed) return;

    setDeletingRoomCode(roomCode);
    setError("");

    try {
      await api.delete(`/rooms/${roomCode}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      localStorage.removeItem(`interview-notes:${roomCode}`);
      setHistory((currentHistory) => currentHistory.filter((item) => item.roomCode !== roomCode));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete interview history.");
    } finally {
      setDeletingRoomCode("");
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f13] text-white">
      <header className="border-b border-[#2a2a38] bg-[#0f0f13]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-4">
          <button onClick={() => navigate("/dashboard")} className="text-gray-500 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div>
            <h1 className="text-lg font-semibold text-white">Interview History</h1>
            <p className="text-xs text-gray-500">Previous rooms, interviewee details, and saved notes.</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Rooms" value={summary.totalRooms} accent="text-violet-400" />
          <SummaryCard label="Candidates" value={summary.totalCandidates} accent="text-emerald-400" />
          <SummaryCard label="Notes Saved" value={summary.interviewsWithNotes} accent="text-blue-400" />
          <SummaryCard label="Hints Used" value={summary.totalHintsUsed} accent="text-amber-400" />
        </section>

        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-5 py-3.5">
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        {loading ? (
          <div className="border border-[#2a2a38] rounded-2xl bg-[#111118] px-6 py-10 text-sm text-gray-500">
            Loading interview history...
          </div>
        ) : history.length === 0 ? (
          <div className="border border-[#2a2a38] rounded-2xl bg-[#111118] px-6 py-10 text-center">
            <p className="text-sm font-semibold text-white mb-2">No interviews yet</p>
            <p className="text-sm text-gray-500 mb-5">Create a room, interview a candidate, and your notes will show up here.</p>
            <button
              onClick={() => navigate("/dashboard")}
              className="inline-flex items-center justify-center rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2 transition-all"
            >
              Back to Dashboard
            </button>
          </div>
        ) : (
          <section className="space-y-4">
            {history.map((item) => (
              <article key={item.roomCode} className="border border-[#2a2a38] rounded-2xl bg-[#111118] overflow-hidden">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between px-5 py-4 border-b border-[#2a2a38]">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-white">Room {item.roomCode}</span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400">
                        {item.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">Created {formatDate(item.createdAt)}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => copyRoomCode(item.roomCode)}
                      className="px-3 py-2 rounded-lg border border-[#2a2a38] text-xs text-gray-300 hover:border-violet-500/40 hover:text-violet-300 transition-all"
                    >
                      Copy Code
                    </button>
                    <button
                      onClick={() => navigate(`/room/${item.roomCode}`)}
                      className="px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white transition-all"
                    >
                      Open Room
                    </button>
                    <button
                      onClick={() => deleteHistoryEntry(item.roomCode)}
                      disabled={deletingRoomCode === item.roomCode}
                      className="px-3 py-2 rounded-lg bg-red-600/90 hover:bg-red-500 disabled:bg-red-900/60 disabled:cursor-not-allowed text-xs font-semibold text-white transition-all"
                    >
                      {deletingRoomCode === item.roomCode ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>

                <div className="grid gap-0 lg:grid-cols-[320px_minmax(0,1fr)]">
                  <section className="px-5 py-4 border-b lg:border-b-0 lg:border-r border-[#2a2a38]">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Interviewees</h2>
                    {item.interviewees?.length ? (
                      <div className="space-y-3">
                        {item.interviewees.map((interviewee) => (
                          <div key={`${item.roomCode}-${interviewee.id}`} className="rounded-xl border border-[#2a2a38] bg-[#0f0f13] px-4 py-3">
                            <p className="text-sm font-semibold text-white">{interviewee.name}</p>
                            <p className="text-xs text-gray-500 mt-1">{interviewee.email}</p>
                            <p className="text-[11px] text-gray-600 mt-2">Joined {formatDate(interviewee.joinedAt)}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No interviewee has joined this room yet.</p>
                    )}
                  </section>

                  <section className="px-5 py-4 space-y-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Interview Notes & AI Insights</h2>
                      <span className="text-[11px] text-gray-600 font-mono">Saved with room</span>
                    </div>
                    <div className="rounded-xl border border-[#2a2a38] bg-[#0f0f13] px-4 py-3 min-h-40">
                      {item.notes?.trim() ? (
                        <pre className="whitespace-pre-wrap break-words text-sm text-gray-200 font-sans">{item.notes}</pre>
                      ) : (
                        <p className="text-sm text-gray-500">No interview notes saved for this room.</p>
                      )}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <InsightCard label="Hints Used" value={item.hintCount || 0} accent="text-amber-300" />
                      <InsightCard label="Questions Asked" value={item.questionsAsked?.length || 0} accent="text-cyan-300" />
                    </div>

                    {item.aiSummary?.trim() && (
                      <div className="rounded-xl border border-[#2a2a38] bg-[#0f0f13] px-4 py-3">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">AI Summary</h3>
                          {item.interviewees?.[0]?.name && (
                            <span className="text-[11px] text-gray-600">Candidate: {item.interviewees[0].name}</span>
                          )}
                        </div>
                        <pre className="whitespace-pre-wrap break-words text-sm text-gray-200 font-sans">{item.aiSummary}</pre>
                      </div>
                    )}

                    {item.latestAiReview?.trim() && (
                      <div className="rounded-xl border border-[#2a2a38] bg-[#0f0f13] px-4 py-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Latest AI Review</h3>
                        <pre className="whitespace-pre-wrap break-words text-sm text-gray-200 font-sans">{item.latestAiReview}</pre>
                      </div>
                    )}

                    {item.questionsAsked?.length > 0 && (
                      <div className="rounded-xl border border-[#2a2a38] bg-[#0f0f13] px-4 py-3">
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Questions Asked</h3>
                          <span className="text-[11px] text-gray-600">Newest first</span>
                        </div>
                        <div className="space-y-3">
                          {item.questionsAsked.map((question) => (
                            <div key={question.id} className="rounded-xl border border-[#2a2a38] bg-[#111118] px-4 py-3">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-white">{question.title}</p>
                                  <p className="mt-1 text-xs text-gray-500">{formatDate(question.askedAt)}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300">
                                    {question.difficulty || "Easy"}
                                  </span>
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
                                    {question.source || "MANUAL"}
                                  </span>
                                </div>
                              </div>
                              {question.description?.trim() && (
                                <pre className="mt-3 whitespace-pre-wrap break-words text-xs text-gray-400 font-sans">{question.description}</pre>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                </div>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}

function SummaryCard({ label, value, accent }) {
  return (
    <div className="border border-[#2a2a38] rounded-2xl bg-[#111118] px-5 py-4">
      <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-3 text-2xl font-semibold ${accent}`}>{value}</p>
    </div>
  );
}

function InsightCard({ label, value, accent }) {
  return (
    <div className="rounded-xl border border-[#2a2a38] bg-[#0f0f13] px-4 py-3">
      <p className="text-[11px] uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-2 text-xl font-semibold ${accent}`}>{value}</p>
    </div>
  );
}

export default InterviewHistory;
