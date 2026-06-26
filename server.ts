import express from "express";
import http from "http";
import path from "path";
import url from "url";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

import { dbStore } from "./src/db_store.js";
import { Quiz, QuizSession, Participant, ParticipantAnswer, Question, Option, LeaderboardEntry, SessionStatus } from "./src/types.js";

dotenv.config();

const PORT = 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

// Create Express app
const app = express();
app.use(express.json());

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server attached to HTTP server
const wss = new WebSocketServer({ server, path: "/ws" });

// Active WebSocket connections tracking by session
// Key: sessionId, Value: Map of connectionId -> socket client info
interface ClientConn {
  ws: WebSocket;
  role: "organiser" | "participant";
  salesId?: string;
  name?: string;
  id: string; // Socket ID
}
const sessionClients = new Map<string, Map<string, ClientConn>>();

// Broadcasters
function broadcastToSession(sessionId: string, event: any) {
  const clients = sessionClients.get(sessionId);
  if (!clients) return;
  const payload = JSON.stringify(event);
  for (const client of clients.values()) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
}

function broadcastToOrganisers(sessionId: string, event: any) {
  const clients = sessionClients.get(sessionId);
  if (!clients) return;
  const payload = JSON.stringify(event);
  for (const client of clients.values()) {
    if (client.role === "organiser" && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
}

// Sanitize question payload for participants (stripping correct answers)
function sanitizeQuestionForParticipant(question: Question) {
  return {
    id: question.id,
    quizId: question.quizId,
    text: question.text,
    type: question.type,
    orderIndex: question.orderIndex,
    options: question.options.map(o => ({
      id: o.id,
      questionId: o.questionId,
      text: o.text,
      orderIndex: o.orderIndex
    }))
  };
}

// Calculate responsive state details for organizer
function getResponseState(sessionId: string, currentQuestionId?: string) {
  const participants = dbStore.getParticipants(sessionId);
  const activeCount = participants.filter(p => p.connectionStatus === "CONNECTED").length;
  const answers = dbStore.getAnswersForSession(sessionId);
  
  const currentAnswers = currentQuestionId 
    ? answers.filter(a => a.questionId === currentQuestionId && a.isAnswered)
    : [];
  
  const answeredParticipants = currentAnswers.map(a => {
    const p = participants.find(part => part.id === a.participantId);
    return p ? p.salesId : "";
  }).filter(Boolean);

  return {
    answeredCount: currentAnswers.length,
    totalCount: participants.length,
    activeCount,
    answeredParticipants
  };
}

// WebSocket Connection Handler
wss.on("connection", (ws, req) => {
  const parsedUrl = url.parse(req.url || "", true);
  const { role, sessionId, salesId, name } = parsedUrl.query as {
    role?: string;
    sessionId?: string;
    salesId?: string;
    name?: string;
  };

  if (!role || !sessionId) {
    ws.send(JSON.stringify({ type: "ERROR", data: { message: "Missing role or sessionId parameters" } }));
    ws.close();
    return;
  }

  const connectionId = `${role}-${salesId || "org"}-${Math.random().toString(36).substring(2, 9)}`;

  // Retrieve or create session client map
  if (!sessionClients.has(sessionId)) {
    sessionClients.set(sessionId, new Map());
  }
  const clientsMap = sessionClients.get(sessionId)!;

  const clientInfo: ClientConn = {
    ws,
    role: role === "organiser" ? "organiser" : "participant",
    salesId,
    name,
    id: connectionId
  };

  clientsMap.set(connectionId, clientInfo);

  // If participant, manage DB record
  if (role === "participant" && salesId && name) {
    // 1. Prevent duplicates of salesId in the same session by mapping old connection id
    const existing = dbStore.getParticipantBySalesId(sessionId, salesId);
    let participantRecord: Participant;
    
    if (existing) {
      // Reconnection or session restoration
      existing.connectionStatus = "CONNECTED";
      // Update DB record ID to current connectionId for synchronization
      existing.id = connectionId;
      dbStore.addParticipant(existing);
      participantRecord = existing;
    } else {
      // Create new participant
      participantRecord = {
        id: connectionId,
        quizSessionId: sessionId,
        name,
        salesId,
        joinedAt: new Date().toISOString(),
        connectionStatus: "CONNECTED"
      };
      dbStore.addParticipant(participantRecord);
    }

    // Inform organisers of lobby change
    broadcastToSession(sessionId, {
      type: "LOBBY_UPDATE",
      data: {
        participants: dbStore.getParticipants(sessionId),
        session: dbStore.getSession(sessionId)!
      }
    });

    // Send individual state sync to participant
    const session = dbStore.getSession(sessionId);
    const quiz = session ? dbStore.getQuiz(session.quizId) : null;

    if (session && quiz) {
      if (session.status === "LOBBY") {
        ws.send(JSON.stringify({
          type: "PARTICIPANT_STATE",
          data: { state: "LOBBY", session }
        }));
      } else if (session.status === "ACTIVE") {
        const currentQuestion = quiz.questions[session.currentQuestionIndex];
        const participantAnswer = dbStore.getAnswer(participantRecord.id, currentQuestion.id) || null;
        
        ws.send(JSON.stringify({
          type: "PARTICIPANT_STATE",
          data: {
            state: "ACTIVE",
            session,
            currentQuestion: sanitizeQuestionForParticipant(currentQuestion),
            participantAnswer
          }
        }));
      } else if (session.status === "COMPLETED") {
        ws.send(JSON.stringify({
          type: "PARTICIPANT_STATE",
          data: { state: "COMPLETED", session }
        }));
      } else if (session.status === "LEADERBOARD_REVEALED") {
        const leaderboard = dbStore.calculateLeaderboard(sessionId, quiz);
        ws.send(JSON.stringify({
          type: "PARTICIPANT_STATE",
          data: {
            state: "LEADERBOARD_REVEALED",
            session,
            leaderboard: leaderboard.map(entry => ({
              ...entry,
              isCurrentUser: entry.participantId === participantRecord.id
            }))
          }
        }));
      }
    }
  } else if (role === "organiser") {
    // Send full organizer state on connect
    const session = dbStore.getSession(sessionId);
    if (session) {
      const quiz = dbStore.getQuiz(session.quizId);
      const participants = dbStore.getParticipants(sessionId);
      const leaderboard = (session.status === "LEADERBOARD_REVEALED" && quiz)
        ? dbStore.calculateLeaderboard(sessionId, quiz)
        : [];
      
      ws.send(JSON.stringify({
        type: "PARTICIPANT_STATE",
        data: {
          state: "ORGANISER_CONNECTED",
          session,
          participants,
          responseState: getResponseState(sessionId, quiz?.questions[session.currentQuestionIndex]?.id),
          leaderboard
        }
      }));
    }
  }

  // Handle incoming messages
  ws.on("message", (messageStr) => {
    try {
      const message = JSON.parse(messageStr.toString());
      if (message.type === "SUBMIT_ANSWER" && role === "participant" && salesId) {
        const { questionId, selectedOptionIds } = message.data;
        const session = dbStore.getSession(sessionId);
        if (!session || session.status !== "ACTIVE") return;

        const quiz = dbStore.getQuiz(session.quizId);
        if (!quiz) return;

        const currentQuestion = quiz.questions[session.currentQuestionIndex];
        if (!currentQuestion || currentQuestion.id !== questionId) return;

        const participantRecord = dbStore.getParticipantBySalesId(sessionId, salesId);
        if (!participantRecord) return;

        // Verify correct answer matching
        const correctOptions = currentQuestion.options.filter(o => o.isCorrect).map(o => o.id);
        const isSingle = currentQuestion.type === "SINGLE_CORRECT";

        let isCorrect = false;
        if (isSingle) {
          isCorrect = selectedOptionIds.length === 1 && correctOptions.includes(selectedOptionIds[0]);
        } else {
          // All correct options must be selected, and NO incorrect option selected
          const selectSet = new Set(selectedOptionIds);
          const correctSet = new Set(correctOptions);
          const hasAllCorrect = correctOptions.every(id => selectSet.has(id));
          const hasNoIncorrect = selectedOptionIds.every(id => correctSet.has(id));
          isCorrect = hasAllCorrect && hasNoIncorrect;
        }

        // Apply our precise timing algorithm
        const now = Date.now();
        const existingAnswer = dbStore.getAnswer(participantRecord.id, questionId);
        
        let newTimeTaken = 0;
        if (!existingAnswer) {
          // First submission
          const questionStartTime = session.startedAt ? new Date(session.startedAt).getTime() : now;
          newTimeTaken = now - questionStartTime;
          
          dbStore.saveAnswer({
            participantId: participantRecord.id,
            questionId,
            selectedOptionIds,
            isCorrect,
            timeTakenMs: newTimeTaken,
            firstShownAt: questionStartTime,
            lastAnsweredAt: now,
            isAnswered: true
          });
        } else {
          // Resubmitting/changing selection
          // Time taken since lastAnsweredAt gets accumulated
          const timeSinceLastAnswer = now - (existingAnswer.lastAnsweredAt || now);
          newTimeTaken = existingAnswer.timeTakenMs + timeSinceLastAnswer;
          
          dbStore.saveAnswer({
            ...existingAnswer,
            selectedOptionIds,
            isCorrect,
            timeTakenMs: newTimeTaken,
            lastAnsweredAt: now,
            isAnswered: true
          });
        }

        // Inform participant that answer was successfully saved (only sending their answer state, no correctness feedback)
        const savedAnswer = dbStore.getAnswer(participantRecord.id, questionId);
        ws.send(JSON.stringify({
          type: "PARTICIPANT_STATE",
          data: {
            state: "ACTIVE",
            session,
            currentQuestion: sanitizeQuestionForParticipant(currentQuestion),
            participantAnswer: savedAnswer
          }
        }));

        // Send real-time response counters to organiser
        const responseState = getResponseState(sessionId, currentQuestion.id);
        broadcastToOrganisers(sessionId, {
          type: "RESPONSE_UPDATE",
          data: responseState
        });
      }
    } catch (e) {
      console.error("WS Message Error", e);
    }
  });

  // Handle Disconnect
  ws.on("close", () => {
    clientsMap.delete(connectionId);
    if (role === "participant" && salesId) {
      // Wait a short duration to verify if they truly disconnected or just refreshed
      setTimeout(() => {
        const checkClient = Array.from(clientsMap.values()).find(c => c.salesId === salesId);
        if (!checkClient) {
          const participantRecord = dbStore.getParticipantBySalesId(sessionId, salesId);
          if (participantRecord) {
            dbStore.updateParticipantStatus(participantRecord.id, "DISCONNECTED");
            
            // Inform organiser of lobby update
            broadcastToSession(sessionId, {
              type: "LOBBY_UPDATE",
              data: {
                participants: dbStore.getParticipants(sessionId),
                session: dbStore.getSession(sessionId)!
              }
            });
          }
        }
      }, 3000);
    }
  });
});

// Admin Authentication Middleware
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader === `Bearer ${ADMIN_PASSWORD}`) {
    next();
  } else {
    res.status(401).json({ error: "Unauthorized. Invalid admin token." });
  }
}

