import React, { useState, useEffect, useRef } from "react";
import { 
  Plus, Edit, Trash2, Play, Users, BarChart2, Share2, Copy, CheckCircle, 
  ChevronRight, ArrowLeft, RotateCcw, Volume2, ShieldAlert, Check, 
  HelpCircle, Settings, Award, Clock, Save, X, ExternalLink, Download, LogOut
} from "lucide-react";
import { Quiz, Question, Option, QuizSession, Participant, LeaderboardEntry } from "../types";

interface AdminDashboardProps {
  adminToken: string;
  onLogout: () => void;
  onPreviewParticipantScreen?: (sessionId?: string) => void;
}

export default function AdminDashboard({ adminToken, onLogout, onPreviewParticipantScreen }: AdminDashboardProps) {
  // Views: 'LIST', 'EDIT', 'LOBBY', 'LIVE', 'LEADERBOARD', 'HISTORY'
  const [view, setView] = useState<"LIST" | "EDIT" | "LOBBY" | "LIVE" | "LEADERBOARD" | "HISTORY">(() => {
    const saved = localStorage.getItem("qsync_admin_view");
    if (saved === "EDIT") return "LIST";
    return (saved as any) || "LIST";
  });
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Quiz Edit State
  const [editingQuiz, setEditingQuiz] = useState<Partial<Quiz> | null>(null);
  
  // Session State
  const [activeSession, setActiveSession] = useState<QuizSession | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [responseStatsState, setResponseStats] = useState<{
    answeredCount: number;
    totalCount: number;
    activeCount: number;
    answeredParticipants: string[];
  }>({ answeredCount: 0, totalCount: 0, activeCount: 0, answeredParticipants: [] });
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  
  // History State
  const [history, setHistory] = useState<any[]>([]);
  const [selectedHistoryEntry, setSelectedHistoryEntry] = useState<any | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedParticipantId, setExpandedParticipantId] = useState<string | null>(null);
  
  const [copied, setCopied] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [quizToDeleteId, setQuizToDeleteId] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Fetch quizzes
  const fetchQuizzes = async () => {
    try {
      const res = await fetch("/api/quizzes");
      if (res.ok) {
        const data = await res.json();
        setQuizzes(data);
      }
    } catch (e) {
      console.error("Failed to load quizzes", e);
    } finally {
      setLoading(false);
    }
  };

  // Fetch history
  const fetchHistory = async () => {
    try {
      setHistoryLoading(true);
      const res = await fetch("/api/admin/history", {
        headers: {
          "Authorization": `Bearer ${adminToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (e) {
      console.error("Failed to load history", e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleDeleteHistoryEntry = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this session history?")) return;
    try {
      const res = await fetch(`/api/admin/history/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${adminToken}`
        }
      });
      if (res.ok) {
        setHistory(prev => prev.filter(h => h.id !== id));
        if (selectedHistoryEntry?.id === id) {
          setSelectedHistoryEntry(null);
        }
      }
    } catch (e) {
      console.error("Failed to delete history entry", e);
    }
  };

  const handleClearAllHistory = async () => {
    if (!confirm("Are you sure you want to clear ALL past session history? This action cannot be undone.")) return;
    try {
      const res = await fetch("/api/admin/history", {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${adminToken}`
        }
      });
      if (res.ok) {
        setHistory([]);
        setSelectedHistoryEntry(null);
      }
    } catch (e) {
      console.error("Failed to clear history", e);
    }
  };

  const handleDownloadDatabase = async () => {
    try {
      const res = await fetch("/api/admin/database", {
        headers: {
          "Authorization": `Bearer ${adminToken}`
        }
      });
      if (!res.ok) {
        throw new Error("Failed to download database file.");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "data.json";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      console.error("Failed to download database", e);
      alert("Failed to export database backup. Please try again.");
    }
  };

  useEffect(() => {
    fetchQuizzes();
    
    // Restore active session if any
    const savedSessionId = localStorage.getItem("qsync_active_session_id");
    if (savedSessionId) {
      const restoreSession = async () => {
        try {
          const res = await fetch(`/api/sessions/${savedSessionId}`);
          if (res.ok) {
            const session = await res.json();
            setActiveSession(session);
            connectToSession(session.id);
            const savedView = localStorage.getItem("qsync_admin_view");
            if (savedView && ["LOBBY", "LIVE", "LEADERBOARD"].includes(savedView)) {
              setView(savedView as any);
            } else {
              if (session.status === "LOBBY") {
                setView("LOBBY");
              } else if (session.status === "ACTIVE") {
                setView("LIVE");
              } else if (session.status === "COMPLETED") {
                setView("LIVE");
              } else if (session.status === "LEADERBOARD_REVEALED") {
                setView("LEADERBOARD");
              }
            }
          } else {
            localStorage.removeItem("qsync_active_session_id");
            localStorage.setItem("qsync_admin_view", "LIST");
            setView("LIST");
          }
        } catch (e) {
          console.error("Failed to restore session", e);
        }
      };
      restoreSession();
    } else {
      const savedView = localStorage.getItem("qsync_admin_view");
      if (savedView === "HISTORY") {
        fetchHistory();
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("qsync_admin_view", view);
  }, [view]);

  useEffect(() => {
    if (activeSession) {
      localStorage.setItem("qsync_active_session_id", activeSession.id);
    } else {
      localStorage.removeItem("qsync_active_session_id");
    }
  }, [activeSession]);

  // Sync with live session using WebSockets
  const connectToSession = (sessionId: string) => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws?role=organiser&sessionId=${sessionId}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "PARTICIPANT_STATE" && message.data.state === "ORGANISER_CONNECTED") {
          setActiveSession(message.data.session);
          setParticipants(message.data.participants);
          if (message.data.responseState) {
            setResponseStats(message.data.responseState);
          }
          if (message.data.leaderboard) {
            setLeaderboard(message.data.leaderboard);
          }
        } else if (message.type === "LOBBY_UPDATE") {
          setParticipants(message.data.participants);
          setActiveSession(message.data.session);
        } else if (message.type === "RESPONSE_UPDATE") {
          if (message.data) {
            setResponseStats(message.data);
          }
        } else if (message.type === "QUESTION_CHANGED") {
          setActiveSession(message.data.session);
          if (message.data.responseState) {
            setResponseStats(message.data.responseState);
          }
        } else if (message.type === "LEADERBOARD_REVEALED") {
          setLeaderboard(message.data.leaderboard);
        } else if (message.type === "QUIZ_COMPLETED") {
          setActiveSession(message.data.session);
        }
      } catch (e) {
        console.error("Failed to parse WebSocket message", e);
      }
    };

    wsRef.current = ws;
  };

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Share Quiz Url
  const getShareUrl = (sessionId: string) => {
    return `${window.location.origin}/?join=${sessionId}`;
  };

  const handleCopyLink = (sessionId: string) => {
    navigator.clipboard.writeText(getShareUrl(sessionId));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Launch Lobby
  const handleOpenLobby = async (quizId: string) => {
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId })
      });
      if (res.ok) {
        const session = await res.json();
        setActiveSession(session);
        connectToSession(session.id);
        
        if (session.status === "LOBBY") {
          setView("LOBBY");
        } else if (session.status === "ACTIVE") {
          setView("LIVE");
        } else if (session.status === "COMPLETED" || session.status === "LEADERBOARD_REVEALED") {
          // If already completed or revealed, let's fetch leaderboard
          const quiz = quizzes.find(q => q.id === quizId);
          if (quiz) {
            setView(session.status === "COMPLETED" ? "LIVE" : "LEADERBOARD");
          }
        }
      }
    } catch (e) {
      console.error("Failed to open lobby", e);
    }
  };

  const deactivateSession = async () => {
    if (!activeSession) return;
    try {
      await fetch(`/api/sessions/${activeSession.id}/action`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${adminToken}`
        },
        body: JSON.stringify({ action: "DEACTIVATE" })
      });
    } catch (e) {
      console.error("Failed to deactivate session", e);
    } finally {
      setActiveSession(null);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    }
  };

  // Quiz Controller Actions
  const handleSessionAction = async (action: "START" | "NEXT_QUESTION" | "FINISH" | "REVEAL" | "RESET") => {
    if (!activeSession) return;
    try {
      const res = await fetch(`/api/sessions/${activeSession.id}/action`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${adminToken}`
        },
        body: JSON.stringify({ action })
      });

      if (res.ok) {
        const updatedSession = await res.json();
        setActiveSession(updatedSession);

        if (action === "START") {
          setView("LIVE");
        } else if (action === "RESET") {
          connectToSession(updatedSession.id);
          setView("LOBBY");
          setParticipants([]);
          setResponseStats({ answeredCount: 0, totalCount: 0, activeCount: 0, answeredParticipants: [] });
        } else if (action === "FINISH") {
          // Stay on live view but can click Reveal
        } else if (action === "REVEAL") {
          setView("LEADERBOARD");
        } else if (action === "NEXT_QUESTION") {
          // Next question logic
        }
      }
    } catch (e) {
      console.error("Action failed", e);
    }
  };

  // CRUD Operations
  const handleCreateNewQuiz = () => {
    setEditingQuiz({
      title: "",
      description: "",
      questions: [
        {
          id: `new-q-0`,
          quizId: "",
          text: "",
          type: "SINGLE_CORRECT",
          orderIndex: 0,
          options: [
            { id: "new-o-0-0", questionId: "new-q-0", text: "", isCorrect: true, orderIndex: 0 },
            { id: "new-o-0-1", questionId: "new-q-0", text: "", isCorrect: false, orderIndex: 1 }
          ]
        }
      ]
    });
    setView("EDIT");
  };

  const handleEditQuiz = (quiz: Quiz) => {
    setEditingQuiz({ ...quiz });
    setView("EDIT");
  };

  const handleDeleteQuiz = async (quizId: string) => {
    try {
      const res = await fetch(`/api/quizzes/${quizId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${adminToken}` }
      });
      if (res.ok) {
        fetchQuizzes();
        setQuizToDeleteId(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Edit Question Handlers
  const handleAddQuestion = () => {
    if (!editingQuiz) return;
    const questions = [...(editingQuiz.questions || [])];
    const newQi = questions.length;
    questions.push({
      id: `new-q-${newQi}-${Math.random().toString(36).substring(2, 6)}`,
      quizId: editingQuiz.id || "",
      text: "",
      type: "SINGLE_CORRECT",
      orderIndex: newQi,
      options: [
        { id: `new-o-${newQi}-0-${Math.random().toString(36).substring(2, 6)}`, questionId: `new-q-${newQi}`, text: "", isCorrect: true, orderIndex: 0 },
        { id: `new-o-${newQi}-1-${Math.random().toString(36).substring(2, 6)}`, questionId: `new-q-${newQi}`, text: "", isCorrect: false, orderIndex: 1 }
      ]
    });
    setEditingQuiz({ ...editingQuiz, questions });
  };

  const handleRemoveQuestion = (qi: number) => {
    if (!editingQuiz || !editingQuiz.questions) return;
    const questions = editingQuiz.questions.filter((_, i) => i !== qi);
    questions.forEach((q, idx) => { q.orderIndex = idx; });
    setEditingQuiz({ ...editingQuiz, questions });
  };

  const handleAddOption = (qi: number) => {
    if (!editingQuiz || !editingQuiz.questions) return;
    const questions = [...editingQuiz.questions];
    const q = questions[qi];
    const oi = q.options.length;
    q.options.push({
      id: `new-o-${qi}-${oi}-${Math.random().toString(36).substring(2, 6)}`,
      questionId: q.id,
      text: "",
      isCorrect: false,
      orderIndex: oi
    });
    setEditingQuiz({ ...editingQuiz, questions });
  };

  const handleRemoveOption = (qi: number, oi: number) => {
    if (!editingQuiz || !editingQuiz.questions) return;
    const questions = [...editingQuiz.questions];
    const q = questions[qi];
    if (q.options.length <= 2) {
      alert("A question must have at least 2 options.");
      return;
    }
    q.options = q.options.filter((_, i) => i !== oi);
    q.options.forEach((o, idx) => { o.orderIndex = idx; });
    setEditingQuiz({ ...editingQuiz, questions });
  };

  const handleSaveQuiz = async () => {
    if (!editingQuiz) return;
    if (!editingQuiz.title?.trim()) {
      alert("Quiz title is required");
      return;
    }

    // Validation
    const questions = editingQuiz.questions || [];
    if (questions.length === 0) {
      alert("Quiz must have at least one question");
      return;
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) {
        alert(`Question ${i + 1} text is required`);
        return;
      }
      if (q.options.some(o => !o.text.trim())) {
        alert(`All options for Question ${i + 1} must be filled in`);
        return;
      }
      if (!q.options.some(o => o.isCorrect)) {
        alert(`Question ${i + 1} must have at least one correct option`);
        return;
      }
      if (q.type === "SINGLE_CORRECT" && q.options.filter(o => o.isCorrect).length > 1) {
        alert(`Question ${i + 1} is marked as Single-Choice but has multiple correct answers. Please change to Multiple-Choice or choose one correct answer.`);
        return;
      }
    }

    try {
      const url = editingQuiz.id ? `/api/quizzes/${editingQuiz.id}` : "/api/quizzes";
      const method = editingQuiz.id ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${adminToken}`
        },
        body: JSON.stringify(editingQuiz)
      });

      if (res.ok) {
        setEditingQuiz(null);
        setView("LIST");
        fetchQuizzes();
      } else {
        const errData = await res.json();
        alert(errData.error || "Failed to save quiz");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const activeQuiz = activeSession ? quizzes.find(q => q.id === activeSession.quizId) : null;
  const currentQuestion = (activeQuiz && activeSession) ? (
    (activeSession.questionOrder && activeSession.questionOrder.length > 0)
      ? activeQuiz.questions.find(q => q.id === activeSession.questionOrder[activeSession.currentQuestionIndex])
      : activeQuiz.questions[activeSession.currentQuestionIndex]
  ) : null;

  const responseStats = responseStatsState || { answeredCount: 0, totalCount: 0, activeCount: 0, answeredParticipants: [] };

  const connectedParticipants = participants.filter(p => p.connectionStatus === "CONNECTED");

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden font-sans text-slate-900">
      {/* Top Header */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-2.5 sm:px-6 shrink-0 shadow-sm">
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-100 shrink-0">
            <span className="text-white font-bold text-base">Q</span>
          </div>
          <div className={`min-w-0 ${activeSession ? "hidden sm:block" : ""}`}>
            <h1 className="font-bold text-slate-800 tracking-tight flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm md:text-base">
              <span className="truncate hidden sm:inline">LCE Quiz Organiser</span>
              <span className="truncate inline sm:hidden text-indigo-600 font-extrabold">LCE Quiz</span>
              <span className="text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-mono border border-indigo-100 shrink-0">Admin</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {activeSession && ["LOBBY", "LIVE", "LEADERBOARD"].includes(view) && (
            <div 
              onClick={() => setShowShareModal(true)}
              className="flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-1.5 sm:px-3 py-1 rounded-full border border-emerald-100 cursor-pointer transition shrink-0"
            >
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-[9px] sm:text-xs font-semibold uppercase tracking-wider font-mono">
                <span className="hidden xs:inline">ID: </span>
                {activeSession.id.toUpperCase()}
              </span>
              <Share2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 ml-0.5 text-emerald-600" />
            </div>
          )}
          {onPreviewParticipantScreen && (
            <button
              onClick={() => onPreviewParticipantScreen(activeSession?.id)}
              className="px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs font-bold text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:border-indigo-300 rounded-lg bg-indigo-50/50 hover:bg-indigo-50 transition shrink-0 font-sans flex items-center gap-1 cursor-pointer"
            >
              <ExternalLink className="w-3 h-3 text-indigo-500" />
              <span className="hidden xs:inline sm:hidden">Preview</span>
              <span className="hidden sm:inline">Preview Screen</span>
            </button>
          )}
          <button 
            onClick={async () => {
              await deactivateSession();
              onLogout();
            }}
            className="px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs font-bold text-slate-600 hover:text-slate-800 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 transition shrink-0 font-sans flex items-center gap-1 cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto">
        {view === "LIST" && (
          <div className="max-w-5xl mx-auto p-4 sm:p-6 md:p-8">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6 md:mb-8">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold font-display text-slate-800 tracking-tight">Your Live Quizzes</h2>
                <p className="text-slate-500 text-xs sm:text-sm mt-1">Create, configure and manage LCE quiz sessions.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3.5 w-full xl:w-auto">
                <button
                  onClick={() => {
                    fetchHistory();
                    setView("HISTORY");
                  }}
                  className="px-4 py-2.5 sm:py-3 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl font-bold transition flex items-center justify-center gap-2 active:scale-95 text-xs sm:text-sm w-full sm:w-auto shrink-0 cursor-pointer"
                >
                  <BarChart2 className="w-4 h-4 text-indigo-600" />
                  <span>Quiz Stats & History</span>
                </button>
                <button
                  onClick={handleDownloadDatabase}
                  className="px-4 py-2.5 sm:py-3 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl font-bold transition flex items-center justify-center gap-2 active:scale-95 text-xs sm:text-sm w-full sm:w-auto shrink-0 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-slate-500" />
                  <span>Download JSON Backup</span>
                </button>
                <button
                  onClick={handleCreateNewQuiz}
                  className="px-5 py-2.5 sm:py-3 bg-indigo-600 rounded-xl font-bold text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition flex items-center justify-center gap-2 active:scale-95 text-xs sm:text-sm w-full sm:w-auto shrink-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create New Quiz</span>
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center p-12">
                <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : quizzes.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm max-w-lg mx-auto mt-8">
                <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <HelpCircle className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 font-display">No Quizzes Created Yet</h3>
                <p className="text-sm text-slate-500 mt-2 mb-6">Create your first quiz to align your event participants and strategy.</p>
                <button
                  onClick={handleCreateNewQuiz}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 transition inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Build First Quiz</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {quizzes.map(quiz => (
                  <div key={quiz.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between group">
                    <div>
                      <div className="flex justify-between items-center gap-3 min-w-0">
                        <h3 className="text-base sm:text-lg font-bold text-slate-800 font-display group-hover:text-indigo-600 transition truncate flex-1 min-w-0">{quiz.title}</h3>
                        <span className="text-[10px] sm:text-xs bg-slate-100 text-slate-600 px-2 py-1 sm:px-2.5 sm:py-1 rounded-full font-bold font-mono shrink-0 whitespace-nowrap">
                          {quiz.questions.length} <span className="hidden sm:inline">{quiz.questions.length === 1 ? 'Question' : 'Questions'}</span><span className="inline sm:hidden">{quiz.questions.length === 1 ? 'Q' : 'Qs'}</span>
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 mt-2 line-clamp-2 h-10">{quiz.description || "No description provided."}</p>
                    </div>

                    <div className="border-t border-slate-100 mt-6 pt-4 flex items-center justify-between gap-2">
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEditQuiz(quiz)}
                          className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                          title="Edit Quiz"
                        >
                          <Edit className="w-4.5 h-4.5" />
                        </button>
                        <button
                          onClick={() => setQuizToDeleteId(quiz.id)}
                          className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Delete Quiz"
                        >
                          <Trash2 className="w-4.5 h-4.5" />
                        </button>
                      </div>

                      <button
                        onClick={() => handleOpenLobby(quiz.id)}
                        className="px-4 py-2 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 rounded-xl font-bold text-xs transition flex items-center gap-1.5"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Host Live Session</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === "EDIT" && editingQuiz && (
          <div className="max-w-4xl mx-auto p-3 sm:p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <button 
                onClick={() => { setEditingQuiz(null); setView("LIST"); }}
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="text-2xl font-bold font-display tracking-tight">
                {editingQuiz.id ? "Edit Quiz Structure" : "Create New Quiz"}
              </h2>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 md:p-8 shadow-sm space-y-6">
              {/* Info Section */}
              <div className="grid xl:grid-cols-3 gap-6">
                <div className="xl:col-span-1">
                  <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-1">General Details</h3>
                  <p className="text-xs text-slate-400">The basic details of the event quiz, visible to the host and in lobbies.</p>
                </div>
                <div className="xl:col-span-2 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Quiz Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Q4 Regional Strategy Quiz"
                      value={editingQuiz.title || ""}
                      onChange={(e) => setEditingQuiz({ ...editingQuiz, title: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 text-slate-800 transition text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description</label>
                    <textarea
                      placeholder="Short summary of target participants or agenda."
                      rows={2}
                      value={editingQuiz.description || ""}
                      onChange={(e) => setEditingQuiz({ ...editingQuiz, description: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 text-slate-800 transition text-sm"
                    />
                  </div>
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* Questions Section */}
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider">Quiz Questions ({editingQuiz.questions?.length || 0})</h3>
                </div>

                <div className="space-y-6">
                  {editingQuiz.questions?.map((q, qi) => (
                    <div key={q.id} className="p-5 bg-slate-50 border border-slate-200 rounded-2xl relative space-y-4">
                      <button
                        onClick={() => handleRemoveQuestion(qi)}
                        className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Remove Question"
                      >
                        <X className="w-4 h-4" />
                      </button>

                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold font-mono">
                          {qi + 1}
                        </span>
                        <div className="flex items-center gap-2">
                          <select
                            value={q.type}
                            onChange={(e) => {
                              const questions = [...(editingQuiz.questions || [])];
                              questions[qi].type = e.target.value as any;
                              // If changing to single correct, keep only one correct
                              if (e.target.value === "SINGLE_CORRECT") {
                                let correctedCount = 0;
                                questions[qi].options.forEach(o => {
                                  if (o.isCorrect) {
                                    correctedCount++;
                                    if (correctedCount > 1) o.isCorrect = false;
                                  }
                                });
                                if (correctedCount === 0) questions[qi].options[0].isCorrect = true;
                              }
                              setEditingQuiz({ ...editingQuiz, questions });
                            }}
                            className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 focus:outline-none"
                          >
                            <option value="SINGLE_CORRECT">Single-Choice</option>
                            <option value="MULTIPLE_CORRECT">Multiple-Choice (Multi-Select)</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Question Text</label>
                        <input
                          type="text"
                          placeholder="e.g. Which of the following is our target growth projection?"
                          value={q.text}
                          onChange={(e) => {
                            const questions = [...(editingQuiz.questions || [])];
                            questions[qi].text = e.target.value;
                            setEditingQuiz({ ...editingQuiz, questions });
                          }}
                          className="w-full bg-white px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 text-slate-800 transition text-sm"
                        />
                      </div>

                      {/* Options */}
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Answer Options</label>
                          <button
                            onClick={() => handleAddOption(qi)}
                            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Option</span>
                          </button>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-3">
                          {q.options.map((o, oi) => (
                            <div key={o.id} className="flex items-center gap-2 bg-white border border-slate-100 p-2 rounded-xl shadow-sm">
                              <button
                                type="button"
                                onClick={() => {
                                  const questions = [...(editingQuiz.questions || [])];
                                  const opt = questions[qi].options[oi];
                                  if (q.type === "SINGLE_CORRECT") {
                                    questions[qi].options.forEach(otherO => otherO.isCorrect = false);
                                    opt.isCorrect = true;
                                  } else {
                                    opt.isCorrect = !opt.isCorrect;
                                  }
                                  setEditingQuiz({ ...editingQuiz, questions });
                                }}
                                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border transition ${
                                  o.isCorrect 
                                    ? "bg-indigo-600 border-indigo-600 text-white" 
                                    : "border-slate-200 hover:border-indigo-500 text-transparent"
                                }`}
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>

                              <input
                                type="text"
                                placeholder={`Option ${oi + 1}`}
                                value={o.text}
                                onChange={(e) => {
                                  const questions = [...(editingQuiz.questions || [])];
                                  questions[qi].options[oi].text = e.target.value;
                                  setEditingQuiz({ ...editingQuiz, questions });
                                }}
                                className="flex-1 bg-transparent text-xs text-slate-800 focus:outline-none font-medium"
                              />

                              <button
                                onClick={() => handleRemoveOption(qi, oi)}
                                className="p-1 text-slate-300 hover:text-rose-600 rounded"
                                title="Delete Option"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={handleAddQuestion}
                    className="w-full py-4 border-2 border-dashed border-slate-200 hover:border-indigo-400 text-slate-500 hover:text-indigo-600 rounded-2xl font-bold transition flex items-center justify-center gap-2 bg-slate-50/50 hover:bg-indigo-50/10 active:scale-[0.99]"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Question</span>
                  </button>
                </div>
              </div>

              {/* Form Controls */}
              <div className="pt-6 border-t border-slate-100 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => { setEditingQuiz(null); setView("LIST"); }}
                  className="px-6 py-2.5 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition active:scale-95 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveQuiz}
                  className="px-8 py-2.5 bg-indigo-600 rounded-xl font-bold text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition flex items-center gap-2 active:scale-95 text-sm"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Quiz Structure</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {view === "LOBBY" && activeSession && activeQuiz && (
          <div className="max-w-4xl mx-auto p-3 sm:p-6 md:p-8">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 md:p-8 shadow-sm">
              <div className="flex flex-col xl:flex-row justify-between items-start gap-4 mb-6">
                <div>
                  <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-full text-xs font-bold uppercase tracking-wider font-mono">
                    Lobby Waiting Stage
                  </span>
                  <h2 className="text-3xl font-bold text-slate-800 tracking-tight font-display mt-3">
                    {activeQuiz.title}
                  </h2>
                  <p className="text-slate-500 text-sm mt-1">{activeQuiz.description}</p>
                </div>

                <div className="flex flex-wrap gap-2 w-full xl:w-auto">
                  <button
                    onClick={() => setShowShareModal(true)}
                    className="w-full xl:w-auto px-4 py-2.5 bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 font-bold text-sm transition flex items-center justify-center gap-2"
                  >
                    <Share2 className="w-4.5 h-4.5" />
                    <span>Reveal Access QR / Code</span>
                  </button>
                </div>
              </div>

              {/* QR and Share Banner */}
              <div className="bg-indigo-50/50 rounded-2xl border border-indigo-100/50 p-4 sm:p-6 flex flex-col xl:flex-row gap-6 items-center justify-between mb-8">
                <div className="space-y-2 text-center md:text-left w-full min-w-0">
                  <h3 className="font-bold text-indigo-900">Invite Participants Now</h3>
                  <p className="text-xs text-indigo-700 max-w-md mx-auto md:mx-0">
                    Direct participants to scan the QR code or use the unique join link. They will appear here instantly as soon as they enter their sales info.
                  </p>
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-indigo-100 w-full max-w-xs justify-between mx-auto md:mx-0 min-w-0">
                    <span className="text-xs font-mono font-bold text-indigo-950 truncate select-all flex-1 min-w-0 text-left">{getShareUrl(activeSession.id)}</span>
                    <button 
                      onClick={() => handleCopyLink(activeSession.id)}
                      className="p-1 text-indigo-600 hover:text-indigo-800 rounded transition shrink-0"
                    >
                      {copied ? <span className="text-[10px] text-emerald-600 font-bold">Copied!</span> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="shrink-0 bg-white p-3 rounded-2xl border border-indigo-100/40 shadow-sm flex flex-col items-center">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(getShareUrl(activeSession.id))}`}
                    alt="Quiz QR Code" 
                    className="w-28 h-28 select-none"
                    referrerPolicy="no-referrer"
                  />
                  <span className="text-[9px] font-bold text-slate-400 font-mono mt-1.5">SCAN TO JOIN INSTANTLY</span>
                </div>
              </div>

              {/* Participant Presence Table */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                    Joined Participants 
                    <span className="bg-indigo-600 text-white px-2 py-0.5 rounded-full text-xs font-bold font-mono">
                      {connectedParticipants.length}
                    </span>
                  </h3>
                  <span className="text-xs text-slate-400 italic">Listening dynamically for connections...</span>
                </div>

                {connectedParticipants.length === 0 ? (
                  <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl">
                    <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium text-sm">No participants have joined yet.</p>
                    <p className="text-xs text-slate-400 mt-1">Waiting for registrations on the entrance link.</p>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm border-collapse min-w-[500px]">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">
                            <th className="p-4">Participant Name</th>
                            <th className="p-4">SalesId</th>
                            <th className="p-4">Connected State</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {connectedParticipants.map((p, idx) => (
                            <tr key={p.id} className="hover:bg-slate-50/50 transition">
                              <td className="p-4 font-bold text-slate-800">{p.name}</td>
                              <td className="p-4">
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-md font-mono border border-slate-200">
                                  {p.salesId}
                                </span>
                              </td>
                              <td className="p-4">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                  p.connectionStatus === "CONNECTED" 
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                                    : "bg-slate-50 text-slate-400 border border-slate-100"
                                }`}>
                                  <div className={`w-1.5 h-1.5 rounded-full ${p.connectionStatus === "CONNECTED" ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`}></div>
                                  {p.connectionStatus === "CONNECTED" ? "CONNECTED" : "AWAY"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Start Trigger */}
              <div className="border-t border-slate-100 mt-8 pt-6 flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center">
                <button
                  type="button"
                  onClick={async () => {
                    await deactivateSession();
                    setView("LIST");
                  }}
                  className="w-full sm:w-auto order-2 sm:order-1 px-5 py-3 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition text-sm text-center active:scale-95"
                >
                  Back to Dashboard
                </button>
                <button
                  onClick={() => handleSessionAction("START")}
                  disabled={connectedParticipants.length === 0}
                  className="w-full sm:w-auto order-1 sm:order-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white shadow-lg disabled:shadow-none hover:shadow-indigo-100 rounded-xl font-bold transition flex items-center justify-center gap-2 active:scale-95 disabled:scale-100 disabled:text-slate-400 disabled:cursor-not-allowed text-sm sm:text-base shrink-0"
                >
                  <span>Launch Live Quiz</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {view === "LIVE" && activeSession && activeQuiz && currentQuestion && (
          <div className="max-w-5xl mx-auto p-3 sm:p-6 md:p-8">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-4 mb-6">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 font-mono">LIVE PRESENTATION STAGE</p>
                <h2 className="text-3xl font-bold text-slate-800 tracking-tight font-display">
                  Question {activeSession.currentQuestionIndex + 1} of {activeQuiz.questions.length}
                </h2>
              </div>
              <div className="bg-indigo-50/50 border border-indigo-100 px-4 py-2.5 rounded-2xl text-center md:text-right shrink-0">
                <p className="text-xs font-bold text-indigo-700 uppercase tracking-widest mb-1 font-mono">RESPONSES SECURED</p>
                <p className="text-3xl font-mono font-bold text-indigo-900">
                  {responseStats.answeredCount} <span className="text-indigo-400 font-normal">/ {responseStats.totalCount}</span>
                </p>
              </div>
            </div>

            {/* Question Text Frame */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 md:p-8 border border-slate-200 shadow-sm space-y-4 mb-6">
              <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider font-mono ${
                currentQuestion.type === "SINGLE_CORRECT" ? "bg-slate-100 text-slate-700" : "bg-purple-50 text-purple-700 border border-purple-100"
              }`}>
                {currentQuestion.type === "SINGLE_CORRECT" ? "Single-Choice" : "Multiple-Choice (Multi-Select)"}
              </span>

              <h3 className="text-xl md:text-2xl font-medium leading-relaxed text-slate-800">
                {currentQuestion.text}
              </h3>

              {/* Reveal answer options strictly for host only */}
              <div className="grid sm:grid-cols-2 gap-3.5 pt-4 border-t border-slate-100">
                {currentQuestion.options.map(o => (
                  <div 
                    key={o.id} 
                    className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-sm font-semibold transition ${
                      o.isCorrect 
                        ? "bg-emerald-50 border-emerald-200 text-emerald-900 shadow-sm" 
                        : "bg-slate-50 border-slate-200 text-slate-600"
                    }`}
                  >
                    <span>{o.text}</span>
                    {o.isCorrect && (
                      <span className="px-2 py-0.5 bg-emerald-600 text-white rounded font-bold text-[9px] font-mono tracking-wider">
                        CORRECT
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Live Response Tracker */}
            <div className="grid xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 flex flex-col justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-1">Answer Sync Dashboard</h4>
                  <p className="text-xs text-slate-400 mb-4">View which registered participants have successfully confirmed their choices.</p>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
                    {connectedParticipants.map(p => {
                      const hasAnswered = responseStats.answeredParticipants.includes(p.salesId);
                      return (
                        <div 
                          key={p.id} 
                          className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition ${
                            hasAnswered 
                              ? "bg-emerald-50 border-emerald-100 text-emerald-800" 
                              : "bg-slate-50 border-slate-200/60 text-slate-400"
                          }`}
                        >
                          <div className={`w-2 h-2 rounded-full shrink-0 ${hasAnswered ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`}></div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold truncate">{p.name}</p>
                            <p className="text-[9px] font-mono tracking-wider uppercase">{hasAnswered ? "Answer Saved" : "Thinking..."}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 italic">
                  <span>● Active sync listening...</span>
                  <span>{responseStats.activeCount} connected organizers/players</span>
                </div>
              </div>

              {/* Progress Panel */}
              <div className="xl:col-span-1 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-slate-600 uppercase tracking-wider">Submission Stats</h4>
                  
                  <div className="relative pt-1">
                    <div className="flex mb-2 items-center justify-between text-xs">
                      <span className="font-semibold text-indigo-600">Completion</span>
                      <span className="font-bold text-indigo-600">
                        {responseStats.totalCount > 0 ? Math.round((responseStats.answeredCount / responseStats.totalCount) * 100) : 0}%
                      </span>
                    </div>
                    <div className="overflow-hidden h-2.5 text-xs flex rounded bg-indigo-50 border border-indigo-100/30">
                      <div 
                        style={{ width: `${responseStats.totalCount > 0 ? (responseStats.answeredCount / responseStats.totalCount) * 100 : 0}%` }}
                        className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-600 transition-all duration-500"
                      ></div>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                    <div className="flex justify-between items-center text-xs text-slate-500">
                      <span>Answered:</span>
                      <span className="font-bold font-mono text-slate-800">{responseStats.answeredCount}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-500">
                      <span>Waiting:</span>
                      <span className="font-bold font-mono text-slate-800">{Math.max(0, responseStats.totalCount - responseStats.answeredCount)}</span>
                    </div>
                  </div>
                </div>

                {/* Question Actions */}
                <div className="space-y-2.5">
                  {activeSession.status === "ACTIVE" && (
                    <>
                      {activeSession.currentQuestionIndex < activeQuiz.questions.length - 1 ? (
                        <button
                          onClick={() => handleSessionAction("NEXT_QUESTION")}
                          className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 transition flex items-center justify-center gap-2 active:scale-95"
                        >
                          <span>Next Question</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSessionAction("FINISH")}
                          className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 transition flex items-center justify-center gap-2 active:scale-95"
                        >
                          <span>Complete Session</span>
                        </button>
                      )}
                      <button
                        onClick={() => setShowResetConfirm(true)}
                        className="w-full py-3.5 border border-rose-100 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl font-bold transition active:scale-95 text-xs"
                      >
                        Reset/Stop Quiz
                      </button>
                    </>
                  )}

                  {activeSession.status === "COMPLETED" && (
                    <button
                      onClick={() => handleSessionAction("REVEAL")}
                      className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 transition flex items-center justify-center gap-2 active:scale-95 text-sm uppercase tracking-wide"
                    >
                      <Award className="w-5 h-5 text-indigo-200" />
                      <span>Reveal Final Leaderboard</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {view === "LEADERBOARD" && activeSession && activeQuiz && (
          <div className="max-w-4xl mx-auto p-3 sm:p-6 md:p-8">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 md:p-8 shadow-sm">
              <div className="text-center space-y-3 mb-8">
                <div className="w-14 h-14 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                  <Award className="w-8 h-8" />
                </div>
                <h2 className="text-3xl font-bold text-slate-800 tracking-tight font-display">
                  Official Final Standings
                </h2>
                <p className="text-slate-500 text-sm max-w-lg mx-auto">
                  Synchronized standings based on correct answer counts and accumulated active response thinking times.
                </p>
              </div>

              {leaderboard.length === 0 ? (
                <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl">
                  <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500 font-medium text-sm">Standings table is empty.</p>
                  <p className="text-xs text-slate-400">Restart session to accept and calculate scores.</p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white mb-8">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse min-w-[500px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">
                          <th className="p-4 text-center">Rank</th>
                          <th className="p-4">Participant</th>
                          <th className="p-4">SalesId</th>
                          <th className="p-4 text-center">Correct Answers</th>
                          <th className="p-4 text-right">Total Time Taken</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {leaderboard.map((entry) => (
                          <tr key={entry.participantId} className="hover:bg-slate-50/50 transition">
                            <td className="p-4 text-center">
                              <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                                entry.rank === 1 ? "bg-amber-100 text-amber-800 border border-amber-200" :
                                entry.rank === 2 ? "bg-slate-200 text-slate-700 border border-slate-300" :
                                entry.rank === 3 ? "bg-amber-50 text-amber-900 border border-amber-100" :
                                "bg-slate-100 text-slate-500"
                              }`}>
                                {entry.rank}
                              </span>
                            </td>
                            <td className="p-4 font-bold text-slate-800">{entry.name}</td>
                            <td className="p-4">
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-md font-mono border border-slate-200">
                                {entry.salesId}
                              </span>
                            </td>
                            <td className="p-4 text-center font-mono font-bold text-slate-700">
                              {entry.score} <span className="text-slate-300 font-normal">/ {entry.totalQuestions}</span>
                            </td>
                            <td className="p-4 text-right font-mono text-slate-500 font-medium">
                              {(entry.totalTimeMs / 1000).toFixed(1)}s
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Reset control */}
              <div className="flex flex-col sm:flex-row justify-between gap-4 pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={async () => {
                    await deactivateSession();
                    setView("LIST");
                  }}
                  className="px-6 py-2.5 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition text-sm"
                >
                  Return to Quizzes
                </button>
                <button
                  onClick={() => setShowResetConfirm(true)}
                  className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-100 rounded-xl font-bold transition flex items-center justify-center gap-2 active:scale-95 text-sm cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Restart Session (Reset & Loop)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {view === "HISTORY" && (
          <div className="max-w-7xl mx-auto p-4 sm:p-6 md:p-8">
            {/* Header / Back navigation */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 md:mb-8 border-b border-slate-100 pb-6">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => { setSelectedHistoryEntry(null); setView("LIST"); }}
                  className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold font-display text-slate-800 tracking-tight flex items-center gap-2">
                    <BarChart2 className="w-6 h-6 sm:w-7 sm:h-7 text-indigo-600" />
                    <span>Quiz History & Analytics</span>
                  </h2>
                  <p className="text-slate-500 text-xs sm:text-sm mt-1">Review past quiz sessions, performance rankings, and complete answer logs.</p>
                </div>
              </div>
              
              {history.length > 0 && (
                <button
                  onClick={handleClearAllHistory}
                  className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl font-bold transition flex items-center gap-1.5 active:scale-95 text-xs sm:text-sm cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 text-rose-500" />
                  <span>Clear All History</span>
                </button>
              )}
            </div>

            {historyLoading ? (
              <div className="flex flex-col items-center justify-center p-24">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-slate-500 font-medium text-sm">Loading historical data...</p>
              </div>
            ) : history.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm max-w-lg mx-auto mt-8">
                <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <BarChart2 className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 font-display">No History Records Found</h3>
                <p className="text-slate-500 text-sm mt-2 leading-relaxed">
                  When a session is completed or reset by the host, its standings and participant answers will automatically be archived here.
                </p>
                <button
                  onClick={() => setView("LIST")}
                  className="mt-6 px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition active:scale-95 text-sm cursor-pointer"
                >
                  Return to Quizzes
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Side: Sessions List Sidebar */}
                <div className={`lg:col-span-4 space-y-3.5 ${selectedHistoryEntry ? "hidden lg:block" : "block"}`}>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 font-mono">Past Quiz Sessions ({history.length})</h3>
                  <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-2">
                    {history.map((entry) => {
                      const isSelected = selectedHistoryEntry?.id === entry.id;
                      const dateObj = new Date(entry.playedAt);
                      const formattedDate = dateObj.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
                      
                      return (
                        <div
                          key={entry.id}
                          onClick={() => {
                            setSelectedHistoryEntry(entry);
                            setExpandedParticipantId(null);
                          }}
                          className={`p-4 rounded-xl border transition text-left cursor-pointer ${
                            isSelected
                              ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100"
                              : "bg-white border-slate-200 hover:bg-slate-50 text-slate-800"
                          }`}
                        >
                          <div className="font-bold text-sm sm:text-base line-clamp-1">{entry.quizTitle}</div>
                          <div className="flex items-center justify-between mt-2.5">
                            <span className={`text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-md font-mono ${
                              isSelected ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-600 border border-slate-200"
                            }`}>
                              ID: {entry.id}
                            </span>
                            <span className={`text-[10px] sm:text-xs font-medium flex items-center gap-1 ${
                              isSelected ? "text-indigo-100" : "text-slate-400"
                            }`}>
                              <Users className="w-3.5 h-3.5" />
                              {entry.participantsCount} {entry.participantsCount === 1 ? "player" : "players"}
                            </span>
                          </div>
                          <div className={`text-[10px] sm:text-xs mt-2 font-mono flex items-center justify-between ${
                            isSelected ? "text-indigo-200" : "text-slate-400"
                          }`}>
                            <span>{formattedDate}</span>
                            <button
                              onClick={(e) => handleDeleteHistoryEntry(entry.id, e)}
                              className={`p-1 rounded-md transition ${
                                isSelected ? "hover:bg-indigo-700 text-white" : "hover:bg-slate-100 text-slate-400 hover:text-rose-600"
                              }`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right Side: Selected Session Detail View */}
                <div className={`lg:col-span-8 ${selectedHistoryEntry ? "block" : "hidden lg:block"}`}>
                  {selectedHistoryEntry ? (
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 md:p-8 shadow-sm space-y-6">
                      {/* Back Button for Mobile/Tablet */}
                      <button
                        onClick={() => setSelectedHistoryEntry(null)}
                        className="lg:hidden flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-indigo-600 transition mb-2 cursor-pointer bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 w-fit"
                      >
                        <ArrowLeft className="w-4 h-4" /> Back to History List
                      </button>

                      {/* Summary Header */}
                      <div className="border-b border-slate-100 pb-5">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                          <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full uppercase tracking-wider font-mono">
                            Session Summary
                          </span>
                          <span className="text-xs text-slate-400 font-mono">
                            Played on: {new Date(selectedHistoryEntry.playedAt).toLocaleString()}
                          </span>
                        </div>
                        <h3 className="text-xl sm:text-2xl font-bold text-slate-800 mt-2 font-display">{selectedHistoryEntry.quizTitle}</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                            <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider font-mono">Session ID</div>
                            <div className="text-base font-bold text-slate-800 font-mono mt-1">{selectedHistoryEntry.id}</div>
                          </div>
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                            <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider font-mono">Participants</div>
                            <div className="text-base font-bold text-slate-800 mt-1">{selectedHistoryEntry.participantsCount}</div>
                          </div>
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                            <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider font-mono">Winner</div>
                            <div className="text-sm font-bold text-emerald-700 truncate mt-1">
                              {selectedHistoryEntry.participants[0]?.name || "N/A"}
                            </div>
                          </div>
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                            <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider font-mono">Top Score</div>
                            <div className="text-base font-bold text-slate-800 mt-1">
                              {selectedHistoryEntry.participants[0] 
                                ? `${selectedHistoryEntry.participants[0].score}/${selectedHistoryEntry.participants[0].totalQuestions}`
                                : "N/A"
                              }
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Standings list */}
                      <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3.5 font-mono">Final Standings & Player Logs</h4>
                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm border-collapse">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">
                                  <th className="p-3 text-center w-14">Rank</th>
                                  <th className="p-3">Player</th>
                                  <th className="p-3">Sales ID</th>
                                  <th className="p-3 text-center">Score</th>
                                  <th className="p-3 text-right">Time Taken</th>
                                  <th className="p-3 text-center w-28">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 text-slate-700">
                                {selectedHistoryEntry.participants.map((p: any) => {
                                  const isExpanded = expandedParticipantId === p.participantId;
                                  return (
                                    <React.Fragment key={p.participantId}>
                                      <tr className="hover:bg-slate-50/50 transition">
                                        <td className="p-3 text-center">
                                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                                            p.rank === 1 ? "bg-amber-100 text-amber-800 border border-amber-200" :
                                            p.rank === 2 ? "bg-slate-200 text-slate-700 border border-slate-300" :
                                            p.rank === 3 ? "bg-amber-50 text-amber-900 border border-amber-100" :
                                            "bg-slate-100 text-slate-500"
                                          }`}>
                                            {p.rank}
                                          </span>
                                        </td>
                                        <td className="p-3 font-semibold text-slate-800">{p.name}</td>
                                        <td className="p-3">
                                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-md font-mono">
                                            {p.salesId}
                                          </span>
                                        </td>
                                        <td className="p-3 text-center font-bold font-mono">
                                          {p.score} <span className="text-slate-300 font-normal">/ {p.totalQuestions}</span>
                                        </td>
                                        <td className="p-3 text-right font-mono text-slate-500 font-medium">
                                          {(p.totalTimeMs / 1000).toFixed(1)}s
                                        </td>
                                        <td className="p-3 text-center">
                                          <button
                                            onClick={() => setExpandedParticipantId(isExpanded ? null : p.participantId)}
                                            className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition cursor-pointer ${
                                              isExpanded 
                                                ? "bg-indigo-600 text-white border-indigo-600" 
                                                : "bg-white text-indigo-600 border-indigo-100 hover:border-indigo-200"
                                            }`}
                                          >
                                            {isExpanded ? "Hide Logs" : "Inspect Logs"}
                                          </button>
                                        </td>
                                      </tr>
                                      
                                      {/* Expanded answer logs block */}
                                      {isExpanded && (
                                        <tr>
                                          <td colSpan={6} className="bg-slate-50/80 p-4 border-t border-b border-slate-100">
                                            <div className="space-y-3.5 max-w-4xl mx-auto text-left">
                                              <div className="flex items-center justify-between mb-1.5 border-b border-slate-100 pb-2">
                                                <h5 className="text-xs font-bold text-indigo-950 uppercase tracking-wider font-mono">
                                                  Question-by-Question breakdown for {p.name}
                                                </h5>
                                                <span className="text-[10px] font-mono text-slate-400 font-medium">
                                                  Total Time: {(p.totalTimeMs / 1000).toFixed(2)} seconds
                                                </span>
                                              </div>
                                              
                                              {p.responses && p.responses.length > 0 ? (
                                                <div className="space-y-3">
                                                  {p.responses.map((resp: any, ri: number) => (
                                                    <div key={resp.questionId || ri} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                                                      <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                          <span className="inline-block text-[10px] font-bold font-mono text-slate-400 uppercase mr-1.5">
                                                            Q{ri + 1}:
                                                          </span>
                                                          <span className="text-sm font-semibold text-slate-800 leading-tight">
                                                            {resp.questionText}
                                                          </span>
                                                        </div>
                                                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono ${
                                                          resp.isCorrect 
                                                            ? "bg-emerald-50 text-emerald-800 border border-emerald-100" 
                                                            : "bg-rose-50 text-rose-800 border border-rose-100"
                                                        }`}>
                                                          {resp.isCorrect ? "Correct" : "Incorrect"}
                                                        </span>
                                                      </div>
                                                      
                                                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-left">
                                                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                          <div className="text-slate-400 text-[9px] uppercase font-bold tracking-wider font-mono mb-0.5">Selected Answers</div>
                                                          <div className="font-medium text-slate-800 leading-tight">
                                                            {resp.selectedOptionTexts && resp.selectedOptionTexts.length > 0 
                                                              ? resp.selectedOptionTexts.join(", ") 
                                                              : <span className="text-slate-400 italic font-normal">Skipped / No Answer</span>
                                                            }
                                                          </div>
                                                        </div>
                                                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 flex justify-between items-center">
                                                          <div>
                                                            <div className="text-slate-400 text-[9px] uppercase font-bold tracking-wider font-mono mb-0.5">Time Spent</div>
                                                            <div className="font-mono font-semibold text-slate-800">
                                                              {(resp.timeTakenMs / 1000).toFixed(2)}s
                                                            </div>
                                                          </div>
                                                        </div>
                                                      </div>
                                                    </div>
                                                  ))}
                                                </div>
                                              ) : (
                                                <p className="text-xs text-slate-400 italic">No responses recorded for this player.</p>
                                              )}
                                            </div>
                                          </td>
                                        </tr>
                                      )}
                                    </React.Fragment>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-16 text-center h-full flex flex-col items-center justify-center">
                      <BarChart2 className="w-12 h-12 text-slate-300 mb-3" />
                      <h4 className="text-base font-bold text-slate-600 font-display">No Session Selected</h4>
                      <p className="text-slate-400 text-xs max-w-sm mt-1 leading-relaxed">
                        Select a completed quiz session from the past list on the left to review general statistics, players, and their specific answer logs.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Share Modal Dialog */}
      {showShareModal && activeSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <h3 className="text-xl font-bold font-display text-slate-800 flex items-center gap-2">
                <Share2 className="w-5 h-5 text-indigo-600" />
                <span>Invite Participants</span>
              </h3>
              <button 
                onClick={() => setShowShareModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col items-center text-center space-y-4">
              {/* Actual dynamic live QR code */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-xs">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(getShareUrl(activeSession.id))}`}
                  alt="Scannable entrance QR" 
                  className="w-48 h-48 select-none"
                  referrerPolicy="no-referrer"
                />
              </div>
              <p className="text-xs text-slate-500 max-w-xs">
                Let your presentation audience scan this code on their phones to jump straight to the join page.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Join Link</label>
              <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-3 rounded-xl border border-slate-200 justify-between">
                <span className="text-xs font-mono font-bold text-indigo-950 truncate select-all">{getShareUrl(activeSession.id)}</span>
                <button 
                  onClick={() => handleCopyLink(activeSession.id)}
                  className="p-2 bg-white text-indigo-600 hover:text-indigo-800 rounded-lg border border-slate-100 hover:border-slate-200 transition shrink-0"
                >
                  {copied ? <span className="text-[11px] text-emerald-600 font-bold px-1">Copied</span> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setShowShareModal(false)}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md shadow-indigo-100 transition text-sm"
              >
                Dismiss Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quiz Delete Confirmation Modal */}
      {quizToDeleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <h3 className="text-xl font-bold font-display text-rose-600 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-500" />
                <span>Delete Quiz?</span>
              </h3>
              <button 
                onClick={() => setQuizToDeleteId(null)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-slate-600 leading-relaxed">
                Are you sure you want to delete this quiz? This action is <strong className="text-slate-800 font-bold">irreversible</strong>.
              </p>
              <p className="text-xs text-slate-400">
                All associated questions, active sessions, and saved participant answers will be permanently deleted.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setQuizToDeleteId(null)}
                className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteQuiz(quizToDeleteId)}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-md shadow-rose-100 transition text-sm"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Session Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <h3 className="text-xl font-bold font-display text-amber-600 flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-amber-500" />
                <span>Reset Current Session?</span>
              </h3>
              <button 
                onClick={() => setShowResetConfirm(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-slate-600 leading-relaxed">
                Are you sure you want to reset the active quiz? All user connection records, scores, and saved answers will be permanently cleared.
              </p>
              <p className="text-xs text-slate-400">
                This allows you to restart the entire quiz clean from the Lobby Stage with the same connected players.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition text-xs"
              >
                Keep Playing
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowResetConfirm(false);
                  await deactivateSession();
                  setView("LIST");
                }}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-md shadow-rose-100 transition text-xs"
              >
                Stop & Exit
              </button>
              <button
                type="button"
                onClick={() => {
                  handleSessionAction("RESET");
                  setShowResetConfirm(false);
                }}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-md shadow-amber-100 transition text-xs"
              >
                Reset & Restart
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
