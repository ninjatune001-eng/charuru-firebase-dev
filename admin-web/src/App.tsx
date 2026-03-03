// admin-web/src/App.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import AuthPanel from "./components/AuthPanel";
import AdminSettingsContainer from "./components/AdminSettingsContainer";
import DiagnosticsPage from "./components/DiagnosticsPage";
import { AdminSessionProvider, useAdminSession } from "./AdminSessionContext";

function isDiagnosticsEnabled(): boolean {
  const v = import.meta.env.VITE_ENABLE_DIAGNOSTICS;
  return String(v).toLowerCase() === "true";
}

function normalizeHash(h: string): string {
  const noQuery = h.split("?")[0];
  return noQuery.endsWith("/") ? noQuery.slice(0, -1) : noQuery;
}

function AppInner() {
  const { user, isAllowed, authzMessage, can } = useAdminSession();

  const diagnosticsEnabled = useMemo(() => isDiagnosticsEnabled(), []);
  const [hash, setHash] = useState(() => window.location.hash);

  const replaceHash = useCallback((nextHash: string) => {
    const url = new URL(window.location.href);
    url.hash = nextHash;
    window.history.replaceState(null, "", url.toString());
    // replaceState は hashchange を発火しないので state も更新
    setHash(nextHash);
  }, []);

  useEffect(() => {
    const sync = () => setHash(window.location.hash);

    // ★重要：起動直後に1回同期（main.tsx の replaceState 正規化を拾う）
    sync();

    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
    };
  }, []);

  const isDiagnosticsRoute = normalizeHash(hash) === "#/diagnostics";
  const canOpenDiagnostics = !!user && isAllowed && diagnosticsEnabled && can("diagnostics.access");

  // ★ここがポイント：
  // diagnostics 直打ちの瞬間は user/isAllowed が未確定になりやすいので、
  // 「未確認」の間は #/ へ戻さず待つ。
  useEffect(() => {
    if (!isDiagnosticsRoute) return;

    // フラグで無効なら戻す（確定）
    if (!diagnosticsEnabled) {
      replaceHash("#/");
      return;
    }

    // 未ログインは「diagnosticsのURLのまま」ログインUIを出す（戻さない）
    if (!user) return;

    // 権限がまだ未確認なら待つ（戻さない）
    if (authzMessage === "未確認") return;

    // 権限が確定して「不可」ならトップへ戻す
    if (!canOpenDiagnostics) replaceHash("#/");
  }, [
    isDiagnosticsRoute,
    diagnosticsEnabled,
    user,
    authzMessage,
    canOpenDiagnostics,
    replaceHash,
  ]);

  const openDiagnostics = () => {
    window.location.hash = "#/diagnostics";
  };

  const backToHome = () => {
    replaceHash("#/");
  };

  // diagnosticsルートでは、開けない間も AuthPanel を表示して空白回避
  const showAuthPanel = !isDiagnosticsRoute || !canOpenDiagnostics;

  return (
    <div style={{ maxWidth: 560, margin: "40px auto", padding: 16 }}>
      <h2 style={{ marginBottom: 16 }}>管理者ログイン（Emulator）</h2>

      {showAuthPanel && <AuthPanel />}

      {isDiagnosticsRoute && canOpenDiagnostics && (
        <div style={{ marginTop: 12 }}>
          <DiagnosticsPage onBack={backToHome} />
        </div>
      )}

      {!isDiagnosticsRoute && user && (
        <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
          <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
            <AdminSettingsContainer />

            {canOpenDiagnostics && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <button onClick={openDiagnostics}>Diagnostics</button>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ marginTop: 16, fontSize: 12, opacity: 0.7 }}>
        接続先: Auth Emulator 127.0.0.1:9099 / Firestore Emulator 127.0.0.1:8180
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AdminSessionProvider>
      <AppInner />
    </AdminSessionProvider>
  );
}