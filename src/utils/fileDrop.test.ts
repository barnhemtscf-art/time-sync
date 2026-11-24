import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyDropFileType,
  FILE_DROP_MODES,
  resolveLocationTitleUpdate,
  validateDropFiles,
  verifyDropPasscode,
} from './fileDrop';

test('FILE_DROP_MODES defines all 4 requested modes with dynamic placeholders', () => {
  assert.equal(FILE_DROP_MODES.length, 4);
  const orgMode = FILE_DROP_MODES.find((m) => m.id === 'org_edu');
  assert.equal(orgMode?.titleTh, 'องค์กรและการศึกษา');
  assert.equal(orgMode?.placeholderTh, 'เช่น โรงเรียนอนุบาลเดือนฉาย');
});

test('resolveLocationTitleUpdate keeps previous title when input is blank', () => {
  assert.equal(
    resolveLocationTitleUpdate('โรงเรียนอนุบาลเดือนฉาย', '   ', 'มูลนิธิบ้านสายรุ้ง'),
    'โรงเรียนอนุบาลเดือนฉาย'
  );
  assert.equal(
    resolveLocationTitleUpdate('โรงเรียนอนุบาลเดือนฉาย', 'ชมรมศิลปะ', 'มูลนิธิบ้านสายรุ้ง'),
    'ชมรมศิลปะ'
  );
  assert.equal(resolveLocationTitleUpdate(undefined, '', 'มูลนิธิบ้านสายรุ้ง'), 'มูลนิธิบ้านสายรุ้ง');
});

test('verifyDropPasscode enforces passcode when configured', () => {
  assert.equal(verifyDropPasscode('', ''), true);
  assert.equal(verifyDropPasscode('5566', '5566'), true);
  assert.equal(verifyDropPasscode('5566', '1234'), false);
});

test('classifyDropFileType and validateDropFiles enforce allowed types accurately', () => {
  assert.equal(classifyDropFileType('slip.jpg', 'image/jpeg'), 'image');
  assert.equal(classifyDropFileType('report.PDF', 'application/pdf'), 'pdf');
  assert.equal(classifyDropFileType('roster.xlsx', ''), 'excel');
  assert.equal(classifyDropFileType('script.exe', 'application/octet-stream'), 'other');

  const result = validateDropFiles(
    [
      { name: 'photo.png', type: 'image/png', size: 1200 },
      { name: 'invoice.pdf', type: 'application/pdf', size: 3400 },
      { name: 'budget.csv', type: 'text/csv', size: 512 },
      { name: 'archive.zip', type: 'application/zip', size: 4000 },
    ],
    { image: true, text: true, pdf: false, excel: true }
  );

  assert.equal(result.accepted.length, 2);
  assert.deepEqual(
    result.accepted.map((a) => a.file.name),
    ['photo.png', 'budget.csv']
  );
  assert.equal(result.rejected.length, 2);
  assert.deepEqual(
    result.rejected.map((r) => r.name),
    ['invoice.pdf', 'archive.zip']
  );
});
