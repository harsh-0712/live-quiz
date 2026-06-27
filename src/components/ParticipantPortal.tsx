import React, { useState, useEffect, useRef } from "react";
import { 
  User, Shield, Users, Clock, Check, Award, AlertCircle, RefreshCw, 
  Wifi, WifiOff, Send, Flame, Trophy, ChevronRight, LogOut, Sparkles
} from "lucide-react";
import { QuizSession, ParticipantAnswer, LeaderboardEntry } from "../types";

interface ParticipantPortalProps {
  initialSessionId: string | null;
  onLeave?: () => void;
}

export default function ParticipantPortal({ initialSessionId, onLeave }: ParticipantPortalProps) {
  // Connection and Session Details
  const [sessionId, setSessionId] = useState("");
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

  // Synchronize deep links and saved states on load/change
  useEffect(() => {
    const savedName = localStorage.getItem("qsync_name") || "";
    const savedSalesId = localStorage.getItem("qsync_salesId") || "";
    const savedSessionId = localStorage.getItem("qsync_sessionId");

    if (savedName) setName(savedName);
    if (savedSalesId) setSalesId(savedSalesId);

    // Deep link from scanning a QR code or visiting with ?join=XXXXX takes absolute priority
    if (initialSessionId) {
      setSessionId(initialSessionId);
      
      // Auto-join only if they were already part of THIS session
      if (savedSessionId === initialSessionId && savedName && savedSalesId) {
        setIsJoined(true);
        connectToWebSocket(initialSessionId, savedName, savedSalesId, true);
      } else {
        // Otherwise, keep them on the join form with the NEW code auto-filled
        setIsJoined(false);
        setSessionStatus("JOIN");
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
      }
    } else if (savedName && savedSalesId && savedSessionId) {
      setSessionId(savedSessionId);
      setIsJoined(true);
      connectToWebSocket(savedSessionId, savedName, savedSalesId, true);
    }
  }, [initialSessionId]);

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

          // If the session code is expired or invalid, reset everything immediately
          if (message.data.message.includes("Invalid Session Code") || message.data.message.includes("not found")) {
            localStorage.removeItem("qsync_name");
            localStorage.removeItem("qsync_salesId");
            localStorage.removeItem("qsync_sessionId");
            setIsJoined(false);
            setConnected(false);
            setSessionStatus("JOIN");
            setActiveSession(null);
            if (wsRef.current) {
              wsRef.current.close();
              wsRef.current = null;
            }
          }
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
    localStorage.setItem("qsync_salesId", salesId.toUpperCase().trim());
    localStorage.setItem("qsync_sessionId", sessionId);
    setIsJoined(true);
    setLoading(false);

    connectToWebSocket(sessionId, name, salesId.toUpperCase().trim());
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

    // Notify parent to switch tabs/views if registered
    if (onLeave) {
      onLeave();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full w-full lg:bg-slate-100 items-center justify-center lg:p-4 select-none">
      {/* Phone Screen Mock Container: high-fidelity simulator on desktop, clean full-screen on mobile */}
      <div className="w-full h-full lg:max-w-[390px] lg:h-[780px] lg:max-h-[90vh] bg-white lg:bg-[#0f172a] lg:rounded-[3.5rem] lg:p-3 lg:shadow-2xl lg:border-[10px] lg:border-slate-800 flex flex-col relative overflow-hidden shrink-0 transition-all duration-300">
        
        {/* Dynamic Island Header Accent */}
        <div className="hidden lg:block absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-800 rounded-b-2xl z-30 shadow-inner"></div>

        {/* Inner Phone Frame */}
        <div className="w-full h-full bg-slate-50 lg:rounded-[2.8rem] overflow-hidden flex flex-col relative text-slate-800 font-sans shadow-inner">
          
          {/* Connection Status Header Bar */}
          <div className="h-12 flex items-center justify-between px-6 shrink-0 border-b border-slate-100 bg-white/80 backdrop-blur-md z-10">
            <span className="text-[11px] font-bold tracking-tight text-slate-600 lg:block hidden font-mono">9:41</span>
            <div className="flex items-center gap-1.5 lg:hidden">
              <Sparkles className="w-4 h-4 text-indigo-600 animate-spin-slow" />
              <span className="text-xs font-black tracking-tight text-slate-800 font-display">LCE INTERACTIVE</span>
            </div>
            
            <div className="flex items-center gap-2">
              {isJoined && (
                <>
                  {connected ? (
                    <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 animate-fade-in">
                      <Wifi className="w-2.5 h-2.5 text-emerald-500" />
                      <span>SECURE SYNC</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 animate-pulse">
                      <WifiOff className="w-2.5 h-2.5 text-slate-400" />
                      <span>{reconnecting ? "RECON..." : "STALE"}</span>
                    </span>
                  )}
                </>
              )}
              <div className="w-5 h-3 bg-slate-800 rounded-[3px] p-0.5 lg:flex items-center justify-start hidden shadow-xs">
                <div className="w-3.5 h-full bg-emerald-500 rounded-[2px]"></div>
              </div>
            </div>
          </div>

          {/* Core Content Body */}
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 flex flex-col relative">
            
            {sessionStatus === "JOIN" && (
              <div className="flex-1 flex flex-col justify-between space-y-4 sm:space-y-6 animate-fade-in py-1">
                <div className="space-y-4 sm:space-y-5">
                  <div className="text-center space-y-1.5">
                    <div className="w-11 h-11 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mx-auto shadow-lg shadow-indigo-100 animate-bounce-subtle">
                      <User className="w-5.5 h-5.5" />
                    </div>
                    <h2 className="text-lg sm:text-xl font-bold tracking-tight font-display text-slate-900">Join Live Quiz Room</h2>
                    <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed max-w-[240px] mx-auto">
                      Fill out your official event credentials to participate in real-time.
                    </p>
                  </div>

                  {error && (
                    <div className="p-2.5 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl flex items-start gap-2 text-[11px] sm:text-xs font-medium animate-shake">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-500" />
                      <span>{error}</span>
                    </div>
                  )}

                  <form onSubmit={handleJoin} className="space-y-3 sm:space-y-4">
                    <div>
                      <label className="block text-[9px] sm:text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1 sm:mb-1.5">Session Code</label>
                      <input
                        type="text"
                        value={sessionId}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "").slice(0, 5);
                          setSessionId(val);
                        }}
                        maxLength={5}
                        placeholder="Enter 5-digit code"
                        className="w-full px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 text-sm font-bold text-slate-900 transition font-mono tracking-widest text-center"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] sm:text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1 sm:mb-1.5">Your Name</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 text-sm text-slate-800 transition font-medium"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] sm:text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1 sm:mb-1.5">Sales ID</label>
                      <input
                        type="text"
                        value={salesId}
                        onChange={(e) => setSalesId(e.target.value)}
                        className="w-full px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 text-sm text-slate-800 transition font-mono uppercase tracking-wider font-bold"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3 sm:py-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white rounded-xl font-bold shadow-lg shadow-indigo-100 transition duration-200 flex items-center justify-center gap-2 disabled:opacity-50 text-xs uppercase tracking-wider cursor-pointer"
                    >
                      {loading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <span>Connect to Lobby</span>
                          <ChevronRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                </div>

                <div className="text-center">
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-300 font-mono">SECURE SYNC v1.4.2</span>
                </div>
              </div>
            )}

            {sessionStatus === "LOBBY" && (
              <div className="flex-1 flex flex-col justify-between py-1 animate-fade-in">
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 sm:space-y-6">
                  <div className="relative">
                    {/* Ring pulses */}
                    <div className="absolute inset-0 bg-amber-400/20 rounded-full animate-ping duration-1000"></div>
                    <div className="w-14 h-14 bg-amber-50 border border-amber-200 text-amber-600 rounded-full flex items-center justify-center shadow-md relative">
                      <Flame className="w-7 h-7 text-amber-500 animate-pulse" />
                    </div>
                  </div>
                  
                  <div className="space-y-1 sm:space-y-2">
                    <h3 className="text-base sm:text-lg font-bold text-slate-950 font-display">Locked in the Lobby!</h3>
                    <p className="text-[11px] sm:text-xs text-slate-400 max-w-[240px] mx-auto leading-relaxed">
                      Standby. The quiz organiser will broadcast the live quiz session shortly.
                    </p>
                  </div>

                  <div className="p-3.5 sm:p-4 bg-white border border-slate-200/60 rounded-2xl w-full text-left space-y-2.5 sm:space-y-3 shadow-xs">
                    <p className="text-[9px] sm:text-[10px] font-extrabold text-indigo-500 uppercase tracking-widest border-b border-slate-50 pb-1 sm:pb-1.5">Registered Identity</p>
                    <div className="flex justify-between items-center text-[11px] sm:text-xs">
                      <span className="text-slate-400 font-medium">Player:</span>
                      <span className="font-extrabold text-slate-800">{name}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] sm:text-xs">
                      <span className="text-slate-400 font-medium">Sales Badge:</span>
                      <span className="font-mono font-bold text-slate-800 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md uppercase">{salesId}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] sm:text-xs">
                      <span className="text-slate-400 font-medium">Room Code:</span>
                      <span className="font-mono font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">{sessionId}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleLeaveSession}
                  className="w-full py-2.5 sm:py-3 border border-rose-100 hover:bg-rose-50 text-[11px] sm:text-xs font-bold text-rose-600 rounded-xl transition duration-150 flex items-center justify-center gap-1.5 cursor-pointer mt-4"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Leave Lobby Room</span>
                </button>
              </div>
            )}

            {sessionStatus === "ACTIVE" && currentQuestion && activeSession && (
              <div className="flex-1 flex flex-col justify-between py-1 animate-fade-in">
                <div className="space-y-3 sm:space-y-4">
                  {/* Progress Header */}
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100 shrink-0">
                    <span className="text-[9px] sm:text-[10px] font-extrabold text-indigo-500 uppercase tracking-widest font-mono">
                      Question {activeSession.currentQuestionIndex + 1}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-[8px] font-extrabold uppercase tracking-wider ${
                      currentQuestion.type === "SINGLE_CORRECT" ? "bg-slate-100 text-slate-600" : "bg-indigo-50 border border-indigo-100 text-indigo-700"
                    }`}>
                      {currentQuestion.type === "SINGLE_CORRECT" ? "Single Choice" : "Multi-Choice"}
                    </span>
                  </div>

                  {/* Question Text */}
                  <h3 className="text-sm sm:text-[15px] font-extrabold text-slate-900 leading-snug font-display">
                    {currentQuestion.text}
                  </h3>

                  {/* Options List */}
                  <div className="space-y-2 sm:space-y-3 pt-0.5">
                    {currentQuestion.options.map((o: any) => {
                      const isSelected = selectedOptionIds.includes(o.id);
                      return (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => handleOptionClick(o.id, currentQuestion.type === "SINGLE_CORRECT")}
                          className={`w-full text-left p-3 sm:p-4 rounded-xl border-2 flex items-center justify-between transition-all duration-200 active:scale-[0.99] cursor-pointer shadow-xs ${
                            isSelected 
                              ? "border-indigo-600 bg-indigo-50/70 text-indigo-950" 
                              : "border-slate-100 bg-white hover:border-slate-200 text-slate-700"
                          }`}
                        >
                          <span className="text-[11px] sm:text-xs font-semibold leading-tight pr-3">{o.text}</span>
                          <div className={`w-4.5 h-4.5 sm:w-5 sm:h-5 rounded-full border shrink-0 flex items-center justify-center transition-all duration-200 ${
                            isSelected 
                              ? "bg-indigo-600 border-indigo-600 text-white" 
                              : "border-slate-300 text-transparent bg-white"
                          }`}>
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Question Timing & Controls */}
                <div className="space-y-2.5 sm:space-y-3.5 pt-3 sm:pt-4 border-t border-slate-100 shrink-0 text-center mt-auto">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 bg-white border border-slate-200 rounded-lg text-[9px] sm:text-[10px] font-mono text-slate-500 shadow-xs">
                    <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-500 animate-pulse" />
                    <span>Timer: <strong className="text-slate-800 font-bold">{(displayTimeMs / 1000).toFixed(2)}s</strong></span>
                  </div>

                  {participantAnswer && !isModifying ? (
                    <div className="p-2.5 sm:p-3 bg-emerald-50 border border-emerald-100 rounded-xl shadow-xs animate-fade-in">
                      <p className="text-[9px] sm:text-[10px] text-emerald-800 font-extrabold flex items-center justify-center gap-1 uppercase tracking-wider">
                        <Check className="w-3 h-3 text-emerald-600 stroke-[3.5]" />
                        <span>Selection Locked</span>
                      </p>
                      <p className="text-[8px] sm:text-[9px] text-emerald-600 mt-0.5">
                        You can update options until the host proceeds.
                      </p>
                    </div>
                  ) : (
                    <button
                      onClick={handleConfirmAnswer}
                      disabled={selectedOptionIds.length === 0}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 text-white disabled:text-slate-400 rounded-xl font-bold shadow-lg disabled:shadow-none transition-all duration-200 flex items-center justify-center gap-2 text-xs uppercase tracking-wider active:scale-95 disabled:scale-100 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isModifying ? "Save Selection Update" : "Lock Choice"}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {sessionStatus === "COMPLETED" && (
              <div className="flex-1 flex flex-col justify-between py-1 animate-fade-in">
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 sm:space-y-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-indigo-400/20 rounded-full animate-ping duration-1000"></div>
                    <div className="w-14 h-14 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-full flex items-center justify-center shadow-md relative">
                      <Award className="w-7 h-7 text-indigo-600 animate-bounce" />
                    </div>
                  </div>

                  <div className="space-y-1 sm:space-y-2">
                    <h3 className="text-base sm:text-lg font-bold text-slate-950 font-display">Quiz Completed!</h3>
                    <p className="text-[11px] sm:text-xs text-slate-400 max-w-[240px] mx-auto leading-relaxed">
                      Excellent effort! The organiser is aggregating scores. Standby to view the final event scoreboard.
                    </p>
                  </div>

                  <div className="p-3.5 sm:p-4 bg-white border border-slate-200/60 rounded-2xl w-full text-left space-y-2.5 sm:space-y-3 shadow-xs font-mono text-[11px]">
                    <p className="text-[9px] sm:text-[10px] font-extrabold text-indigo-500 uppercase tracking-widest font-sans border-b border-slate-50 pb-1 sm:pb-1.5">Game Connection</p>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-sans">Status:</span>
                      <span className="text-emerald-600 font-extrabold">ANSWERS SUBMITTED</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-sans">Player ID:</span>
                      <span className="text-slate-800 uppercase font-bold">{salesId}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleLeaveSession}
                  className="w-full py-2.5 sm:py-3 border border-rose-100 hover:bg-rose-50 text-[11px] sm:text-xs font-bold text-rose-600 rounded-xl transition duration-150 flex items-center justify-center gap-1.5 cursor-pointer mt-4"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Leave Session</span>
                </button>
              </div>
            )}

            {sessionStatus === "LEADERBOARD_REVEALED" && (
              <div className="flex-1 flex flex-col justify-between py-1 animate-fade-in">
                <div className="flex-1 flex flex-col min-h-0">
                  {/* Score Summary Badge */}
                  {(() => {
                    const myEntry = leaderboard.find(entry => entry.isCurrentUser);
                    return myEntry ? (
                      <div className="bg-gradient-to-br from-indigo-600 to-indigo-500 rounded-2xl p-3.5 sm:p-4 text-center space-y-1 mb-3.5 shadow-md text-white animate-fade-in relative overflow-hidden">
                        <div className="absolute top-0 right-0 -translate-y-1/3 translate-x-1/3 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-indigo-200 font-mono">Performance Card</span>
                        <h4 className="text-lg sm:text-xl font-black font-display text-white">Rank #{myEntry.rank}</h4>
                        <div className="flex justify-center gap-3.5 text-[11px] sm:text-xs font-bold text-indigo-100 font-mono">
                          <span>Score: {myEntry.score} / {myEntry.totalQuestions}</span>
                          <span>Speed: {(myEntry.totalTimeMs / 1000).toFixed(1)}s</span>
                        </div>
                      </div>
                    ) : null;
                  })()}

                  <div className="flex justify-between items-center mb-2.5 shrink-0">
                    <h4 className="text-[9px] sm:text-[10px] font-extrabold text-slate-400 uppercase tracking-widest font-mono">Interactive Standing</h4>
                    <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider font-mono">Live Scores</span>
                  </div>

                  {/* Standings list */}
                  <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
                    {leaderboard.map((entry) => {
                      const isTop3 = entry.rank <= 3;
                      const podiumColors = 
                        entry.rank === 1 ? "bg-amber-100 text-amber-800 border-amber-200" :
                        entry.rank === 2 ? "bg-slate-200 text-slate-800 border-slate-300" :
                        entry.rank === 3 ? "bg-amber-500/10 text-amber-700 border-amber-600/20" :
                        "bg-slate-100 text-slate-500 border-slate-200";

                      const rankIcon = 
                        entry.rank === 1 ? "🥇" :
                        entry.rank === 2 ? "🥈" :
                        entry.rank === 3 ? "🥉" :
                        entry.rank.toString();

                      return (
                        <div 
                          key={entry.participantId} 
                          className={`p-3 sm:p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-all duration-200 shadow-xs ${
                            entry.isCurrentUser 
                              ? "bg-amber-50 border-amber-300/80 shadow-md shadow-amber-500/5 ring-1 ring-amber-400/30" 
                              : "bg-white border-slate-200/60"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className={`w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-lg flex items-center justify-center text-[9px] sm:text-[10px] font-black shrink-0 border ${podiumColors}`}>
                              {rankIcon}
                            </span>
                            <div className="min-w-0">
                              <p className={`text-[11px] sm:text-xs font-black truncate ${entry.isCurrentUser ? "text-amber-950 font-display" : "text-slate-800"}`}>
                                {entry.name} {entry.isCurrentUser && <span className="text-[8px] font-bold uppercase text-amber-600 bg-amber-100/50 px-1.5 py-0.5 rounded ml-1">You</span>}
                              </p>
                              <p className="text-[8px] text-slate-400 font-mono">ID: {entry.salesId}</p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <p className={`text-[11px] sm:text-xs font-black font-mono ${entry.isCurrentUser ? "text-amber-950" : "text-slate-800"}`}>
                              {entry.score} <span className="text-[9px] text-slate-400 font-normal">/ {entry.totalQuestions}</span>
                            </p>
                            <p className="text-[9px] text-slate-400 font-mono">{(entry.totalTimeMs / 1000).toFixed(1)}s</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Back to entry or reset */}
                <div className="pt-3 sm:pt-4 border-t border-slate-100 shrink-0 mt-3">
                  <button
                    onClick={handleLeaveSession}
                    className="w-full py-2.5 sm:py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-[9px] sm:text-[10px] uppercase tracking-wider transition cursor-pointer"
                  >
                    Disconnect & Exit Board
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer App Credits */}
          <div className="h-10 border-t border-slate-100 flex items-center justify-center bg-white text-[9px] font-mono tracking-widest text-slate-400 shrink-0 select-none">
            LCE EVENT SYSTEMS
          </div>
        </div>
      </div>
      
      {/* Mobile Badge Annotation */}
      {isJoined && (
        <p className="mt-4 text-xs text-slate-500 font-medium italic animate-fade-in lg:block hidden">
          Active Player: {name} (Badge: {salesId})
        </p>
      )}
    </div>
  );
}