// --- API Endpoints ---

// Login
app.post("/api/admin/login", (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ token: ADMIN_PASSWORD });
  } else {
    res.status(400).json({ error: "Invalid dashboard password" });
  }
});

// Download database
app.get("/api/admin/database", requireAdmin, (req, res) => {
  res.sendFile(path.join(process.cwd(), "data.json"));
});

// Quizzes CRUD
app.get("/api/quizzes", (req, res) => {
  res.json(dbStore.getQuizzes());
});

app.get("/api/quizzes/:id", (req, res) => {
  const quiz = dbStore.getQuiz(req.params.id);
  if (quiz) {
    res.json(quiz);
  } else {
    res.status(404).json({ error: "Quiz not found" });
  }
});

app.post("/api/quizzes", requireAdmin, (req, res) => {
  const { title, description, questions } = req.body;
  if (!title) {
    res.status(400).json({ error: "Quiz title is required" });
    return;
  }
  const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Math.random().toString(36).substring(2, 6);
  const newQuiz: Quiz = {
    id,
    title,
    description: description || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    questions: (questions || []).map((q: any, qi: number) => ({
      id: `q-${qi}-${Math.random().toString(36).substring(2, 6)}`,
      quizId: id,
      text: q.text,
      type: q.type || "SINGLE_CORRECT",
      orderIndex: qi,
      options: (q.options || []).map((o: any, oi: number) => ({
        id: `o-${qi}-${oi}-${Math.random().toString(36).substring(2, 6)}`,
        questionId: `q-${qi}`,
        text: o.text,
        isCorrect: !!o.isCorrect,
        orderIndex: oi
      }))
    }))
  };
  dbStore.saveQuiz(newQuiz);
  res.status(201).json(newQuiz);
});

