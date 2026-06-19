export type Archetype =
  | "greener"
  | "whale"
  | "troll"
  | "freeloader"
  | "greener_en"
  | "whale_en"
  | "troll_en"
  | "freeloader_en";

export interface AuthResponse {
  uid: string;
  email: string;
  role: string;
  verified: boolean;
  message: string;
}

export interface SessionInfo {
  id: string;
  operator_id: string | null;
  archetype: string;
  status: string;
  created_at: string;
  closed_at: string | null;
}

export interface FeedbackData {
  score: number;
  strengths: string;
  mistakes: string;
}

export interface ChatMessage {
  id?: string;
  type: "message" | "system" | "error";
  role: "user" | "assistant" | "system";
  content: string;
  action: { type: string; amount?: number } | null;
  feedback: FeedbackData | null;
}

export interface AIStatus {
  status: "online" | "offline" | "checking";
  model: string;
  base_url: string;
  error: string | null;
}

export interface OperatorInfo {
  id: string;
  email: string;
  name: string;
  role: string;
  verified: boolean;
  created_at: string;
}

export interface SessionWithResult {
  id: string;
  operator_id: string | null;
  archetype: string;
  status: string;
  created_at: string;
  closed_at: string | null;
  operator_email: string | null;
  operator_name: string | null;
  score: number | null;
  strengths: string | null;
  mistakes: string | null;
}
