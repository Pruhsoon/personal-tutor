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

export interface Flashcard {
  id: string;
  user_id: string;
  topic_id: string;
  topic_name?: string;
  card_type: string;
  difficulty_level: number;
  front_content: string;
  back_content: string;
  extra_data: Record<string, unknown> | null;
  repetition_count: number;
  interval_days: number;
  ease_factor: number;
  next_review_date: string;
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

export function getDueFlashcards(userId?: string, topicId?: string): Promise<Flashcard[]> {
  const query = topicId ? `?topic_id=${topicId}` : "";
  return fetchApi<Flashcard[]>(`/api/flashcards/due/${userId || DEFAULT_USER_ID}${query}`);
}

export function submitReview(flashcardId: string, grade: number): Promise<void> {
  return fetchApi<void>(`/api/review/${flashcardId}`, {
    method: "PATCH",
    body: JSON.stringify({ grade }),
  });
}

export interface DailyProgress {
  date: string;
  count: number;
}

export function getUserProgress(userId?: string): Promise<DailyProgress[]> {
  return fetchApi<DailyProgress[]>(`/api/users/${userId || DEFAULT_USER_ID}/progress`);
}
