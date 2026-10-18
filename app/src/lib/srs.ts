import { CATS, QS, type Card, type Level } from "@/data"

export const MIN = 6e4
export const DAY = 864e5
export const LEVELS: Level[] = ["Basic", "Intermediate", "Advanced"]

export type Rating = "again" | "hard" | "good" | "easy"
export type ModeKey = "review" | "mixed" | "quiz" | "mock"
export type Pool = "due" | "new" | "weak" | "all"

export interface CardRec { ease: number; interval: number; due: number; reps: number; lapses: number; last?: Rating }
export interface Settings { recallBox: boolean; newPerDay: number; mockCount: number; mockSeconds: number }
export interface HistoryItem { day: string; mode: ModeKey; score: number; total: number }
export interface Progress {
  cards: Record<string, CardRec>
  streak: { day: string | null; count: number }
  today: { day: string | null; reviews: number; newSeen: number }
  history: HistoryItem[]
  settings: Settings
}
export interface Setup {
  mode: ModeKey; cats: string[]; levels: Level[]; pool: Pool; size: number | "all"
  recall: boolean; mockCount: number; mockSeconds: number
}

export const ALL_QS: Card[] = Object.values(QS).flat()
export const BY_ID: Record<string, Card> = Object.fromEntries(ALL_QS.map((q) => [q.id, q]))
export const CAT_OF: Record<string, string> = {}
for (const c of CATS) for (const q of QS[c]) CAT_OF[q.id] = c

export const MODES: Record<ModeKey, { name: string; kind: "cards" | "quiz" | "mock"; blurb: string; why: string }> = {
  review: { name: "Spaced review", kind: "cards", blurb: "Flashcards that come back right before you'd forget them.", why: "Rate how well you remembered: easy cards wait longer, hard ones return sooner." },
  mixed: { name: "Mixed review", kind: "cards", blurb: "Flashcards from several topics, shuffled together.", why: "Switching topics trains you to recognise which concept a question is really about." },
  quiz: { name: "Quiz", kind: "quiz", blurb: "Pick the right answer from options in the same topic.", why: "Close alternatives make you notice the details that separate similar concepts." },
  mock: { name: "Mock interview", kind: "mock", blurb: "Timed questions you answer out loud, then score yourself.", why: "Explaining under time pressure turns what you know into clear answers." },
}
export const POOLS: Record<Pool, string> = { due: "Due + new", new: "New", weak: "Weak", all: "All" }
export const DEFAULT_SETTINGS: Settings = { recallBox: false, newPerDay: 15, mockCount: 8, mockSeconds: 120 }

export function freshProgress(): Progress {
  return { cards: {}, streak: { day: null, count: 0 }, today: { day: null, reviews: 0, newSeen: 0 }, history: [], settings: { ...DEFAULT_SETTINGS } }
}

// --- scheduler (SM-2-lite) ---
export function schedule(card: Partial<CardRec> | undefined, rating: Rating, now: number): CardRec {
  const c: CardRec = { ease: 2.5, interval: 0, due: now, reps: 0, lapses: 0, ...card }
  if (rating === "again") {
    c.lapses++; c.ease = Math.max(1.3, c.ease - 0.2); c.interval = 0; c.reps = 0; c.due = now + 10 * MIN
  } else {
    let next: number
    if (rating === "hard") { next = Math.max(1, c.interval * 1.2); c.ease = Math.max(1.3, c.ease - 0.15) }
    else {
      next = c.reps === 0 ? 1 : c.reps === 1 ? 3 : c.interval * c.ease
      if (rating === "easy") { next = Math.max(next * 1.3, next + 1); c.ease += 0.15 }
    }
    c.interval = Math.max(1, Math.round(next)); c.reps++; c.due = now + c.interval * DAY
  }
  c.last = rating
  return c
}

// --- card state ---
export type CardState = "new" | "weak" | "due" | "mastered" | "learning"
export const isNew = (p: Progress, id: string) => !p.cards[id]
export const isDue = (p: Progress, id: string, now = Date.now()) => !!p.cards[id] && p.cards[id].due <= now
export const isMastered = (p: Progress, id: string) => !!p.cards[id] && p.cards[id].interval >= 21
export const isWeak = (p: Progress, id: string) => !!p.cards[id] && (p.cards[id].lapses >= 2 || p.cards[id].last === "again")
export function cardState(p: Progress, id: string): CardState {
  if (isNew(p, id)) return "new"
  if (isWeak(p, id)) return "weak"
  if (isDue(p, id)) return "due"
  if (isMastered(p, id)) return "mastered"
  return "learning"
}

