import { useState } from "react"
import { BookOpen, Moon, Settings as SettingsIcon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { QS } from "@/data"
import { Home } from "@/components/Home"
import { Session, type Summary } from "@/components/Session"
import { SetupSheet } from "@/components/SetupSheet"
import { BrowseScreen, SettingsScreen, SummaryScreen } from "@/components/Screens"
import { buildQueue, candidates, defaultSetup, isDue, isNew, shuffle, type ModeKey, type Setup } from "@/lib/srs"
import { useProgress } from "@/lib/progress"

type Screen =
  | { name: "home" }
  | { name: "session"; setup: Setup; queue: string[]; run: number }
  | { name: "summary"; summary: Summary }
  | { name: "browse"; cat: string }
  | { name: "settings" }

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const dark = resolvedTheme === "dark"
  return (
    <Button variant="ghost" size="icon" className="size-10 rounded-full" aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} onClick={() => setTheme(dark ? "light" : "dark")}>
      {dark ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}
    </Button>
  )
}

export default function App() {
  const { progress: p } = useProgress()
  const [screen, setScreen] = useState<Screen>({ name: "home" })
  const [sheet, setSheet] = useState<{ mode: ModeKey; over?: Partial<Setup> } | null>(null)
  const [run, setRun] = useState(0)

  const home = () => { setSheet(null); setScreen({ name: "home" }); window.scrollTo(0, 0) }
  const start = (setup: Setup, queue: string[]) => {
    if (!queue.length) return
    setSheet(null); setRun((r) => r + 1); setScreen({ name: "session", setup, queue, run: run + 1 }); window.scrollTo(0, 0)
  }

  const quick = () => { const s = defaultSetup(p, "review"); start(s, buildQueue(p, s)) }
  const topic = (c: string) => {
    const has = QS[c].some((q) => isDue(p, q.id) || isNew(p, q.id))
    setSheet({ mode: "review", over: { cats: [c], pool: has ? "due" : "all" } })
  }
  const weak = (c: string) => { const s = defaultSetup(p, "review", { cats: [c], pool: "weak" }); start(s, shuffle(candidates(p, s)).map((q) => q.id)) }
  const mistakes = (ids: string[]) => start(defaultSetup(p, "review"), shuffle(ids))

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-transparent bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-14 max-w-page items-center gap-1 px-4">
          <button onClick={home} className="mr-auto font-serif text-base font-semibold tracking-tight">iOS Interview Prep</button>
          <Button variant="ghost" size="icon" className="size-10 rounded-full" aria-label="Browse questions" onClick={() => setScreen({ name: "browse", cat: "All" })}><BookOpen className="size-4.5" /></Button>
          <Button variant="ghost" size="icon" className="size-10 rounded-full" aria-label="Settings" onClick={() => setScreen({ name: "settings" })}><SettingsIcon className="size-4.5" /></Button>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto max-w-page px-4 pb-16">
        {screen.name === "home" && (
          <Home onQuick={quick} onMode={(m) => setSheet({ mode: m })} onTopic={topic} onWeak={weak}
            onRead={(c) => setScreen({ name: "browse", cat: c })} onSettings={() => setScreen({ name: "settings" })} />
        )}
        {screen.name === "session" && <Session key={screen.run} setup={screen.setup} queue={screen.queue} onFinish={(summary) => { setScreen({ name: "summary", summary }); window.scrollTo(0, 0) }} onExit={home} />}
        {screen.name === "summary" && <SummaryScreen summary={screen.summary} onHome={home} onMistakes={() => mistakes(screen.summary.mistakes)} />}
        {screen.name === "browse" && <BrowseScreen key={screen.cat} cat={screen.cat} onHome={home} />}
        {screen.name === "settings" && <SettingsScreen onHome={home} />}
      </main>
      <SetupSheet mode={sheet?.mode ?? null} over={sheet?.over} onClose={() => setSheet(null)} onStart={start} />
    </>
  )
}
