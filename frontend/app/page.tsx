"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BookOpen, User, Flame } from "lucide-react";
import { getTopicsByUser, getDueCardsCount, getUserProgress, TopicSummary, DailyProgress } from "@/lib/api";

const formatDateStr = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const getMonthName = (date: Date) => {
  return date.toLocaleDateString("en-US", { month: "short" });
};

export default function DashboardPage() {
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [dueCount, setDueCount] = useState<number>(0);
  const [progressData, setProgressData] = useState<DailyProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [topicsData, dueData, progress] = await Promise.all([
          getTopicsByUser(),
          getDueCardsCount(),
          getUserProgress(),
        ]);
        setTopics(topicsData);
        setDueCount(dueData.count);
        setProgressData(progress);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  // Generate calendar grid (30 weeks of progress)
  const today = new Date();
  const start = new Date(today.getTime() - 30 * 7 * 24 * 60 * 60 * 1000);
  const startDayOfWeek = start.getDay();
  start.setDate(start.getDate() - startDayOfWeek); // Adjust to Sunday

  const days: Date[] = [];
  const current = new Date(start);
  while (current <= today) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  const weeks: Date[][] = [];
  let currentWeek: Date[] = [];
  days.forEach((day) => {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });
  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  const progressMap = new Map<string, number>();
  progressData.forEach((item) => {
    progressMap.set(item.date, item.count);
  });

  const monthLabels: { label: string; index: number }[] = [];
  weeks.forEach((week, index) => {
    const firstDay = week[0];
    if (firstDay) {
      const monthName = getMonthName(firstDay);
      const lastLabel = monthLabels[monthLabels.length - 1];
      if (!lastLabel || lastLabel.label !== monthName) {
        monthLabels.push({ label: monthName, index });
      }
    }
  });

  // Calculate streaks
  let currentStreak = 0;
  let maxStreak = 0;

  const reviewedDatesSet = new Set(progressData.filter((d) => d.count > 0).map((d) => d.date));
  let streakCheck = new Date();
  const todayStr = formatDateStr(streakCheck);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatDateStr(yesterday);

  if (reviewedDatesSet.has(todayStr) || reviewedDatesSet.has(yesterdayStr)) {
    if (!reviewedDatesSet.has(todayStr)) {
      streakCheck = yesterday;
    }
    while (reviewedDatesSet.has(formatDateStr(streakCheck))) {
      currentStreak++;
      streakCheck.setDate(streakCheck.getDate() - 1);
    }
  }

  const uniqueReviewedDates = Array.from(reviewedDatesSet).sort();
  if (uniqueReviewedDates.length > 0) {
    let prevDate: Date | null = null;
    let currentMax = 0;
    uniqueReviewedDates.forEach((dateStr) => {
      const curDate = new Date(dateStr);
      if (prevDate === null) {
        currentMax = 1;
      } else {
        const diffTime = Math.abs(curDate.getTime() - prevDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          currentMax++;
        } else if (diffDays > 1) {
          if (currentMax > maxStreak) maxStreak = currentMax;
          currentMax = 1;
        }
      }
      prevDate = curDate;
    });
    if (currentMax > maxStreak) maxStreak = currentMax;
  }

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
          <div className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-600">
            <User className="h-4 w-4" />
            <span>Profile</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        {/* Top Section: Greeting & Quick Actions */}
        <section className="mb-8">
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 animate-fade-in">
                  {dueCount === 0
                    ? "All caught up!"
                    : `You have ${dueCount} card${dueCount === 1 ? "" : "s"} due today`}
                </h1>
                <p className="text-slate-500 mt-1">
                  {dueCount === 0
                    ? "Your review queue is empty. Ingest new notes from Obsidian to create cards."
                    : `Across ${topics.length} topic${topics.length === 1 ? "" : "s"}. Ready to review?`}
                </p>
              </div>
              <div>
                {dueCount > 0 ? (
                  <Link href="/review">
                    <Button size="lg" className="bg-slate-900 text-white hover:bg-slate-800 shadow-sm transition-colors">
                      Start Daily Review
                    </Button>
                  </Link>
                ) : (
                  <Button size="lg" disabled className="bg-slate-200 text-slate-400 cursor-not-allowed">
                    Start Daily Review
                  </Button>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Progress Calendar Heatmap */}
        {!loading && !error && (
          <section className="mb-12">
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-slate-950 flex items-center gap-2">
                    <Flame className="h-4.5 w-4.5 text-orange-500 fill-orange-500 animate-pulse" />
                    Review Activity
                  </CardTitle>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <span className="font-semibold text-slate-700">Total:</span> {progressData.reduce((acc, c) => acc + c.count, 0)} reviews
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="font-semibold text-slate-700">Streak:</span> {currentStreak} days
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid gap-6 md:grid-cols-4 items-center">
                  <div className="md:col-span-1 flex md:flex-col justify-around gap-4 border-b md:border-b-0 md:border-r border-slate-100 pb-4 md:pb-0 md:pr-4">
                    <div className="text-center md:text-left">
                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Current Streak</p>
                      <p className="text-xl font-bold text-orange-600 flex items-center justify-center md:justify-start gap-1 mt-0.5">
                        {currentStreak} days
                      </p>
                    </div>
                    <div className="text-center md:text-left">
                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Longest Streak</p>
                      <p className="text-xl font-bold text-slate-700 mt-0.5">{maxStreak} days</p>
                    </div>
                  </div>
                  
                  <div className="md:col-span-3 overflow-x-auto pb-2">
                    <div className="min-w-[400px] flex flex-col">
                      {/* Month labels */}
                      <div className="relative h-4 text-[9px] text-slate-400 mb-1 select-none" style={{ marginLeft: "28px" }}>
                        {monthLabels.map((lbl, idx) => (
                          <span
                            key={idx}
                            className="absolute"
                            style={{ left: `${lbl.index * 12}px` }}
                          >
                            {lbl.label}
                          </span>
                        ))}
                      </div>
                      
                      {/* Grid with Weekday labels */}
                      <div className="flex items-start">
                        <div className="flex flex-col justify-between text-[9px] text-slate-400 pr-2 h-[82px] pt-[2px] w-[20px] text-right">
                          <span>Mon</span>
                          <span>Wed</span>
                          <span>Fri</span>
                        </div>
                        
                        <div className="flex gap-0.5 select-none">
                          {weeks.map((week, wIdx) => (
                            <div key={wIdx} className="flex flex-col gap-0.5">
                              {week.map((day, dIdx) => {
                                const dateStr = formatDateStr(day);
                                const count = progressMap.get(dateStr) || 0;
                                let color = "bg-slate-100";
                                if (count > 0 && count <= 3) color = "bg-emerald-100 hover:bg-emerald-200";
                                else if (count > 3 && count <= 6) color = "bg-emerald-300 hover:bg-emerald-400";
                                else if (count > 6 && count <= 10) color = "bg-emerald-500 hover:bg-emerald-600";
                                else if (count > 10) color = "bg-emerald-700 hover:bg-emerald-800";
                                
                                return (
                                  <div
                                    key={dIdx}
                                    className={`h-[10px] w-[10px] rounded-[1.5px] transition-colors cursor-pointer ${color}`}
                                    title={`${count} review${count === 1 ? "" : "s"} on ${day.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                                  />
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* Legend */}
                      <div className="flex justify-end items-center gap-1.5 mt-3 text-[9px] text-slate-400 select-none">
                        <span>Less</span>
                        <div className="h-2 w-2 rounded-[1px] bg-slate-100" />
                        <div className="h-2 w-2 rounded-[1px] bg-emerald-100" />
                        <div className="h-2 w-2 rounded-[1px] bg-emerald-300" />
                        <div className="h-2 w-2 rounded-[1px] bg-emerald-500" />
                        <div className="h-2 w-2 rounded-[1px] bg-emerald-700" />
                        <span>More</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Topics Section */}
        {!loading && !error && topics.length > 0 && (
          <section>
            <h2 className="mb-6 text-xl font-semibold text-slate-900">
              Your Topics
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {topics.map((topic) => (
                <Link key={topic.id} href={`/review?topicId=${topic.id}`} className="block">
                  <Card
                    className="border-slate-200 bg-white shadow-sm transition-all hover:shadow-md hover:border-slate-300 cursor-pointer h-full"
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base font-semibold text-slate-950">
                          {topic.name}
                        </CardTitle>
                        {topic.cards_due > 0 && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
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
                          className="h-2 bg-slate-100 [&>div]:bg-slate-700"
                        />
                      </div>
                      <p className="text-xs text-slate-400">
                        {topic.cards_total} card{topic.cards_total === 1 ? "" : "s"} total
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

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
