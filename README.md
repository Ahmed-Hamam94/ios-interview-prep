# iOS Interview Prep

Study app for iOS interviews: 174 questions across 17 topics, from Swift and SwiftUI to concurrency, architecture and system design. It schedules cards with spaced repetition, so what you forget comes back sooner.

## Study modes

| Mode | What it does |
|---|---|
| Spaced review | Flashcards that return right before you'd forget them. Grade yourself Again / Hard / Good / Easy. |
| Mixed review | Cards from several topics, shuffled. |
| Quiz | Multiple choice with close alternatives from the same topic. |
| Mock interview | Timed questions you answer out loud, then score yourself. |

Also: browse and search all answers, weak-spot tracking per topic, a daily streak, and **Back** to undo your last grade. Progress is saved in your browser (`localStorage`); export or import a JSON backup in Settings.

## Run it

Quickest: open [`ios_interview_prep_v2.html`](ios_interview_prep_v2.html). It's a single self-contained file and needs no server. Rebuild it after code changes.

From source (Node 20+):

```bash
cd app
pnpm install
pnpm dev      # http://localhost:5173
pnpm build    # type-check + production build into app/dist
pnpm lint
```

## Stack

React 19, TypeScript, Vite, Tailwind CSS 3, shadcn/ui (Radix). Design tokens live in `app/tailwind.config.js` and `app/src/index.css`.

## Layout

- `app/src/data.ts`: the question bank (ids must stay unique).
- `app/src/lib/srs.ts`: scheduling, session building, modes.
- `app/src/components/`: Home, Session, Screens (summary, browse, settings), SetupSheet.
- [`QUESTIONS.md`](QUESTIONS.md): the full question bank as readable text.

## License

[MIT](LICENSE)
