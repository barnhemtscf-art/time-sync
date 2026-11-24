import type {
  LangCode,
  ProfileCardFieldConfig,
  ProfileCardSubmission,
  ProfileDropHubConfig,
} from '../types/system';

export const DEFAULT_PROFILE_FIELD_CONFIG: ProfileCardFieldConfig = {
  showPhoto: true,
  showEducation: true,
  showExperience: true,
  showSkills: true,
  showAvailability: true,
  showEmergencyContact: true,
};

export const PRESET_SKILL_TAGS_TH = [
  'สื่อสารประสานงาน',
  'ใช้งานคอมพิวเตอร์ / Excel',
  'บริการลูกค้า / ต้อนรับ',
  'งานเอกสารและบัญชีเบื้องต้น',
  'ขับรถยนต์ / มีใบอนุญาตขับขี่',
  'ถ่ายภาพ / สื่อประชาสัมพันธ์',
  'ดูแลเด็ก / กิจกรรมกลุ่ม',
  'ภาษาอังกฤษสื่อสาร',
];

export const PRESET_AVAILABILITY_TH = [
  'พร้อมเริ่มงานทันที',
  'จันทร์–ศุกร์ เวลาทำการ',
  'ทำงานวันเสาร์-อาทิตย์ / เป็นกะได้',
  'สะดวกติดต่อช่วงเวลา 09:00–17:00 น.',
];

export function getDefaultProfileDropHub(
  orgNameTh: string,
  orgNameEn?: string
): ProfileDropHubConfig {
  return {
    enabled: true,
    headerTitleTh: `ฝากประวัติ / อัปเดตข้อมูลส่วนตัว · ${orgNameTh}`,
    headerTitleEn: `Submit Profile / Update Info · ${orgNameEn || orgNameTh}`,
    requirePasscode: false,
    passcode: '',
    fields: { ...DEFAULT_PROFILE_FIELD_CONFIG },
    submissions: [],
  };
}

