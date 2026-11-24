import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeedTenants, createTenantSeedForMode } from '../data/seedData';
import {
  generateUniqueMemberCode,
  generateUniqueOrgCode,
  getDefaultOwnerRoleTitle,
  inferDropModeFromCategory,
  isMemberCodeDuplicate,
  isValidGasWebAppUrl,
  normalizeOrgLookupKey,
  verifyGooglePortalAccess,
} from './orgCode';

test('generateUniqueOrgCode avoids collisions and follows ORG-XXXX format', () => {
  const seed = createSeedTenants(new Date());
  // Add a colliding ORG-1375 first and mock RNG to hit 1375 then 4821
  seed['ORG-1375'] = { ...seed.ORG01, orgId: 'ORG-1375' };
  let call = 0;
  const rng = () => {
    call += 1;
    if (call === 1) return (1375 - 1000) / 9000;
    return (4821 - 1000) / 9000;
  };
  const code = generateUniqueOrgCode(seed, rng);
  assert.equal(code, 'ORG-4821');
});

test('normalizeOrgLookupKey matches exact and hyphen-insensitive org codes', () => {
  const seed = createSeedTenants(new Date());
  seed['ORG-1375'] = { ...seed.ORG01, orgId: 'ORG-1375' };
  assert.equal(normalizeOrgLookupKey('org01', seed), 'ORG01');
  assert.equal(normalizeOrgLookupKey('org-1375', seed), 'ORG-1375');
  assert.equal(normalizeOrgLookupKey('ORG1375', seed), 'ORG-1375');
  assert.equal(normalizeOrgLookupKey('UNKNOWN', seed), null);
});

test('getDefaultOwnerRoleTitle returns mode-appropriate title', () => {
  assert.equal(getDefaultOwnerRoleTitle('org_2tier', 'th'), 'หัวหน้า / เจ้าขององค์กร');
  assert.equal(getDefaultOwnerRoleTitle('foundation_3tier', 'th'), 'ผู้บริหาร / เจ้าขององค์กร');
  assert.equal(getDefaultOwnerRoleTitle('file_drop', 'th'), 'ผู้ดูแลจุดฝากไฟล์รวม');
});

test('isMemberCodeDuplicate and generateUniqueMemberCode prevent duplicate member codes', () => {
  const members = createSeedTenants(new Date()).ORG01.members;
  assert.equal(isMemberCodeDuplicate('s01', members), true);
  assert.equal(isMemberCodeDuplicate('NEW99', members), false);
  const generated = generateUniqueMemberCode([
    ...members,
    { ...members[0], id: 'extra', code: 'M16' },
  ]);
  assert.equal(isMemberCodeDuplicate(generated, members), false);
  assert.notEqual(generated, 'M16');
});

test('verifyGooglePortalAccess prevents unverified org access and enforces ownerEmail', () => {
  const seed = createSeedTenants(new Date());
  seed['ORG-5555'] = createTenantSeedForMode({
    orgId: 'ORG-5555',
    orgNameTh: 'ร้านกาแฟตัวอย่าง',
    orgNameEn: 'Sample Cafe',
    execPin: '1234',
    orgAccountMode: 'org_2tier',
    ownerEmail: 'owner@gmail.com',
  });

  assert.deepEqual(verifyGooglePortalAccess('NOPE', 'owner@gmail.com', seed), {
    ok: false,
    reason: 'invalid_org',
  });
  assert.deepEqual(verifyGooglePortalAccess('ORG-5555', 'bad-email', seed), {
    ok: false,
    reason: 'invalid_email',
  });
  assert.deepEqual(verifyGooglePortalAccess('ORG-5555', 'other@gmail.com', seed), {
    ok: false,
    reason: 'email_mismatch',
  });
  assert.deepEqual(verifyGooglePortalAccess('org5555', 'OWNER@gmail.com', seed), {
    ok: true,
    orgId: 'ORG-5555',
  });
});

test('isValidGasWebAppUrl validates script.google.com https URLs', () => {
  assert.equal(isValidGasWebAppUrl('https://script.google.com/macros/s/abc/exec'), true);
  assert.equal(isValidGasWebAppUrl('http://script.google.com/macros/s/abc/exec'), false);
  assert.equal(isValidGasWebAppUrl('https://evil.example/exec'), false);
  assert.equal(isValidGasWebAppUrl(''), false);
});

test('createTenantSeedForMode tailors tasks and excludes foundation school tasks for org_2tier and file_drop', () => {
  const cafe = createTenantSeedForMode({
    orgId: 'ORG-2001',
    orgNameTh: 'คาเฟ่สุขใจ',
    orgNameEn: 'Happy Cafe',
    execPin: '2468',
    orgAccountMode: 'org_2tier',
    ownerNickname: 'บอส',
  });
  assert.equal(cafe.tasks.some((t) => t.titleTh.includes('ไปโรงเรียน')), false);
  assert.equal(cafe.tasks.some((t) => t.titleTh.includes('เข้านอน')), false);
  assert.equal(cafe.members.some((m) => m.group === 'ทีมน้องเล็ก'), false);
  assert.equal(cafe.strictFieldAuth, true);

  const hub = createTenantSeedForMode({
    orgId: 'ORG-3001',
    orgNameTh: 'จุดรับงานสื่อ',
    orgNameEn: 'Media Hub',
    execPin: '1357',
    orgAccountMode: 'file_drop',
  });
  assert.equal(hub.tasks.length, 0);
  assert.equal(inferDropModeFromCategory('ร้านค้า / อีเวนท์ / ทีมงานสื่อ'), 'biz_event');
});
