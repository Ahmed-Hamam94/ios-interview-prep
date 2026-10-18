import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { ThemeProvider } from "next-themes"
import "./index.css"
import App from "./App"
import { Toaster } from "@/components/ui/sonner"
import { ProgressProvider } from "@/lib/progress"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="theme" disableTransitionOnChange>
      <ProgressProvider>
        <App />
        <Toaster position="bottom-center" />
      </ProgressProvider>
    </ThemeProvider>
  </StrictMode>,
)