app.put("/api/quizzes/:id", requireAdmin, (req, res) => {
  const { title, description, questions } = req.body;
  const quiz = dbStore.getQuiz(req.params.id);
  if (!quiz) {
    res.status(404).json({ error: "Quiz not found" });
    return;
  }

  quiz.title = title || quiz.title;
  quiz.description = description !== undefined ? description : quiz.description;
  if (questions) {
    quiz.questions = questions.map((q: any, qi: number) => {
      const qId = q.id || `q-${qi}-${Math.random().toString(36).substring(2, 6)}`;
      return {
        id: qId,
        quizId: quiz.id,
        text: q.text,
        type: q.type || "SINGLE_CORRECT",
        orderIndex: qi,
        options: q.options.map((o: any, oi: number) => ({
          id: o.id || `o-${qi}-${oi}-${Math.random().toString(36).substring(2, 6)}`,
          questionId: qId,
          text: o.text,
          isCorrect: !!o.isCorrect,
          orderIndex: oi
        }))
      };
    });
  }

  dbStore.saveQuiz(quiz);
  res.json(quiz);
});

app.delete("/api/quizzes/:id", requireAdmin, (req, res) => {
  dbStore.deleteQuiz(req.params.id);
  res.json({ success: true });
});

// History Endpoints
app.get("/api/admin/history", requireAdmin, (req, res) => {
  res.json(dbStore.getHistory());
});

