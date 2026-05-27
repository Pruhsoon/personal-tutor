const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
const DEFAULT_USER_ID = process.env.NEXT_PUBLIC_DEFAULT_USER_ID || "your-user-uuid-here";

export interface TopicSummary {
  id: string;
  user_id: string;
  name: string;
  obsidian_file_path: string | null;
  created_at: string;
  mastery_score: number;
  cards_total: number;
  cards_due: number;
}

export interface DueCardsCount {
  count: number;
}

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

export function getTopicsByUser(userId?: string): Promise<TopicSummary[]> {
  return fetchApi<TopicSummary[]>(`/api/topics/by-user/${userId || DEFAULT_USER_ID}`);
}

export function getDueCardsCount(userId?: string): Promise<DueCardsCount> {
  return fetchApi<DueCardsCount>(`/api/flashcards/due/count/${userId || DEFAULT_USER_ID}`);
}

export function getDueFlashcards(userId?: string) {
  return fetchApi(`/api/flashcards/due/${userId || DEFAULT_USER_ID}`);
}
