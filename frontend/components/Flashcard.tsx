"use client";

import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Flashcard, submitReview } from "@/lib/api";

interface CodeMCQExtra {
  language: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

interface Props {
  card: Flashcard;
  onReviewComplete: () => void;
}

const GRADE_LABELS: Record<number, string> = {
  1: "Again",
  2: "Hard",
  3: "Good",
  4: "Easy",
};

const GRADE_STYLES: Record<number, string> = {
  1: "border-red-200 bg-red-50 text-red-800 hover:bg-red-100",
  2: "border-orange-200 bg-orange-50 text-orange-800 hover:bg-orange-100",
  3: "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
  4: "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100",
};

function isCodeMCQ(card: Flashcard): boolean {
  return card.card_type === "code_mcq";
}

function parseExtraData(card: Flashcard): CodeMCQExtra | null {
  if (!card.extra_data || !isCodeMCQ(card)) return null;
  const extra = card.extra_data as unknown as CodeMCQExtra;
  if (!extra.options || extra.correct_index === undefined) return null;
  return extra;
}

export default function FlashcardComponent({ card, onReviewComplete }: Props) {
  const [revealed, setRevealed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const extra = parseExtraData(card);

  async function handleGrade(grade: number) {
    if (submitting) return;
    setSubmitting(true);
    try {
      await submitReview(card.id, grade);
      onReviewComplete();
    } catch {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full">
      {/* ── Card Face ──────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        {card.topic_name && (
          <div className="mb-4 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
            <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">
              {card.topic_name}
            </span>
          </div>
        )}
        {isCodeMCQ(card) && extra ? (
          <CodeMCQFace
            card={card}
            extra={extra}
            revealed={revealed}
            onReveal={() => setRevealed(true)}
          />
        ) : (
          <StandardFace
            card={card}
            revealed={revealed}
            onReveal={() => setRevealed(true)}
          />
        )}
      </div>

      {/* ── Action Bar ──────────────────────────────────────────── */}
      {revealed && (
        <div className="mt-6 flex gap-3">
          {([1, 2, 3, 4] as const).map((grade) => (
            <button
              key={grade}
              disabled={submitting}
              onClick={() => handleGrade(grade)}
              className={`flex-1 rounded-lg border px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-50 ${GRADE_STYLES[grade]}`}
            >
              {GRADE_LABELS[grade]} ({grade})
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Standard Card ──────────────────────────────────────────────────────── */

function StandardFace({
  card,
  revealed,
  onReveal,
}: {
  card: Flashcard;
  revealed: boolean;
  onReveal: () => void;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-400">
        Question
      </p>
      <div className="prose prose-slate max-w-none text-slate-900">
        <p className="text-lg leading-relaxed whitespace-pre-wrap">
          {card.front_content}
        </p>
      </div>

      {!revealed ? (
        <button
          onClick={onReveal}
          className="mt-6 rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          Show Answer
        </button>
      ) : (
        <>
          <hr className="my-6 border-slate-200" />
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-400">
            Answer
          </p>
          <div className="prose prose-slate max-w-none text-slate-900">
            <p className="text-lg leading-relaxed whitespace-pre-wrap">
              {card.back_content}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Code MCQ Card ──────────────────────────────────────────────────────── */

function CodeMCQFace({
  card,
  extra,
  revealed,
  onReveal,
}: {
  card: Flashcard;
  extra: CodeMCQExtra;
  revealed: boolean;
  onReveal: () => void;
}) {
  return (
    <div>
      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-400">
        Code Question
      </p>

      <div className="mb-6 overflow-x-auto rounded-lg border border-slate-200 show-scrollbar">
        <SyntaxHighlighter
          language={extra.language || "text"}
          style={oneLight}
          customStyle={{
            margin: 0,
            borderRadius: 0,
            fontSize: "0.875rem",
            lineHeight: 1.6,
            minWidth: "max-content",
          }}
          showLineNumbers
        >
          {card.front_content}
        </SyntaxHighlighter>
      </div>

      <div className="space-y-2">
        {extra.options.map((option, idx) => {
          const isCorrect = idx === extra.correct_index;
          let optionStyle =
            "border-slate-200 bg-white text-slate-700 hover:bg-slate-50";

          if (revealed) {
            optionStyle = isCorrect
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : "border-slate-100 bg-slate-50 text-slate-400";
          }

          return (
            <div
              key={idx}
              className={`rounded-lg border px-4 py-3 text-sm transition-colors ${optionStyle}`}
            >
              <span className="mr-2 font-semibold text-slate-400">
                {String.fromCharCode(65 + idx)}.
              </span>
              {option}
              {revealed && isCorrect && (
                <span className="ml-2 text-xs font-bold text-emerald-600">
                  ✓ Correct
                </span>
              )}
            </div>
          );
        })}
      </div>

      {!revealed ? (
        <button
          onClick={onReveal}
          className="mt-6 rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          Show Answer
        </button>
      ) : (
        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-400">
            Explanation
          </p>
          <p className="text-sm leading-relaxed text-slate-700">
            {extra.explanation}
          </p>
        </div>
      )}
    </div>
  );
}