// --- days, streaks, daily limits ---
export const dayKey = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` }
export const streakNow = (p: Progress) => (p.streak.day === dayKey() || p.streak.day === dayKey(Date.now() - DAY) ? p.streak.count : 0)
export const todayStats = (p: Progress) => (p.today.day === dayKey() ? p.today : { reviews: 0, newSeen: 0 })
export const newRoom = (p: Progress) => Math.max(0, p.settings.newPerDay - todayStats(p).newSeen)

export function withRating(p: Progress, id: string, rating: Rating): Progress {
  const n = structuredClone(p)
  const today = dayKey()
  if (n.today.day !== today) n.today = { day: today, reviews: 0, newSeen: 0 }
  if (n.streak.day !== today) n.streak = { day: today, count: n.streak.day === dayKey(Date.now() - DAY) ? n.streak.count + 1 : 1 }
  if (isNew(p, id)) n.today.newSeen++
  n.today.reviews++
  n.cards[id] = schedule(p.cards[id], rating, Date.now())
  return n
}

// --- session building ---
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

export function defaultSetup(p: Progress, mode: ModeKey, over: Partial<Setup> = {}): Setup {
  return {
    mode, cats: [...CATS], levels: [...LEVELS], pool: mode === "review" ? "due" : "all", size: mode === "quiz" ? 10 : 20,
    recall: p.settings.recallBox, mockCount: p.settings.mockCount, mockSeconds: p.settings.mockSeconds, ...over,
  }
}

export function candidates(p: Progress, s: Setup): Card[] {
  const now = Date.now()
  const qs = ALL_QS.filter((q) => s.cats.includes(CAT_OF[q.id]) && s.levels.includes(q.level))
  if (s.pool === "due") {
    const due = qs.filter((q) => isDue(p, q.id, now)).sort((a, b) => p.cards[a.id].due - p.cards[b.id].due)
    return [...due, ...qs.filter((q) => isNew(p, q.id)).slice(0, newRoom(p))]
  }
  if (s.pool === "new") return qs.filter((q) => isNew(p, q.id))
  if (s.pool === "weak") return qs.filter((q) => isWeak(p, q.id))
  return qs
}

// Interleaving: highest-priority card whose topic differs from the previous one.
export function interleave(p: Progress, qs: Card[]): Card[] {
  const tier = (q: Card) => (isDue(p, q.id) ? 0 : isWeak(p, q.id) ? 1 : isNew(p, q.id) ? 2 : 3)
  const rest = shuffle(qs).sort((a, b) => tier(a) - tier(b))
  const out: Card[] = []
  while (rest.length) {
    const prev = out.length ? CAT_OF[out[out.length - 1].id] : null
    let i = rest.findIndex((q) => CAT_OF[q.id] !== prev)
    if (i < 0) i = 0
    out.push(rest.splice(i, 1)[0])
  }
  return out
}

export function buildQueue(p: Progress, s: Setup): string[] {
  let qs = candidates(p, s)
  if (s.mode === "mixed") qs = interleave(p, qs)
  else if (s.pool !== "due") qs = shuffle(qs)
  const n = s.mode === "mock" ? s.mockCount : s.size
  return qs.slice(0, n === "all" ? qs.length : n).map((q) => q.id)
}

export interface Choice { text: string; correct: boolean }
export function getChoices(q: Card): Choice[] {
  const cat = CAT_OF[q.id]
  const same = shuffle(QS[cat].filter((x) => x.id !== q.id))
  const other = shuffle(ALL_QS.filter((x) => CAT_OF[x.id] !== cat))
  return shuffle<Choice>([{ text: q.short, correct: true }, ...[...same, ...other].slice(0, 3).map((x) => ({ text: x.short, correct: false }))])
}

// --- formatting ---
export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)
export function fmtIv(c: CardRec) {
  if (c.interval === 0) return "10 min"
  const d = c.interval
  if (d < 30) return `${d}d`
  if (d < 365) return `${+(d / 30).toFixed(1)}mo`
  return `${+(d / 365).toFixed(1)}y`
}
export function fmtWhen(t: number) {
  const d = t - Date.now()
  if (d <= 0) return "now"
  if (d < 60 * MIN) return `in ${Math.ceil(d / MIN)} min`
  if (d < DAY) return `in ${Math.round(d / (60 * MIN))} h`
  const days = Math.round(d / DAY)
  return days === 1 ? "tomorrow" : `in ${days} days`
}
export const fmtClock = (s: number) => { s = Math.max(0, s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` }
