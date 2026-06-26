import fs from "fs";
import path from "path";
import { Quiz, QuizSession, Participant, ParticipantAnswer, Question, Option, LeaderboardEntry, ParticipantHistoryEntry, ParticipantQuestionResponse, QuizHistoryEntry } from "./types.js";

const DATA_FILE = path.join(process.cwd(), "data.json");
const HISTORY_FILE = path.join(process.cwd(), "history.json");

interface DatabaseSchema {
  quizzes: Quiz[];
  sessions: QuizSession[];
  participants: Participant[];
  answers: ParticipantAnswer[];
}

const DEFAULT_QUIZZES: Quiz[] = [
  {
    id: "synergy-gm0p",
    title: "Synergy",
    description: "It is for synergy event.",
    createdAt: "2026-06-26T15:52:42.989Z",
    updatedAt: "2026-06-26T15:56:01.082Z",
    questions: [
      {
        id: "q-0-0763",
        quizId: "synergy-gm0p",
        text: "Who is richest?",
        type: "SINGLE_CORRECT",
        orderIndex: 0,
        options: [
          { id: "o-0-0-jxlj", questionId: "q-0-0763", text: "Sujeet", isCorrect: false, orderIndex: 0 },
          { id: "o-0-1-9uq5", questionId: "q-0-0763", text: "Ravi", isCorrect: false, orderIndex: 1 },
          { id: "o-0-2-nlsg", questionId: "q-0-0763", text: "Amartya", isCorrect: false, orderIndex: 2 },
          { id: "o-0-3-g7v8", questionId: "q-0-0763", text: "Durgesh", isCorrect: true, orderIndex: 3 }
        ]
      },
      {
        id: "q-1-y9if",
        quizId: "synergy-gm0p",
        text: "Who is hardworking?",
        type: "SINGLE_CORRECT",
        orderIndex: 1,
        options: [
          { id: "o-1-0-6qg0", questionId: "q-1-y9if", text: "Guneet", isCorrect: false, orderIndex: 0 },
          { id: "o-1-1-ozio", questionId: "q-1-y9if", text: "Akhila", isCorrect: true, orderIndex: 1 },
          { id: "o-1-2-7xin", questionId: "q-1-y9if", text: "Sujeet", isCorrect: false, orderIndex: 2 },
          { id: "o-1-3-eobg", questionId: "q-1-y9if", text: "Shubham", isCorrect: false, orderIndex: 3 }
        ]
      },
      {
        id: "q-2-11qe",
        quizId: "synergy-gm0p",
        text: "Who is most irritating?",
        type: "SINGLE_CORRECT",
        orderIndex: 2,
        options: [
          { id: "o-2-0-w5bj", questionId: "q-2-11qe", text: "Ravi", isCorrect: false, orderIndex: 0 },
          { id: "o-2-1-n6xe", questionId: "q-2-11qe", text: "Yaso", isCorrect: false, orderIndex: 1 },
          { id: "o-2-2-ya2z", questionId: "q-2-11qe", text: "Aditya", isCorrect: false, orderIndex: 2 },
          { id: "o-2-3-qii1", questionId: "q-2-11qe", text: "Surjeet", isCorrect: true, orderIndex: 3 }
        ]
      },
      {
        id: "q-3-f9i4",
        quizId: "synergy-gm0p",
        text: "Who have best sense of humour?",
        type: "SINGLE_CORRECT",
        orderIndex: 3,
        options: [
          { id: "o-3-0-zy0n", questionId: "q-3-f9i4", text: "Sujeet", isCorrect: true, orderIndex: 0 },
          { id: "o-3-1-gcv2", questionId: "q-3-f9i4", text: "Guneet", isCorrect: false, orderIndex: 1 },
          { id: "o-3-2-1tdc", questionId: "q-3-f9i4", text: "Aditya", isCorrect: false, orderIndex: 2 },
          { id: "o-3-3-3wac", questionId: "q-3-f9i4", text: "Jiya", isCorrect: false, orderIndex: 3 }
        ]
      }
    ]
  },
  {
    id: "annual-sales-2026",
    title: "Annual Sales Strategy Quiz",
    description: "Verify alignment on the FY26 Enterprise Cloud roadmap, high-growth territories, and core platform value pillars.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    questions: [
      {
        id: "q1",
        quizId: "annual-sales-2026",
        text: "Which of the following is our primary customer acquisition channel for the Enterprise tier in FY26?",
        type: "SINGLE_CORRECT",
        orderIndex: 0,
        options: [
          { id: "o1_1", questionId: "q1", text: "Direct Outbound Sales & Strategic Partnerships", isCorrect: true, orderIndex: 0 },
          { id: "o1_2", questionId: "q1", text: "Self-service Web Signups", isCorrect: false, orderIndex: 1 },
          { id: "o1_3", questionId: "q1", text: "Third-party Marketplace Resellers", isCorrect: false, orderIndex: 2 },
          { id: "o1_4", questionId: "q1", text: "Social Media Influencer Campaigns", isCorrect: false, orderIndex: 3 },
        ]
      },
      {
        id: "q2",
        quizId: "annual-sales-2026",
        text: "Select all the core value pillars of our LCE Enterprise Platform as outlined in the tech roadmap.",
        type: "MULTIPLE_CORRECT",
        orderIndex: 1,
        options: [
          { id: "o2_1", questionId: "q2", text: "Real-time Multi-device Sync & State Reconciliation", isCorrect: true, orderIndex: 0 },
          { id: "o2_2", questionId: "q2", text: "Legacy floppy disk export & magnetic tape backup", isCorrect: false, orderIndex: 1 },
          { id: "o2_3", questionId: "q2", text: "Military-grade end-to-end encryption & compliance", isCorrect: true, orderIndex: 2 },
          { id: "o2_4", questionId: "q2", text: "AI-powered predictive sales forecasting engine", isCorrect: true, orderIndex: 3 },
        ]
      },
      {
        id: "q3",
        quizId: "annual-sales-2026",
        text: "What is our target Net Revenue Retention (NRR) rate for the current fiscal year?",
        type: "SINGLE_CORRECT",
        orderIndex: 2,
        options: [
          { id: "o3_1", questionId: "q3", text: "90% - 95% retention rate", isCorrect: false, orderIndex: 0 },
          { id: "o3_2", questionId: "q3", text: "100% - 105% retention rate", isCorrect: false, orderIndex: 1 },
          { id: "o3_3", questionId: "q3", text: "115% - 120% retention rate", isCorrect: true, orderIndex: 2 },
          { id: "o3_4", questionId: "q3", text: "135%+ retention rate", isCorrect: false, orderIndex: 3 },
        ]
      },
      {
        id: "q4",
        quizId: "annual-sales-2026",
        text: "Which three regions are identified as high-growth territories for our Enterprise Cloud suite in the FY26 strategic roadmap?",
        type: "MULTIPLE_CORRECT",
        orderIndex: 3,
        options: [
          { id: "o4_1", questionId: "q4", text: "APAC South East", isCorrect: true, orderIndex: 0 },
          { id: "o4_2", questionId: "q4", text: "Nordics & DACH", isCorrect: true, orderIndex: 1 },
          { id: "o4_3", questionId: "q4", text: "North America West", isCorrect: true, orderIndex: 2 },
          { id: "o4_4", questionId: "q4", text: "LATAM Central", isCorrect: false, orderIndex: 3 },
        ]
      }
    ]
  }
];

