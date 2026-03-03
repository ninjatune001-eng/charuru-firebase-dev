// functions/setAdminClaims.mjs
import admin from "firebase-admin";

// Auth Emulator に接続
process.env.FIREBASE_AUTH_EMULATOR_HOST =
  process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";

// projectId は必要（あなたのプロジェクトに合わせてOK）
const projectId =
  process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || "charuru-dev-2026japan";

admin.initializeApp({ projectId });

const uid = process.argv[2];
if (!uid) {
  console.error("Usage: node setAdminClaims.mjs <UID>");
  process.exit(1);
}

await admin.auth().setCustomUserClaims(uid, { admin: true, owner: true });
const u = await admin.auth().getUser(uid);

console.log("OK setCustomUserClaims:", uid);
console.log("customClaims:", u.customClaims);
process.exit(0);