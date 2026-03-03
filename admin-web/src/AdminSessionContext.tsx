// admin-web/src/AdminSessionContext.tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "./firebase";
import { refreshAdminAuthz } from "./lib/ensureAdminAuthz";
import { hasCapability, type AuthzState, type CapabilityKey } from "./lib/authz";

export type AdminSession = {
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

type AdminSessionContextValue = {
  session: AdminSession;
  setSession: Dispatch<SetStateAction<AdminSession>>;

  user: User | null;
  authz: AuthzState;
  isAllowed: boolean;
  authzMessage: string;

  ensureAdmin: (capability?: CapabilityKey) => Promise<void>;
  can: (capability: CapabilityKey) => boolean;
};

const Ctx = createContext<AdminSessionContextValue | null>(null);

// deep link（#/diagnostics 等）をログイン後に復帰するための一時保存キー
const RETURN_TO_KEY = "admin-web:returnToHash";

function getRootPath(): string {
  const baseUrl = (import.meta as any).env?.BASE_URL ?? "/";
  const basePath = String(baseUrl).replace(/\/$/, ""); // "/admin/" -> "/admin", "/" -> ""
  return basePath === "" ? "/" : `${basePath}/`;
}

function replaceToHash(hash: string) {
  if (typeof window === "undefined") return;
  if (!hash.startsWith("#/")) return;

  const rootPath = getRootPath();
  const search = window.location.search ?? "";
  history.replaceState(null, "", `${rootPath}${search}${hash}`);
  // replaceState は hashchange を発火しないため、ルーター側の同期を促す
  try {
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } catch {
    window.dispatchEvent(new Event("hashchange"));
  }
}

// 初回ロード時点の hash を同期的に捕まえる（初回レンダー前）
// 例: "/diagnostics" 直打ち → main.tsx で "#/diagnostics" に正規化済み → ここで保存
(function captureInitialReturnTo() {
  if (typeof window === "undefined") return;
  try {
    const existing = window.sessionStorage.getItem(RETURN_TO_KEY);
    if (existing) return;

    const h = window.location.hash ?? "";
    if (h.startsWith("#/") && h !== "#/") {
      window.sessionStorage.setItem(RETURN_TO_KEY, h);
    }
  } catch {
    // ignore
  }
})();

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AdminSession>(() => ({
    user: auth.currentUser ?? null,
    authz: EMPTY_AUTHZ,
  }));

  // リロード/直打ちでもログイン状態を復元する
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setSession((prev) => ({
        ...prev,
        user: u,
        authz: u ? prev.authz : EMPTY_AUTHZ,
      }));

      // サインイン時は権限状態も更新（表示用）
      if (u) {
        void refreshAdminAuthz({
          auth,
          onAuthz: (next) => setSession((prev) => ({ ...prev, authz: next })),
        }).catch(() => {
          // ignore
        });

        // ログイン後に deep link を復帰（今が "#/" に戻されている場合のみ）
        try {
          const ret = window.sessionStorage.getItem(RETURN_TO_KEY);
          if (
            ret &&
            (window.location.hash === "" ||
              window.location.hash === "#" ||
              window.location.hash === "#/")
          ) {
            replaceToHash(ret);
          }
          window.sessionStorage.removeItem(RETURN_TO_KEY);
        } catch {
          // ignore
        }
      }
    });

    return () => unsub();
  }, []);

  const ensureAdmin = useCallback(async (capability?: CapabilityKey) => {
    const { authz } = await refreshAdminAuthz({
      auth,
      onAuthz: (next) => setSession((prev) => ({ ...prev, authz: next })),
    });

    if (!authz.isAllowed) throw new Error(authz.message);
    if (capability && !hasCapability(authz, capability)) {
      throw new Error(`権限がありません（${capability} が必要）`);
    }
  }, []);

  const value = useMemo<AdminSessionContextValue>(() => {
    const user = session.user;
    const authz = session.authz;
    return {
      session,
      setSession,
      user,
      authz,
      isAllowed: authz.isAllowed,
      authzMessage: authz.message,
      ensureAdmin,
      can: (capability: CapabilityKey) => hasCapability(authz, capability),
    };
  }, [session, ensureAdmin]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdminSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error("AdminSessionProvider is missing");
  return v;
}