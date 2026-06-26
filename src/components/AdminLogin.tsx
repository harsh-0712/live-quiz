import React, { useState } from "react";
import { KeyRound, LogIn, AlertCircle } from "lucide-react";

interface AdminLoginProps {
  onLoginSuccess: (token: string) => void;
  onClose: () => void;
}

export default function AdminLogin({ onLoginSuccess, onClose }: AdminLoginProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();
      if (res.ok && data.token) {
        onLoginSuccess(data.token);
      } else {
        setError(data.error || "Incorrect password. Please try again.");
      }
    } catch (err) {
      setError("Failed to connect to the server. Please verify it is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 min-h-[400px]">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-8 shadow-xl">
        <div className="flex items-center justify-center mb-6">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
            <KeyRound className="w-6 h-6" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-center text-slate-800 tracking-tight font-display mb-2">
          Organiser Dashboard Access
        </h2>
        <p className="text-sm text-center text-slate-500 mb-6">
          Enter the administrator passcode to manage quizzes and host live events. (Default: <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">admin123</code>)
        </p>

        {error && (
          <div className="mb-4 p-4 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl flex items-start gap-3 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Passcode
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 text-slate-800 transition"
              required
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition active:scale-[0.98]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-indigo-600 rounded-xl font-bold text-white shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 hover:bg-indigo-700 transition active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Authenticate</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
