"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BookOpen } from "lucide-react";
import { getDueFlashcards, Flashcard } from "@/lib/api";
import FlashcardComponent from "@/components/Flashcard";

function ReviewContent() {
  const searchParams = useSearchParams();
  const topicId = searchParams.get("topicId") || undefined;
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCards() {
      try {
        const due = await getDueFlashcards(undefined, topicId);
        setCards(due);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load flashcards");
      } finally {
        setLoading(false);
      }
    }
    loadCards();
  }, [topicId]);

  function handleReviewComplete() {
    setCurrentIndex((prev) => prev + 1);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="animate-pulse space-y-4 text-center">
          <div className="mx-auto h-6 w-48 rounded bg-slate-100" />
          <div className="mx-auto h-4 w-32 rounded bg-slate-100" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-6">
        <div className="max-w-md text-center">
          <p className="mb-2 text-lg font-semibold text-red-700">
            Something went wrong
          </p>
          <p className="mb-6 text-sm text-slate-500">{error}</p>
          <Link
            href="/"
            className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (currentIndex >= cards.length) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-6">
        <div className="max-w-md text-center">
          <BookOpen className="mx-auto mb-4 h-10 w-10 text-slate-300" />
          <h1 className="mb-2 text-2xl font-bold text-slate-900">
            You&apos;re all caught up for today!
          </h1>
          <p className="mb-6 text-sm text-slate-500">
            Come back tomorrow for your next review. Keep your Obsidian notes
            synced to get new cards.
          </p>
          <Link
            href="/"
            className="inline-block rounded-lg bg-slate-900 px-6 py-3 text-sm font-medium text-white hover:bg-slate-800"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const card = cards[currentIndex];

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-slate-700" />
            <span className="text-lg font-semibold tracking-tight text-slate-900">
              Personal Learner
            </span>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
          >
            Exit Review
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-12">
        <div className="mb-6 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Card {currentIndex + 1} of {cards.length}
          </p>
          <div className="h-1.5 flex-1 mx-4 rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-slate-400 transition-all duration-300"
              style={{
                width: `${((currentIndex + 1) / cards.length) * 100}%`,
              }}
            />
          </div>
        </div>

        <FlashcardComponent key={card.id} card={card} onReviewComplete={handleReviewComplete} />
      </main>
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="animate-pulse space-y-4 text-center">
          <div className="mx-auto h-6 w-48 rounded bg-slate-100" />
          <div className="mx-auto h-4 w-32 rounded bg-slate-100" />
        </div>
      </div>
    }>
      <ReviewContent />
    </Suspense>
  );
}