app.delete("/api/admin/history/:id", requireAdmin, (req, res) => {
  dbStore.deleteHistoryEntry(req.params.id);
  res.json({ success: true });
});

app.delete("/api/admin/history", requireAdmin, (req, res) => {
  dbStore.clearAllHistory();
  res.json({ success: true });
});

// Quiz Session Manager
app.post("/api/sessions", (req, res) => {
  const { quizId } = req.body;
  const quiz = dbStore.getQuiz(quizId);
  if (!quiz) {
    res.status(404).json({ error: "Quiz not found" });
    return;
  }

  // Check if session already exists for this quiz, otherwise create a new one
  let sessionId = "";
  do {
    sessionId = Math.floor(10000 + Math.random() * 90000).toString();
  } while (dbStore.getSession(sessionId));

  const session: QuizSession = {
    id: sessionId,
    quizId,
    status: "LOBBY",
    currentQuestionIndex: 0,
    startedAt: null,
    completedAt: null,
    leaderboardRevealedAt: null
  };
  dbStore.saveSession(session);

  res.json(session);
});

// Get session details
app.get("/api/sessions/:id", (req, res) => {
  const session = dbStore.getSession(req.params.id);
  if (session) {
    res.json(session);
  } else {
    res.status(404).json({ error: "Session not found" });
  }
});

