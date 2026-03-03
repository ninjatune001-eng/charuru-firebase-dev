// admin-web/src/components/DiagnosticsPage.tsx
import AdminSmokePanel from "./AdminSmokePanel";
import { useAdminSession } from "../AdminSessionContext";

type Props = {
  onBack?: () => void;
};

function isDiagnosticsEnabled(): boolean {
  const v: any = (import.meta as any).env?.VITE_ENABLE_DIAGNOSTICS;
  if (typeof v === "boolean") return v;
  return String(v).toLowerCase() === "true";
}

export default function DiagnosticsPage({ onBack }: Props) {
  const { isAllowed, authzMessage, can } = useAdminSession();
  const enabled = isDiagnosticsEnabled();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    // ハッシュ運用を前提に、トップへ戻す（次ステップでApp側の分岐に合わせて調整）
    window.location.hash = "";
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Diagnostics</h3>
        <button onClick={handleBack}>戻る</button>
      </div>

      {!enabled && (
        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
          <b>Diagnostics は無効です</b>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
            VITE_ENABLE_DIAGNOSTICS=true のときだけ表示されます。
          </div>
        </div>
      )}

      {enabled && (!isAllowed || !can("diagnostics.access")) && (
        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, color: "crimson" }}>
          {authzMessage}
        </div>
      )}

      {enabled && isAllowed && can("diagnostics.access") && (
        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
          <AdminSmokePanel />
        </div>
      )}
    </div>
  );
}