class DatabaseStore {
  private data: DatabaseSchema = {
    quizzes: [],
    sessions: [],
    participants: [],
    answers: []
  };
  private history: QuizHistoryEntry[] = [];

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const fileContent = fs.readFileSync(DATA_FILE, "utf-8");
        this.data = JSON.parse(fileContent);

        // Normalize any old session IDs to 5-digit codes
        let hasChanges = false;
        if (this.data.sessions && Array.isArray(this.data.sessions)) {
          this.data.sessions.forEach((session) => {
            if (!/^\d{5}$/.test(session.id)) {
              const oldId = session.id;
              // Generate a 5-digit code that is unique
              let newId = "";
              do {
                newId = Math.floor(10000 + Math.random() * 90000).toString();
              } while (this.data.sessions.some(s => s.id === newId));

              session.id = newId;
              hasChanges = true;

              // Also update any participants pointing to this session
              if (this.data.participants && Array.isArray(this.data.participants)) {
                this.data.participants.forEach((p) => {
                  const pSessionId = p.quizSessionId || "";
                  if (
                    pSessionId.toLowerCase() === oldId.toLowerCase() ||
                    pSessionId.toLowerCase().replace("session-", "") === oldId.toLowerCase().replace("session-", "")
                  ) {
                    p.quizSessionId = newId;
                  }
                });
              }
            }
          });
        }
        // Normalize connectionStatus for all participants to DISCONNECTED on startup since no websocket is yet active
        if (this.data.participants && Array.isArray(this.data.participants)) {
          this.data.participants.forEach((p) => {
            p.connectionStatus = "DISCONNECTED";
          });
          hasChanges = true;
        }

