import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateBudgetSplit,
  exportLogsAndMembersCsv,
  isDemoPreviewQuery,
  matchQaResponse,
  parseMembersCsv,
} from './budget';

test('calculateBudgetSplit splits evenly and preserves exact total with remainders', () => {
  const res = calculateBudgetSplit(100, [
    { id: '1', name: 'A' },
    { id: '2', name: 'B' },
    { id: '3', name: 'C' },
  ]);
  assert.equal(res.rows.length, 3);
  assert.equal(Math.round(res.totalDistributed * 100), 10000);
  assert.equal(res.rows[0].amount, 33.34);
  assert.equal(res.rows[1].amount, 33.33);
  assert.equal(res.rows[2].amount, 33.33);
});

test('calculateBudgetSplit handles weighted participants', () => {
  const res = calculateBudgetSplit(300, [
    { id: '1', name: 'Senior', weight: 2 },
    { id: '2', name: 'Junior', weight: 1 },
  ]);
  assert.equal(res.rows[0].amount, 200);
  assert.equal(res.rows[1].amount, 100);
});

test('exportLogsAndMembersCsv adds UTF-8 BOM and parses members back', () => {
  const csv = exportLogsAndMembersCsv([], [
    {
      id: 'm1',
      name: 'น้องต้น',
      group: 'ทีมพี่โต',
      code: 'S01',
      offensePoints: 0,
      customUnitScores: {},
      active: true,
    },
  ]);
  assert.equal(csv.startsWith('\uFEFF'), true);
  const parsed = parseMembersCsv(csv);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].name, 'น้องต้น');
  assert.equal(parsed[0].group, 'ทีมพี่โต');
});

test('parseMembersCsv handles quoted fields with commas and escaped quotes', () => {
  const csv = [
    'Name,Group,Code',
    '"สมชาย, ฝ่ายขาย","ทีมงาน ""A""",S99',
    'น้ำฝน,การเงิน,F02',
  ].join('\n');
  const parsed = parseMembersCsv(csv);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].name, 'สมชาย, ฝ่ายขาย');
  assert.equal(parsed[0].group, 'ทีมงาน "A"');
  assert.equal(parsed[0].code, 'S99');
  assert.equal(parsed[1].name, 'น้ำฝน');
});

test('exportLogsAndMembersCsv neutralizes formula injection prefixes', () => {
  const csv = exportLogsAndMembersCsv([], [
    {
      id: 'm-inj',
      name: '=HYPERLINK("http://evil.example","Click")',
      group: '+TEAM',
      code: 'X01',
      offensePoints: 0,
      customUnitScores: {},
      active: true,
    },
  ]);
  assert.match(csv, /'=HYPERLINK/);
  assert.match(csv, /'\+TEAM/);
});

test('matchQaResponse answers emergency 8888, lost-and-found, and demo example queries', () => {
  assert.match(matchQaResponse('8888 ใช้ยังไง', 'th'), /8888/);
  assert.match(matchQaResponse('where to report lost item', 'en'), /Lost & Found/i);
  assert.equal(isDemoPreviewQuery('มีตัวอย่างการใช้งานไหม'), true);
  assert.equal(isDemoPreviewQuery('can I see a demo example'), true);
  assert.equal(isDemoPreviewQuery('รหัส 8888 ใช้ยังไง'), false);
  assert.match(matchQaResponse('มีตัวอย่างการใช้งานไหม', 'th'), /ตัวอย่าง/);
});
