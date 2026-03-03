// src/components/AdminSettingsPanel.tsx
import { useEffect, useMemo, useState } from "react";

export type AdminSettingsPanelProps = {
  isAllowed: boolean;
  authzMessage: string;

  busy: boolean;
  error: string;
  json: string;

  maintenanceMode: boolean;
  onChangeMaintenanceMode: (v: boolean) => void;

  announcement: string;
  onChangeAnnouncement: (v: string) => void;

  onLoad: () => Promise<void>;
  onSave: () => Promise<void>;
  canWrite: boolean;
};

type Snapshot = {
  maintenanceMode: boolean;
  announcement: string;
};

function normalizeAdminSettingsError(raw: string): string {
  const s = (raw || "").trim();
  if (!s) return "";

  const lower = s.toLowerCase();

  // Permission
  if (
    lower.includes("permission-denied") ||
    lower.includes("missing or insufficient permissions") ||
    lower.includes("insufficient permissions")
  ) {
    return "権限がありません（permission-denied）";
  }

  // Unauthenticated / not logged in
  if (lower.includes("unauthenticated") || lower.includes("not logged in")) {
    return "ログインが必要です（unauthenticated）";
  }

  // Network / unavailable
  if (
    lower.includes("unavailable") ||
    lower.includes("network") ||
    lower.includes("failed to fetch") ||
    lower.includes("fetch") && lower.includes("failed")
  ) {
    return "ネットワークエラー（unavailable）";
  }

  // Timeout
  if (lower.includes("deadline-exceeded") || lower.includes("timeout")) {
    return "タイムアウトしました（deadline-exceeded）";
  }

  return s; // その他はそのまま
}

function tryReadSnapshotFromJson(json: string): Snapshot | null {
  if (!json) return null;
  try {
    const obj = JSON.parse(json) as any;
    if (obj?.path !== "admin/settings") return null;

    const d = obj?.data;
    if (!d) return null;

    const mm =
      typeof d.maintenanceMode === "boolean" ? d.maintenanceMode : false;
    const ann = typeof d.announcement === "string" ? d.announcement : "";

    return { maintenanceMode: mm, announcement: ann };
  } catch {
    return null;
  }
}

