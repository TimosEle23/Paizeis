import Constants from "expo-constants";
import type { ApiErrorBody, ApiErrorCode } from "@paizeis/shared";

/**
 * The app's only route to data. Nothing else opens a network connection, and
 * no database driver exists in this package at all — the server is the only
 * thing that talks to MongoDB.
 */
const BASE_URL: string =
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
  "http://localhost:4000/api/v1";

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }

  /** The message to put in front of a person, without leaking internals. */
  get userMessage(): string {
    if (this.code === "SLOT_TAKEN") return "That slot has just been taken. Pick another.";
    if (this.code === "RATE_LIMITED") return "Too many attempts. Try again in a few minutes.";
    if (this.status >= 500) return "Something went wrong at our end. Try again.";
    return this.message;
  }
}

type TokenSource = () => Promise<string | null>;
type OnUnauthorized = () => Promise<string | null>;

let getAccessToken: TokenSource = async () => null;
let refreshAccessToken: OnUnauthorized = async () => null;

/** Wired up once by the auth provider, so screens never handle tokens. */
export function configureAuth(source: TokenSource, onUnauthorized: OnUnauthorized): void {
  getAccessToken = source;
  refreshAccessToken = onUnauthorized;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** Set false for endpoints that must stay anonymous, e.g. sign-in. */
  authenticated?: boolean;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, authenticated = true } = options;

  const url = new URL(BASE_URL + path);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }

  const send = async (token: string | null): Promise<Response> =>
    fetch(url.toString(), {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

  let token = authenticated ? await getAccessToken() : null;
  let response = await send(token);

  // Access tokens last 15 minutes. One transparent retry after a refresh keeps
  // that invisible rather than bouncing someone to the sign-in screen mid-tap.
  if (response.status === 401 && authenticated) {
    token = await refreshAccessToken();
    if (token) response = await send(token);
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = (payload as ApiErrorBody | null)?.error;
    throw new ApiRequestError(
      response.status,
      error?.code ?? "INTERNAL",
      error?.message ?? "Request failed",
      error?.details,
    );
  }

  return payload as T;
}

export const apiBaseUrl = BASE_URL;
