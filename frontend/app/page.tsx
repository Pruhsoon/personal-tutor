"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BookOpen, User } from "lucide-react";
import { getTopicsByUser, getDueCardsCount, TopicSummary } from "@/lib/api";

export default function DashboardPage() {
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [dueCount, setDueCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [topicsData, dueData] = await Promise.all([
          getTopicsByUser(),
          getDueCardsCount(),
        ]);
        setTopics(topicsData);
        setDueCount(dueData.count);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* ── Top Navbar ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-slate-700" />
            <span className="text-lg font-semibold tracking-tight text-slate-900">
              Personal Learner
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-600">
            <User className="h-4 w-4" />
            <span>Profile</span>
          </div>
        </div>
      </header>

      {/* ── Main Content ───────────────────────────────────────── */}
      <main className="mx-auto max-w-5xl px-6 py-12">
        {/* Hero Section */}
        <section className="mb-12">
          {loading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-8 w-64 rounded bg-slate-100" />
              <div className="h-10 w-40 rounded bg-slate-100" />
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
              {error}
            </div>
          ) : (
            <>
              <h1 className="mb-2 text-3xl font-bold tracking-tight text-slate-900">
                {dueCount === 0
                  ? "All caught up!"
                  : `You have ${dueCount} card${dueCount === 1 ? "" : "s"} due today`}
              </h1>
              <p className="mb-6 text-slate-500">
                {dueCount === 0
                  ? "Your review queue is empty. Ingest new notes from Obsidian to create cards."
                  : `Across ${topics.length} topic${topics.length === 1 ? "" : "s"}. Ready to review?`}
              </p>
              <Button
                size="lg"
                disabled={dueCount === 0}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                Start Daily Review
              </Button>
            </>
          )}
        </section>

        {/* Topic Grid */}
        {!loading && !error && topics.length > 0 && (
          <section>
            <h2 className="mb-6 text-xl font-semibold text-slate-900">
              Your Topics
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {topics.map((topic) => (
                <Card
                  key={topic.id}
                  className="border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base font-semibold text-slate-900">
                        {topic.name}
                      </CardTitle>
                      {topic.cards_due > 0 && (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                          {topic.cards_due} due
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <div className="mb-1.5 flex justify-between text-xs text-slate-500">
                        <span>Mastery</span>
                        <span className="font-medium text-slate-700">
                          {topic.mastery_score.toFixed(0)}%
                        </span>
                      </div>
                      <Progress
                        value={topic.mastery_score}
                        className="h-2 bg-slate-100 [&>div]:bg-blue-600"
                      />
                    </div>
                    <p className="text-xs text-slate-400">
                      {topic.cards_total} card{topic.cards_total === 1 ? "" : "s"} total
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {!loading && !error && topics.length === 0 && (
          <section className="rounded-lg border border-dashed border-slate-200 p-12 text-center">
            <BookOpen className="mx-auto mb-3 h-8 w-8 text-slate-300" />
            <p className="text-slate-500">
              No topics yet. Ingest your first note from Obsidian to get started.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
