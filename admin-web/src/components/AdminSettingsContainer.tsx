// admin-web/src/components/AdminSettingsContainer.tsx
import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import AdminSettingsPanel from "./AdminSettingsPanel";
import { loadAdminSettings } from "../lib/firestoreAdmin";
import { db, functions } from "../firebase";
import { useAdminSession } from "../AdminSessionContext";
import { useAsyncPanelState } from "../lib/useAsyncPanelState";

export default function AdminSettingsContainer() {
  const { user, isAllowed, authzMessage, ensureAdmin, can } = useAdminSession();
  const panel = useAsyncPanelState();

  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const onLoad = async () => {
    if (!isAllowed) {
      panel.clear();
      return;
    }

    panel.start();
    try {
      await ensureAdmin();

      const res = await loadAdminSettings(db);

      setMaintenanceMode(res.data.maintenanceMode);
      setAnnouncement(res.data.announcement);

      panel.succeed(
        JSON.stringify(
          { ok: true, exists: res.exists, path: "admin/settings", data: res.data },
          null,
          2
        )
      );
    } catch (e: unknown) {
      panel.fail(e, "load failed");
    }
  };

  const onSave = async () => {
    if (!isAllowed || !user) {
      panel.clear();
      return;
    }

    panel.start();
    try {
      await ensureAdmin("settings.write");

      const requestId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const callUpdate = httpsCallable(functions, "adminUpdateSettings");

      const res = await callUpdate({
        requestId,
        reason: "admin-web: update admin/settings",
        patch: { maintenanceMode, announcement },
      });

      panel.succeed(
        JSON.stringify(
          {
            ok: true,
            path: "admin/settings",
            saved: true,
            data: { maintenanceMode, announcement },

            callable: "adminUpdateSettings",
            requestId,
            result: res.data,
            patch: { maintenanceMode, announcement },
          },
          null,
          2
        )
      );
    } catch (e: unknown) {
      panel.fail(e, "save failed");
    }
  };

  return (
    <div style={{ marginTop: 16 }}>
      <AdminSettingsPanel
        isAllowed={isAllowed}
        authzMessage={authzMessage}
        busy={panel.busy}
        error={panel.error}
        json={panel.json}
        maintenanceMode={maintenanceMode}
        onChangeMaintenanceMode={setMaintenanceMode}
        announcement={announcement}
        onChangeAnnouncement={setAnnouncement}
        onLoad={onLoad}
        onSave={onSave}
        canWrite={can("settings.write")}
      />
    </div>
  );
}