        if (hasChanges) {
          this.saveData();
        }
      } else {
        this.data.quizzes = DEFAULT_QUIZZES;
        this.saveData();
      }
    } catch (e) {
      console.error("Failed to load database, using fallback", e);
      this.data.quizzes = DEFAULT_QUIZZES;
    }

    // Load history
    try {
      if (fs.existsSync(HISTORY_FILE)) {
        const historyContent = fs.readFileSync(HISTORY_FILE, "utf-8");
        this.history = JSON.parse(historyContent);
      } else {
        this.history = [];
      }
    } catch (e) {
      console.error("Failed to load history, using empty", e);
      this.history = [];
    }
  }

  public save() {
    this.saveData();
    this.saveHistory();
  }

  private saveData() {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2), "utf-8");
    } catch (e) {
      console.error("Failed to save database", e);
    }
  }

  private saveHistory() {
    try {
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(this.history, null, 2), "utf-8");
    } catch (e) {
      console.error("Failed to save history", e);
    }
  }

  // Quizzes
  public getQuizzes(): Quiz[] {
    return this.data.quizzes;
  }

  public getQuiz(id: string): Quiz | undefined {
    return this.data.quizzes.find(q => q.id === id);
  }

  public saveQuiz(quiz: Quiz) {
    const index = this.data.quizzes.findIndex(q => q.id === quiz.id);
    if (index >= 0) {
      this.data.quizzes[index] = { ...quiz, updatedAt: new Date().toISOString() };
    } else {
      this.data.quizzes.push({ ...quiz, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    this.save();
  }

  public deleteQuiz(id: string) {
    this.data.quizzes = this.data.quizzes.filter(q => q.id !== id);
    // clean up linked sessions/participants/answers
    this.data.sessions = this.data.sessions.filter(s => s.quizId !== id);
    this.save();
  }

  // Sessions
  public getSessions(): QuizSession[] {
    return this.data.sessions;
  }

  public getSession(id: string): QuizSession | undefined {
    return this.data.sessions.find(s => s.id === id);
  }

  public getSessionByQuiz(quizId: string): QuizSession | undefined {
    return this.data.sessions.find(s => s.quizId === quizId);
  }

  public saveSession(session: QuizSession) {
    const index = this.data.sessions.findIndex(s => s.id === session.id);
    if (index >= 0) {
      this.data.sessions[index] = session;
    } else {
      this.data.sessions.push(session);
    }
    this.save();
  }

  public deleteSession(id: string) {
    this.data.sessions = this.data.sessions.filter(s => s.id !== id);
    this.data.participants = this.data.participants.filter(p => p.quizSessionId !== id);
    this.save();
  }

  // Participants
  public getParticipants(sessionId: string): Participant[] {
    return this.data.participants.filter(p => p.quizSessionId === sessionId);
  }

  public getParticipant(id: string): Participant | undefined {
    return this.data.participants.find(p => p.id === id);
  }

  public getParticipantBySalesId(sessionId: string, salesId: string): Participant | undefined {
    return this.data.participants.find(p => p.quizSessionId === sessionId && p.salesId === salesId);
  }

  public addParticipant(participant: Participant) {
    // Prevent duplicates
    const existing = this.getParticipantBySalesId(participant.quizSessionId, participant.salesId);
    if (existing) {
      existing.connectionStatus = "CONNECTED";
      existing.id = participant.id; // update to new socket ID
      this.save();
      return existing;
    }
    this.data.participants.push(participant);
    this.save();
    return participant;
  }

  public updateParticipantStatus(id: string, status: "CONNECTED" | "DISCONNECTED") {
    const participant = this.getParticipant(id);
    if (participant) {
      participant.connectionStatus = status;
      this.save();
    }
  }

  // Answers
  public getAnswersForSession(sessionId: string): ParticipantAnswer[] {
    const pIds = this.getParticipants(sessionId).map(p => p.id);
    return this.data.answers.filter(a => pIds.includes(a.participantId));
  }

  public getParticipantAnswers(participantId: string): ParticipantAnswer[] {
    return this.data.answers.filter(a => a.participantId === participantId);
  }

  public getAnswer(participantId: string, questionId: string): ParticipantAnswer | undefined {
    return this.data.answers.find(a => a.participantId === participantId && a.questionId === questionId);
  }

  public saveAnswer(answer: ParticipantAnswer) {
    const index = this.data.answers.findIndex(
      a => a.participantId === answer.participantId && a.questionId === answer.questionId
    );
    if (index >= 0) {
      this.data.answers[index] = answer;
    } else {
      this.data.answers.push(answer);
    }
    this.save();
  }

  public clearSessionAnswersAndParticipants(sessionId: string, activeParticipantIds?: string[]) {
    const participants = this.getParticipants(sessionId);
    const pIds = participants.map(p => p.id);
    
    // Clear all answers for this session's participants
    this.data.answers = this.data.answers.filter(a => !pIds.includes(a.participantId));
    
    // Only remove disconnected participants of this session, keep connected ones
    this.data.participants = this.data.participants.filter(p => {
      if (p.quizSessionId === sessionId) {
        if (activeParticipantIds) {
          return activeParticipantIds.includes(p.id);
        }
        return p.connectionStatus === "CONNECTED";
      }
      return true;
    });
    
    this.save();
  }

  public removeDisconnectedParticipants(sessionId: string) {
    this.data.participants = this.data.participants.filter(p => {
      if (p.quizSessionId === sessionId) {
        return p.connectionStatus === "CONNECTED";
      }
      return true;
    });
    this.save();
  }

  public clearAllParticipants(sessionId: string) {
    const participants = this.getParticipants(sessionId);
    const pIds = participants.map(p => p.id);
    
    // Clear all answers for this session's participants
    this.data.answers = this.data.answers.filter(a => !pIds.includes(a.participantId));
    
    // Remove all participants
    this.data.participants = this.data.participants.filter(p => p.quizSessionId !== sessionId);
    
    this.save();
  }

  // Scoring Logic
  public calculateLeaderboard(sessionId: string, quiz: Quiz): LeaderboardEntry[] {
    const participants = this.getParticipants(sessionId);
    const answers = this.getAnswersForSession(sessionId);

    const entries: LeaderboardEntry[] = participants.map(p => {
      const pAnswers = answers.filter(a => a.participantId === p.id);
      let score = 0;
      let totalTimeMs = 0;

      quiz.questions.forEach(q => {
        const pAns = pAnswers.find(a => a.questionId === q.id);
        if (pAns && pAns.isCorrect) {
          score += 1;
        }
        if (pAns) {
          totalTimeMs += pAns.timeTakenMs;
        }
      });

      return {
        participantId: p.id,
        name: p.name,
        salesId: p.salesId,
        score,
        totalQuestions: quiz.questions.length,
        totalTimeMs,
        rank: 0 // Will assign below
      };
    });

    // Sort: Higher score ranks first. If tied, lower total time ranks higher. If still tied, sort by salesId.
    entries.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (a.totalTimeMs !== b.totalTimeMs) {
        return a.totalTimeMs - b.totalTimeMs;
      }
      return a.salesId.localeCompare(b.salesId);
    });

    // Assign rank
    entries.forEach((entry, i) => {
      entry.rank = i + 1;
    });

    return entries;
  }

  // History Methods
  public getHistory(): QuizHistoryEntry[] {
    return this.history || [];
  }

  public deleteHistoryEntry(id: string) {
    this.history = (this.history || []).filter(h => h.id !== id);
    this.saveHistory();
  }

  public clearAllHistory() {
    this.history = [];
    this.saveHistory();
  }

  public archiveSession(sessionId: string) {
    const session = this.getSession(sessionId);
    if (!session) return;

    const quiz = this.getQuiz(session.quizId);
    if (!quiz) return;

    this.history = this.history || [];
    // If already archived, don't duplicate
    if (this.history.some(h => h.id === sessionId)) {
      return;
    }

    const participants = this.getParticipants(sessionId);
    // Only archive if there is at least 1 participant
    if (participants.length === 0) return;

    const leaderboard = this.calculateLeaderboard(sessionId, quiz);
    const answers = this.getAnswersForSession(sessionId);

    const participantHistoryEntries: ParticipantHistoryEntry[] = leaderboard.map(le => {
      const pAnswers = answers.filter(a => a.participantId === le.participantId);

      const responses: ParticipantQuestionResponse[] = quiz.questions.map(q => {
        const pAns = pAnswers.find(a => a.questionId === q.id);
        
        let selectedOptionTexts: string[] = [];
        if (pAns && pAns.selectedOptionIds) {
          selectedOptionTexts = q.options
            .filter(opt => pAns.selectedOptionIds.includes(opt.id))
            .map(opt => opt.text);
        }

        return {
          questionId: q.id,
          questionText: q.text,
          selectedOptionIds: pAns ? pAns.selectedOptionIds : [],
          selectedOptionTexts,
          isCorrect: pAns ? pAns.isCorrect : false,
          timeTakenMs: pAns ? pAns.timeTakenMs : 0
        };
      });

      return {
        participantId: le.participantId,
        name: le.name,
        salesId: le.salesId,
        rank: le.rank,
        score: le.score,
        totalQuestions: le.totalQuestions,
        totalTimeMs: le.totalTimeMs,
        responses
      };
    });

    const historyEntry: QuizHistoryEntry = {
      id: sessionId,
      quizId: quiz.id,
      quizTitle: quiz.title,
      playedAt: new Date().toISOString(),
      participantsCount: participantHistoryEntries.length,
      participants: participantHistoryEntries
    };

    this.history.push(historyEntry);
    this.saveHistory();
  }
}

export const dbStore = new DatabaseStore();
