import type {
  FileDropHubConfig,
  FileDropSubmission,
  LangCode,
  ProfileCardSubmission,
  TenantData,
} from '../types/system';
import { formatFileSize } from './fileDrop';

export const DEFAULT_RETENTION_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

export function extractDateKey(value: string | undefined): string | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function toLocalMidnightMs(dateKey: string): number | null {
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const dt = new Date(year, month, day, 0, 0, 0, 0);
  if (
    dt.getFullYear() !== year ||
    dt.getMonth() !== month ||
    dt.getDate() !== day
  ) {
    return null;
  }
  return dt.getTime();
}

export function getAgeInDays(dateValue: string | undefined, now: Date): number | null {
  const itemKey = extractDateKey(dateValue);
  if (!itemKey) return null;
  const itemMs = toLocalMidnightMs(itemKey);
  if (itemMs === null) return null;
  const todayMidnightMs = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0
  ).getTime();
  return Math.max(0, Math.floor((todayMidnightMs - itemMs) / DAY_MS));
}

export function getItemRemainingDays(
  dateValue: string | undefined,
  now: Date,
  retentionDays: number = DEFAULT_RETENTION_DAYS
): number {
  const age = getAgeInDays(dateValue, now);
  if (age === null) return retentionDays;
  return Math.max(0, retentionDays - age);
}

export function isItemExpired(
  dateValue: string | undefined,
  now: Date,
  retentionDays: number = DEFAULT_RETENTION_DAYS
): boolean {
  const age = getAgeInDays(dateValue, now);
  if (age === null) return false;
  return age >= retentionDays;
}

export interface PurgeResult {
  tenant: TenantData;
  removedLogs: number;
  removedDrops: number;
  removedProfiles: number;
  removedLostFound: number;
  totalRemoved: number;
}

/**
 * Rolling item-by-item purge:
 * Only removes individual temporary records (logs, file-drop submissions, profile cards, lost & found)
 * whose own age >= retentionDays (default 14 days).
 * Newer items (e.g., submitted on day 13) keep their full 14-day lifetime.
 * Organization structure, members, staff, tasks, and hub settings are never removed.
 */
export function purgeExpiredTenantRecords(
  tenant: TenantData,
  now: Date,
  retentionDaysOverride?: number
): PurgeResult {
  const retentionDays =
    retentionDaysOverride ?? tenant.retentionDays ?? DEFAULT_RETENTION_DAYS;

  const keptLogs = tenant.logs.filter(
    (entry) => !isItemExpired(entry.dateKey, now, retentionDays)
  );
  const removedLogs = tenant.logs.length - keptLogs.length;

  const keptLostFound = tenant.lostFound.filter(
    (item) => !isItemExpired(item.createdAt, now, retentionDays)
  );
  const removedLostFound = tenant.lostFound.length - keptLostFound.length;

  let nextFileDropHub = tenant.fileDropHub;
  let removedDrops = 0;
  if (tenant.fileDropHub) {
    const keptDrops = tenant.fileDropHub.submissions.filter(
      (sub) => !isItemExpired(sub.createdAt, now, retentionDays)
    );
    removedDrops = tenant.fileDropHub.submissions.length - keptDrops.length;
    if (removedDrops > 0) {
      nextFileDropHub = {
        ...tenant.fileDropHub,
        submissions: keptDrops,
      };
    }
  }

  let nextProfileHub = tenant.profileHub;
  let removedProfiles = 0;
  if (tenant.profileHub) {
    const keptProfiles = tenant.profileHub.submissions.filter(
      (sub) => !isItemExpired(sub.createdAt, now, retentionDays)
    );
    removedProfiles = tenant.profileHub.submissions.length - keptProfiles.length;
    if (removedProfiles > 0) {
      nextProfileHub = {
        ...tenant.profileHub,
        submissions: keptProfiles,
      };
    }
  }

  const totalRemoved = removedLogs + removedDrops + removedProfiles + removedLostFound;
  if (totalRemoved === 0) {
    return {
      tenant,
      removedLogs: 0,
      removedDrops: 0,
      removedProfiles: 0,
      removedLostFound: 0,
      totalRemoved: 0,
    };
  }

  return {
    tenant: {
      ...tenant,
      logs: keptLogs,
      lostFound: keptLostFound,
      fileDropHub: nextFileDropHub,
      profileHub: nextProfileHub,
    },
    removedLogs,
    removedDrops,
    removedProfiles,
    removedLostFound,
    totalRemoved,
  };
}

export function clearFileDropSubmissions(tenant: TenantData): TenantData {
  if (!tenant.fileDropHub) return tenant;
  return {
    ...tenant,
    fileDropHub: {
      ...tenant.fileDropHub,
      submissions: [],
    },
  };
}

export function clearProfileDropSubmissions(tenant: TenantData): TenantData {
  if (!tenant.profileHub) return tenant;
  return {
    ...tenant,
    profileHub: {
      ...tenant.profileHub,
      submissions: [],
    },
  };
}

