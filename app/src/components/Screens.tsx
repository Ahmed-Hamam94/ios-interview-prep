import { useRef, useState } from "react"
import { Download, Home as HomeIcon, RefreshCw, RotateCcw, Search, Upload } from "lucide-react"
import { toast } from "sonner"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { CATS, CFG, QS } from "@/data"
import { ALL_QS, BY_ID, CAT_OF, DAY, MODES, fmtClock, pct } from "@/lib/srs"
import { useProgress } from "@/lib/progress"
import { CodeBlock, LevelBadge, StatusBadge } from "@/components/common"
import { Segment } from "@/components/SetupSheet"
import type { Summary } from "@/components/Session"
import { cn } from "@/lib/utils"

const H1 = "mt-6 font-serif text-4xl font-semibold leading-tight tracking-tight sm:text-display"

export function SummaryScreen({ summary: r, onHome, onMistakes }: { summary: Summary; onHome: () => void; onMistakes: () => void }) {
  const { progress: p } = useProgress()
  const m = MODES[r.mode]
  const big = r.mode === "mock" ? `${+r.score.toFixed(1)} of ${r.total}` : `${pct(r.score, r.total)}%`
  const label = r.mode === "mock" ? "Interview score. Nailed it counts 1, partial counts half." : r.mode === "quiz" ? `${r.score} of ${r.total} correct.` : `${r.score} of ${r.total} recalled on the first try.`
  const c = r.counts
  const soon = ALL_QS.filter((q) => p.cards[q.id] && p.cards[q.id].due <= Date.now() + DAY).length
  const pill = "rounded-full px-3 py-1 text-sm font-semibold"
  return (
    <div className="animate-rise">
      <h1 className={H1}>{m.name} complete</h1>
      <p className="mb-1 mt-4 font-serif text-7xl font-semibold leading-none tracking-tighter tabular-nums">{big}</p>
      <p className="mb-4 mt-2 text-muted-foreground">{label}</p>
      <div className="mb-5 flex flex-wrap gap-2">
        {r.mode === "quiz" ? <><span className={cn(pill, "bg-success-bg text-success")}>{r.score} correct</span><span className={cn(pill, "bg-danger-bg text-danger")}>{r.total - r.score} wrong</span></>
          : r.mode === "mock" ? <><span className={cn(pill, "bg-success-bg text-success")}>{c.good} nailed</span><span className={cn(pill, "bg-muted")}>{c.hard} partial</span><span className={cn(pill, "bg-danger-bg text-danger")}>{c.again} missed</span></>
          : <><span className={cn(pill, "bg-danger-bg text-danger")}>{c.again} again</span><span className={cn(pill, "bg-muted")}>{c.hard} hard</span><span className={cn(pill, "bg-success-bg text-success")}>{c.good} good</span><span className={cn(pill, "bg-info-bg text-info")}>{c.easy} easy</span></>}
      </div>
      <p className="text-sm text-muted-foreground">{soon} card{soon === 1 ? "" : "s"} will be due within 24 hours. Missed cards come back first.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        {r.mistakes.length > 0 && <Button size="lg" className="h-12 rounded-xl" onClick={onMistakes}><RefreshCw aria-hidden /> Review {r.mistakes.length} mistake{r.mistakes.length === 1 ? "" : "s"} now</Button>}
        <Button size="lg" variant="outline" className="h-12 rounded-xl" onClick={onHome}><HomeIcon aria-hidden /> Home</Button>
      </div>
      {(r.mode === "mock" ? r.firsts.length > 0 : r.mistakes.length > 0) && (
        <>
          <h2 className="mb-2 mt-10 font-serif text-2xl font-semibold tracking-tight">{r.mode === "mock" ? "Your answers" : "To revisit"}</h2>
          <div className="border-b">
            {(r.mode === "mock" ? r.firsts : r.mistakes.map((id) => ({ id, rating: "again" as const, ms: 0 }))).map((x) => (
              <div key={x.id} className="flex items-center gap-3 border-t px-1 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold leading-snug">{BY_ID[x.id].q}</div>
                  <div className="text-sm text-muted-foreground">{CAT_OF[x.id]}{r.mode === "mock" ? `, ${fmtClock(Math.round(x.ms / 1000))}` : ""}</div>
                </div>
                {r.mode === "mock" && <span className={cn(pill, x.rating === "good" ? "bg-success-bg text-success" : x.rating === "again" ? "bg-danger-bg text-danger" : "bg-muted")}>{x.rating === "good" ? "Nailed" : x.rating === "hard" ? "Partial" : "Missed"}</span>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function BrowseScreen({ cat: initialCat, onHome }: { cat: string; onHome: () => void }) {
  const { progress: p } = useProgress()
  const [cat, setCat] = useState(initialCat)
  const [query, setQuery] = useState("")
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const qs = (cat === "All" ? ALL_QS : QS[cat]).filter((q) => { const t = `${q.q} ${q.short} ${q.a} ${q.code ?? ""}`.toLowerCase(); return words.every((w) => t.includes(w)) })
  return (
    <div className="animate-rise">
      <Button variant="ghost" className="-ml-3 text-muted-foreground" onClick={onHome}>Home</Button>
      <h1 className={H1.replace("mt-6", "mt-1")}>Browse questions</h1>
      <p className="mb-5 mt-2 max-w-measure-sm text-muted-foreground">Read answers at your own pace. Browsing doesn't change your review schedule.</p>
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input id="search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search, e.g. retain cycle…" aria-label="Search questions" autoComplete="off" className="h-12 rounded-xl bg-muted pl-11 text-base" />
      </div>
      <ToggleGroup type="single" value={cat} onValueChange={(v) => v && setCat(v)} aria-label="Topic filter" className="mb-5 flex flex-wrap justify-start gap-2">
        {["All", ...CATS].map((c) => (
          <ToggleGroupItem key={c} value={c} className="h-9 gap-2 rounded-full border border-input px-3.5 text-sm data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-background">
            {c !== "All" && <span className="size-2 rounded-full" style={{ background: CFG[c].dot }} aria-hidden />} {c === "All" ? "All topics" : c}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <p className="mb-2 text-sm text-muted-foreground" aria-live="polite">{qs.length} question{qs.length === 1 ? "" : "s"}</p>
      {qs.length ? (
        <Accordion type="multiple" className="border-b">
          {qs.map((q) => (
            <AccordionItem key={q.id} value={q.id} className="border-t border-b-0">
              <AccordionTrigger className="items-start gap-3 px-1 py-4 text-left hover:no-underline">
                <span className="flex-1">
                  <span className="block font-serif text-lg font-semibold leading-snug tracking-tight">{q.q}</span>
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    {cat === "All" && <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">{CAT_OF[q.id]}</span>}
                    <LevelBadge level={q.level} /><StatusBadge p={p} id={q.id} />
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-1 pb-6">
                <p className="mb-4 border-l-3 border-foreground/30 pl-4 font-serif text-lg font-semibold leading-snug">{q.short}</p>
                <p className="max-w-measure whitespace-pre-line font-serif text-lg leading-reading">{q.a}</p>
                <CodeBlock code={q.code} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : <p className="py-8 text-muted-foreground">No questions match “{query}”. Try fewer words or another topic.</p>}
    </div>
  )
}

export function SettingsScreen({ onHome }: { onHome: () => void }) {
  const { progress: p, setSetting, exportJson, importJson, reset } = useProgress()
  const [confirm, setConfirm] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const st = p.settings
  const exportFile = () => {
    const url = URL.createObjectURL(new Blob([exportJson()], { type: "application/json" }))
    const a = document.createElement("a")
    a.href = url; a.download = `ios-interview-prep-progress-${new Date().toISOString().slice(0, 10)}.json`; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast.success("Backup downloaded")
  }
  const importFile = (f?: File) => f?.text().then((t) => toast.success(`Imported progress for ${importJson(t)} cards`)).catch(() => toast.error("That file isn't a progress backup from this app."))
  return (
    <div className="animate-rise">
      <Button variant="ghost" className="-ml-3 text-muted-foreground" onClick={onHome}>Home</Button>
      <h1 className={H1.replace("mt-6", "mt-1")}>Settings</h1>
      <p className="mb-6 mt-2 text-muted-foreground">{Object.keys(p.cards).length} of {ALL_QS.length} cards studied, {p.history.length} sessions completed.</p>
      <div className="space-y-7">
        <section><h2 className="mb-2.5 font-semibold">New cards per day</h2>
          <Segment label="New cards per day" value={st.newPerDay} options={[[5, "5"], [10, "10"], [15, "15"], [20, "20"], [30, "30"]]} onChange={(v) => setSetting("newPerDay", v)} />
          <p className="mt-2.5 text-sm text-muted-foreground">Fewer new cards keeps daily reviews manageable as your deck grows.</p></section>
        <label className="flex cursor-pointer items-start gap-4 rounded-2xl bg-muted p-4">
          <span className="flex-1"><span className="block font-semibold">Write answers before revealing by default</span><span className="text-sm text-muted-foreground">Turns on active recall for flashcards and mock interviews.</span></span>
          <Switch checked={st.recallBox} onCheckedChange={(v) => setSetting("recallBox", v)} className="mt-1" />
        </label>
        <section><h2 className="mb-2.5 font-semibold">Mock interview questions</h2>
          <Segment label="Mock interview questions" value={st.mockCount} options={[[5, "5"], [8, "8"], [12, "12"]]} onChange={(v) => setSetting("mockCount", v)} /></section>
        <section><h2 className="mb-2.5 font-semibold">Mock interview time per question</h2>
          <Segment label="Time per question" value={st.mockSeconds} options={[[60, "1 min"], [120, "2 min"], [180, "3 min"]]} onChange={(v) => setSetting("mockSeconds", v)} /></section>
      </div>
      <h2 className="mb-1 mt-10 font-serif text-2xl font-semibold tracking-tight">Your progress</h2>
      <p className="mb-4 text-sm text-muted-foreground">Saved only in this browser. Export a backup to move it to another device.</p>
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" className="h-11 rounded-xl" onClick={exportFile}><Download aria-hidden /> Export backup</Button>
        <Button variant="outline" className="h-11 rounded-xl" onClick={() => fileRef.current?.click()}><Upload aria-hidden /> Import backup</Button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { importFile(e.target.files?.[0]); e.target.value = "" }} />
        <Button variant="outline" className="h-11 rounded-xl text-danger hover:text-danger" onClick={() => setConfirm(true)}><RotateCcw aria-hidden /> Reset progress</Button>
      </div>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset all progress?</DialogTitle>
            <DialogDescription>Your review schedule, streak and history will be deleted. Export a backup first if you might want them.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirm(false)}>Keep my progress</Button>
            <Button variant="destructive" onClick={() => { reset(); setConfirm(false); toast("Progress reset") }}>Reset progress</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