// Session Control Action
app.post("/api/sessions/:id/action", requireAdmin, (req, res) => {
  const session = dbStore.getSession(req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const { action } = req.body;
  const quiz = dbStore.getQuiz(session.quizId);
  if (!quiz) {
    res.status(404).json({ error: "Quiz not found" });
    return;
  }

  if (action === "START") {
    // Prune any disconnected participants before the quiz starts
    dbStore.removeDisconnectedParticipants(session.id);

    session.status = "ACTIVE";
    session.currentQuestionIndex = 0;
    session.startedAt = new Date().toISOString();
    dbStore.saveSession(session);

    // Broadcast to all participants to start
    const firstQuestion = quiz.questions[0];
    broadcastToSession(session.id, {
      type: "QUIZ_STARTED",
      data: {
        session,
        firstQuestion: sanitizeQuestionForParticipant(firstQuestion)
      }
    });
  } else if (action === "NEXT_QUESTION") {
    if (session.currentQuestionIndex < quiz.questions.length - 1) {
      session.currentQuestionIndex += 1;
      session.startedAt = new Date().toISOString(); // Reset start time for the next question timer
      dbStore.saveSession(session);

      const nextQuestion = quiz.questions[session.currentQuestionIndex];
      
      // Send targeted updates to participants with their previous answer state for this question (if any)
      const clients = sessionClients.get(session.id);
      if (clients) {
        for (const client of clients.values()) {
          if (client.role === "participant" && client.ws.readyState === WebSocket.OPEN) {
            const partRecord = dbStore.getParticipantBySalesId(session.id, client.salesId || "");
            const partAnswer = partRecord ? dbStore.getAnswer(partRecord.id, nextQuestion.id) || null : null;
            
            client.ws.send(JSON.stringify({
              type: "QUESTION_CHANGED",
              data: {
                session,
                question: sanitizeQuestionForParticipant(nextQuestion),
                participantAnswer: partAnswer
              }
            }));
          } else if (client.role === "organiser" && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify({
              type: "QUESTION_CHANGED",
              data: {
                session,
                question: nextQuestion, // Organizer gets complete question
                responseState: getResponseState(session.id, nextQuestion.id)
              }
            }));
          }
        }
      }
    }
  } else if (action === "FINISH") {
    session.status = "COMPLETED";
    session.completedAt = new Date().toISOString();
    dbStore.saveSession(session);

    // Archive session data
    dbStore.archiveSession(session.id);

    broadcastToSession(session.id, {
      type: "QUIZ_COMPLETED",
      data: { session }
    });
  } else if (action === "REVEAL") {
    session.status = "LEADERBOARD_REVEALED";
    session.leaderboardRevealedAt = new Date().toISOString();
    dbStore.saveSession(session);

    // Archive session data in case FINISH was skipped
    dbStore.archiveSession(session.id);

    const leaderboard = dbStore.calculateLeaderboard(session.id, quiz);

    // Broadcast targeted leaderboard to each participant
    const clients = sessionClients.get(session.id);
    if (clients) {
      for (const client of clients.values()) {
        if (client.ws.readyState === WebSocket.OPEN) {
          if (client.role === "participant") {
            const partRecord = dbStore.getParticipantBySalesId(session.id, client.salesId || "");
            const sanitizedLeaderboard = leaderboard.map(entry => ({
              ...entry,
              isCurrentUser: partRecord ? entry.participantId === partRecord.id : false
            }));
            client.ws.send(JSON.stringify({
              type: "LEADERBOARD_REVEALED",
              data: { leaderboard: sanitizedLeaderboard }
            }));
          } else {
            client.ws.send(JSON.stringify({
              type: "LEADERBOARD_REVEALED",
              data: { leaderboard }
            }));
          }
        }
      }
    }
  } else if (action === "RESET") {
    // Archive session data before clearing participants and resetting
    dbStore.archiveSession(session.id);

    // Generate new sessionId
    let newSessionId = "";
    do {
      newSessionId = Math.floor(10000 + Math.random() * 90000).toString();
    } while (dbStore.getSession(newSessionId));

    const newSession: QuizSession = {
      ...session,
      id: newSessionId,
      status: "LOBBY",
      currentQuestionIndex: 0,
      startedAt: null,
      completedAt: null,
      leaderboardRevealedAt: null
    };

    dbStore.saveSession(newSession);

    // Broadcast STOPPED to old session participants
    broadcastToSession(session.id, {
      type: "QUIZ_STOPPED"
    });
    
    // Clear old session participants and connections
    dbStore.clearAllParticipants(session.id);
    sessionClients.delete(session.id);
    
    // Return new session to AdminDashboard
    res.json(newSession);
    return;
  }

  res.json(session);
});

// Create and mount Vite middleware in development, or serve built assets in production
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

setupServer();
export default server;
