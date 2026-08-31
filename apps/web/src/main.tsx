import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import { LanguageProvider } from "@/hooks/useLanguage";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { installErrorReporting } from "@/lib/errorReporting";
import App from "./App.tsx";
import "./index.css";

installErrorReporting();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <ThemeProvider attribute="class" defaultTheme="dark" storageKey="paizeis-theme" disableTransitionOnChange={false}>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </ThemeProvider>
  </ErrorBoundary>
);
