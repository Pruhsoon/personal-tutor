# Frontend Documentation

The frontend is a **Next.js 14** application using the **App Router**, **TypeScript**, **Tailwind CSS**, and **shadcn/ui** components. It provides the dashboard, flashcard review room, and all user-facing UI.

---

## Architecture Overview

```
frontend/
├── app/
│   ├── globals.css              # Global CSS, design tokens, scrollbar styling
│   ├── layout.tsx               # Root layout (Inter font, metadata)
│   ├── page.tsx                 # Dashboard home page (357 lines)
│   └── review/
│       └── page.tsx             # Study Room / flashcard review page
├── components/
│   ├── Flashcard.tsx            # Flashcard renderer (standard + code MCQ)
│   └── ui/
│       ├── button.tsx           # shadcn Button (cva variants)
│       ├── card.tsx             # shadcn Card, CardHeader, CardTitle, CardContent
│       └── progress.tsx         # shadcn Progress bar
├── lib/
│   ├── api.ts                   # API client layer (fetch functions + types)
│   └── utils.ts                 # Tailwind class merging utility (cn)
├── .env.local                   # Frontend env vars (API base URL, user ID)
├── tailwind.config.ts           # Tailwind config with shadcn color tokens
├── package.json                 # Dependencies
├── postcss.config.js
├── next.config.mjs
└── tsconfig.json
```

### Technology Stack

| Component | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5.4 |
| Styling | Tailwind CSS 3.4 + shadcn/ui design tokens |
| Components | shadcn/ui (Button, Card, Progress) + Radix UI primitives |
| Icons | Lucide React |
| Syntax highlighting | `react-syntax-highlighter` (Prism + oneLight theme) |
| State | React `useState` / `useEffect` (no external state library) |
| Routing | Next.js App Router + `useSearchParams` |

---

## Design System (`app/globals.css`)

### Color Palette (HSL Design Tokens)

All colors are defined as CSS custom properties on `:root` under `@layer base`. The app uses a **light-only theme** — no dark mode.

