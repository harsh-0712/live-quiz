import React, { useState, useEffect, useRef } from "react";
import { 
  Tv, Phone, ShieldAlert, Sparkles, LogIn, Laptop, ArrowRight, HelpCircle, 
  Settings, Award, Clock, Users, Database, Play
} from "lucide-react";
import AdminLogin from "./components/AdminLogin";
import AdminDashboard from "./components/AdminDashboard";
import ParticipantPortal from "./components/ParticipantPortal";

export default function App() {
  const [adminToken, setAdminToken] = useState<string | null>(
    localStorage.getItem("qsync_admin_token")
  );
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [activeTab, setActiveTab] = useState<"host" | "participant">("host");
  const [deepJoinSessionId, setDeepJoinSessionId] = useState<string | null>(null);
  const participantRef = useRef<HTMLDivElement>(null);

  // Check URL query parameters for deep linking
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinId = params.get("join");
    const isAdmin = params.get("admin") === "true";

    if (joinId) {
      setDeepJoinSessionId(joinId);
      setActiveTab("participant");
    } else if (isAdmin) {
      setShowAdminLogin(true);
      setActiveTab("host");
    }
  }, []);

  const handleAdminLoginSuccess = (token: string) => {
    localStorage.setItem("qsync_admin_token", token);
    setAdminToken(token);
    setShowAdminLogin(false);
  };

  const handleAdminLogout = () => {
    localStorage.removeItem("qsync_admin_token");
    setAdminToken(null);
  };

  return (
    <div className="w-full h-screen bg-slate-100 flex flex-col font-sans text-slate-900 overflow-hidden select-none">
      
      {/* Mobile/Tablet Screen View Selectors (Only visible on screens smaller than lg) */}
      <div className="lg:hidden shrink-0 h-14 bg-white border-b border-slate-200 flex items-center justify-around px-4 shadow-xs">
        <button
          onClick={() => setActiveTab("host")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === "host"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
              : "text-slate-500 hover:text-slate-800"
          }`}
          id="host-tab-btn"
        >
          <Tv className="w-4 h-4" />
          <span>Organiser Deck</span>
        </button>
        <button
          onClick={() => setActiveTab("participant")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === "participant"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
              : "text-slate-500 hover:text-slate-800"
          }`}
          id="participant-tab-btn"
        >
          <Phone className="w-4 h-4" />
          <span>Participant Screen</span>
        </button>
      </div>

      {/* Main Split Layout container */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Side: Organiser Suite / Landing Screen */}
        <div className={`flex-1 min-w-0 lg:w-2/3 h-full flex flex-col border-r border-slate-200 bg-slate-50 relative ${
          activeTab === "host" ? "flex" : "hidden lg:flex"
        }`}>
          {adminToken ? (
            <AdminDashboard adminToken={adminToken} onLogout={handleAdminLogout} />
          ) : showAdminLogin ? (
            <div className="flex-1 flex flex-col justify-center items-center">
              <AdminLogin 
                onLoginSuccess={handleAdminLoginSuccess} 
                onClose={() => setShowAdminLogin(false)} 
              />
            </div>
          ) : (
            // Premium Professional Polish landing page
            <div className="flex-1 flex flex-col justify-between p-6 md:p-12 overflow-y-auto">
              {/* Top Row */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-100">
                    <span className="font-extrabold text-xl tracking-tighter">L</span>
                  </div>
                  <span className="font-extrabold tracking-tight text-slate-800 text-lg font-display">
                    LCE Quiz <span className="text-slate-400 font-medium">Live</span>
                  </span>
                </div>
                <button
                  onClick={() => setShowAdminLogin(true)}
                  className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-xs"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Admin Sign In</span>
                </button>
              </div>

              {/* Middle Row (Bento/Showcase Hero) */}
              <div className="max-w-xl mx-auto py-12 md:py-16 space-y-8 text-center md:text-left">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-100/50 px-3 py-1 rounded-full text-xs font-bold text-indigo-700 uppercase tracking-wider font-mono">
                    <Sparkles className="w-3.5 h-3.5 animate-pulse text-indigo-500" />
                    <span>LCE Quiz Synchronization</span>
                  </div>
                  <h1 className="text-4xl md:text-5xl font-extrabold text-slate-800 tracking-tight font-display leading-none">
                    Engage LCE Events with <span className="text-indigo-600 bg-gradient-to-r from-indigo-600 to-indigo-500 bg-clip-text text-transparent">Seamless</span> Quiz Sync.
                  </h1>
                  <p className="text-slate-500 text-sm leading-relaxed max-w-lg">
                    Build custom quiz decks, project the host screen, and synchronize participants' mobile screens seamlessly for Lowe's events.
                  </p>
                </div>

                {/* Main Landing Calls to Action */}
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <button
                    onClick={() => {
                      setActiveTab("participant");
                      participantRef.current?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="w-full sm:w-auto px-8 py-3.5 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition flex items-center justify-center gap-2.5 active:scale-95 text-sm uppercase tracking-wide cursor-pointer"
                  >
                    <span>Join as Participant</span>
                    <Phone className="w-4 h-4 text-indigo-200" />
                  </button>
                  <button
                    onClick={() => setShowAdminLogin(true)}
                    className="w-full sm:w-auto px-8 py-3.5 border border-slate-300 bg-white text-slate-700 rounded-xl font-bold hover:bg-slate-50 hover:border-slate-400 transition flex items-center justify-center gap-2 active:scale-95 text-sm"
                  >
                    <span>Host Live Session</span>
                    <Laptop className="w-4 h-4 text-slate-400" />
                  </button>
                </div>

                {/* Key Benefits Grid */}
                <div className="grid grid-cols-3 gap-4 border-t border-slate-200 pt-8 text-left">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-indigo-600">
                      <Clock className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider font-mono">Real-time</span>
                    </div>
                    <p className="text-[11px] text-slate-400">Low-latency participant synchronization.</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-indigo-600">
                      <Users className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider font-mono">Event-Ready</span>
                    </div>
                    <p className="text-[11px] text-slate-400">Suitable for small teams or large event halls.</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-indigo-600">
                      <Database className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider font-mono">Secure</span>
                    </div>
                    <p className="text-[11px] text-slate-400">Protected administrative and session access.</p>
                  </div>
                </div>
              </div>

              {/* Bottom Row */}
              <footer className="text-center md:text-left text-xs text-slate-400 flex flex-col md:flex-row justify-between gap-2 border-t border-slate-100 pt-4">
                <span>© 2026 Lowe's LCE Department. All rights reserved.</span>
                <span className="font-mono">LCE QUIZ TOOL v1.4.2</span>
              </footer>
            </div>
          )}
        </div>

        {/* Right Side: Participant Portal (Rendered inside Phone Mockup layout on Desktop) */}
        <div ref={participantRef} className={`lg:w-1/3 min-w-0 h-full lg:bg-slate-200 items-center justify-center lg:p-6 shrink-0 relative overflow-hidden ${
          activeTab === "participant" ? "flex w-full bg-white" : "hidden lg:flex"
        }`}>
          {/* Ambient light effects in background */}
          <div className="absolute -top-12 -right-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

          <ParticipantPortal initialSessionId={deepJoinSessionId} />
        </div>
      </div>
    </div>
  );
}