function escapeCsvCell(value: string | number | undefined): string {
  let str = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportFileDropSubmissionsCsv(hub: FileDropHubConfig): string {
  const lines: string[] = [];
  lines.push('CREATED_AT,LOCATION,TOPIC,SENDER,MESSAGE,FILES,DRIVE_LINKS,SYNCED');

  for (const sub of hub.submissions) {
    const fileList = sub.files
      .map((f) => `${f.name} (${formatFileSize(f.size)})`)
      .join(' | ');
    const driveLinks = sub.files
      .map((f) => f.driveUrl)
      .filter(Boolean)
      .join(' | ');

    lines.push(
      [
        sub.createdAt,
        sub.locationTitle,
        sub.topic,
        sub.senderName,
        sub.message ?? '',
        fileList,
        driveLinks,
        sub.syncedToCentral ? 'synced' : 'local_14d',
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  }

  return `\uFEFF${lines.join('\r\n')}`;
}

export function exportProfileSubmissionsCsv(submissions: ProfileCardSubmission[]): string {
  const lines: string[] = [];
  lines.push(
    'CREATED_AT,KIND,FULL_NAME,ROLE_OR_GROUP,CONTACT,EMAIL,SUMMARY,EDUCATION,EXPERIENCE,SKILLS,AVAILABILITY,EMERGENCY_CONTACT,PHOTO_DRIVE_URL'
  );

  for (const s of submissions) {
    lines.push(
      [
        s.createdAt,
        s.kind,
        s.fullName,
        s.targetRoleOrGroup,
        s.phoneOrContact,
        s.email ?? '',
        s.headlineOrSummary,
        s.educationOrAffiliation ?? '',
        s.experienceOrNote ?? '',
        s.skills.join(' | '),
        s.availability ?? '',
        s.emergencyContact ?? '',
        s.photoDriveUrl ?? '',
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  }

  return `\uFEFF${lines.join('\r\n')}`;
}

export function formatFileDropSummaryForLine(
  hub: FileDropHubConfig,
  lang: LangCode,
  now: Date
): string {
  const header =
    lang === 'th'
      ? `📦 สรุปจุดฝากไฟล์รวม: ${hub.customLocationTitle}\nหัวข้อ: ${hub.topic}\nจำนวนทั้งหมด: ${hub.submissions.length} รายการ (ข้อมูลชั่วคราว 14 วัน)`
      : `📦 File Drop Summary: ${hub.customLocationTitle}\nTopic: ${hub.topic}\nTotal: ${hub.submissions.length} items (14-day temporary retention)`;

  if (hub.submissions.length === 0) {
    return `${header}\n\n${
      lang === 'th' ? '- ยังไม่มีรายการที่ฝากไว้ -' : '- No items submitted yet -'
    }`;
  }

  const lines = hub.submissions.map((sub: FileDropSubmission, idx: number) => {
    const remaining = getItemRemainingDays(sub.createdAt, now);
    const parts: string[] = [
      `${idx + 1}. ${sub.senderName} (${sub.createdAt} · ${
        lang === 'th' ? `เหลือ ${remaining} วัน` : `${remaining}d left`
      })`,
    ];
    if (sub.message) {
      parts.push(`   ${lang === 'th' ? 'ข้อความ' : 'Note'}: ${sub.message}`);
    }
    if (sub.files.length > 0) {
      const filesText = sub.files
        .map((f) =>
          f.driveUrl
            ? `${f.name} (${formatFileSize(f.size)}) -> ${f.driveUrl}`
            : `${f.name} (${formatFileSize(f.size)})`
        )
        .join(', ');
      parts.push(`   ${lang === 'th' ? 'ไฟล์' : 'Files'}: ${filesText}`);
    }
    return parts.join('\n');
  });

  return `${header}\n\n${lines.join('\n\n')}`;
}

export function formatProfileSummaryForLine(
  submissions: ProfileCardSubmission[],
  orgName: string,
  lang: LangCode,
  now: Date
): string {
  const header =
    lang === 'th'
      ? `📋 สรุปรายการฝากประวัติ / อัปเดตข้อมูล: ${orgName}\nจำนวนทั้งหมด: ${submissions.length} รายการ (เก็บรายชิ้น 14 วัน)`
      : `📋 Profile & Info Submissions: ${orgName}\nTotal: ${submissions.length} items (14-day item retention)`;

  if (submissions.length === 0) {
    return `${header}\n\n${
      lang === 'th' ? '- ยังไม่มีรายการที่ส่งเข้ามา -' : '- No submissions yet -'
    }`;
  }

  const lines = submissions.map((s, idx) => {
    const remaining = getItemRemainingDays(s.createdAt, now);
    const kindStr =
      s.kind === 'job_apply'
        ? lang === 'th'
          ? 'ฝากประวัติ'
          : 'Applicant'
        : lang === 'th'
        ? 'อัปเดตข้อมูล'
        : 'Info Update';
    const parts = [
      `${idx + 1}. [${kindStr}] ${s.fullName} — ${s.targetRoleOrGroup} (${s.createdAt} · ${
        lang === 'th' ? `เหลือ ${remaining} วัน` : `${remaining}d left`
      })`,
      `   ${lang === 'th' ? 'ติดต่อ' : 'Contact'}: ${s.phoneOrContact}${s.email ? ` / ${s.email}` : ''}`,
    ];
    if (s.headlineOrSummary) {
      parts.push(`   ${lang === 'th' ? 'สรุป' : 'Summary'}: ${s.headlineOrSummary}`);
    }
    if (s.skills.length > 0) {
      parts.push(`   ${lang === 'th' ? 'ทักษะ' : 'Skills'}: ${s.skills.join(', ')}`);
    }
    if (s.photoDriveUrl) {
      parts.push(`   Drive: ${s.photoDriveUrl}`);
    }
    return parts.join('\n');
  });

  return `${header}\n\n${lines.join('\n\n')}`;
}