| Token | HSL Value | Usage |
|---|---|---|
| `--background` | `0 0% 100%` | Pure white page background |
| `--foreground` | `222.2 84% 4.9%` | Near-black text |
| `--card` | `0 0% 100%` | White card surface |
| `--card-foreground` | `222.2 84% 4.9%` | Card text |
| `--primary` | `221.2 83.2% 53.3%` | **Blue** (#3b82f6) — scrollbar, focus rings |
| `--primary-foreground` | `210 40% 98%` | White text on primary |
| `--secondary` | `210 40% 96.1%` | Light blue-gray background |
| `--secondary-foreground` | `222.2 47.4% 11.2%` | Dark text on secondary |
| `--muted` | `210 40% 96.1%` | Same as secondary |
| `--muted-foreground` | `215.4 16.3% 46.9%` | Gray subdued text |
| `--accent` | `210 40% 96.1%` | Same as secondary |
| `--destructive` | `0 84.2% 60.2%` | Red for destructive actions |
| `--border` | `214.3 31.8% 91.4%` | Light gray borders |
| `--input` | `214.3 31.8% 91.4%` | Input field borders |
| `--ring` | `221.2 83.2% 53.3%` | Focus ring (matches primary blue) |

### Tailwind Config

The `tailwind.config.ts` maps each semantic token to a Tailwind color utility:

```typescript
colors: {
  border: "hsl(var(--border))",
  primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
  secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
  // ... etc for muted, accent, destructive, card, popover, background, foreground
}
```

### Typography

- **Font:** Inter (Google Font, loaded via `next/font/google`)
- **Body:** `bg-white text-slate-900 antialiased`
- **Font features:** `"rlig" 1, "calt" 1` (stylistic ligatures + contextual alternates)

### Scrollbar Design

The scrollbar is a key visual element, strictly controlled:

- **Main page scrollbar (`html`):** Blue thumb (`#3b82f6`) on slate-100 track (`#f1f5f9`), 8px wide, with darker blue hover (`#2563eb`). Uses both `scrollbar-width: thin` (Firefox) and `::-webkit-scrollbar` (Chrome/Edge).
- **Nested scrollbars:** Hidden by default — `body *:not(.show-scrollbar)` has `scrollbar-width: none` and `::-webkit-scrollbar { display: none }`.
- **`.show-scrollbar` elements:** Only elements explicitly given this class get visible scrollbars, styled identically to the main scrollbar (blue thumb on slate-100 track).

This ensures exactly **one scrollbar** is visible at a time — the main page scrollbar — unless an element (like the code block in the flashcard component) opts in.

### shadcn/ui Components

All three UI components follow shadcn patterns: `React.forwardRef` with `cn()` for className merging.

**Button** (`components/ui/button.tsx`):
- Uses `cva` (class-variance-authority) for variants: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`
- Sizes: `default`, `sm`, `lg`, `icon`
- Renders as `<button>` or as a child via Radix `Slot` (`asChild`)

**Card** (`components/ui/card.tsx`):
- `Card`: `rounded-xl border border-slate-200 bg-white text-slate-950 shadow`
- `CardHeader`: `flex flex-col space-y-1.5 p-6`
- `CardTitle`: `font-semibold leading-none tracking-tight`
- `CardContent`: `p-6 pt-0`

**Progress** (`components/ui/progress.tsx`):
- Wraps Radix `ProgressPrimitive.Root` and `ProgressPrimitive.Indicator`
- Default styling: `h-2 rounded-full bg-slate-900/20` with indicator `bg-slate-900`

---

## Pages

### Dashboard (`app/page.tsx`)

The home page. A `"use client"` component that fetches data on mount.

**States handled:**
- **Loading:** Animated pulse placeholders
- **Error:** Red error card with message
- **Empty:** Dashed border empty state with `BookOpen` icon
- **Normal:** Full dashboard with all sections

**Data fetching** (parallel, via `Promise.all`):

```typescript
const [topicsData, dueData, progress] = await Promise.all([
  getTopicsByUser(),        // GET /api/topics/by-user/{user_id}
  getDueCardsCount(),       // GET /api/flashcards/due/count/{user_id}
  getUserProgress(),        // GET /api/users/{user_id}/progress
]);
```

#### Layout (from top to bottom):

**1. Header (sticky)**
- Logo: `BookOpen` icon + "Personal Learner" text
- Profile placeholder: rounded pill with `User` icon
- Glass-morphism: `bg-white/80 backdrop-blur-sm`

**2. Hero Section**
- Dynamic heading: "You have X cards due today" (or "All caught up!" if zero)
- Subtitle with topic count
- **Start Daily Review** button — links to `/review` if cards are due, disabled otherwise
- Uses direct Tailwind classes: `bg-slate-900 text-white hover:bg-slate-800` (NOT blue — follows the restrained color palette rule)

**3. Review Activity Card (Calendar Heatmap)**
- Displays a custom-built **GitHub-style contribution heatmap**
- 30 weeks of data, each day rendered as a 10×10px colored box
- Color scale based on review count:
  - `0`: `bg-slate-100` (empty)
  - `1-3`: `bg-emerald-100`
  - `4-6`: `bg-emerald-300`
  - `7-10`: `bg-emerald-500`
  - `10+`: `bg-emerald-700`
- Month labels above the grid
- Weekday labels: Mon, Wed, Fri on the left
- Color legend: "Less" to "More" scale at bottom-right
- Stats sidebar: **Current Streak** (orange, with flame icon) and **Longest Streak**

**Streak calculation logic:**
- Builds a `Set` of dates with reviews > 0
- Current streak: counts consecutive days backward from today (or yesterday if today has no reviews)
- Max streak: iterates sorted dates, resets counter on gaps > 1 day

**4. Topic Grid**
- Heading: "Your Topics"
- Responsive grid: 1 col on mobile, 2 on sm, 3 on lg
- Each topic card links to `/review?topicId={topic.id}`
- Shows: topic name, cards due badge (if > 0), progress bar (mastery %), total cards count
- Hover effect: `shadow-md` + border darkening

### Review Page (`app/review/page.tsx`)

The Study Room. A `"use client"` component wrapped in `<Suspense>` for `useSearchParams`.

**URL parameter:** `?topicId=<UUID>` (optional — filters cards to a specific topic)

**States handled:**
- **Suspense fallback:** Animated pulse skeleton
- **Loading:** Pulse skeleton
- **Error:** Red error card with "Back to Dashboard" link
- **Empty (all caught up):** "You're all caught up for today!" with `BookOpen` icon and dashboard link
- **Reviewing:** Card display with progress bar

#### Layout:

**Header:**
- Same as dashboard — logo + "Personal Learner"
- "Exit Review" link (returns to dashboard)

**Progress Bar:**
- `Card {n} of {total}` with a thin horizontal track (`bg-slate-100`) and fill (`bg-slate-400`)
- Width transitions smoothly via `transition-all duration-300`

**Flashcard Area:**
- The `FlashcardComponent` renders the current card
- When user grades, `onReviewComplete` increments `currentIndex`
- `key={card.id}` forces re-mount (clean state reset) on card change

**Completion:**
- When `currentIndex >= cards.length`: shows completion screen

---

## Flashcard Component (`components/Flashcard.tsx`)

The core study component. Handles two card types: **standard** (Q&A) and **code_mcq** (code multiple-choice).

### Props

```typescript
interface Props {
  card: Flashcard;
  onReviewComplete: () => void;
}
```

The parent (review page) is responsible for advancing to the next card — this component only handles rendering and grade submission for a single card.

### State

| State | Type | Purpose |
|---|---|---|
| `revealed` | `boolean` | Whether the answer is shown |
| `submitting` | `boolean` | Prevents double-clicks during API call |

### Card Type Detection

```typescript
function isCodeMCQ(card: Flashcard): boolean {
  return card.card_type === "code_mcq";
}
```

The `extra_data` field is parsed from the API response and cast to `CodeMCQExtra`:
```typescript
interface CodeMCQExtra {
  language: string;
  options: string[];
  correct_index: number;
  explanation: string;
}
```

### Standard Card Face

- **Before reveal:** Shows `front_content` (the question) with a **"Show Answer"** button
- **After reveal:** Shows a horizontal divider, then `back_content` (the answer)
- Typography: `text-lg leading-relaxed whitespace-pre-wrap` for readability

### Code MCQ Card Face

- **Code display:** `SyntaxHighlighter` from `react-syntax-highlighter` using the `oneLight` theme (Prism)
  - Language dynamically set from `extra.language`
  - Inline style: `fontSize: "0.875rem"`, `lineHeight: 1.6`, line numbers enabled
  - Wrapped in a horizontal scroll container with `overflow-x-auto show-scrollbar` (the blue scrollbar)
- **Options:** Rendered as styled divs with letter labels (A, B, C, D)
  - Before reveal: neutral style, hover effect
  - After reveal: correct option highlighted in emerald green with "✓ Correct" badge; incorrect options dimmed
- **Explanation:** Revealed in a gray box (`bg-slate-50 border-slate-200`) after clicking "Show Answer"

### Grade Action Bar

After reveal, four grade buttons appear:

| Grade | Label | Style |
|---|---|---|
| 1 | Again | Red (`border-red-200 bg-red-50 text-red-800`) |
| 2 | Hard | Orange (`border-orange-200 bg-orange-50 text-orange-800`) |
| 3 | Good | Emerald (`border-emerald-200 bg-emerald-50 text-emerald-800`) |
| 4 | Easy | Sky (`border-sky-200 bg-sky-50 text-sky-800`) |

Clicking a button:
1. Sets `submitting = true` (disables all buttons)
2. Calls `submitReview(card.id, grade)` → `PATCH /api/review/{flashcard_id}`
3. On success: calls `onReviewComplete()` → parent advances to next card
4. On failure: re-enables buttons for retry

---

## API Client Layer (`lib/api.ts`)

A central module for all backend communication. Uses the native `fetch` API with a generic wrapper.

### Configuration

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
const DEFAULT_USER_ID = process.env.NEXT_PUBLIC_DEFAULT_USER_ID || "your-user-uuid-here";
```

Read from `.env.local`:
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_DEFAULT_USER_ID=c2b27bf8-40d5-4015-9023-7aea7c615495
```

### Generic Fetch Wrapper

```typescript
async function fetchApi<T>(path: string, options?: RequestInit): Promise<T>
```

- Prepends `API_BASE` to all paths
- Sets `Content-Type: application/json`
- Throws on non-OK responses with status and body text
- Returns parsed JSON cast to generic type `T`

### Exported Functions

| Function | Method | Endpoint | Returns |
|---|---|---|---|
| `getTopicsByUser(userId?)` | GET | `/api/topics/by-user/{userId}` | `TopicSummary[]` |
| `getDueCardsCount(userId?)` | GET | `/api/flashcards/due/count/{userId}` | `DueCardsCount` |
| `getDueFlashcards(userId?, topicId?)` | GET | `/api/flashcards/due/{userId}?topic_id={topicId}` | `Flashcard[]` |
| `submitReview(flashcardId, grade)` | PATCH | `/api/review/{flashcardId}` | `void` |
| `getUserProgress(userId?)` | GET | `/api/users/{userId}/progress` | `DailyProgress[]` |

### TypeScript Interfaces

| Interface | Fields |
|---|---|
| `TopicSummary` | `id, user_id, name, obsidian_file_path, created_at, mastery_score, cards_total, cards_due` |
| `DueCardsCount` | `count: number` |
| `Flashcard` | All flashcard fields + `topic_name?` |
| `DailyProgress` | `date: string, count: number` |

---

## Utility (`lib/utils.ts`)

The standard shadcn/ui `cn()` utility:
```typescript
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```
Combines `clsx` (conditional class joining) with `tailwind-merge` (deduplicates conflicting Tailwind classes).

---

## Running the Frontend

### Setup

```bash
cd frontend
npm install

# Configure environment
# .env.local should already exist with:
#   NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
#   NEXT_PUBLIC_DEFAULT_USER_ID=<your-user-uuid>
```

### Development

```bash
npm run dev
# Starts on http://localhost:3000
```

### Production Build

```bash
npm run build
npm start
```

---

## Navigation Flow

```
Dashboard (/)
    │
    ├─ "Start Daily Review" → /review (all due cards)
    │                              │
    │                              ├─ Study cards one by one
    │                              ├─ Grade each card (1-4)
    │                              └─ "All caught up" → Back to /
    │
    └─ Click a topic card → /review?topicId={id} (filtered to that topic)
                                  │
                                  └─ Same flow as above
```
