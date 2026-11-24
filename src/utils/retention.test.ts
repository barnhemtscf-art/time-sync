import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createTenantSeedForMode } from '../data/seedData';
import { getDefaultFileDropHub } from './fileDrop';
import { generateGoogleAppsScriptCode } from './gasExport';
import {
  clearFileDropSubmissions,
  clearProfileDropSubmissions,
  exportFileDropSubmissionsCsv,
  exportProfileSubmissionsCsv,
  formatFileDropSummaryForLine,
  formatProfileSummaryForLine,
  getItemRemainingDays,
  purgeExpiredTenantRecords,
} from './retention';
import {
  buildDirectPortalUrl,
  generatePrintableProfileHtml,
  getDefaultProfileDropHub,
} from './profileCard';

describe('Rolling 14-day item-level retention & pack-up helpers', () => {
  it('keeps both Day 1 and Day 13 items on Day 14, then purges only Day 1 on Day 15', () => {
    const day1Date = new Date(2026, 10, 1, 9, 0, 0);
    const seed = createTenantSeedForMode({
      orgId: 'ORG-TEST14',
      orgNameTh: 'จุดทดสอบ 14 วัน',
      orgNameEn: '14D Test',
      execPin: '9000',
      orgAccountMode: 'file_drop',
      now: day1Date,
    });
    const baseHub = getDefaultFileDropHub(seed.orgNameTh, seed.orgNameEn);
    const baseProfileHub = getDefaultProfileDropHub(seed.orgNameTh, seed.orgNameEn);

    const tenant = {
      ...seed,
      logs: [
        {
          id: 'log-day1',
          dateKey: '2026-11-01',
          timestamp: '09:00',
          type: 'file_drop' as const,
          actorName: 'ผู้ส่งวันที่ 1',
          note: 'ส่งตั้งแต่วันที่ 1',
        },
        {
          id: 'log-day13',
          dateKey: '2026-11-13',
          timestamp: '14:30',
          type: 'file_drop' as const,
          actorName: 'ผู้ส่งวันที่ 13',
          note: 'ส่งวันที่ 13 ยังใหม่',
        },
      ],
      fileDropHub: {
        ...baseHub,
        topic: 'ส่งรูปกิจกรรม',
        sharedPasscode: '2468',
        submissions: [
          {
            id: 'sub-day1',
            senderName: 'เอ (วันที่ 1)',
            topic: 'ส่งรูปกิจกรรม',
            locationTitle: 'จุดทดสอบ 14 วัน',
            modeId: 'org_edu' as const,
            message: 'ไฟล์วันที่ 1',
            files: [],
            createdAt: '2026-11-01 09:00',
            syncedToCentral: false,
          },
          {
            id: 'sub-day13',
            senderName: 'บี (วันที่ 13)',
            topic: 'ส่งรูปกิจกรรม',
            locationTitle: 'จุดทดสอบ 14 วัน',
            modeId: 'org_edu' as const,
            message: 'ไฟล์วันที่ 13',
            files: [],
            createdAt: '2026-11-13 14:30',
            syncedToCentral: false,
          },
        ],
      },
      profileHub: {
        ...baseProfileHub,
        passcode: '7788',
        submissions: [
          {
            id: 'prof-day1',
            kind: 'job_apply' as const,
            fullName: 'คุณกัญญา วันที่หนึ่ง',
            targetRoleOrGroup: 'ธุรการประสานงาน',
            phoneOrContact: '081-000-0001',
            headlineOrSummary: 'มีประสบการณ์ประสานงานทั่วไป 2 ปี',
            skills: ['Excel / Google Sheets'],
            createdAt: '2026-11-01 09:00',
            syncedToCentral: false,
          },
          {
            id: 'prof-day13',
            kind: 'member_update' as const,
            fullName: 'คุณภูมิ วันที่สิบสาม',
            targetRoleOrGroup: 'ฝ่ายการเงิน',
            phoneOrContact: '081-000-0013',
            headlineOrSummary: 'อัปเดตเบอร์โทรศัพท์ติดต่อใหม่',
            skills: ['งานเอกสาร / การเงิน'],
            createdAt: '2026-11-13 14:30',
            syncedToCentral: false,
          },
        ],
      },
    };

    // On Day 14 (2026-11-14): Day 1 is 13 days old (< 14), Day 13 is 1 day old -> ALL kept!
    const day14Now = new Date(2026, 10, 14, 10, 0, 0);
    const resDay14 = purgeExpiredTenantRecords(tenant, day14Now);
    assert.equal(resDay14.totalRemoved, 0);
    assert.equal(resDay14.tenant.logs.length, 2);
    assert.equal(resDay14.tenant.fileDropHub?.submissions.length, 2);
    assert.equal(resDay14.tenant.profileHub?.submissions.length, 2);
    assert.equal(getItemRemainingDays('2026-11-13 14:30', day14Now), 13);

    // On Day 15 (2026-11-15): Day 1 is 14 days old -> purged! Day 13 is 2 days old -> KEPT with 12 days left!
    const day15Now = new Date(2026, 10, 15, 10, 0, 0);
    const resDay15 = purgeExpiredTenantRecords(tenant, day15Now);
    assert.equal(resDay15.removedLogs, 1);
    assert.equal(resDay15.removedDrops, 1);
    assert.equal(resDay15.removedProfiles, 1);
    assert.deepEqual(
      resDay15.tenant.logs.map((l) => l.id),
      ['log-day13']
    );
    assert.deepEqual(
      resDay15.tenant.fileDropHub?.submissions.map((s) => s.id),
      ['sub-day13']
    );
    assert.deepEqual(
      resDay15.tenant.profileHub?.submissions.map((p) => p.id),
      ['prof-day13']
    );
    assert.equal(getItemRemainingDays('2026-11-13 14:30', day15Now), 12);

    // Organization settings & staff remain intact
    assert.equal(resDay15.tenant.fileDropHub?.sharedPasscode, '2468');
    assert.equal(resDay15.tenant.profileHub?.passcode, '7788');
    assert.equal(resDay15.tenant.staff.length, seed.staff.length);
  });

  it('clears submissions on Pack & Leave while preserving hub and profile settings', () => {
    const seed = createTenantSeedForMode({
      orgId: 'ORG-CLEAR',
      orgNameTh: 'จุดรับรูปอีเวนท์',
      orgNameEn: 'Event Hub',
      execPin: '9000',
      orgAccountMode: 'file_drop',
      now: new Date(2026, 10, 22),
    });
    const baseHub = getDefaultFileDropHub(seed.orgNameTh, seed.orgNameEn);
    const baseProfile = getDefaultProfileDropHub(seed.orgNameTh, seed.orgNameEn);
    const populated = {
      ...seed,
      fileDropHub: {
        ...baseHub,
        sharedPasscode: '9999',
        submissions: [
          {
            id: 'sub-1',
            senderName: 'สมชาย',
            topic: 'หัวข้อเดิม',
            locationTitle: 'จุดรับรูปอีเวนท์',
            modeId: 'biz_event' as const,
            files: [],
            createdAt: '2026-11-22 10:00',
            syncedToCentral: false,
          },
        ],
      },
      profileHub: {
        ...baseProfile,
        requirePasscode: true,
        passcode: '4455',
        submissions: [
          {
            id: 'prof-1',
            kind: 'job_apply' as const,
            fullName: 'นางสาวณัฐพร ศรีสุข',
            targetRoleOrGroup: 'ผู้ช่วยประสานงาน',
            phoneOrContact: '089-123-4567',
            headlineOrSummary: 'มีทักษะการประสานงานลูกค้า',
            skills: ['สื่อสารลูกค้า'],
            createdAt: '2026-11-22 10:00',
            syncedToCentral: false,
          },
        ],
      },
    };

    const cleared = clearProfileDropSubmissions(clearFileDropSubmissions(populated));
    assert.equal(cleared.fileDropHub?.submissions.length, 0);
    assert.equal(cleared.fileDropHub?.sharedPasscode, '9999');
    assert.equal(cleared.fileDropHub?.customLocationTitle, 'จุดรับรูปอีเวนท์');
    assert.equal(cleared.profileHub?.submissions.length, 0);
    assert.equal(cleared.profileHub?.passcode, '4455');
    assert.equal(cleared.profileHub?.requirePasscode, true);
  });

  it('formats LINE summary and exports CSV safely against formula injection', () => {
    const seed = createTenantSeedForMode({
      orgId: 'ORG-LINE',
      orgNameTh: 'จุดส่งสลิป',
      orgNameEn: 'Slip Hub',
      execPin: '9000',
      orgAccountMode: 'file_drop',
      now: new Date(2026, 10, 22),
    });
    const baseHub = getDefaultFileDropHub(seed.orgNameTh, seed.orgNameEn);
    const hub = {
      ...baseHub,
      topic: 'สลิปค่าอาหาร',
      submissions: [
        {
          id: 'sub-1',
          senderName: '=CMD()',
          topic: 'สลิปค่าอาหาร',
          locationTitle: 'จุดส่งสลิป',
          modeId: 'personal_family' as const,
          message: '+โอนแล้ว 500 บาท',
          files: [
            {
              id: 'f1',
              name: 'slip.jpg',
              size: 102400,
              mimeType: 'image/jpeg',
              category: 'image' as const,
              driveUrl: 'https://drive.google.com/file/d/abc/view',
            },
          ],
          createdAt: '2026-11-22 12:00',
          syncedToCentral: true,
        },
      ],
    };

    const lineText = formatFileDropSummaryForLine(hub, 'th', new Date(2026, 10, 22, 13, 0));
    assert.match(lineText, /จุดส่งสลิป/);
    assert.match(lineText, /slip\.jpg/);
    assert.match(lineText, /https:\/\/drive\.google\.com\/file\/d\/abc\/view/);
    assert.match(lineText, /เหลือ 14 วัน/);

    const csv = exportFileDropSubmissionsCsv(hub);
    assert.match(csv, /'=CMD\(\)/);
    assert.match(csv, /'\+โอนแล้ว 500 บาท/);

    const profileSubmissions = [
      {
        id: 'prof-line-1',
        kind: 'job_apply' as const,
        fullName: '=IMPORTXML()',
        targetRoleOrGroup: 'นักสังคมสงเคราะห์',
        phoneOrContact: '081-222-3333',
        headlineOrSummary: '+พร้อมเริ่มงานทันที',
        skills: ['ประสานงานองค์กร', 'สื่อสารภาษาอังกฤษ'],
        createdAt: '2026-11-22 12:00',
        syncedToCentral: false,
      },
    ];

    const profLine = formatProfileSummaryForLine(
      profileSubmissions,
      'มูลนิธิแสงตะวัน',
      'th',
      new Date(2026, 10, 22, 13, 0)
    );
    assert.match(profLine, /มูลนิธิแสงตะวัน/);
    assert.match(profLine, /นักสังคมสงเคราะห์/);
    assert.match(profLine, /เหลือ 14 วัน/);

    const profCsv = exportProfileSubmissionsCsv(profileSubmissions);
    assert.match(profCsv, /'=IMPORTXML\(\)/);
    assert.match(profCsv, /'\+พร้อมเริ่มงานทันที/);
  });

  it('builds direct QR portal URLs and printable profile HTML without script tags', () => {
    const portalUrl = buildDirectPortalUrl('https://portal.example.com/app', 'ORG01', 'profile');
    assert.equal(portalUrl, 'https://portal.example.com/app?org=ORG01&view=profile');

    const html = generatePrintableProfileHtml(
      {
        kind: 'job_apply',
        fullName: 'นายธนกฤต วงศ์สุวรรณ',
        targetRoleOrGroup: 'ผู้ประสานงานโครงการ',
        phoneOrContact: '081-555-0199',
        email: 'thanakrit@example.com',
        headlineOrSummary: 'มีประสบการณ์บริหารเอกสารและประสานงานอาสาสมัคร 4 ปี',
        skills: ['ประสานงานองค์กร', 'Excel / Google Sheets'],
        availability: 'เริ่มงานได้ทันที',
        createdAt: '2026-11-22 14:00',
      },
      'มูลนิธิแสงตะวัน',
      'ORG01'
    );
    assert.match(html, /นายธนกฤต วงศ์สุวรรณ/);
    assert.match(html, /ORG01/);
    assert.match(html, /@media print/);
  });

  it('generates Code.gs containing doPost, DriveApp folder upload, FileDrops and ProfileCards sheets', () => {
    const code = generateGoogleAppsScriptCode('ORG01');
    assert.match(code, /function doPost\(e\)/);
    assert.match(code, /DriveApp\.getFoldersByName/);
    assert.match(code, /Utilities\.base64Decode/);
    assert.match(code, /FileDrops/);
    assert.match(code, /ProfileCards/);
    assert.match(code, /profile_drop/);
    assert.match(code, /function saveTenantState/);
  });
});
