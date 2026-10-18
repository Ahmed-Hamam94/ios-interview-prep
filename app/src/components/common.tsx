import type { CSSProperties, ReactNode } from "react"
import {
  Apple, Building2, Bug, Cloud, Code2, Cpu, Database, Flame, Gauge, Lock, MessageCircle, Network, PanelTop, RefreshCw, Split, Wand2, Workflow,
  CalendarClock, ListChecks, Mic, Shuffle, type LucideIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { CFG, type Level } from "@/data"
import { cardState, type ModeKey, type Progress } from "@/lib/srs"
import { cn } from "@/lib/utils"

export const TOPIC_ICON: Record<string, LucideIcon> = {
  "Software Basics": Cpu, "Objective-C": Apple, Swift: Flame, UIKit: PanelTop, SwiftUI: Wand2, "Protocols & POP": Code2,
  "Memory & ARC": RefreshCw, Concurrency: Workflow, Combine: Split, Architecture: Building2, Networking: Cloud, Persistence: Database,
  Testing: Bug, Performance: Gauge, "Security & Tools": Lock, "System Design": Network, Behavioral: MessageCircle,
}
export const MODE_ICON: Record<ModeKey, LucideIcon> = { review: CalendarClock, mixed: Shuffle, quiz: ListChecks, mock: Mic }

/** Wrapper that gives descendants the theme-aware topic colour as `text-topic` / `bg-topic`. */
export function TopicScope({ cat, className, children }: { cat: string; className?: string; children: ReactNode }) {
  return <div className={cn("tc", className)} style={{ "--tc": CFG[cat].dot } as CSSProperties}>{children}</div>
}

export function TopicTag({ cat, className }: { cat: string; className?: string }) {
  const Icon = TOPIC_ICON[cat]
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm font-semibold text-topic", className)}>
      <Icon className="size-4" aria-hidden /> {cat}
    </span>
  )
}

const LEVEL_STYLE: Record<Level, string> = {
  Basic: "bg-success-bg text-success",
  Intermediate: "bg-info-bg text-info",
  Advanced: "bg-danger-bg text-danger",
}
export function LevelBadge({ level }: { level: Level }) {
  return <Badge variant="secondary" className={cn("rounded-full border-0 px-2.5 py-0.5 text-xs font-semibold shadow-none", LEVEL_STYLE[level])}>{level}</Badge>
}

const STATE_LABEL = { new: "New", weak: "Weak", due: "Due", mastered: "Mastered", learning: "Learning" } as const
const STATE_STYLE = { new: "border border-input bg-transparent text-muted-foreground", weak: "bg-danger-bg text-danger", due: "bg-info-bg text-info", mastered: "bg-success-bg text-success", learning: "border border-input bg-transparent text-muted-foreground" } as const
export function StatusBadge({ p, id }: { p: Progress; id: string }) {
  const s = cardState(p, id)
  return <Badge variant="secondary" className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-none", STATE_STYLE[s].includes("border") ? "" : "border-0", STATE_STYLE[s])}>{STATE_LABEL[s]}</Badge>
}

// ---- Xcode-style code ----
const KW = new Set(
  ("actor any as associatedtype async await break case catch class continue default defer deinit do else enum extension fallthrough false fileprivate final for func get guard if import in indirect init inout internal is lazy let mutating nil nonisolated open operator override private protocol public repeat rethrows return self Self set some static struct subscript super switch throw throws true try typealias unowned var weak where while willSet didSet convenience required dynamic optional " +
    "@interface @implementation @end @property @selector @synthesize @dynamic void id BOOL YES NO NULL Nil").split(" "),
)
const TOKEN = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\\n])*")|([@#]?[A-Za-z_]\w*)|(\b\d[\d_]*(?:\.\d+)?\b)/g

function highlightLine(src: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  const re = new RegExp(TOKEN.source, "g")
  while ((m = re.exec(src))) {
    if (m.index > last) out.push(src.slice(last, m.index))
    const t = m[0]
    const asName = t === "id" && /^\s*[:,).=]/.test(src.slice(re.lastIndex)) // Swift `id` parameter, not ObjC `id`
    const cls = m[1] ? "c" : m[2] ? "s" : m[4] ? "n" : KW.has(t) && !asName ? "k" : /^[@#]/.test(t) ? "a" : /^[A-Z]/.test(t) ? "t" : ""
    out.push(cls ? <span key={m.index} className={cls}>{t}</span> : t)
    last = re.lastIndex
  }
  if (last < src.length) out.push(src.slice(last))
  return out
}

export function CodeBlock({ code }: { code: string | null }) {
  if (!code) return null
  return (
    <pre className="code-block mt-6 overflow-x-auto rounded-lg bg-editor py-3.5 font-mono text-code text-editor-foreground" tabIndex={0} aria-label="Code example">
      <code>{code.split("\n").map((l, i) => <span key={i} className="l">{highlightLine(l)}</span>)}</code>
    </pre>
  )
}
