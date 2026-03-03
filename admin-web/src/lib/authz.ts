export type AdminRole = "owner" | "staff";

export type CapabilityKey =
  | "diagnostics.access"
  | "settings.write"
  | "staff.manage";

export type StaffDoc = {
  role: AdminRole;
  disabled: boolean;
  capabilities: CapabilityKey[];
};

export type AuthzState = {
  isAllowed: boolean;
  message: string;
  role: AdminRole | null;
  disabled: boolean;
  capabilities: CapabilityKey[];
};

const VALID_CAPABILITIES: readonly CapabilityKey[] = [
  "diagnostics.access",
  "settings.write",
  "staff.manage",
];

function isCapabilityKey(v: unknown): v is CapabilityKey {
  return typeof v === "string" && VALID_CAPABILITIES.includes(v as CapabilityKey);
}

function normalizeCapabilities(raw: unknown): CapabilityKey[] {
  if (!Array.isArray(raw)) return [];
  const onlyValid = raw.filter(isCapabilityKey);
  return Array.from(new Set(onlyValid));
}

export function authzFromStaffDoc(staff: unknown): AuthzState {
  if (!staff || typeof staff !== "object") {
    return {
      isAllowed: false,
      message: "権限がありません（staff 未登録）",
      role: null,
      disabled: false,
      capabilities: [],
    };
  }

  const raw = staff as Record<string, unknown>;
  const role = raw.role;
  const disabled = raw.disabled === true;
  const capabilities = normalizeCapabilities(raw.capabilities);

  if (role !== "owner" && role !== "staff") {
    return {
      isAllowed: false,
      message: "権限がありません（role 不正）",
      role: null,
      disabled,
      capabilities: [],
    };
  }

  const resolvedCapabilities: CapabilityKey[] =
    role === "owner"
      ? Array.from(new Set<CapabilityKey>(["staff.manage", ...capabilities]))
      : capabilities;

  if (disabled) {
    return {
      isAllowed: false,
      message: "アカウントは無効化されています",
      role,
      disabled,
      capabilities: resolvedCapabilities,
    };
  }

  return {
    isAllowed: true,
    message: `OK（${role}）`,
    role,
    disabled,
    capabilities: resolvedCapabilities,
  };
}

export function hasCapability(authz: AuthzState, capability: CapabilityKey): boolean {
  if (!authz.isAllowed || authz.disabled) return false;
  if (capability === "staff.manage") return authz.role === "owner";
  return authz.capabilities.includes(capability);
}