export default function AdminSettingsPanel(props: AdminSettingsPanelProps) {
  // ---- Step10: validation ----
  const maxAnnouncementLen = 500;
  const annLen = props.announcement.length;
  const annTooLong = annLen > maxAnnouncementLen;

  const baseDisabled = !props.isAllowed || props.busy;
  const saveDisabled = baseDisabled || annTooLong || !props.canWrite;

  // ---- Step11: pending action label ----
  const [pendingAction, setPendingAction] = useState<"load" | "save" | null>(
    null
  );

  const loadLabel =
    props.busy && pendingAction === "load" ? "読込中..." : "Load";
  const saveLabel =
    props.busy && pendingAction === "save" ? "保存中..." : "Save";

  // ---- Step13: baseline snapshot (for dirty) ----
  const [baseline, setBaseline] = useState<Snapshot | null>(null);

  // 初回は現状値をベースラインにする（「いきなり未保存」にならないように）
  useEffect(() => {
    if (baseline) return;
    setBaseline({
      maintenanceMode: props.maintenanceMode,
      announcement: props.announcement,
    });
  }, [baseline, props.maintenanceMode, props.announcement]);

  // Load/Save 結果の JSON が更新されたら、そこからベースラインを更新する
  useEffect(() => {
    const snap = tryReadSnapshotFromJson(props.json);
    if (snap) setBaseline(snap);

    // saved=true のときだけ Saved を出す（loadのjsonではSavedを消す）
    try {
      const obj = props.json ? (JSON.parse(props.json) as any) : null;
      if (obj?.path === "admin/settings") {
        if (obj?.saved === true) {
          setSavedAtMs(Date.now());
        } else if (obj?.exists !== undefined) {
          // load結果（existsがある）ならSavedは消す
          setSavedAtMs(null);
        }
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.json]);

  const isDirty = useMemo(() => {
    if (!baseline) return false;
    return (
      props.maintenanceMode !== baseline.maintenanceMode ||
      props.announcement !== baseline.announcement
    );
  }, [baseline, props.maintenanceMode, props.announcement]);

  // ---- Step12: Saved indicator ----
  const [savedAtMs, setSavedAtMs] = useState<number | null>(null);

  // 入力が変わったら Saved を消す（未保存になる）
  useEffect(() => {
    if (!savedAtMs) return;
    if (isDirty) setSavedAtMs(null);
  }, [isDirty, savedAtMs]);

  const savedLabel = useMemo(() => {
    if (!savedAtMs) return "";
    const t = new Date(savedAtMs).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    return `Saved (${t})`;
  }, [savedAtMs]);

  // ---- Step13: normalized error ----
  const normalizedError = useMemo(
    () => normalizeAdminSettingsError(props.error),
    [props.error]
  );

  return (
    <div>
      <div>
        <b>A) admin/settings（単一設定）</b>
      </div>
      <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
        target: admin/settings
      </div>

      {!props.isAllowed && (
        <div style={{ marginTop: 8, color: "crimson" }}>{props.authzMessage}</div>
      )}

      <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
        <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={props.maintenanceMode}
            onChange={(e) => props.onChangeMaintenanceMode(e.target.checked)}
            disabled={baseDisabled}
          />
          <span>maintenanceMode（メンテON）</span>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <div
            style={{ display: "flex", justifyContent: "space-between", gap: 12 }}
          >
            <span>announcement（運営メッセージ）</span>
            <span
              style={{
                fontSize: 12,
                color: annTooLong ? "crimson" : "inherit",
                opacity: annTooLong ? 1 : 0.75,
                whiteSpace: "nowrap",
              }}
            >
              {annLen}/{maxAnnouncementLen}
            </span>
          </div>

          <textarea
            value={props.announcement}
            onChange={(e) => props.onChangeAnnouncement(e.target.value)}
            rows={4}
            placeholder="例：メンテ予定／告知など"
            disabled={baseDisabled}
          />

          <div style={{ fontSize: 12, opacity: 0.75 }}>
            文字数は 0〜{maxAnnouncementLen} 文字です（空欄OK）。
          </div>

          {annTooLong && (
            <div style={{ fontSize: 12, color: "crimson", whiteSpace: "pre-wrap" }}>
              文字数が上限（{maxAnnouncementLen}）を超えています。
              {maxAnnouncementLen} 文字以内にしてください。
            </div>
          )}
        </label>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={async () => {
              setSavedAtMs(null);
              setPendingAction("load");
              try {
                await props.onLoad();
              } finally {
                setPendingAction(null);
              }
            }}
            disabled={baseDisabled}
          >
            {loadLabel}
          </button>

          <button
            onClick={async () => {
              setPendingAction("save");
              try {
                await props.onSave();
                // savedAtMs は props.json の saved=true でもセットされるが、
                // 念のためここでもセット（表示タイミングが安定する）
                setSavedAtMs(Date.now());
              } finally {
                setPendingAction(null);
              }
            }}
            disabled={saveDisabled}
          >
            {saveLabel}
          </button>

          {/* Step13: dirty / Step12: saved */}
          {isDirty ? (
            <span style={{ fontSize: 12, color: "crimson", whiteSpace: "nowrap" }}>
              未保存
            </span>
          ) : savedAtMs ? (
            <span style={{ fontSize: 12, opacity: 0.75, whiteSpace: "nowrap" }}>
              {savedLabel}
            </span>
          ) : null}
        </div>

        {!props.canWrite && props.isAllowed && (
          <div style={{ color: "crimson", whiteSpace: "pre-wrap" }}>
            権限がありません（settings.write が必要）
          </div>
        )}

        {normalizedError && (
          <div style={{ color: "crimson", whiteSpace: "pre-wrap" }}>
            {normalizedError}
          </div>
        )}

        {props.json && (
          <pre
            style={{
              marginTop: 4,
              padding: 10,
              background: "#f7f7f7",
              borderRadius: 8,
              overflowX: "auto",
            }}
          >
            {props.json}
          </pre>
        )}
      </div>
    </div>
  );
}