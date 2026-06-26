import React, { useState, useEffect, useRef } from "react";
import { 
  User, Shield, Users, Clock, Check, Award, AlertCircle, RefreshCw, 
  Wifi, WifiOff, Send, HelpCircle, Flame
} from "lucide-react";
import { QuizSession, ParticipantAnswer, LeaderboardEntry } from "../types";

interface ParticipantPortalProps {
  initialSessionId: string | null;
}

export default function ParticipantPortal({ initialSessionId }: ParticipantPortalProps) {
  // Connection and Session Details
  const [sessionId, setSessionId] = useState(initialSessionId || "");
  const [name, setName] = useState("");
  const [salesId, setSalesId] = useState("");
  const [isJoined, setIsJoined] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  // Quiz States (received via WS)
  const [sessionStatus, setSessionStatus] = useState<string>("JOIN"); // JOIN, LOBBY, ACTIVE, COMPLETED, LEADERBOARD_REVEALED
  const [activeSession, setActiveSession] = useState<QuizSession | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<any | null>(null);
  const [participantAnswer, setParticipantAnswer] = useState<ParticipantAnswer | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  // Selection states (for pending edits/answers)
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [isModifying, setIsModifying] = useState(false);

  // Live Timer states
  const [displayTimeMs, setDisplayTimeMs] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const timerIntervalRef = useRef<any>(null);
  const modifyStartTimeRef = useRef<number | null>(null);

  // Refs to keep track of current states in the WebSocket closure
  const isJoinedRef = useRef(isJoined);
  const sessionIdRef = useRef(sessionId);

  useEffect(() => {
    isJoinedRef.current = isJoined;
  }, [isJoined]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // On mount, look for saved session in localStorage
  useEffect(() => {
    const savedName = localStorage.getItem("qsync_name");
    const savedSalesId = localStorage.getItem("qsync_salesId");
    const savedSessionId = localStorage.getItem("qsync_sessionId");

    if (savedName && savedSalesId && savedSessionId) {
      setName(savedName);
      setSalesId(savedSalesId);
      setSessionId(savedSessionId);
      setIsJoined(true);
      connectToWebSocket(savedSessionId, savedName, savedSalesId, true);
    }
  }, []);

  // Sync Timer logic
  useEffect(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    if (sessionStatus !== "ACTIVE" || !currentQuestion || !activeSession) {
      return;
    }

    const questionStartTime = activeSession.startedAt ? new Date(activeSession.startedAt).getTime() : Date.now();

    timerIntervalRef.current = setInterval(() => {
      const now = Date.now();

      if (participantAnswer && !isModifying) {
        // Answer is saved, freeze display at submitted time
        setDisplayTimeMs(participantAnswer.timeTakenMs);
      } else if (participantAnswer && isModifying && modifyStartTimeRef.current) {
        // Answer is saved but they are editing. Accumulate previous time + elapsed editing time
        const editingElapsed = now - modifyStartTimeRef.current;
        setDisplayTimeMs(participantAnswer.timeTakenMs + editingElapsed);
      } else {
        // First time thinking (no previous submission)
        const elapsed = now - questionStartTime;
        setDisplayTimeMs(elapsed > 0 ? elapsed : 0);
      }
    }, 100);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [sessionStatus, currentQuestion, activeSession, participantAnswer, isModifying]);

  // Handle local option clicks
  const handleOptionClick = (optionId: string, isSingle: boolean) => {
    let nextSelection: string[];

    if (isSingle) {
      nextSelection = [optionId];
    } else {
      if (selectedOptionIds.includes(optionId)) {
        nextSelection = selectedOptionIds.filter(id => id !== optionId);
      } else {
        nextSelection = [...selectedOptionIds, optionId];
      }
    }

    setSelectedOptionIds(nextSelection);

    // If they already have a confirmed answer, tapping to change options enters modifying state
    if (participantAnswer) {
      if (!isModifying) {
        setIsModifying(true);
        modifyStartTimeRef.current = Date.now();
      }
    }
  };

  // Submit/Confirm selection
  const handleConfirmAnswer = () => {
    if (selectedOptionIds.length === 0) return;
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError("Unable to submit. Connection lost. Retrying connection...");
      return;
    }

    wsRef.current.send(JSON.stringify({
      type: "SUBMIT_ANSWER",
      data: {
        quizSessionId: sessionId,
        salesId,
        questionId: currentQuestion.id,
        selectedOptionIds
      }
    }));

    setIsModifying(false);
    modifyStartTimeRef.current = null;
  };

  // WebSocket Connector
  const connectToWebSocket = (sId: string, pName: string, pSalesId: string, isReconnect = false) => {
    setLoading(true);
    setReconnecting(isReconnect);

    if (wsRef.current) {
      wsRef.current.close();
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const encodedName = encodeURIComponent(pName);
    const encodedSalesId = encodeURIComponent(pSalesId);
    const wsUrl = `${protocol}//${window.location.host}/ws?role=participant&sessionId=${sId}&salesId=${encodedSalesId}&name=${encodedName}`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setConnected(true);
      setReconnecting(false);
      setLoading(false);
      setError("");
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "PARTICIPANT_STATE") {
          const { state, session, currentQuestion: q, participantAnswer: ans, leaderboard: lBoard } = message.data;
          setSessionStatus(state);
          setActiveSession(session);
          
          if (q) {
            setCurrentQuestion(q);
            // Sync selection status
            if (ans) {
              setParticipantAnswer(ans);
              setSelectedOptionIds(ans.selectedOptionIds);
              setIsModifying(false);
            } else {
              setParticipantAnswer(null);
              setSelectedOptionIds([]);
              setIsModifying(false);
            }
          }

          if (lBoard) {
            setLeaderboard(lBoard);
          }
        } else if (message.type === "QUIZ_STOPPED") {
          // Quiz stopped/reset, disconnect participant
          localStorage.removeItem("qsync_name");
          localStorage.removeItem("qsync_salesId");
          localStorage.removeItem("qsync_sessionId");
          
          if (wsRef.current) {
            wsRef.current.close();
          }
          wsRef.current = null;
          setIsJoined(false);
          setConnected(false);
          setSessionStatus("JOIN");
          setActiveSession(null);
        } else if (message.type === "LOBBY_UPDATE") {
          setSessionStatus("LOBBY");
          setActiveSession(message.data.session);
        } else if (message.type === "QUIZ_STARTED") {
          setSessionStatus("ACTIVE");
          setActiveSession(message.data.session);
          setCurrentQuestion(message.data.firstQuestion);
          setParticipantAnswer(null);
          setSelectedOptionIds([]);
          setIsModifying(false);
        } else if (message.type === "QUESTION_CHANGED") {
          setSessionStatus("ACTIVE");
          setActiveSession(message.data.session);
          setCurrentQuestion(message.data.question);
          
          const ans = message.data.participantAnswer;
          if (ans) {
            setParticipantAnswer(ans);
            setSelectedOptionIds(ans.selectedOptionIds);
            setIsModifying(false);
          } else {
            setParticipantAnswer(null);
            setSelectedOptionIds([]);
            setIsModifying(false);
          }
        } else if (message.type === "QUIZ_COMPLETED") {
          setSessionStatus("COMPLETED");
          setActiveSession(message.data.session);
        } else if (message.type === "LEADERBOARD_REVEALED") {
          setSessionStatus("LEADERBOARD_REVEALED");
          setLeaderboard(message.data.leaderboard);
        } else if (message.type === "ERROR") {
          setError(message.data.message);
          setLoading(false);
        }
      } catch (e) {
        console.error("Failed to parse WS data", e);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      // Automatic reconnection loop
      setTimeout(() => {
        if (isJoinedRef.current && sessionIdRef.current === sId && wsRef.current === ws) {
          connectToWebSocket(sId, pName, pSalesId, true);
        }
      }, 3000);
    };

    wsRef.current = ws;
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!sessionId.trim() || !name.trim() || !salesId.trim()) {
      setError("Please fill in all entry fields.");
      return;
    }

    // Check if session exists
    try {
      setLoading(true);
      const res = await fetch(`/api/sessions/${sessionId}`);
      if (!res.ok) {
        setError("Invalid Session Code. Please check the code and try again.");
        setLoading(false);
        return;
      }
    } catch (err) {
      setError("Unable to connect to server. Please try again.");
      setLoading(false);
      return;
    }

    // Save registration
    localStorage.setItem("qsync_name", name);
    localStorage.setItem("qsync_salesId", salesId);
    localStorage.setItem("qsync_sessionId", sessionId);
    setIsJoined(true);
    setLoading(false);

    connectToWebSocket(sessionId, name, salesId);
  };

  const handleLeaveSession = () => {
    localStorage.removeItem("qsync_name");
    localStorage.removeItem("qsync_salesId");
    localStorage.removeItem("qsync_sessionId");
    
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    setIsJoined(false);
    setSessionStatus("JOIN");
    setName("");
    setSalesId("");
    setActiveSession(null);
    setCurrentQuestion(null);
    setParticipantAnswer(null);
    setSelectedOptionIds([]);
    setIsModifying(false);
  };

  return (
    <div className="flex-1 flex flex-col h-full w-full lg:bg-slate-100 items-center justify-center lg:p-4">
      {/* Phone Screen Mock Container: high-fidelity simulator on desktop, clean full-screen on mobile */}
      <div className="w-full h-full lg:max-w-[390px] lg:h-[780px] lg:max-h-[90vh] bg-white lg:bg-[#121212] lg:rounded-[3.5rem] lg:p-3 lg:shadow-2xl lg:border-[10px] lg:border-slate-800 flex flex-col relative overflow-hidden shrink-0">
        {/* Dynamic Island Header Accent */}
        <div className="hidden lg:block absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-slate-800 rounded-b-2xl z-30"></div>

        {/* Inner Phone Frame */}
        <div className="w-full h-full bg-white lg:rounded-[2.8rem] overflow-hidden flex flex-col relative text-slate-800 font-sans">
          
          {/* Connection Status Header Bar */}
          <div className="h-11 flex items-center justify-between px-6 shrink-0 select-none border-b border-slate-50 bg-slate-50/50">
            <span className="text-xs font-bold tracking-tight text-slate-800 lg:block hidden font-mono">9:41</span>
            <span className="text-xs font-extrabold tracking-tight text-indigo-600 lg:hidden block font-display">LCE QUIZ PLAYER</span>
            
            <div className="flex items-center gap-1.5">
              {isJoined && (
                <>
                  {connected ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                      <Wifi className="w-3 h-3" />
                      <span>LIVE</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                      <WifiOff className="w-3 h-3 animate-pulse" />
                      <span>{reconnecting ? "RECONNECTING" : "OFFLINE"}</span>
                    </span>
                  )}
                </>
              )}
              <div className="w-5 h-3 bg-slate-800 rounded-[3px] p-0.5 lg:flex items-center justify-start hidden">
                <div className="w-3.5 h-full bg-white rounded-[2px]"></div>
              </div>
            </div>
          </div>

          {/* Core Content Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col">
            
            {sessionStatus === "JOIN" && (
              <div className="flex-1 flex flex-col justify-center space-y-6">
                <div className="text-center space-y-2">
                  <div className="w-11 h-11 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mx-auto shadow-md">
                    <User className="w-5.5 h-5.5" />
                  </div>
                  <h2 className="text-xl font-bold tracking-tight font-display text-slate-800">LCE Quiz Participant</h2>
                  <p className="text-xs text-slate-500">Sign in to join the live LCE event quiz.</p>
                </div>

                {error && (
                  <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl flex items-start gap-2.5 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleJoin} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Session Invitation Code</label>
                    <input
                      type="text"
                      value={sessionId}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "").slice(0, 5);
                        setSessionId(val);
                      }}
                      maxLength={5}
                      placeholder="e.g. 54829"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 text-sm text-slate-800 transition font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Your Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 text-sm text-slate-800 transition"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">SalesId</label>
                    <input
                      type="text"
                      value={salesId}
                      onChange={(e) => setSalesId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 text-sm text-slate-800 transition font-mono uppercase"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 transition flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 text-xs uppercase tracking-wider"
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <span>Enter Lobby Room</span>
                    )}
                  </button>
                </form>
              </div>
            )}

            {sessionStatus === "LOBBY" && (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
                <div className="w-16 h-16 bg-amber-50 border border-amber-100 text-amber-600 rounded-full flex items-center justify-center shadow-xs">
                  <Flame className="w-8 h-8 animate-pulse text-amber-500" />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-slate-800 font-display">Waiting for Host...</h3>
                  <p className="text-xs text-slate-500 max-w-[240px] mx-auto">
                    The quiz organiser is assembling the lobby. The countdown will launch automatically.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl w-full text-left space-y-2.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Your Details</p>
                  <div className="flex justify-between items-center text-xs text-slate-600">
                    <span>Name:</span>
                    <span className="font-bold text-slate-800">{name}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-slate-600">
                    <span>Sales Badge:</span>
                    <span className="font-mono font-bold text-slate-800">{salesId}</span>
                  </div>
                </div>

                <button
                  onClick={handleLeaveSession}
                  className="text-xs font-semibold text-rose-500 hover:text-rose-700 transition"
                >
                  Leave Lobby Room
                </button>
              </div>
            )}

            {sessionStatus === "ACTIVE" && currentQuestion && activeSession && (
              <div className="flex-1 flex flex-col justify-between">
                <div className="space-y-4">
                  {/* Progress Header */}
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100 shrink-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Question {activeSession.currentQuestionIndex + 1}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                      currentQuestion.type === "SINGLE_CORRECT" ? "bg-slate-100 text-slate-600" : "bg-indigo-50 text-indigo-700 border border-indigo-100"
                    }`}>
                      {currentQuestion.type === "SINGLE_CORRECT" ? "Single Choice" : "Multi-Choice"}
                    </span>
                  </div>

                  {/* Question Text */}
                  <h3 className="text-base font-bold text-slate-800 leading-snug">
                    {currentQuestion.text}
                  </h3>

                  {/* Options List */}
                  <div className="space-y-2.5">
                    {currentQuestion.options.map((o: any) => {
                      const isSelected = selectedOptionIds.includes(o.id);
                      return (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => handleOptionClick(o.id, currentQuestion.type === "SINGLE_CORRECT")}
                          className={`w-full text-left p-3.5 rounded-xl border-2 flex items-center justify-between transition active:scale-[0.98] ${
                            isSelected 
                              ? "border-indigo-600 bg-indigo-50 text-indigo-950" 
                              : "border-slate-100 bg-slate-50 hover:bg-slate-100/50 text-slate-700"
                          }`}
                        >
                          <span className="text-xs font-semibold leading-tight">{o.text}</span>
                          <div className={`w-4 h-4 rounded-full border shrink-0 flex items-center justify-center transition ${
                            isSelected 
                              ? "bg-indigo-600 border-indigo-600 text-white" 
                              : "border-slate-300 text-transparent"
                          }`}>
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Question Timing & Controls */}
                <div className="space-y-3 pt-4 border-t border-slate-100 shrink-0 text-center">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-lg text-[10px] font-mono text-slate-500">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Accumulated Time: <strong>{(displayTimeMs / 1000).toFixed(1)}s</strong></span>
                  </div>

                  {participantAnswer && !isModifying ? (
                    <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                      <p className="text-[10px] text-emerald-800 font-bold flex items-center justify-center gap-1">
                        <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                        <span>ANSWER SAVED</span>
                      </p>
                      <p className="text-[9px] text-emerald-600 mt-0.5">
                        You can change selection until host proceeds.
                      </p>
                    </div>
                  ) : (
                    <button
                      onClick={handleConfirmAnswer}
                      disabled={selectedOptionIds.length === 0}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 text-white disabled:text-slate-400 rounded-xl font-bold shadow-lg disabled:shadow-none transition flex items-center justify-center gap-2 text-xs uppercase tracking-wider active:scale-95 disabled:scale-100"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isModifying ? "Save Choice Update" : "Confirm Choice"}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {sessionStatus === "COMPLETED" && (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
                <div className="w-16 h-16 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-full flex items-center justify-center shadow-xs">
                  <Award className="w-8 h-8 animate-bounce" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-slate-800 font-display">Quiz Completed!</h3>
                  <p className="text-xs text-slate-500 max-w-[240px] mx-auto">
                    Standby. The quiz organiser is verifying final answers and will reveal the live standings table shortly.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl w-full text-left space-y-2.5 font-mono text-[11px] text-slate-600">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Connection State</p>
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <span className="text-emerald-600 font-bold">SESSION COMPLETED</span>
                  </div>
                </div>
              </div>
            )}

            {sessionStatus === "LEADERBOARD_REVEALED" && (
              <div className="flex-1 flex flex-col">
                {/* Score Summary Badge */}
                {(() => {
                  const myEntry = leaderboard.find(entry => entry.isCurrentUser);
                  return myEntry ? (
                    <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 rounded-2xl p-4 border border-indigo-100 text-center space-y-1 mb-4">
                      <span className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest font-mono">Your Performance Score</span>
                      <h4 className="text-2xl font-bold text-indigo-950 font-display">Rank #{myEntry.rank}</h4>
                      <div className="flex justify-center gap-4 text-xs font-medium text-indigo-800 font-mono">
                        <span>Score: {myEntry.score} / {myEntry.totalQuestions}</span>
                        <span>Time: {(myEntry.totalTimeMs / 1000).toFixed(1)}s</span>
                      </div>
                    </div>
                  ) : null;
                })()}

                <div className="flex justify-between items-center mb-3 shrink-0">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Live Standing Scorecard</h4>
                  <span className="text-[9px] font-semibold text-slate-400 italic">Participant Result</span>
                </div>

                {/* Standings list */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
                  {leaderboard.map((entry) => (
                    <div 
                      key={entry.participantId} 
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition ${
                        entry.isCurrentUser 
                          ? "bg-amber-50 border-amber-200 shadow-xs" 
                          : "bg-slate-50 border-slate-200/60"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-5.5 h-5.5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                          entry.isCurrentUser 
                            ? "bg-amber-200 text-amber-900 border border-amber-300" 
                            : "bg-slate-200 text-slate-600"
                        }`}>
                          {entry.rank}
                        </span>
                        <div className="min-w-0">
                          <p className={`text-xs font-bold truncate ${entry.isCurrentUser ? "text-amber-950" : "text-slate-800"}`}>
                            {entry.name} {entry.isCurrentUser && <span className="text-[9px] font-normal text-amber-700 font-sans ml-1">(You)</span>}
                          </p>
                          <p className="text-[9px] text-slate-400 font-mono">ID: {entry.salesId}</p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className={`text-xs font-bold font-mono ${entry.isCurrentUser ? "text-amber-950" : "text-slate-800"}`}>
                          {entry.score} <span className="text-[10px] text-slate-400 font-normal">/ {entry.totalQuestions}</span>
                        </p>
                        <p className="text-[9px] text-slate-400 font-mono">{(entry.totalTimeMs / 1000).toFixed(1)}s</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Back to entry or reset */}
                <div className="pt-4 mt-2 border-t border-slate-100 shrink-0">
                  <button
                    onClick={handleLeaveSession}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-[10px] uppercase tracking-wider transition"
                  >
                    Exit Standing Board
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer App Credits */}
          <div className="h-10 border-t border-slate-100 flex items-center justify-center bg-slate-50 text-[9px] font-mono tracking-wide text-slate-400 shrink-0 select-none">
            LCE QUIZ ENGINE
          </div>
        </div>
      </div>
      
      {/* Mobile Badge Annotation */}
      {isJoined && (
        <p className="mt-4 text-xs text-slate-500 font-medium italic">
          Active Player: {name} (ID: {salesId})
        </p>
      )}
    </div>
  );
}
