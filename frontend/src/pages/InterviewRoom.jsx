import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import socket from "../services/socket";
import CodeEditor from "../components/CodeEditor";
import Webcam from "../components/Webcam";
import { questions as builtinQuestions } from "../data/questions";
import api from "../services/api";

const LANGUAGE = "python";

const DIFFICULTY_COLOR = {
  Easy:   "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  Medium: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  Hard:   "text-red-400 bg-red-400/10 border-red-400/20",
};

const PYTHON_BOILERPLATE =
  "import sys\n" +
  "data = sys.stdin.read().split()\n" +
  "\n" +
  "# write your solution here\n";

const BLANK_FORM = {
  title: "", difficulty: "Easy", description: "",
  starterCode: PYTHON_BOILERPLATE,
  testCases: [{ input: "", expected: "" }],
};

function InterviewRoom() {
  const { roomCode } = useParams();
  const navigate     = useNavigate();

  // Role comes from localStorage (set at login from DB)
  const currentUser  = JSON.parse(localStorage.getItem("user") || "{}");
  const role         = currentUser.role || "INTERVIEWEE"; // "INTERVIEWER" | "INTERVIEWEE"
  const isInterviewer = role === "INTERVIEWER";

  const chatEndRef = useRef(null);

  // ── chat / room ────────────────────────────────────────
  const [message,      setMessage]      = useState("");
  const [messages,     setMessages]     = useState([]);
  const [participants, setParticipants] = useState([]);

  // ── editor ─────────────────────────────────────────────
  const [code,     setCode]     = useState("# Waiting for the interviewer to load a question...\n");
  const [question, setQuestion] = useState(null);

  // ── left panel ─────────────────────────────────────────
  const [activeTab,    setActiveTab]    = useState("question");
  const [questionView, setQuestionView] = useState("list");

  // ── custom question form (interviewer only) ────────────
  const [form,     setForm]     = useState(BLANK_FORM);
  const [formSent, setFormSent] = useState(false);

  // ── output / test ──────────────────────────────────────
  const [outputTab,    setOutputTab]    = useState("tests");
  const [running,      setRunning]      = useState(false);
  const [runningTests, setRunningTests] = useState(false);
  const [consoleOut,   setConsoleOut]   = useState("");
  const [testResults,  setTestResults]  = useState([]);
  const [activeCase,   setActiveCase]   = useState(0);
  const [testInput,    setTestInput]    = useState("");
  const [expectedOut,  setExpectedOut]  = useState("");
  const [manualResult, setManualResult] = useState(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── socket ─────────────────────────────────────────────
  useEffect(() => {
    socket.emit("join-room", {
      roomCode,
      username: currentUser.name,
      userId:   currentUser.id,
      role,                          // send role so server registers it correctly
    });

    socket.on("question-update", (q) => {
      setQuestion(q);
      setCode(q.starterCode || PYTHON_BOILERPLATE);
      setTestResults([]);
      setConsoleOut("");
      setActiveCase(0);
      setActiveTab("question");
      setQuestionView("detail");
    });
    socket.on("code-update",         setCode);
    socket.on("participants-update", setParticipants);
    socket.on("receive-message",     (data) => setMessages(p => [...p, data]));

    return () => {
      socket.off("question-update");
      socket.off("code-update");
      socket.off("participants-update");
      socket.off("receive-message");
    };
  }, [roomCode]);

  // ── question actions (interviewer only) ───────────────
  const selectQuestion = (q) => {
    setQuestion(q);
    setCode(q.starterCode || PYTHON_BOILERPLATE);
    setTestResults([]);
    setConsoleOut("");
    setActiveCase(0);
    setQuestionView("detail");
    socket.emit("question-change", { roomCode, question: q });
  };

  const broadcastCustomQuestion = () => {
    const tc = form.testCases.filter(t => t.input.trim() || t.expected.trim());
    const q  = { ...form, testCases: tc };
    setQuestion(q);
    setCode(q.starterCode || PYTHON_BOILERPLATE);
    setTestResults([]);
    setConsoleOut("");
    setActiveCase(0);
    setFormSent(true);
    socket.emit("question-change", { roomCode, question: q });
    setActiveTab("question");
    setQuestionView("detail");
  };

  // ── form helpers ───────────────────────────────────────
  const updateFormField = (k, v) => { setForm(f => ({ ...f, [k]: v })); setFormSent(false); };
  const updateTestCase  = (i, k, v) => {
    setForm(f => { const tc = [...f.testCases]; tc[i] = { ...tc[i], [k]: v }; return { ...f, testCases: tc }; });
    setFormSent(false);
  };
  const addTestCase    = () => setForm(f => ({ ...f, testCases: [...f.testCases, { input: "", expected: "" }] }));
  const removeTestCase = (i) => setForm(f => ({ ...f, testCases: f.testCases.filter((_, idx) => idx !== i) }));
  const resetForm      = () => { setForm(BLANK_FORM); setFormSent(false); };

  // ── run (console, auto-feeds first test case) ─────────
  const runCode = async () => {
    setRunning(true);
    setConsoleOut("");
    setManualResult(null);
    setOutputTab("console");
    const inp = testInput || question?.testCases?.[0]?.input    || "";
    const exp = expectedOut || question?.testCases?.[0]?.expected || "";
    try {
      const { data } = await api.post("/code/run", { code, language: LANGUAGE, input: inp });
      setConsoleOut(data.output);
      if (exp.trim()) setManualResult(data.output.trim() === exp.trim() ? "pass" : "fail");
    } catch {
      setConsoleOut("Error: Failed to execute code.");
    } finally {
      setRunning(false);
    }
  };

  // ── submit / run all tests ─────────────────────────────
  const runTests = async () => {
    if (!question?.testCases?.length) return;
    setRunningTests(true);
    setTestResults([]);
    setOutputTab("tests");
    try {
      const { data } = await api.post("/code/run-tests", {
        code, language: LANGUAGE, testCases: question.testCases,
      });
      setTestResults(data.results);
      setActiveCase(0);
    } catch {
      setTestResults([]);
    } finally {
      setRunningTests(false);
    }
  };

  const copyRoomCode = () => navigator.clipboard.writeText(roomCode);
  const sendMessage  = () => {
    if (!message.trim()) return;
    socket.emit("send-message", { roomCode, sender: currentUser.name, message });
    setMessage("");
  };

  const passed  = testResults.filter(r => r.passed).length;
  const total   = testResults.length;
  const allPass = total > 0 && passed === total;

  // ── tabs by role ───────────────────────────────────────
  const tabs = [
    { id: "question", label: "📋" },
    ...(isInterviewer ? [{ id: "add", label: "➕" }] : []),
    { id: "chat",     label: `💬${messages.length > 0 ? ` (${messages.length})` : ""}` },
    { id: "webcam",   label: "📷" },
  ];

  return (
    <div className="h-screen bg-[#0f0f13] text-white flex flex-col overflow-hidden">

      {/* ── Navbar ── */}
      <header className="shrink-0 h-14 border-b border-[#2a2a38] bg-[#0f0f13]/90 backdrop-blur-md flex items-center px-5 gap-4 z-20">
        <button onClick={() => navigate("/dashboard")} className="text-gray-500 hover:text-white transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
            <svg className="w-3 h-3 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </div>
          <span className="font-semibold text-sm">Interview<span className="shimmer-text">Flow</span></span>
        </div>

        <div className="h-5 w-px bg-[#2a2a38]" />

        <button onClick={copyRoomCode} className="flex items-center gap-2 bg-[#1e1e2a] border border-[#2a2a38] hover:border-violet-500/40 rounded-lg px-3 py-1 transition-all group" title="Click to copy">
          <span className="text-xs text-gray-400">Room:</span>
          <span className="text-xs font-mono font-semibold text-violet-400 tracking-widest">{roomCode}</span>
          <svg className="w-3 h-3 text-gray-600 group-hover:text-violet-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>

        {/* Role badge */}
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-semibold ${
          isInterviewer
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
            : "bg-blue-500/10 border-blue-500/30 text-blue-400"
        }`}>
          <span>{isInterviewer ? "🟢" : "🔵"}</span>
          {isInterviewer ? "Interviewer" : "Interviewee"}
        </div>

        {/* Participants */}
        <div className="flex items-center gap-2 ml-1">
          {participants.slice(0, 4).map((u, i) => (
            <div key={i} title={u}
              className="w-7 h-7 rounded-full bg-violet-600/30 border border-violet-500/40 flex items-center justify-center text-xs font-bold text-violet-300"
              style={{ marginLeft: i > 0 ? "-8px" : "0" }}>
              {u.charAt(0).toUpperCase()}
            </div>
          ))}
          {participants.length > 4 && <span className="text-xs text-gray-500 ml-1">+{participants.length - 4}</span>}
          <div className="flex items-center gap-1.5 ml-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-gray-500">{participants.length} online</span>
          </div>
        </div>

        {/* Actions */}
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-1.5">
            <span className="text-xs text-blue-400 font-semibold">🐍 Python</span>
          </div>
          <button onClick={runCode} disabled={running || runningTests}
            className="flex items-center gap-1.5 bg-[#1e1e2a] hover:bg-[#2a2a38] border border-[#2a2a38] disabled:opacity-50 disabled:cursor-not-allowed text-gray-300 text-sm font-semibold px-4 py-1.5 rounded-lg transition-all">
            {running ? <Spinner /> : (
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
            )}
            Run
          </button>
          <button onClick={runTests} disabled={running || runningTests || !question?.testCases?.length}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-all shadow-lg shadow-emerald-900/30 hover:-translate-y-0.5 active:translate-y-0">
            {runningTests ? <Spinner /> : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            Submit
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left Panel ── */}
        <aside className="w-[340px] shrink-0 border-r border-[#2a2a38] flex flex-col bg-[#0f0f13] overflow-hidden">
          <div className="flex border-b border-[#2a2a38] shrink-0">
            {tabs.map(({ id, label }) => (
              <button key={id} onClick={() => setActiveTab(id)}
                className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-all ${
                  activeTab === id ? "text-violet-400 border-b-2 border-violet-500 bg-violet-500/5" : "text-gray-600 hover:text-gray-400"
                }`}>
                {label}
              </button>
            ))}
          </div>

          {/* ── Question Tab ── */}
          {activeTab === "question" && (
            <div className="flex flex-col flex-1 overflow-hidden">
              {questionView === "list" ? (
                /* List: interviewer sees problems, interviewee sees waiting */
                isInterviewer ? (
                  <div className="p-3 flex flex-col flex-1 overflow-hidden">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 shrink-0">Problem Bank</p>
                    <div className="flex flex-col gap-1 overflow-y-auto flex-1 pr-1">
                      {builtinQuestions.map((q, i) => (
                        <button key={i} onClick={() => selectQuestion(q)}
                          className={`flex items-center justify-between text-left px-3 py-2 rounded-lg border transition-all ${
                            question?.title === q.title
                              ? "bg-violet-600/15 border-violet-500/40 text-violet-300"
                              : "bg-[#1e1e2a]/50 border-transparent hover:border-[#2a2a38] text-gray-400 hover:text-gray-200"
                          }`}>
                          <span className="text-xs truncate">{q.title}</span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ml-2 ${DIFFICULTY_COLOR[q.difficulty] || ""}`}>
                            {q.difficulty}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center animate-pulse-glow">
                      <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white mb-1">Waiting for question</p>
                      <p className="text-xs text-gray-600 leading-relaxed">The interviewer will load a problem for you shortly. Get your editor ready!</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                      <span className="text-xs text-gray-600">Interviewer is preparing...</span>
                    </div>
                  </div>
                )
              ) : (
                /* Detail view — both roles */
                <div className="flex flex-col flex-1 overflow-hidden">
                  {isInterviewer && (
                    <div className="flex items-center gap-2 px-4 py-2 border-b border-[#2a2a38] shrink-0">
                      <button onClick={() => setQuestionView("list")} className="text-gray-600 hover:text-gray-300 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <span className="text-xs text-gray-500">Back to problems</span>
                    </div>
                  )}
                  <div className="flex-1 overflow-y-auto p-4">
                    {question && (
                      <div className="animate-fade-in space-y-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${DIFFICULTY_COLOR[question.difficulty] || ""}`}>
                            {question.difficulty}
                          </span>
                          {question.testCases?.length > 0 && (
                            <span className="text-xs text-gray-600">{question.testCases.length} test cases</span>
                          )}
                        </div>
                        <h3 className="text-white font-semibold text-base">{question.title}</h3>
                        <p className="text-gray-400 text-xs leading-relaxed whitespace-pre-line">{question.description}</p>
                        {question.testCases?.[0] && (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Example</p>
                            <CaseBlock label="Input"  value={question.testCases[0].input}    color="text-gray-300" />
                            <CaseBlock label="Output" value={question.testCases[0].expected} color="text-emerald-400" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Add Question Tab — Interviewer only ── */}
          {activeTab === "add" && isInterviewer && (
            <div className="flex flex-col flex-1 overflow-y-auto">
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Custom Question</p>
                  <button onClick={resetForm} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">Reset</button>
                </div>

                <div>
                  <label className="text-xs text-gray-600 block mb-1">Title</label>
                  <input value={form.title} onChange={e => updateFormField("title", e.target.value)}
                    placeholder="e.g. Sum of Array"
                    className="w-full bg-[#0f0f13] border border-[#2a2a38] rounded-lg px-3 py-2 text-white text-xs placeholder-gray-700 focus:outline-none focus:border-violet-500 transition-all" />
                </div>

                <div>
                  <label className="text-xs text-gray-600 block mb-1">Difficulty</label>
                  <select value={form.difficulty} onChange={e => updateFormField("difficulty", e.target.value)}
                    className="w-full bg-[#0f0f13] border border-[#2a2a38] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-violet-500 cursor-pointer transition-all">
                    <option>Easy</option><option>Medium</option><option>Hard</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-600 block mb-1">Description</label>
                  <textarea rows={4} value={form.description} onChange={e => updateFormField("description", e.target.value)}
                    placeholder="Describe the problem..."
                    className="w-full bg-[#0f0f13] border border-[#2a2a38] rounded-lg px-3 py-2 text-white text-xs placeholder-gray-700 focus:outline-none focus:border-violet-500 transition-all resize-none" />
                </div>

                <div>
                  <label className="text-xs text-gray-600 block mb-1">Starter Code + Driver (Python)</label>
                  <div className="bg-violet-500/5 border border-violet-500/15 rounded-lg px-3 py-2 mb-2">
                    <p className="text-[10px] text-violet-400 font-semibold mb-0.5">Driver pattern</p>
                    <p className="text-[10px] text-gray-600 leading-relaxed">Define a function stub + a driver that reads stdin, calls it, prints result. Candidate fills function body only.</p>
                  </div>
                  <textarea rows={7} value={form.starterCode} onChange={e => updateFormField("starterCode", e.target.value)}
                    className="w-full bg-[#0f0f13] border border-[#2a2a38] rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-violet-500 transition-all resize-none" />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-gray-600">Test Cases</label>
                    <button onClick={addTestCase} className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      Add case
                    </button>
                  </div>
                  <div className="space-y-3">
                    {form.testCases.map((tc, i) => (
                      <div key={i} className="bg-[#1e1e2a] border border-[#2a2a38] rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-600 font-semibold">Case {i + 1}</span>
                          {form.testCases.length > 1 && (
                            <button onClick={() => removeTestCase(i)} className="text-gray-700 hover:text-red-400 transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          )}
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-600 block mb-1">Input (stdin)</label>
                          <textarea rows={2} value={tc.input} onChange={e => updateTestCase(i, "input", e.target.value)}
                            placeholder="stdin fed to driver"
                            className="w-full bg-[#0f0f13] border border-[#2a2a38] rounded-lg px-2 py-1.5 text-xs font-mono text-gray-300 placeholder-gray-700 focus:outline-none focus:border-violet-500 transition-all resize-none" />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-600 block mb-1">Expected Output</label>
                          <textarea rows={2} value={tc.expected} onChange={e => updateTestCase(i, "expected", e.target.value)}
                            placeholder="what driver should print"
                            className="w-full bg-[#0f0f13] border border-[#2a2a38] rounded-lg px-2 py-1.5 text-xs font-mono text-gray-300 placeholder-gray-700 focus:outline-none focus:border-emerald-500/50 transition-all resize-none" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button onClick={broadcastCustomQuestion}
                  disabled={!form.title.trim() || !form.description.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-900 disabled:cursor-not-allowed text-white text-xs font-semibold py-2.5 rounded-xl transition-all shadow-lg shadow-violet-900/30 hover:-translate-y-0.5 active:translate-y-0 mt-1">
                  {formSent ? (
                    <><svg className="w-3.5 h-3.5 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Sent to Room</>
                  ) : (
                    <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg> Broadcast to Room</>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── Webcam Tab — always mounted ── */}
          <div className={`flex flex-col flex-1 overflow-y-auto ${activeTab === "webcam" ? "" : "hidden"}`}>
            <div className="px-4 pt-4 pb-1 shrink-0">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Video Call</p>
            </div>
            <Webcam username={currentUser.name} roomCode={roomCode} socket={socket} role={role} />
          </div>

          {/* ── Chat Tab ── */}
          {activeTab === "chat" && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center gap-3 text-gray-700">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <p className="text-xs">No messages yet</p>
                  </div>
                ) : messages.map((msg, i) => (
                  <div key={i} className={`flex flex-col gap-0.5 animate-fade-in ${msg.sender === currentUser.name ? "items-end" : "items-start"}`}>
                    <span className="text-xs text-gray-600">{msg.sender}</span>
                    <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                      msg.sender === currentUser.name
                        ? "bg-violet-600/25 text-violet-100 rounded-tr-none"
                        : "bg-[#1e1e2a] text-gray-300 rounded-tl-none border border-[#2a2a38]"
                    }`}>{msg.message}</div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div className="p-4 border-t border-[#2a2a38] flex gap-2 shrink-0">
                <input type="text" value={message} placeholder="Type a message..."
                  onChange={e => setMessage(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendMessage()}
                  className="flex-1 bg-[#1e1e2a] border border-[#2a2a38] rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-all" />
                <button onClick={sendMessage} className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2.5 rounded-xl transition-all hover:-translate-y-0.5 active:translate-y-0">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </aside>

        {/* ── Editor + Output ── */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <CodeEditor code={code} language={LANGUAGE} onChange={(value) => {
              setCode(value);
              socket.emit("code-change", { roomCode, code: value });
            }} />
          </div>

          {/* ── Output Panel ── */}
          <div className="shrink-0 border-t border-[#2a2a38] bg-[#0a0a0e] flex flex-col" style={{ height: "280px" }}>
            <div className="flex items-center border-b border-[#2a2a38] shrink-0 px-4">
              <button onClick={() => setOutputTab("tests")}
                className={`py-2.5 px-1 mr-4 text-xs font-semibold border-b-2 transition-all ${outputTab === "tests" ? "border-violet-500 text-violet-400" : "border-transparent text-gray-600 hover:text-gray-400"}`}>
                Test Cases
              </button>
              <button onClick={() => setOutputTab("console")}
                className={`py-2.5 px-1 text-xs font-semibold border-b-2 transition-all ${outputTab === "console" ? "border-violet-500 text-violet-400" : "border-transparent text-gray-600 hover:text-gray-400"}`}>
                Console
              </button>
              {total > 0 && !runningTests && (
                <div className={`ml-auto flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border animate-fade-in ${
                  allPass ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-red-500/15 text-red-400 border-red-500/30"
                }`}>
                  {allPass ? "✅" : "❌"} {passed} / {total} passed
                </div>
              )}
              {runningTests && (
                <div className="ml-auto flex items-center gap-1.5 text-xs text-violet-400"><Spinner /> Running...</div>
              )}
            </div>

            {/* Tests tab */}
            {outputTab === "tests" && (
              <div className="flex flex-1 overflow-hidden">
                <div className="w-28 shrink-0 border-r border-[#2a2a38] overflow-y-auto py-2">
                  {(question?.testCases || []).map((_, i) => {
                    const r = testResults[i];
                    return (
                      <button key={i} onClick={() => setActiveCase(i)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-all ${activeCase === i ? "bg-violet-500/10 text-violet-300" : "text-gray-600 hover:text-gray-300 hover:bg-[#1e1e2a]/50"}`}>
                        {r ? <span className={`w-2 h-2 rounded-full shrink-0 ${r.passed ? "bg-emerald-400" : "bg-red-400"}`} />
                           : <span className="w-2 h-2 rounded-full bg-gray-700 shrink-0" />}
                        Case {i + 1}
                      </button>
                    );
                  })}
                  {!question && <p className="text-xs text-gray-700 px-3 py-2">No question</p>}
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {question?.testCases?.[activeCase] ? (() => {
                    const tc = question.testCases[activeCase];
                    const r  = testResults[activeCase];
                    return (
                      <>
                        {r && (
                          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold animate-fade-in ${r.passed ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border border-red-500/20 text-red-400"}`}>
                            {r.passed ? "✅ Accepted" : "❌ Wrong Answer"}
                          </div>
                        )}
                        <CaseBlock label="Input"           value={tc.input}   color="text-gray-300" />
                        <CaseBlock label="Expected Output" value={tc.expected} color="text-emerald-400" />
                        {r && <CaseBlock label="Your Output" value={r.actual || "(empty)"} color={r.passed ? "text-emerald-400" : "text-red-400"} />}
                        {!r && !runningTests && <p className="text-xs text-gray-700 font-mono">Click Submit to run test cases.</p>}
                      </>
                    );
                  })() : (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-xs text-gray-700">Select a problem to see test cases</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Console tab */}
            {outputTab === "console" && (
              <div className="flex flex-col flex-1 overflow-hidden">
                <div className="flex gap-3 px-4 pt-3 pb-2 border-b border-[#2a2a38] shrink-0">
                  <div className="flex-1">
                    <label className="text-xs text-gray-600 font-mono block mb-1">
                      stdin {question?.testCases?.[0] && !testInput && <span className="text-violet-500 ml-1">(auto: case 1)</span>}
                    </label>
                    <textarea rows={2} value={testInput} onChange={e => setTestInput(e.target.value)}
                      placeholder={question?.testCases?.[0]?.input || "custom input..."}
                      className="w-full bg-[#0f0f13] border border-[#2a2a38] rounded-lg px-3 py-1.5 text-xs font-mono text-gray-300 placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-all resize-none" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-600 font-mono block mb-1">
                      expected {question?.testCases?.[0] && !expectedOut && <span className="text-violet-500 ml-1">(auto: case 1)</span>}
                    </label>
                    <textarea rows={2} value={expectedOut} onChange={e => setExpectedOut(e.target.value)}
                      placeholder={question?.testCases?.[0]?.expected || "expected output..."}
                      className="w-full bg-[#0f0f13] border border-[#2a2a38] rounded-lg px-3 py-1.5 text-xs font-mono text-gray-300 placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 transition-all resize-none" />
                  </div>
                </div>
                <div className="flex items-center gap-2 px-4 py-1.5 border-b border-[#2a2a38]/50 shrink-0">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#ff5f57]" />
                    <span className="w-2 h-2 rounded-full bg-[#febc2e]" />
                    <span className="w-2 h-2 rounded-full bg-[#28c840]" />
                  </div>
                  <span className="text-xs text-gray-600 font-mono ml-1">stdout</span>
                  {running && <div className="ml-auto flex items-center gap-1.5 text-xs text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Executing...</div>}
                  {manualResult && !running && (
                    <div className={`ml-auto flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border animate-fade-in ${
                      manualResult === "pass" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-red-500/15 text-red-400 border-red-500/30"
                    }`}>
                      {manualResult === "pass" ? "✅ Passed" : "❌ Failed"}
                    </div>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-3">
                  {consoleOut
                    ? <pre className="text-sm font-mono text-emerald-300 whitespace-pre-wrap leading-relaxed">{consoleOut}</pre>
                    : <p className="text-xs text-gray-700 font-mono">{running ? "" : "// Press Run to execute"}</p>}
                  {running && <span className="inline-block w-2 h-4 bg-emerald-400 animate-blink ml-1 align-middle" />}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function CaseBlock({ label, value, color }) {
  return (
    <div className="bg-[#1e1e2a] rounded-lg p-3 border border-[#2a2a38]">
      <p className="text-xs text-gray-600 mb-1">{label}</p>
      <pre className={`text-xs font-mono whitespace-pre-wrap ${color}`}>{value}</pre>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default InterviewRoom;
