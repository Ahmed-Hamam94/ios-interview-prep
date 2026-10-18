import { ChevronRight, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { CATS, QS } from "@/data"
import { ALL_QS, BY_ID, CAT_OF, DAY, MODES, buildQueue, dayKey, defaultSetup, fmtWhen, isDue, isMastered, isNew, isWeak, newRoom, pct, streakNow, todayStats, type ModeKey } from "@/lib/srs"
import { useProgress } from "@/lib/progress"
import { LevelBadge, MODE_ICON, StatusBadge, TOPIC_ICON, TopicScope, TopicTag } from "@/components/common"

interface Props {
  onQuick: () => void
  onMode: (m: ModeKey) => void
  onTopic: (cat: string) => void
  onWeak: (cat: string) => void
  onRead: (cat: string) => void
  onSettings: () => void
}

function WeekStrip() {
  const { progress } = useProgress()
  const done = new Set(progress.history.map((h) => h.day))
  if (todayStats(progress).reviews) done.add(dayKey())
  return (
    <ol className="flex gap-1.5" aria-label="Days you studied this week">
      {[6, 5, 4, 3, 2, 1, 0].map((n) => {
        const t = Date.now() - n * DAY
        const on = done.has(dayKey(t))
        const label = new Date(t).toLocaleDateString(undefined, { weekday: "narrow" })
        return (
          <li key={n} aria-label={`${new Date(t).toLocaleDateString(undefined, { weekday: "long" })}: ${on ? "studied" : "no study"}`}
            className={`flex size-7 items-center justify-center rounded-full border-1.5 text-2xs font-semibold ${on ? "border-foreground bg-foreground text-background" : n === 0 ? "border-foreground text-foreground" : "border-input text-muted-foreground"}`}>
            {label}
          </li>
        )
      })}
    </ol>
  )
}

export function Home({ onQuick, onMode, onTopic, onWeak, onRead, onSettings }: Props) {
  const { progress: p } = useProgress()
  const now = Date.now()
  const due = ALL_QS.filter((q) => isDue(p, q.id, now)).length
  const fresh = Math.min(newRoom(p), ALL_QS.filter((q) => isNew(p, q.id)).length)
  const mastered = ALL_QS.filter((q) => isMastered(p, q.id)).length
  const streak = streakNow(p)
  const today = todayStats(p).reviews
  const nextDue = Object.values(p.cards).map((c) => c.due).filter((t) => t > now).sort((a, b) => a - b)[0]
  const ready = due + fresh
  const first = ready ? BY_ID[buildQueue(p, defaultSetup(p, "review"))[0]] : null

  const weak = CATS.map((c) => ({ c, n: QS[c].filter((q) => isWeak(p, q.id)).length })).filter((t) => t.n > 0).sort((a, b) => b.n - a.n).slice(0, 5)

  return (
    <div className="animate-rise">
      <h1 className="mt-6 font-serif text-4xl font-semibold leading-none tracking-tight sm:text-display">Today</h1>
      <div className="mb-6 mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
        <p className="min-w-56 flex-1 text-muted-foreground">
          {streak ? `${streak}-day streak.` : "Review a few cards to start a streak."} {today ? `${today} reviewed today. ` : ""}
          {mastered} of {ALL_QS.length} mastered.
        </p>
        <WeekStrip />
      </div>

      {first ? (
        <TopicScope cat={CAT_OF[first.id]} className="rounded-panel bg-muted p-6 sm:p-8">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <TopicTag cat={CAT_OF[first.id]} className="mr-1" />
            <LevelBadge level={first.level} />
            <StatusBadge p={p} id={first.id} />
          </div>
          <h2 className="mb-6 max-w-question font-serif text-question font-semibold tracking-tight sm:text-question-lg">{first.q}</h2>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <Button size="lg" className="h-12 rounded-xl px-6 text-base" onClick={onQuick}>
              <Play className="!size-4 fill-current" aria-hidden /> Start review
            </Button>
            <span className="text-sm text-muted-foreground">{due} due, {fresh} new. A session is 20 cards, about 8 minutes.</span>
          </div>
        </TopicScope>
      ) : (
        <div className="rounded-panel bg-muted p-6 sm:p-8">
          <h2 className="font-serif text-question-lg font-semibold leading-tight tracking-tight">You're caught up.</h2>
          <p className="mb-5 mt-2 max-w-measure-sm text-muted-foreground">{nextDue ? `Your next card is due ${fmtWhen(nextDue)}. ` : ""}Mix topics or take a quiz while you wait.</p>
          <Button size="lg" className="h-12 rounded-xl px-6 text-base" onClick={() => onMode("mixed")}>Practice anyway</Button>
        </div>
      )}

      <h2 className="mb-1 mt-12 font-serif text-2xl font-semibold tracking-tight">Ways to study</h2>
      <div className="border-b">
        {(Object.entries(MODES) as [ModeKey, (typeof MODES)[ModeKey]][]).map(([k, m]) => {
          const Icon = MODE_ICON[k]
          return (
            <button key={k} onClick={() => onMode(k)} className="group flex w-full items-start gap-4 border-t px-1 py-5 text-left">
              <Icon className="mt-1 size-6 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-serif text-xl font-semibold tracking-tight group-hover:underline group-hover:underline-offset-4">{m.name}</span>
                <span className="block text-muted-foreground">{m.blurb}</span>
                <span className="mt-1 block max-w-measure-sm text-sm text-muted-foreground">{m.why}</span>
              </span>
              <ChevronRight className="mt-2 size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
            </button>
          )
        })}
      </div>

      {weak.length > 0 && (
        <section>
          <h2 className="mb-1 mt-12 font-serif text-2xl font-semibold tracking-tight">Weak spots</h2>
          <p className="mb-2 text-sm text-muted-foreground">Topics with cards you keep forgetting.</p>
          <div className="border-b">
            {weak.map((t) => {
              const Icon = TOPIC_ICON[t.c]
              return (
                <TopicScope key={t.c} cat={t.c} className="flex items-center gap-3 border-t px-1 py-3.5">
                  <Icon className="size-5 shrink-0 text-topic" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{t.c}</div>
                    <div className="text-sm text-muted-foreground">{t.n} card{t.n === 1 ? "" : "s"} to relearn</div>
                  </div>
                  <Button variant="outline" size="sm" className="h-9 rounded-lg" onClick={() => onWeak(t.c)}>Review</Button>
                </TopicScope>
              )
            })}
          </div>
        </section>
      )}

      <h2 className="mb-2 mt-12 font-serif text-2xl font-semibold tracking-tight">Topics</h2>
      <div className="grid gap-x-8 sm:grid-cols-2">
        {CATS.map((c) => {
          const qs = QS[c]
          const m = qs.filter((q) => isMastered(p, q.id)).length
          const d = qs.filter((q) => isDue(p, q.id, now)).length
          const seen = qs.filter((q) => !isNew(p, q.id)).length
          const Icon = TOPIC_ICON[c]
          return (
            <TopicScope key={c} cat={c} className="relative flex items-center gap-3 border-t py-3.5 pl-4">
              <span className="absolute inset-y-3.5 left-0 w-1 rounded-full bg-topic" aria-hidden />
              <button onClick={() => onTopic(c)} className="group block min-w-0 flex-1 text-left">
                <span className="flex items-center gap-2 text-base font-semibold group-hover:underline group-hover:underline-offset-4">
                  <Icon className="size-4.5 text-topic" aria-hidden /> {c}
                  {d > 0 && <span className="rounded-full bg-info-bg px-2 py-0.5 text-xs font-semibold text-info">{d} due</span>}
                </span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{seen} of {qs.length} studied, {m} mastered</span>
                <Progress value={pct(m, qs.length)} className="mt-2.5 h-1.5 bg-border [&>div]:bg-topic" aria-label={`${c} mastery`} />
              </button>
              <Button variant="link" size="sm" className="px-1 text-muted-foreground" onClick={() => onRead(c)}>Read</Button>
            </TopicScope>
          )
        })}
      </div>
      <p className="mt-8 max-w-measure-sm text-sm text-muted-foreground">
        Mastered means you recalled a card well enough that its next review is three weeks away or more. Progress is saved in this browser; back it up in{" "}
        <button className="underline underline-offset-4" onClick={onSettings}>Settings</button>.
      </p>
    </div>
  )
}
