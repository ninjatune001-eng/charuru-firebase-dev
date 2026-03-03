// admin-web/src/lib/useAsyncPanelState.ts
import { useCallback, useState } from "react";

export type AsyncPanelState = {
  busy: boolean;
  error: string;
  json: string;

  start: () => void;
  succeed: (json: string) => void;
  fail: (e: unknown, fallbackMessage?: string) => void;

  setJson: (json: string) => void;
  clear: () => void;
};

function normalizeError(e: unknown, fallbackMessage = "failed"): string {
  if (!e) return fallbackMessage;

  if (typeof e === "string") return e.trim() || fallbackMessage;

  if (e instanceof Error) {
    const msg = (e.message ?? "").trim();
    return msg || fallbackMessage;
  }

  // FirebaseError など: { code, message }
  const anyE = e as any;
  const msg = typeof anyE?.message === "string" ? anyE.message.trim() : "";
  if (msg) return msg;

  const code = typeof anyE?.code === "string" ? anyE.code.trim() : "";
  if (code) return code;

  return fallbackMessage;
}

/**
 * busy/error/json を統一的に扱うための共通 hook
 */
export function useAsyncPanelState(): AsyncPanelState {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [json, setJson] = useState("");

  const start = useCallback(() => {
    setBusy(true);
    setError("");
    setJson("");
  }, []);

  const succeed = useCallback((nextJson: string) => {
    setBusy(false);
    setError("");
    setJson(nextJson ?? "");
  }, []);

  const fail = useCallback((e: unknown, fallbackMessage?: string) => {
    setBusy(false);
    setJson("");
    setError(normalizeError(e, fallbackMessage ?? "failed"));
  }, []);

  const clear = useCallback(() => {
    setBusy(false);
    setError("");
    setJson("");
  }, []);

  return {
    busy,
    error,
    json,
    start,
    succeed,
    fail,
    setJson: (v: string) => setJson(v ?? ""),
    clear,
  };
}