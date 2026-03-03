import type { Auth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import {
  authzFromStaffDoc,
  hasCapability,
  type AuthzState,
  type CapabilityKey,
  type StaffDoc,
} from "./authz";

type EnsureAdminParams = {
  auth: Auth;
  onAuthz?: (next: AuthzState) => void;
};

export type RefreshAdminAuthzResult = {
  authz: AuthzState;
  claims: Record<string, unknown>;
  staff: StaffDoc | null;
};

export async function refreshAdminAuthz({
  auth,
  onAuthz,
}: EnsureAdminParams): Promise<RefreshAdminAuthzResult> {
  const user = auth.currentUser;
  if (!user) throw new Error("not logged in");

  const staffSnap = await getDoc(doc(db, "admin", "staff", user.uid));
  const staff = staffSnap.exists() ? (staffSnap.data() as StaffDoc) : null;

  const authz = authzFromStaffDoc(staff);
  onAuthz?.(authz);

  return { authz, staff, claims: { staff } };
}

export async function ensureAdminAuthz(params: EnsureAdminParams): Promise<AuthzState> {
  const { authz } = await refreshAdminAuthz(params);
  if (!authz.isAllowed) throw new Error(authz.message);
  return authz;
}

export async function ensureAdminCapability(
  params: EnsureAdminParams & { capability: CapabilityKey }
): Promise<AuthzState> {
  const authz = await ensureAdminAuthz(params);
  if (!hasCapability(authz, params.capability)) {
    throw new Error(`権限がありません（${params.capability} が必要）`);
  }
  return authz;
}
