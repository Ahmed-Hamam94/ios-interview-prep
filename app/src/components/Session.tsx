import { useEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronLeft, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { BY_ID, CAT_OF, MODES, dayKey, fmtClock, fmtIv, getChoices, pct, schedule, type ModeKey, type Progress as ProgressData, type Rating, type Setup } from "@/lib/srs"
import { useProgress } from "@/lib/progress"
import { CodeBlock, LevelBadge, StatusBadge, TopicScope, TopicTag } from "@/components/common"
import { cn } from "@/lib/utils"

export interface Result { id: string; rating: Rating; ms: number }
export interface Summary { mode: ModeKey; total: number; score: number; counts: Record<Rating, number>; firsts: Result[]; mistakes: string[] }

interface Props { setup: Setup; queue: string[]; onFinish: (s: Summary) => void; onExit: () => void }

const RATE_STYLE: Record<Rating, string> = {
  again: "bg-danger-bg text-danger", hard: "bg-warning-bg text-warning", good: "bg-success-bg text-success", easy: "bg-info-bg text-info",
}
const RATE_LABEL: Record<Rating, string> = { again: "Again", hard: "Hard", good: "Good", easy: "Easy" }
const RATE_HINT: Record<Rating, string> = {
  again: "Forgot it. Shows again soon, in this session too.", hard: "Remembered with effort.", good: "Remembered it.", easy: "Knew it instantly. Longest wait.",
}
const MOCK_LABEL: Record<Rating, string> = { again: "Missed", hard: "Partial", good: "Nailed it", easy: "Nailed it" }

export function Session({ setup, queue: initial, onFinish, onExit }: Props) {
  const { progress: p, rate, addHistory, restore } = useProgress()
  const kind = MODES[setup.mode].kind
  const [queue, setQueue] = useState(initial)
  const [idx, setIdx] = useState(0)
  const [results, setResults] = useState<Result[]>([])
  const [revealed, setRevealed] = useState(false)
  const [answer, setAnswer] = useState("")
  const [selected, setSelected] = useState<number | null>(null)
  const [timeLeft, setTimeLeft] = useState(setup.mockSeconds)
  const started = useRef(Date.now())
  const requeues = useRef<Record<string, number>>({})
  // one snapshot per grade, so Back can undo it (schedule, queue and all)
  const undo = useRef<{ progress: ProgressData; queue: string[]; results: Result[]; requeues: Record<string, number>; idx: number }[]>([])
  // the control that had focus unmounts or disables on each step; move focus to what comes next
  const headingRef = useRef<HTMLHeadingElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const answerRef = useRef<HTMLDivElement>(null)
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }) }, [idx])
  // answer panel, not the first rating button: a stray Space there would rate "Again"
  useEffect(() => { if (revealed) answerRef.current?.focus({ preventScroll: true }) }, [revealed])
  useEffect(() => { if (selected !== null) nextRef.current?.focus({ preventScroll: true }) }, [selected])

  const id = queue[idx]
  const q = BY_ID[id]
  const cat = CAT_OF[id]
  const choices = useMemo(() => (kind === "quiz" ? getChoices(q) : []), [idx, kind]) // eslint-disable-line react-hooks/exhaustive-deps

  // mock interview countdown; reaching zero reveals the answer
  useEffect(() => {
    if (kind !== "mock" || revealed) return
    const t = setInterval(() => setTimeLeft((s) => s - 1), 1000)
    return () => clearInterval(t)
  }, [kind, idx, revealed])
  useEffect(() => { if (kind === "mock" && timeLeft <= 0 && !revealed) setRevealed(true) }, [timeLeft, kind, revealed])

  const finish = (all: Result[]) => {
    const first = new Map<string, Result>()
    for (const r of all) if (!first.has(r.id)) first.set(r.id, r)
    const firsts = [...first.values()]
    const counts: Record<Rating, number> = { again: 0, hard: 0, good: 0, easy: 0 }
    for (const r of all) counts[r.rating]++
    const score = setup.mode === "mock"
      ? firsts.reduce((t, r) => t + (r.rating === "good" ? 1 : r.rating === "hard" ? 0.5 : 0), 0)
      : firsts.filter((r) => r.rating !== "again").length
    if (firsts.length) addHistory({ day: dayKey(), mode: setup.mode, score, total: firsts.length })
    onFinish({ mode: setup.mode, total: firsts.length, score, counts, firsts, mistakes: firsts.filter((r) => r.rating === "again").map((r) => r.id) })
  }

  const record = (rating: Rating) => {
    undo.current.push({ progress: p, queue, results, requeues: { ...requeues.current }, idx })
    rate(id, rating)
    const all = [...results, { id, rating, ms: Date.now() - started.current }]
    setResults(all)
    // a forgotten flashcard comes back later in the same session (at most twice)
    let nq = queue
    if (rating === "again" && kind === "cards" && (requeues.current[id] ?? 0) < 2) {
      requeues.current[id] = (requeues.current[id] ?? 0) + 1
      nq = [...queue, id]
      setQueue(nq)
    }
    return { all, nq }
  }
  const advance = (all: Result[], nq: string[]) => {
    if (idx + 1 >= nq.length) return finish(all)
    setIdx(idx + 1); setRevealed(false); setAnswer(""); setSelected(null); setTimeLeft(setup.mockSeconds); started.current = Date.now()
    window.scrollTo(0, 0)
  }
  const doRate = (r: Rating) => { if (!revealed) return; const { all, nq } = record(r); advance(all, nq) }
  const choose = (i: number) => { if (selected !== null) return; setSelected(i); record(choices[i].correct ? "good" : "again") }
  const next = () => advance(results, queue)
  const exit = () => (results.length ? finish(results) : onExit())
  const back = () => {
    const s = undo.current.pop()
    if (!s) return
    restore(s.progress); setQueue(s.queue); setResults(s.results); requeues.current = s.requeues
    setIdx(s.idx); setAnswer(""); setSelected(null); setRevealed(kind !== "quiz"); started.current = Date.now()
    if (kind === "quiz") requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }))
  }
  const reveal = () => { if (!revealed && kind !== "quiz") setRevealed(true) }

  // keyboard: space reveals, 1-4 rates, A-D answers quiz, ← or Backspace goes back, Esc ends
  const key = useRef<(e: KeyboardEvent) => void>(() => {})
  key.current = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key !== "Enter") return
    if (e.altKey) return
    const typing = /^(TEXTAREA|INPUT|SELECT)$/.test((e.target as HTMLElement).tagName)
    if (e.key === "Escape") { if (typing) (e.target as HTMLElement).blur(); else exit(); return }
    if (typing) { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); reveal() } return }
    if (e.key === "ArrowLeft" || e.key === "Backspace") { e.preventDefault(); back(); return }
    if (kind === "quiz") {
      if (selected === null) {
        const i = "abcd".indexOf(e.key.toLowerCase()) >= 0 ? "abcd".indexOf(e.key.toLowerCase()) : "1234".indexOf(e.key)
        if (i >= 0 && i < choices.length) { e.preventDefault(); choose(i) }
      } else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); next() }
      return
    }
    if (!revealed) { if (e.key === " " || e.key === "Enter") { e.preventDefault(); reveal() } return }
    const opts: Rating[] = kind === "mock" ? ["again", "hard", "good"] : ["again", "hard", "good", "easy"]
    const n = parseInt(e.key, 10)
    if (n >= 1 && n <= opts.length) { e.preventDefault(); doRate(opts[n - 1]) }
  }
  useEffect(() => { const h = (e: KeyboardEvent) => key.current(e); document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h) }, [])

  const useRecall = setup.recall && kind !== "quiz"
  const now = Date.now()
  const isLast = idx + 1 >= queue.length

  return (
    <TopicScope cat={cat} className="animate-rise">
      <div className="flex items-center gap-3 pb-6 pt-1">
        <Button variant="ghost" size="icon" className="size-10 shrink-0 text-muted-foreground" onClick={exit} aria-label="End session"><X className="size-5" /></Button>
        <Progress value={pct(idx, queue.length)} className="h-1.5 flex-1 bg-border [&>div]:bg-topic" aria-label="Session progress" />
        <span className="whitespace-nowrap text-sm tabular-nums text-muted-foreground" aria-live="polite">{idx + 1} of {queue.length}</span>
        <Button variant="ghost" size="sm" className="-mr-2 h-10 shrink-0 gap-1 px-2 text-muted-foreground" onClick={back} disabled={!undo.current.length}
          aria-label="Back to previous card, undoes its grade" title="Back (←)"><ChevronLeft className="size-4" aria-hidden /> Back</Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <TopicTag cat={cat} className="mr-1" />
        <LevelBadge level={q.level} />
        {kind !== "quiz" && <StatusBadge p={p} id={id} />}
        {kind === "mock" && (
          <span role="timer" className={cn("ml-auto rounded-full bg-muted px-3 py-0.5 text-sm font-bold tabular-nums", timeLeft <= 0 ? "text-danger" : timeLeft <= 30 && !revealed ? "text-warning" : "")}>{fmtClock(timeLeft)}</span>
        )}
      </div>

      <h2 ref={headingRef} tabIndex={-1} className="max-w-question font-serif text-question font-semibold tracking-tight outline-none sm:text-question-lg">{q.q}</h2>

      {kind === "quiz" ? (
        <>
          <div className="mt-6 flex flex-col gap-2.5" role="group" aria-label="Answer choices">
            {choices.map((c, i) => {
              const state = selected === null ? "" : c.correct ? "correct" : i === selected ? "wrong" : "dim"
              return (
                <button key={i} disabled={selected !== null} onClick={() => choose(i)}
                  className={cn("flex items-start gap-3.5 rounded-2xl border border-input px-4 py-3.5 text-left text-base leading-snug transition-colors",
                    selected === null && "hover:border-foreground",
                    state === "correct" && "border-success bg-success-bg text-success",
                    state === "wrong" && "border-danger bg-danger-bg text-danger",
                    state === "dim" && "opacity-50")}>
                  <span className="mt-px flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-code font-bold">
                    {selected !== null && c.correct ? <Check className="size-3.5" /> : selected === i ? <X className="size-3.5" /> : "ABCD"[i]}
                  </span>
                  <span>{c.text}{state === "correct" ? <span className="sr-only"> (correct answer)</span> : state === "wrong" ? <span className="sr-only"> (your answer, wrong)</span> : null}</span>
                </button>
              )
            })}
          </div>
          <p className="sr-only" aria-live="polite">{selected === null ? "" : choices[selected].correct ? "Correct." : "Not quite."}</p>
          {selected === null ? (
            <p className="mt-3 text-sm text-muted-foreground">Press <kbd className="kbd">A</kbd> to <kbd className="kbd">D</kbd> or <kbd className="kbd">1</kbd> to <kbd className="kbd">4</kbd> to answer.</p>
          ) : (
            <div className="mt-8 animate-rise">
              <p className="mb-2 text-sm font-semibold text-muted-foreground" aria-hidden>{choices[selected].correct ? "Correct." : "Not quite."}</p>
              <p className="max-w-measure whitespace-pre-line font-serif text-lg leading-reading">{q.a}</p>
              <CodeBlock code={q.code} />
            </div>
          )}
        </>
      ) : !revealed ? (
        <>
          {useRecall && (
            <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} aria-label="Your answer"
              placeholder={setup.mode === "mock" ? "Outline your answer as you'd say it…" : "Write what you remember…"}
              className="mt-6 min-h-36 rounded-2xl bg-muted px-4 py-3.5 font-serif text-recall leading-relaxed" />
          )}
          <p className="mt-3 text-sm text-muted-foreground">
            {setup.mode === "mock" ? "Answer out loud as if the interviewer just asked. " : ""}
            {useRecall ? <><kbd className="kbd">⌘</kbd> or <kbd className="kbd">Ctrl</kbd> with <kbd className="kbd">Enter</kbd></> : <kbd className="kbd">Space</kbd>} shows the answer.
          </p>
        </>
      ) : (
        <div ref={answerRef} tabIndex={-1} className="mt-8 animate-rise outline-none">
          {useRecall && answer.trim() && (
            <p className="mb-6 whitespace-pre-wrap rounded-2xl bg-muted px-4 py-3 font-serif text-base leading-relaxed text-muted-foreground"><b className="mr-2 font-sans text-xs text-muted-foreground">You wrote</b>{answer}</p>
          )}
          <blockquote className="mb-5 border-l-3 border-topic py-0.5 pl-4 font-serif text-xl font-semibold leading-snug tracking-tight">{q.short}</blockquote>
          <p className="max-w-measure whitespace-pre-line font-serif text-lg leading-reading">{q.a}</p>
          <CodeBlock code={q.code} />
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 mt-6 border-t bg-background/90 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        {kind === "quiz" ? (
          selected !== null && <Button ref={nextRef} size="lg" className="h-12 w-full rounded-xl text-base" onClick={next}>{isLast ? "See results" : "Next question"} <kbd className="kbd-dark">Enter</kbd></Button>
        ) : !revealed ? (
          <Button size="lg" className="h-12 w-full rounded-xl text-base" onClick={reveal}>Show answer</Button>
        ) : (
          <div role="group" aria-labelledby="grade-prompt">
            {/* grading is the "next" step: it schedules this card's next review, then moves on */}
            <p id="grade-prompt" className="mb-2 text-center text-sm text-muted-foreground">
              {kind === "mock" ? "How did your answer go?" : "How well did you remember it? Your answer sets when you see this card again."}
            </p>
            <div className={cn("grid gap-2", kind === "mock" ? "grid-cols-3" : "grid-cols-4")}>
              {(kind === "mock" ? (["again", "hard", "good"] as Rating[]) : (["again", "hard", "good", "easy"] as Rating[])).map((r, i) => (
                <button key={r} onClick={() => doRate(r)} title={RATE_HINT[r]} className={cn("flex min-h-14 flex-col items-center justify-center rounded-2xl px-1 py-2 font-bold transition-[filter] hover:brightness-95", RATE_STYLE[r])}>
                  {kind === "mock" ? MOCK_LABEL[r] : RATE_LABEL[r]}
                  <small className="text-xs font-medium opacity-85">
                    {kind === "mock" ? <span className="hidden sm:inline">press {i + 1}</span> : <>Next in {fmtIv(schedule(p.cards[id], r, now))}<span className="hidden sm:inline"> · {i + 1}</span></>}
                  </small>
                  {kind !== "mock" && <span className="sr-only">. {RATE_HINT[r]}</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </TopicScope>
  )
}
