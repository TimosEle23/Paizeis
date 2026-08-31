/**
 * Lightweight client-side error reporting.
 *
 * Captures uncaught errors, unhandled promise rejections and React render
 * crashes with full stack traces, keeps a rolling buffer in sessionStorage and
 * exposes it on `window.__pezeisErrors` for quick diagnosis in any environment
 * (including production, where source of truth is the deployed bundle).
 */

export type ReportedError = {
  id: string;
  at: string;
  kind: "error" | "unhandledrejection" | "react" | "manual";
  message: string;
  stack?: string;
  componentStack?: string;
  source?: string;
  url: string;
  userAgent: string;
  reactCopies?: number;
};

const STORAGE_KEY = "pezeis:error-log";
const MAX_ENTRIES = 25;

let buffer: ReportedError[] = [];
let installed = false;

function loadBuffer(): ReportedError[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ReportedError[]) : [];
  } catch {
    return [];
  }
}

function persist() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(buffer.slice(-MAX_ENTRIES)));
  } catch {
    /* storage may be unavailable (private mode) */
  }
}

/**
 * Detects the "duplicated React copies" class of failures
 * (e.g. `null is not an object (evaluating 'dispatcher.useState')`).
 */
export function detectDuplicateReact(): number {
  const globalAny = window as unknown as Record<string, unknown>;
  const hook = globalAny.__REACT_DEVTOOLS_GLOBAL_HOOK__ as
    | { renderers?: Map<unknown, unknown> }
    | undefined;
  const renderers = hook?.renderers?.size ?? 0;
  return renderers;
}

export function getErrorLog(): ReportedError[] {
  return [...buffer];
}

export function clearErrorLog() {
  buffer = [];
  persist();
}

export function reportError(
  error: unknown,
  context: { kind?: ReportedError["kind"]; componentStack?: string; source?: string } = {},
): ReportedError {
  const err = error instanceof Error ? error : new Error(String(error));
  const reactCopies = detectDuplicateReact();

  const entry: ReportedError = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    kind: context.kind ?? "manual",
    message: err.message,
    stack: err.stack,
    componentStack: context.componentStack,
    source: context.source,
    url: window.location.href,
    userAgent: navigator.userAgent,
    reactCopies,
  };

  buffer = [...buffer, entry].slice(-MAX_ENTRIES);
  persist();
  (window as unknown as Record<string, unknown>).__pezeisErrors = buffer;

  // Always log with the stack attached so it is diagnosable from a shared console dump.
  console.error(
    `[pezeis:${entry.kind}] ${entry.message}\n${entry.stack ?? "(no stack)"}` +
      (entry.componentStack ? `\nComponent stack:${entry.componentStack}` : "") +
      (reactCopies > 1
        ? `\n⚠️ ${reactCopies} React renderers detected — likely duplicated React copies / stale bundler cache.`
        : ""),
  );

  return entry;
}

export function installErrorReporting() {
  if (installed) return;
  installed = true;

  buffer = loadBuffer();
  (window as unknown as Record<string, unknown>).__pezeisErrors = buffer;
  (window as unknown as Record<string, unknown>).__pezeisErrorLog = getErrorLog;

  window.addEventListener("error", (event) => {
    reportError(event.error ?? event.message, {
      kind: "error",
      source: `${event.filename}:${event.lineno}:${event.colno}`,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    reportError(event.reason, { kind: "unhandledrejection" });
  });

  const copies = detectDuplicateReact();
  if (copies > 1) {
    reportError(
      new Error(`Multiple React renderers detected (${copies}). Clear node_modules/.vite and restart the dev server.`),
      { kind: "react", source: "startup-check" },
    );
  }
}
