export type QuestionType = "SINGLE_CORRECT" | "MULTIPLE_CORRECT";

export type SessionStatus = "LOBBY" | "ACTIVE" | "COMPLETED" | "LEADERBOARD_REVEALED";

export interface Option {
  id: string;
  questionId: string;
  text: string;
  isCorrect: boolean;
  orderIndex: number;
}

export interface Question {
  id: string;
  quizId: string;
  text: string;
  type: QuestionType;
  options: Option[];
  orderIndex: number;
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  questions: Question[];
}

export interface QuizSession {
  id: string;
  quizId: string;
  status: SessionStatus;
  currentQuestionIndex: number; // 0-based index
  startedAt: string | null;
  completedAt: string | null;
  leaderboardRevealedAt: string | null;
}

export interface Participant {
  id: string; // Socket ID or custom unique ID
  quizSessionId: string;
  name: string;
  salesId: string;
  joinedAt: string;
  connectionStatus: "CONNECTED" | "DISCONNECTED";
}

export interface ParticipantAnswer {
  participantId: string;
  questionId: string;
  selectedOptionIds: string[];
  isCorrect: boolean;
  timeTakenMs: number;
  firstShownAt: number;
  lastAnsweredAt: number | null;
  isAnswered: boolean;
}

export interface LeaderboardEntry {
  participantId: string;
  name: string;
  salesId: string;
  score: number;
  totalQuestions: number;
  totalTimeMs: number;
  rank: number;
  isCurrentUser?: boolean;
}

export interface ParticipantQuestionResponse {
  questionId: string;
  questionText: string;
  selectedOptionIds: string[];
  selectedOptionTexts: string[];
  isCorrect: boolean;
  timeTakenMs: number;
}

export interface ParticipantHistoryEntry {
  participantId: string;
  name: string;
  salesId: string;
  rank: number;
  score: number;
  totalQuestions: number;
  totalTimeMs: number;
  responses: ParticipantQuestionResponse[];
}

export interface QuizHistoryEntry {
  id: string;
  quizId: string;
  quizTitle: string;
  playedAt: string;
  participantsCount: number;
  participants: ParticipantHistoryEntry[];
}

// WebSocket Event Types
export type WsServerEvent =
  | { type: "LOBBY_UPDATE"; data: { participants: Participant[]; session: QuizSession } }
  | { type: "QUIZ_STARTED"; data: { session: QuizSession; firstQuestion: any } }
  | { type: "QUESTION_CHANGED"; data: { session: QuizSession; question: any; participantAnswer: ParticipantAnswer | null } }
  | { type: "RESPONSE_UPDATE"; data: { answeredCount: number; totalCount: number; answeredParticipants: string[] } }
  | { type: "QUIZ_COMPLETED"; data: { session: QuizSession } }
  | { type: "LEADERBOARD_REVEALED"; data: { leaderboard: LeaderboardEntry[] } }
  | { type: "ERROR"; data: { message: string } }
  | { type: "PARTICIPANT_STATE"; data: { state: string; session: QuizSession; currentQuestion?: any; participantAnswer?: ParticipantAnswer | null; leaderboard?: LeaderboardEntry[] } };

export type WsClientEvent =
  | { type: "JOIN_LOBBY"; data: { quizSessionId: string; name: string; salesId: string } }
  | { type: "RECONNECT_PARTICIPANT"; data: { quizSessionId: string; salesId: string } }
  | { type: "SUBMIT_ANSWER"; data: { quizSessionId: string; salesId: string; questionId: string; selectedOptionIds: string[] } };
