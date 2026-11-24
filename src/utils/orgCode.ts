import type { FileDropModeId, Member, OrgAccountMode, TenantData } from '../types/system';

/**
 * Generates a unique organization / drop-hub code in ORG-XXXX format
 * that does not collide with any existing tenant key.
 */
export function generateUniqueOrgCode(
  existingTenants: Record<string, TenantData>,
  rng: () => number = Math.random
): string {
  const existingKeys = new Set(
    Object.keys(existingTenants).map((k) => k.trim().toUpperCase())
  );

  for (let attempt = 0; attempt < 200; attempt += 1) {
    const num = Math.floor(1000 + rng() * 9000);
    const candidate = `ORG-${num}`;
    const compact = `ORG${num}`;
    if (!existingKeys.has(candidate) && !existingKeys.has(compact)) {
      return candidate;
    }
  }

  return `ORG-${Date.now().toString().slice(-4)}`;
}

export function normalizeOrgLookupKey(
  input: string,
  tenants: Record<string, TenantData>
): string | null {
  const cleaned = input.trim().toUpperCase();
  if (!cleaned) return null;
  if (tenants[cleaned]) return cleaned;

  // Support entering ORG1375 or ORG-1375 interchangeably
  const stripped = cleaned.replace(/-/g, '');
  for (const key of Object.keys(tenants)) {
    if (key.toUpperCase().replace(/-/g, '') === stripped) {
      return key;
    }
  }
  return null;
}

export function isMemberCodeDuplicate(code: string, members: Member[]): boolean {
  const target = code.trim().toUpperCase();
  if (!target) return false;
  return members.some((m) => m.code.trim().toUpperCase() === target);
}

export function generateUniqueMemberCode(members: Member[]): string {
  const used = new Set(members.map((m) => m.code.trim().toUpperCase()));
  let idx = members.length + 1;
  while (idx < members.length + 5000) {
    const candidate = `M${String(idx).padStart(2, '0')}`;
    if (!used.has(candidate)) return candidate;
    idx += 1;
  }
  return `M${Date.now().toString().slice(-4)}`;
}

export function verifyGooglePortalAccess(
  orgInput: string,
  emailInput: string,
  tenants: Record<string, TenantData>
): { ok: true; orgId: string } | { ok: false; reason: 'invalid_org' | 'invalid_email' | 'email_mismatch' } {
  const matchedKey = normalizeOrgLookupKey(orgInput, tenants);
  if (!matchedKey) {
    return { ok: false, reason: 'invalid_org' };
  }
  const cleanEmail = emailInput.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { ok: false, reason: 'invalid_email' };
  }
  const tenant = tenants[matchedKey];
  if (tenant.ownerEmail && tenant.ownerEmail.trim().toLowerCase() !== cleanEmail) {
    return { ok: false, reason: 'email_mismatch' };
  }
  return { ok: true, orgId: matchedKey };
}

export function isValidGasWebAppUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('script.google.com');
  } catch {
    return false;
  }
}

export function inferDropModeFromCategory(category?: string): FileDropModeId {
  const c = (category || '').toLowerCase();
  if (c.includes('ส่วนตัว') || c.includes('ครอบครัว') || c.includes('personal') || c.includes('family')) {
    return 'personal_family';
  }
  if (c.includes('ร้านค้า') || c.includes('อีเวนท์') || c.includes('sme') || c.includes('ธุรกิจ') || c.includes('business') || c.includes('shop')) {
    return 'biz_event';
  }
  if (c.includes('อื่นๆ') || c.includes('other')) {
    return 'custom';
  }
  return 'org_edu';
}

export function getDefaultOwnerRoleTitle(mode: OrgAccountMode, lang: 'th' | 'en'): string {
  if (mode === 'org_2tier') {
    return lang === 'th' ? 'หัวหน้า / เจ้าขององค์กร' : 'Head / Owner';
  }
  if (mode === 'file_drop') {
    return lang === 'th' ? 'ผู้ดูแลจุดฝากไฟล์รวม' : 'Drop Hub Owner';
  }
  return lang === 'th' ? 'ผู้บริหาร / เจ้าขององค์กร' : 'Executive / Owner';
}

export function buildOrgCodeEmailHref(params: {
  email: string;
  orgId: string;
  orgName: string;
  ownerPin: string;
}): string {
  const subject = encodeURIComponent(`รหัสองค์กรเข้าใช้งาน: ${params.orgId} (${params.orgName})`);
  const body = encodeURIComponent(
    `ข้อมูลการเปิดองค์กร / จุดรวมไฟล์ใหม่\n` +
      `ชื่อองค์กร: ${params.orgName}\n` +
      `รหัสองค์กร: ${params.orgId}\n` +
      `รหัส PIN ผู้สมัครหลัก: ${params.ownerPin}\n\n` +
      `สามารถเปลี่ยนรหัสองค์กรเองภายหลังได้ในเมนูตั้งค่าหลังบ้าน`
  );
  return `mailto:${encodeURIComponent(params.email)}?subject=${subject}&body=${body}`;
}
