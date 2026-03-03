// admin-web/src/components/AdminSmokePanel.tsx
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import { useAdminSession } from "../AdminSessionContext";
import { useAsyncPanelState } from "../lib/useAsyncPanelState";

export default function AdminSmokePanel() {
  const { user, isAllowed, authzMessage, ensureAdmin, can } = useAdminSession();
  const panel = useAsyncPanelState();
  const adminDocPath = "admin/smoke";

  const onWrite = async () => {
    if (!isAllowed || !user || !can("diagnostics.access")) {
      panel.clear();
      return;
    }

    panel.start();
    try {
      await ensureAdmin("diagnostics.access");

      const requestId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const callWrite = httpsCallable(functions, "adminSmokeWrite");
      const res = await callWrite({
        requestId,
        reason: "admin-web: diagnostics smoke write",
        payload: { note: "smoke-write" },
      });

      panel.succeed(
        JSON.stringify(
          {
            ok: true,
            callable: "adminSmokeWrite",
            requestId,
            result: res.data,
            target: adminDocPath,
            payload: { note: "smoke-write" },
          },
          null,
          2
        )
      );
    } catch (e: unknown) {
      panel.fail(e, "write failed");
    }
  };

  const onRead = async () => {
    if (!isAllowed || !can("diagnostics.access")) {
      panel.clear();
      return;
    }

    panel.start();
    try {
      await ensureAdmin("diagnostics.access");

      const callRead = httpsCallable(functions, "adminSmokeRead");
      const res = await callRead({});

      panel.succeed(
        JSON.stringify(
          {
            ok: true,
            callable: "adminSmokeRead",
            target: adminDocPath,
            result: res.data,
          },
          null,
          2
        )
      );
    } catch (e: unknown) {
      panel.fail(e, "read failed");
    }
  };

  return (
    <div style={{ marginTop: 16 }}>
      <div>
        <b>/admin/** Firestore smoke test</b>
      </div>
      <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>target: {adminDocPath}</div>

      {!isAllowed && <div style={{ marginTop: 8, color: "crimson" }}>{authzMessage}</div>}
      {isAllowed && !can("diagnostics.access") && (
        <div style={{ marginTop: 8, color: "crimson" }}>
          権限がありません（diagnostics.access が必要）
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button onClick={onWrite} disabled={panel.busy || !isAllowed || !can("diagnostics.access")}>
          {panel.busy ? "処理中..." : "Write"}
        </button>
        <button onClick={onRead} disabled={panel.busy || !isAllowed || !can("diagnostics.access")}>
          {panel.busy ? "処理中..." : "Read"}
        </button>
      </div>

      {panel.error && (
        <div style={{ marginTop: 8, color: "crimson", whiteSpace: "pre-wrap" }}>{panel.error}</div>
      )}

      {panel.json && (
        <pre
          style={{
            marginTop: 8,
            padding: 10,
            background: "#f7f7f7",
            borderRadius: 8,
            overflowX: "auto",
          }}
        >
          {panel.json}
        </pre>
      )}
    </div>
  );
}