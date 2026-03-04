// admin-web/src/components/AuthPanel.tsx
import { useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "../firebase";
import { type AuthzState } from "../lib/authz";
import { useAdminSession } from "../AdminSessionContext";

export type AuthSession = {
  user: User | null;
  authz: AuthzState;
};

const EMPTY_AUTHZ: AuthzState = {
  isAllowed: false,
  message: "未確認",
  role: null,
  disabled: false,
  capabilities: [],
};

function toAdminEmail(idRaw: string) {
  const id = idRaw.trim();
  return id ? `${id}@admin.charuru.local` : "";
}

export default function AuthPanel() {
  const { session, setSession } = useAdminSession();
  const user = session.user;
  const authzState = session.authz;

  const [adminId, setAdminId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [claimsJson, setClaimsJson] = useState<string>("");

  const email = useMemo(() => toAdminEmail(adminId), [adminId]);

  const onLogin = async () => {
    setError("");
    setClaimsJson("");

    if (!email) {
      setError("管理者IDを入力してください");
      return;
    }
    if (!password) {
      setError("パスワードを入力してください");
      return;
    }

    setBusy(true);
    try {
      const { user: u } = await signInWithEmailAndPassword(auth, email, password);
      setSession((prev) => ({ ...prev, user: u }));

      try {
        const token = await u.getIdTokenResult(true);
        setClaimsJson(JSON.stringify(token.claims, null, 2));
      } catch {
        setClaimsJson("");
      }
    } catch (e: any) {
      setError(e?.message ?? "ログインに失敗しました");
      setSession({ user: null, authz: EMPTY_AUTHZ });
      setClaimsJson("");
    } finally {
      setBusy(false);
    }
  };

  const onLogout = async () => {
    setError("");
    setBusy(true);
    try {
      await signOut(auth);
    } finally {
      setBusy(false);
      setSession({ user: null, authz: EMPTY_AUTHZ });
      setClaimsJson("");
      setAdminId("");
      setPassword("");
    }
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {!user && (
        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>管理者ID（数字）</div>
          <input
            value={adminId}
            onChange={(e) => setAdminId(e.target.value)}
            placeholder="例: 1234"
            style={{ width: "100%", padding: 8, marginTop: 6 }}
            disabled={busy}
          />

          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 10 }}>
            内部メール（自動）: <b>{email || "-"}</b>
          </div>

          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 10 }}>パスワード</div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", padding: 8, marginTop: 6 }}
            disabled={busy}
          />

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={onLogin} disabled={busy}>
              {busy ? "ログイン中..." : "ログイン"}
            </button>
          </div>

          {error && (
            <div style={{ marginTop: 10, color: "crimson", whiteSpace: "pre-wrap" }}>
              {error}
            </div>
          )}
        </div>
      )}

      {user && (
        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <b>ログイン中</b>
            <button onClick={onLogout} disabled={busy}>
              {busy ? "処理中..." : "ログアウト"}
            </button>
          </div>

          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>email</div>
          <div>{user.email}</div>
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>uid</div>
          <div>{user.uid}</div>

          <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
            <b>権限</b>
            <span
              style={{
                fontSize: 12,
                padding: "2px 8px",
                borderRadius: 999,
                border: "1px solid #ddd",
                background: authzState.isAllowed ? "#f0fff4" : "#fff5f5",
              }}
            >
              {authzState.message}
            </span>
          </div>

          {claimsJson && (
            <pre
              style={{
                marginTop: 10,
                padding: 10,
                background: "#f7f7f7",
                borderRadius: 8,
                overflowX: "auto",
              }}
            >
              {claimsJson}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
