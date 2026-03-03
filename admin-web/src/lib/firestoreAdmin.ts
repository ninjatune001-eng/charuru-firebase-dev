// src/lib/firestoreAdmin.ts
import type { Firestore } from "firebase/firestore";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

export type AdminSettingsValues = {
  maintenanceMode: boolean;
  announcement: string;
};

export type AdminSettingsDoc = AdminSettingsValues & {
  updatedAt?: unknown;
  updatedByUid?: string;
};

function settingsRef(db: Firestore) {
  return doc(db, "admin", "settings");
}

/**
 * admin/settings を読み込み。ドキュメントが無ければ exists=false を返す。
 */
export async function loadAdminSettings(
  db: Firestore
): Promise<{ exists: boolean; data: AdminSettingsDoc }> {
  const snap = await getDoc(settingsRef(db));
  if (!snap.exists()) {
    return {
      exists: false,
      data: { maintenanceMode: false, announcement: "" },
    };
  }

  const raw = snap.data() as Partial<AdminSettingsDoc>;
  return {
    exists: true,
    data: {
      maintenanceMode: raw.maintenanceMode ?? false,
      announcement: raw.announcement ?? "",
      updatedAt: raw.updatedAt,
      updatedByUid: raw.updatedByUid,
    },
  };
}

/**
 * admin/settings を保存（merge）。updatedAt/updatedByUid も同時更新。
 */
export async function saveAdminSettings(
  db: Firestore,
  params: { values: AdminSettingsValues; updatedByUid: string }
): Promise<void> {
  await setDoc(
    settingsRef(db),
    {
      ...params.values,
      updatedAt: serverTimestamp(),
      updatedByUid: params.updatedByUid,
    },
    { merge: true }
  );
}