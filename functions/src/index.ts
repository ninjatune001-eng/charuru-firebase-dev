import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { setGlobalOptions } from "firebase-functions";
import { onCall, HttpsError, onRequest } from "firebase-functions/https";
import { FieldValue } from "firebase-admin/firestore";

setGlobalOptions({ maxInstances: 10 });

admin.initializeApp();
const db = admin.firestore();

type Actor = {
  uid: string;
  role: string; // "owner" | "staff" | "admin" | "support" | ""
  disabled: boolean;
  capabilities: string[];
  visibility: "OWNER_ONLY" | "STAFF";
};

function normalizeCapabilities(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => String(x ?? "").trim())
    .filter((s) => s.length > 0);
}

function requireCapability(actor: Actor, capability: string) {
  if (actor.disabled) throw new HttpsError("permission-denied", "disabled");
  if (!actor.capabilities.includes(capability)) {
    throw new HttpsError("permission-denied", `missing capability: ${capability}`);
  }
}

async function requireAdminActor(req: any): Promise<Actor> {
  if (!req.auth) throw new HttpsError("unauthenticated", "login required");

  const uid = req.auth.uid;

  const staffSnap = await db.doc(`admin_staff/${uid}`).get();
  if (!staffSnap.exists) {
    // admin_staff/{uid} がソース。未登録は常に拒否。
    throw new HttpsError("permission-denied", "staff not registered");
  }

  const staff = staffSnap.data() as any;
  const role = String(staff?.role ?? "").trim();
  const disabled = staff?.disabled === true;
  const capabilities = normalizeCapabilities(staff?.capabilities);

  if (disabled) throw new HttpsError("permission-denied", "disabled");

  // role は表示/可視性のために保持（権限判断は capabilities が主）
  const visibility: Actor["visibility"] = role === "owner" ? "OWNER_ONLY" : "STAFF";

  return { uid, role, disabled, capabilities, visibility };
}

/**
 * 既存（動作確認用）
 */
export const helloWorld = onRequest((_request, response) => {
  logger.info("Hello logs!", { structuredData: true });
  response.send("Hello from Firebase!");
});

/**
 * 管理API：admin/settings を更新（移行1本目）
 * - 既存DB構造に合わせ、冪等/監査ログはトップレベルコレクションに置く
 * - RBACは admin_staff/{uid}.capabilities を強制（settings.write）
 */
export const adminUpdateSettings = onCall(async (req) => {
  const actor = await requireAdminActor(req);
  requireCapability(actor, "settings.write");

  const requestId = String((req.data?.requestId ?? "").trim());
  const reason = String((req.data?.reason ?? "").trim());
  const patch = req.data?.patch;

  if (!requestId) throw new HttpsError("invalid-argument", "requestId required");
  if (!reason) throw new HttpsError("invalid-argument", "reason required");
  if (!patch || typeof patch !== "object") {
    throw new HttpsError("invalid-argument", "patch required");
  }

  const settingsRef = db.doc("admin/settings");
  const idemRef = db.collection("admin_idempotency").doc(requestId);
  const auditRef = db.collection("admin_audit_logs").doc();

  try {
    await db.runTransaction(async (tx) => {
      const idemSnap = await tx.get(idemRef);
      if (idemSnap.exists) return;

      tx.set(idemRef, {
        op: "settings.update",
        requestId,
        actorUid: actor.uid,
        createdAt: FieldValue.serverTimestamp(),
        status: "succeeded",
      });

      tx.set(
        settingsRef,
        {
          ...patch,
          updatedAt: FieldValue.serverTimestamp(),
          updatedByUid: actor.uid,
        },
        { merge: true }
      );

      tx.set(auditRef, {
        at: FieldValue.serverTimestamp(),
        action: "settings.update",
        capabilityKey: "settings.write",
        actorUid: actor.uid,
        actorRole: actor.role,
        visibility: actor.visibility,
        targetType: "admin_settings",
        targetId: "admin/settings",
        summary: { requestId, reason, keys: Object.keys(patch) },
        result: "success",
      });
    });

    return { ok: true, requestId };
  } catch (e: any) {
    logger.error("adminUpdateSettings failed", e);
    throw new HttpsError("internal", "failed");
  }
});

/**
 * ★Diagnostics / Smoke（Write）
 * - Functions経由で admin/smoke を更新する
 * - RBACは admin_staff/{uid}.capabilities を強制（diagnostics.access）
 */
export const adminSmokeWrite = onCall(async (req) => {
  const actor = await requireAdminActor(req);
  requireCapability(actor, "diagnostics.access");

  const requestId = String((req.data?.requestId ?? "").trim());
  const reason = String((req.data?.reason ?? "").trim());
  const payload = req.data?.payload;

  if (!requestId) throw new HttpsError("invalid-argument", "requestId required");
  if (!reason) throw new HttpsError("invalid-argument", "reason required");
  if (!payload || typeof payload !== "object") {
    throw new HttpsError("invalid-argument", "payload required");
  }

  const smokeRef = db.doc("admin/smoke");
  const idemRef = db.collection("admin_idempotency").doc(requestId);
  const auditRef = db.collection("admin_audit_logs").doc();

  try {
    await db.runTransaction(async (tx) => {
      const idemSnap = await tx.get(idemRef);
      if (idemSnap.exists) return;

      tx.set(idemRef, {
        op: "diagnostics.smoke.write",
        requestId,
        actorUid: actor.uid,
        createdAt: FieldValue.serverTimestamp(),
        status: "succeeded",
      });

      tx.set(
        smokeRef,
        {
          ...payload,
          updatedAt: FieldValue.serverTimestamp(),
          updatedByUid: actor.uid,
        },
        { merge: true }
      );

      tx.set(auditRef, {
        at: FieldValue.serverTimestamp(),
        action: "diagnostics.smoke.write",
        capabilityKey: "diagnostics.access",
        actorUid: actor.uid,
        actorRole: actor.role,
        visibility: actor.visibility,
        targetType: "admin_smoke",
        targetId: "admin/smoke",
        summary: { requestId, reason, keys: Object.keys(payload) },
        result: "success",
      });
    });

    return { ok: true, requestId };
  } catch (e: any) {
    logger.error("adminSmokeWrite failed", e);
    throw new HttpsError("internal", "failed");
  }
});

/**
 * ★Diagnostics / Smoke（Read）
 * - RBACは admin_staff/{uid}.capabilities を強制（diagnostics.access）
 */
export const adminSmokeRead = onCall(async (req) => {
  const actor = await requireAdminActor(req);
  requireCapability(actor, "diagnostics.access");

  try {
    const snap = await db.doc("admin/smoke").get();
    return { ok: true, exists: snap.exists, data: snap.exists ? snap.data() : null, path: "admin/smoke" };
  } catch (e: any) {
    logger.error("adminSmokeRead failed", e);
    throw new HttpsError("internal", "failed");
  }
});