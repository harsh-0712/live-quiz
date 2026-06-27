import fs from "fs";
import path from "path";
import { MongoClient, Db } from "mongodb";
import { 
  Quiz, 
  QuizSession, 
  Participant, 
  ParticipantAnswer, 
  Question, 
  Option, 
  LeaderboardEntry, 
  ParticipantHistoryEntry, 
  ParticipantQuestionResponse, 
  QuizHistoryEntry 
} from "./types.js";

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

// Globally accessible MongoDB database reference
let dbClient: MongoClient | null = null;
let db: Db | null = null;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface MongoErrorInfo {
  error: string;
  operationType: OperationType;
  collection: string;
}

export function handleMongoError(error: unknown, operationType: OperationType, collection: string): void {
  const errInfo: MongoErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    collection
  };
  console.error('MongoDB Error (Gracefully Handled): ', JSON.stringify(errInfo));
}

// Lazy initialization is done in init()


class DatabaseStore {
  private data: DatabaseSchema = {
    quizzes: [],
    sessions: [],
    participants: [],
    answers: []
  };
  private history: QuizHistoryEntry[] = [];

  constructor() {
    this.loadLocalFallback();
  }

  private saveLocalData() {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2));
    } catch (err) {
      console.error("Failed to write to local fallback data.json:", err);
    }
  }

  private saveLocalHistory() {
    try {
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(this.history, null, 2));
    } catch (err) {
      console.error("Failed to write to local fallback history.json:", err);
    }
  }

  private loadLocalFallback() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const fileContent = fs.readFileSync(DATA_FILE, "utf-8");
        this.data = JSON.parse(fileContent);

        // Normalize any old session IDs to 5-digit codes
        if (this.data.sessions && Array.isArray(this.data.sessions)) {
          this.data.sessions.forEach((session) => {
            if (!/^\d{5}$/.test(session.id)) {
              const oldId = session.id;
              let newId = "";
              do {
                newId = Math.floor(10000 + Math.random() * 90000).toString();
              } while (this.data.sessions.some(s => s.id === newId));

              session.id = newId;

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
        if (this.data.participants && Array.isArray(this.data.participants)) {
          this.data.participants.forEach((p) => {
            p.connectionStatus = "DISCONNECTED";
          });
        }
      } else {
        this.data.quizzes = DEFAULT_QUIZZES;
      }
    } catch (e) {
      console.error("Failed to load local database fallback:", e);
      this.data.quizzes = DEFAULT_QUIZZES;
    }

    try {
      if (fs.existsSync(HISTORY_FILE)) {
        const historyContent = fs.readFileSync(HISTORY_FILE, "utf-8");
        this.history = JSON.parse(historyContent);
      } else {
        this.history = [];
      }
    } catch (e) {
      console.error("Failed to load local history fallback:", e);
      this.history = [];
    }
  }

  // Load from MongoDB at startup (Async)
  public async init() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.warn("MONGODB_URI environment variable is not defined. Running in offline/in-memory mode with local data.json fallback.");
      return;
    }

    try {
      console.log("Connecting to MongoDB...");
      dbClient = new MongoClient(uri);
      await dbClient.connect();
      
      const dbName = process.env.MONGODB_DB_NAME || "quiz_app";
      db = dbClient.db(dbName);
      console.log(`Connected successfully to MongoDB database: ${dbName}`);

      // 1. Quizzes
      const quizzesCursor = db.collection("quizzes").find({});
      const quizzesList = (await quizzesCursor.toArray()).map(doc => {
        const { _id, ...rest } = doc;
        return rest as unknown as Quiz;
      });

      if (quizzesList.length === 0) {
        console.log("No quizzes found in MongoDB. Seeding default quizzes...");
        this.data.quizzes = DEFAULT_QUIZZES;
        for (const quiz of DEFAULT_QUIZZES) {
          await db.collection("quizzes").updateOne(
            { _id: quiz.id as any },
            { $set: quiz },
            { upsert: true }
          );
        }
      } else {
        this.data.quizzes = quizzesList;
      }

      // 2. Sessions
      const sessionsCursor = db.collection("sessions").find({});
      const sessionsList = (await sessionsCursor.toArray()).map(doc => {
        const { _id, ...rest } = doc;
        return rest as unknown as QuizSession;
      });
      this.data.sessions = sessionsList;

      // Normalize sessions on startup
      this.data.sessions.forEach((session) => {
        if (!/^\d{5}$/.test(session.id)) {
          const oldId = session.id;
          let newId = "";
          do {
            newId = Math.floor(10000 + Math.random() * 90000).toString();
          } while (this.data.sessions.some(s => s.id === newId));

          session.id = newId;
          if (db) {
            db.collection("sessions").deleteOne({ _id: oldId as any }).catch(() => {});
            db.collection("sessions").updateOne(
              { _id: newId as any },
              { $set: session },
              { upsert: true }
            ).catch(() => {});
          }
        }
      });

      // 3. Participants
      const participantsCursor = db.collection("participants").find({});
      const participantsList = (await participantsCursor.toArray()).map(doc => {
        const { _id, ...rest } = doc;
        const p = rest as unknown as Participant;
        // Normalize connectionStatus to DISCONNECTED on boot
        p.connectionStatus = "DISCONNECTED";
        
        if (db) {
          db.collection("participants").updateOne(
            { _id: doc._id },
            { $set: { connectionStatus: "DISCONNECTED" } }
          ).catch(() => {});
        }
        return p;
      });
      this.data.participants = participantsList;

      // 4. Answers
      const answersCursor = db.collection("answers").find({});
      const answersList = (await answersCursor.toArray()).map(doc => {
        const { _id, ...rest } = doc;
        return rest as unknown as ParticipantAnswer;
      });
      this.data.answers = answersList;

      // 5. History
      const historyCursor = db.collection("history").find({});
      const historyList = (await historyCursor.toArray()).map(doc => {
        const { _id, ...rest } = doc;
        return rest as unknown as QuizHistoryEntry;
      });
      historyList.sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime());
      this.history = historyList;

      console.log(`Database sync completed successfully! Quizzes: ${this.data.quizzes.length}, Sessions: ${this.data.sessions.length}, Participants: ${this.data.participants.length}, Answers: ${this.data.answers.length}, History: ${this.history.length}`);
    } catch (err: any) {
      console.warn("----------------------------------------------------------------------");
      console.warn("⚠️  MONGODB CONNECTION NOTICE ⚠️");
      console.warn("Could not connect to MongoDB server:", err.message || err);
      console.warn("");
      console.warn("If you are using MongoDB Atlas, this is likely because your database");
      console.warn("cluster's IP Whitelist does not allow connections from this container.");
      console.warn("");
      console.warn("HOW TO FIX MANUALLY:");
      console.warn("1. Go to your MongoDB Atlas dashboard (https://cloud.mongodb.com).");
      console.warn("2. In the left-hand menu, under Security, click 'Network Access'.");
      console.warn("3. Click the green 'Add IP Address' button.");
      console.warn("4. Click 'ALLOW ACCESS FROM ANYWHERE' (adds IP address 0.0.0.0/0).");
      console.warn("5. Click 'Confirm' and wait a moment for the status to change to 'Active'.");
      console.warn("");
      console.warn("Falling back gracefully to local persistence ('data.json' and 'history.json').");
      console.warn("----------------------------------------------------------------------");
      db = null;
      dbClient = null;
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
    const updatedQuiz = { 
      ...quiz, 
      createdAt: quiz.createdAt || new Date().toISOString(), 
      updatedAt: new Date().toISOString() 
    };
    if (index >= 0) {
      this.data.quizzes[index] = updatedQuiz;
    } else {
      this.data.quizzes.push(updatedQuiz);
    }
    this.saveLocalData();
    
    if (db) {
      db.collection("quizzes").updateOne(
        { _id: quiz.id as any },
        { $set: updatedQuiz },
        { upsert: true }
      ).catch((err: any) => {
        console.error("MongoDB saveQuiz failed:", err);
        handleMongoError(err, OperationType.WRITE, "quizzes");
      });
    }
  }

  public deleteQuiz(id: string) {
    this.data.quizzes = this.data.quizzes.filter(q => q.id !== id);
    const linkedSessionIds = this.data.sessions.filter(s => s.quizId === id).map(s => s.id);
    this.data.sessions = this.data.sessions.filter(s => s.quizId !== id);
    this.saveLocalData();
    
    if (db) {
      db.collection("quizzes").deleteOne({ _id: id as any }).catch((err: any) => {
        console.error("MongoDB deleteQuiz failed:", err);
        handleMongoError(err, OperationType.DELETE, "quizzes");
      });
      for (const sId of linkedSessionIds) {
        db.collection("sessions").deleteOne({ _id: sId as any }).catch((err: any) => {
          handleMongoError(err, OperationType.DELETE, "sessions");
        });
        this.clearAllParticipants(sId);
      }
    }
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
    this.saveLocalData();
    
    if (db) {
      db.collection("sessions").updateOne(
        { _id: session.id as any },
        { $set: session },
        { upsert: true }
      ).catch((err: any) => {
        console.error("MongoDB saveSession failed:", err);
        handleMongoError(err, OperationType.WRITE, "sessions");
      });
    }
  }

  public deleteSession(id: string) {
    this.data.sessions = this.data.sessions.filter(s => s.id !== id);
    this.data.participants = this.data.participants.filter(p => p.quizSessionId !== id);
    this.saveLocalData();
    
    if (db) {
      db.collection("sessions").deleteOne({ _id: id as any }).catch((err: any) => {
        console.error("MongoDB deleteSession failed:", err);
        handleMongoError(err, OperationType.DELETE, "sessions");
      });
      
      // Clean up participants
      db.collection("participants").deleteMany({ quizSessionId: id }).catch((err: any) => {
        console.error("MongoDB deleteSession participants cleanup failed:", err);
        handleMongoError(err, OperationType.DELETE, "participants");
      });
    }
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
    const existing = this.getParticipantBySalesId(participant.quizSessionId, participant.salesId);
    if (existing) {
      existing.connectionStatus = "CONNECTED";
      existing.id = participant.id; // update to new socket ID
      this.saveLocalData();
      
      if (db) {
        db.collection("participants").updateOne(
          { _id: existing.id as any },
          { $set: existing },
          { upsert: true }
        ).catch((err: any) => {
          console.error("MongoDB updateParticipant failed:", err);
          handleMongoError(err, OperationType.WRITE, "participants");
        });
      }
      return existing;
    }
    this.data.participants.push(participant);
    this.saveLocalData();
    
    if (db) {
      db.collection("participants").updateOne(
        { _id: participant.id as any },
        { $set: participant },
        { upsert: true }
      ).catch((err: any) => {
        console.error("MongoDB addParticipant failed:", err);
        handleMongoError(err, OperationType.WRITE, "participants");
      });
    }
    return participant;
  }

  public updateParticipantStatus(id: string, status: "CONNECTED" | "DISCONNECTED") {
    const participant = this.getParticipant(id);
    if (participant) {
      participant.connectionStatus = status;
      this.saveLocalData();
      
      if (db) {
        db.collection("participants").updateOne(
          { _id: id as any },
          { $set: { connectionStatus: status } }
        ).catch((err: any) => {
          console.error("MongoDB updateParticipantStatus failed:", err);
          handleMongoError(err, OperationType.UPDATE, "participants");
        });
      }
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
    this.saveLocalData();
    
    if (db) {
      const docId = `${answer.participantId}_${answer.questionId}`;
      db.collection("answers").updateOne(
        { _id: docId as any },
        { $set: answer },
        { upsert: true }
      ).catch((err: any) => {
        console.error("MongoDB saveAnswer failed:", err);
        handleMongoError(err, OperationType.WRITE, "answers");
      });
    }
  }

  public clearSessionAnswersAndParticipants(sessionId: string, activeParticipantIds?: string[]) {
    const participants = this.getParticipants(sessionId);
    const pIds = participants.map(p => p.id);
    
    // Clear all answers for this session's participants
    this.data.answers = this.data.answers.filter(a => !pIds.includes(a.participantId));
    
    // Only remove disconnected participants of this session, keep connected ones
    const removedParticipantIds: string[] = [];
    this.data.participants = this.data.participants.filter(p => {
      if (p.quizSessionId === sessionId) {
        const keep = activeParticipantIds ? activeParticipantIds.includes(p.id) : p.connectionStatus === "CONNECTED";
        if (!keep) {
          removedParticipantIds.push(p.id);
        }
        return keep;
      }
      return true;
    });
    this.saveLocalData();
    
    if (db) {
      db.collection("answers").deleteMany({ participantId: { $in: pIds } }).catch((err: any) => {
        handleMongoError(err, OperationType.DELETE, "answers");
      });
      db.collection("participants").deleteMany({ _id: { $in: removedParticipantIds as any[] } }).catch((err: any) => {
        handleMongoError(err, OperationType.DELETE, "participants");
      });
    }
  }

  public removeDisconnectedParticipants(sessionId: string) {
    const removedParticipantIds: string[] = [];
    this.data.participants = this.data.participants.filter(p => {
      if (p.quizSessionId === sessionId) {
        const keep = p.connectionStatus === "CONNECTED";
        if (!keep) {
          removedParticipantIds.push(p.id);
        }
        return keep;
      }
      return true;
    });
    this.saveLocalData();
    
    if (db) {
      db.collection("participants").deleteMany({ _id: { $in: removedParticipantIds as any[] } }).catch((err: any) => {
        handleMongoError(err, OperationType.DELETE, "participants");
      });
    }
  }

  public clearAllParticipants(sessionId: string) {
    const participants = this.getParticipants(sessionId);
    const pIds = participants.map(p => p.id);
    
    this.data.answers = this.data.answers.filter(a => !pIds.includes(a.participantId));
    this.data.participants = this.data.participants.filter(p => p.quizSessionId !== sessionId);
    this.saveLocalData();
    
    if (db) {
      db.collection("participants").deleteMany({ _id: { $in: pIds as any[] } }).catch((err: any) => {
        handleMongoError(err, OperationType.DELETE, "participants");
      });
      db.collection("answers").deleteMany({ participantId: { $in: pIds } }).catch((err: any) => {
        handleMongoError(err, OperationType.DELETE, "answers");
      });
    }
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
        rank: 0
      };
    });

    entries.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (a.totalTimeMs !== b.totalTimeMs) {
        return a.totalTimeMs - b.totalTimeMs;
      }
      return a.salesId.localeCompare(b.salesId);
    });

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
    this.saveLocalHistory();
    if (db) {
      db.collection("history").deleteOne({ _id: id as any }).catch((err: any) => {
        console.error("MongoDB deleteHistoryEntry failed:", err);
        handleMongoError(err, OperationType.DELETE, "history");
      });
    }
  }

  public clearAllHistory() {
    this.history = [];
    this.saveLocalHistory();
    if (db) {
      db.collection("history").deleteMany({}).catch((err: any) => {
        console.error("MongoDB clearAllHistory failed:", err);
        handleMongoError(err, OperationType.DELETE, "history");
      });
    }
  }

  public archiveSession(sessionId: string) {
    const session = this.getSession(sessionId);
    if (!session) return;

    const quiz = this.getQuiz(session.quizId);
    if (!quiz) return;

    this.history = this.history || [];
    if (this.history.some(h => h.id === sessionId)) {
      return;
    }

    const participants = this.getParticipants(sessionId);
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
    this.history.sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime());
    this.saveLocalHistory();

    if (db) {
      db.collection("history").updateOne(
        { _id: sessionId as any },
        { $set: historyEntry },
        { upsert: true }
      ).catch((err: any) => {
        console.error("MongoDB archiveSession failed:", err);
        handleMongoError(err, OperationType.WRITE, "history");
      });
    }
  }
}

export const dbStore = new DatabaseStore();