export function getFormalMonogram(fullName: string): string {
  const cleaned = fullName.trim();
  if (!cleaned) return 'TW';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

function escapeHtml(raw: string | undefined): string {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function generatePrintableProfileHtml(
  sub: Omit<ProfileCardSubmission, 'id' | 'createdAt' | 'syncedToCentral'> & {
    createdAt?: string;
  },
  orgName: string,
  orgId: string
): string {
  const kindLabel =
    sub.kind === 'job_apply'
      ? 'เอกสารฝากประวัติสมัครงาน / แนะนำตัว'
      : 'แบบแจ้งอัปเดตข้อมูลส่วนบุคคล';
  const skillPills =
    sub.skills.length > 0
      ? sub.skills
          .map(
            (s) =>
              `<span style="display:inline-block;padding:4px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;margin:0 6px 6px 0;background:#f8fafc;">${escapeHtml(
                s
              )}</span>`
          )
          .join('')
      : '<span style="color:#64748b;font-size:13px;">-</span>';

  const avatarHtml = sub.photoDataUrl
    ? `<img src="${escapeHtml(
        sub.photoDataUrl
      )}" alt="Profile Photo" style="width:96px;height:116px;object-fit:cover;border-radius:8px;border:1px solid #cbd5e1;" />`
    : `<div style="width:96px;height:116px;border-radius:8px;border:1px solid #cbd5e1;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:700;color:#334155;">${escapeHtml(
        getFormalMonogram(sub.fullName)
      )}</div>`;

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(sub.fullName)} — ${escapeHtml(orgName)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 32px; background: #f8fafc; color: #0f172a; font-family: 'Noto Sans Thai', sans-serif; }
    .sheet { max-width: 720px; margin: 0 auto; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 12px; padding: 36px; }
    .top-bar { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 24px; font-size: 12px; color: #475569; }
    .header { display: flex; gap: 24px; align-items: flex-start; margin-bottom: 24px; }
    .section { border-top: 1px solid #e2e8f0; padding-top: 14px; margin-top: 14px; }
    .label { font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px; }
    .val { font-size: 14px; line-height: 1.6; white-space: pre-wrap; }
    @media print {
      body { background: #ffffff; padding: 0; }
      .sheet { border: none; padding: 16px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="top-bar">
      <strong>${escapeHtml(kindLabel)}</strong>
      <span>${escapeHtml(orgName)} (${escapeHtml(orgId)}) · ${escapeHtml(
    sub.createdAt || new Date().toISOString().slice(0, 10)
  )}</span>
    </div>
    <div class="header">
      ${avatarHtml}
      <div style="flex:1;">
        <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;">${escapeHtml(
          sub.fullName
        )}</h1>
        <div style="font-size:15px;font-weight:600;color:#334155;margin-bottom:10px;">${escapeHtml(
          sub.targetRoleOrGroup
        )}</div>
        <div style="font-size:13px;color:#334155;">
          <div>ช่องทางติดต่อ: ${escapeHtml(sub.phoneOrContact)}</div>
          ${sub.email ? `<div>อีเมล: ${escapeHtml(sub.email)}</div>` : ''}
          ${
            sub.availability
              ? `<div>ความพร้อม / ช่วงเวลาสะดวก: ${escapeHtml(sub.availability)}</div>`
              : ''
          }
        </div>
      </div>
    </div>

    ${
      sub.headlineOrSummary
        ? `<div class="section"><div class="label">สรุปประวัติย่อ / จุดเด่น / รายละเอียดที่แจ้ง</div><div class="val">${escapeHtml(
            sub.headlineOrSummary
          )}</div></div>`
        : ''
    }
    ${
      sub.educationOrAffiliation
        ? `<div class="section"><div class="label">ประวัติการศึกษา / สังกัด</div><div class="val">${escapeHtml(
            sub.educationOrAffiliation
          )}</div></div>`
        : ''
    }
    ${
      sub.experienceOrNote
        ? `<div class="section"><div class="label">ประสบการณ์ทำงาน / ผลงาน / หมายเหตุ</div><div class="val">${escapeHtml(
            sub.experienceOrNote
          )}</div></div>`
        : ''
    }
    <div class="section">
      <div class="label">ทักษะและความสามารถ</div>
      <div style="margin-top:6px;">${skillPills}</div>
    </div>
    ${
      sub.emergencyContact
        ? `<div class="section"><div class="label">ผู้ติดต่อกรณีฉุกเฉิน</div><div class="val">${escapeHtml(
            sub.emergencyContact
          )}</div></div>`
        : ''
    }
    <div class="no-print" style="margin-top:24px;text-align:right;">
      <button onclick="window.print()" style="padding:8px 18px;background:#0f172a;color:#fff;border:none;border-radius:6px;font-family:inherit;cursor:pointer;">พิมพ์ / บันทึกเป็น PDF</button>
    </div>
  </div>
</body>
</html>`;
}

export function buildDirectPortalUrl(
  baseHref: string,
  orgId: string,
  view: 'profile' | 'drop' | 'home'
): string {
  try {
    const url = new URL(baseHref);
    url.searchParams.set('org', orgId);
    if (view === 'home') {
      url.searchParams.delete('view');
    } else {
      url.searchParams.set('view', view);
    }
    url.hash = '';
    return url.toString();
  } catch {
    return view === 'home' ? `?org=${orgId}` : `?org=${orgId}&view=${view}`;
  }
}

export function getProfileKindLabel(kind: ProfileCardSubmission['kind'], lang: LangCode): string {
  if (kind === 'job_apply') {
    return lang === 'th' ? 'ฝากประวัติสมัครงาน / แนะนำตัว' : 'Job Application / Profile';
  }
  return lang === 'th' ? 'อัปเดตข้อมูลส่วนบุคคล' : 'Personal Info Update';
}
