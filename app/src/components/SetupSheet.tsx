import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { CATS, CFG, type Level } from "@/data"
import { LEVELS, MODES, POOLS, buildQueue, candidates, defaultSetup, newRoom, type ModeKey, type Pool, type Setup } from "@/lib/srs"
import { useProgress } from "@/lib/progress"

interface Props { mode: ModeKey | null; over?: Partial<Setup>; onClose: () => void; onStart: (s: Setup, queue: string[]) => void }

export function Segment<T extends string | number>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <ToggleGroup type="single" value={String(value)} aria-label={label}
      onValueChange={(v) => { const o = options.find(([k]) => String(k) === v); if (o) onChange(o[0]) }}
      className="inline-flex flex-wrap justify-start gap-0.5 rounded-xl bg-muted p-1">
      {options.map(([k, l]) => (
        <ToggleGroupItem key={String(k)} value={String(k)} className="h-9 rounded-lg px-4 text-sm data-[state=on]:bg-background data-[state=on]:font-semibold data-[state=on]:shadow-sm">{l}</ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

const ALL = "__all"
const chip ="h-9 gap-2 rounded-full border border-input px-3.5 text-sm data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-background"

export function SetupSheet({ mode, over, onClose, onStart }: Props) {
  const { progress: p } = useProgress()
  const [s, setS] = useState<Setup | null>(null)
  const [narrow, setNarrow] = useState(() => window.matchMedia("(max-width: 700px)").matches)
  useEffect(() => { if (mode) setS(defaultSetup(p, mode, over)) }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 700px)")
    const f = () => setNarrow(mq.matches)
    mq.addEventListener("change", f)
    return () => mq.removeEventListener("change", f)
  }, [])
  // keep the last mode/setup mounted while the sheet animates closed (no blank flash)
  const shown = useRef<ModeKey>("review")
  if (mode) shown.current = mode
  if (!s) return null
  const kindMode = shown.current

  const m = MODES[kindMode]
  const n = candidates(p, s).length
  const count = Math.min(n, kindMode === "mock" ? s.mockCount : s.size === "all" ? n : s.size)
  const allCats = s.cats.length === CATS.length
  const set = (o: Partial<Setup>) => setS({ ...s, ...o })
  const empty = n === 0 ? (s.pool === "due" ? "Nothing due in these topics. Try New, Weak or All." : s.pool === "weak" ? "No weak cards here yet. Try All." : "No cards match. Add more topics or levels.") : ""
  const poolHint = s.pool === "due" ? `Cards scheduled for today, plus up to ${newRoom(p)} new ones (daily limit in Settings).` : s.pool === "weak" ? "Cards you've forgotten recently or more than once." : s.pool === "new" ? "Cards you haven't studied yet." : "Every matching card, in random order."

  return (
    <Sheet open={!!mode} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side={narrow ? "bottom" : "right"} className={`overflow-y-auto overscroll-contain ${narrow ? "max-h-[92dvh] rounded-t-3xl" : "w-[30rem] sm:max-w-none"}`}>
        <SheetHeader className="text-left">
          <SheetTitle className="font-serif text-3xl font-semibold tracking-tight">{m.name}</SheetTitle>
          <SheetDescription className="text-base">{m.blurb} {m.why}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-7">
          <section>
            <h3 className="mb-2.5 font-semibold">Topics</h3>
            {/* "All" is a real item so arrow-key roving focus covers it */}
            <ToggleGroup type="multiple" aria-label="Topics" value={allCats ? [ALL] : s.cats}
              onValueChange={(v) => { const rest = v.filter((x) => x !== ALL); set({ cats: (!allCats && v.includes(ALL)) || !rest.length ? [...CATS] : rest }) }}
              className="flex flex-wrap justify-start gap-2">
              <ToggleGroupItem value={ALL} className={chip}>All topics</ToggleGroupItem>
              {CATS.map((c) => (
                <ToggleGroupItem key={c} value={c} className={chip}>
                  <span className="size-2 rounded-full" style={{ background: CFG[c].dot }} aria-hidden /> {c}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </section>

          <section>
            <h3 className="mb-2.5 font-semibold">Difficulty</h3>
            <ToggleGroup type="multiple" aria-label="Difficulty" value={s.levels} onValueChange={(v) => set({ levels: (v.length ? v : [...LEVELS]) as Level[] })} className="flex flex-wrap justify-start gap-2">
              {LEVELS.map((l) => <ToggleGroupItem key={l} value={l} className={chip}>{l}</ToggleGroupItem>)}
            </ToggleGroup>
          </section>

          <section>
            <h3 className="mb-2.5 font-semibold">Which cards</h3>
            <Segment label="Which cards" value={s.pool} options={Object.entries(POOLS) as [Pool, string][]} onChange={(pool) => set({ pool })} />
            <p className="mt-2.5 text-sm text-muted-foreground">{poolHint}</p>
          </section>

          {kindMode === "mock" ? (
            <>
              <section><h3 className="mb-2.5 font-semibold">Questions</h3><Segment label="Questions" value={s.mockCount} options={[[5, "5"], [8, "8"], [12, "12"]]} onChange={(mockCount) => set({ mockCount })} /></section>
              <section><h3 className="mb-2.5 font-semibold">Time per question</h3><Segment label="Time per question" value={s.mockSeconds} options={[[60, "1 min"], [120, "2 min"], [180, "3 min"]]} onChange={(mockSeconds) => set({ mockSeconds })} /></section>
            </>
          ) : (
            <section><h3 className="mb-2.5 font-semibold">Session length</h3>
              <Segment<number | "all"> label="Session length" value={s.size} options={[[10, "10"], [20, "20"], [50, "50"], ["all", "All"]]} onChange={(size) => set({ size })} /></section>
          )}

          {m.kind !== "quiz" && (
            <label className="flex cursor-pointer items-start gap-4 rounded-2xl bg-muted p-4">
              <span className="flex-1">
                <span className="block font-semibold">Write your answer before revealing</span>
                <span className="text-sm text-muted-foreground">Producing an answer yourself strengthens memory far more than rereading.</span>
              </span>
              <Switch checked={s.recall} onCheckedChange={(recall) => set({ recall })} className="mt-1" />
            </label>
          )}
        </div>

        <div className="sticky -bottom-6 -mx-6 -mb-6 mt-8 flex items-center gap-4 border-t bg-background px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4">
          <span className="flex-1 text-sm text-muted-foreground" aria-live="polite">{empty || `${count} ${m.kind === "cards" ? "card" : "question"}${count === 1 ? "" : "s"}`}</span>
          <Button size="lg" className="h-12 rounded-xl px-8 text-base" disabled={!n} onClick={() => onStart(s, buildQueue(p, s))}>Start</Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
