import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateDailyQrToken,
  isButtonAllowedAt,
  isTaskActiveAt,
  isTimeInWindow,
  needsDailyReset,
  parseTimeToMinutes,
} from './timeWindow';
import type { TimeTask } from '../types/system';

const sampleTask: TimeTask = {
  id: 'task-school',
  titleTh: 'ไปโรงเรียน',
  titleEn: 'Go to School',
  descriptionTh: 'เช็คชื่อก่อนออกเดินทาง',
  descriptionEn: 'Morning departure check-in',
  startTime: '06:00',
  endTime: '07:00',
  daysOfWeek: [1, 2, 3, 4, 5],
  authMethod: 'pin',
  buttonCutoffs: {
    present: '06:45',
    late: '07:00',
  },
  showNameButtonLabel: 'เช็คชื่อ',
  enabled: true,
  approvalStatus: 'approved',
  targetGroup: 'all',
};

test('parseTimeToMinutes parses valid HH:MM strings', () => {
  assert.equal(parseTimeToMinutes('06:00'), 360);
  assert.equal(parseTimeToMinutes('00:00'), 0);
  assert.equal(parseTimeToMinutes('23:59'), 1439);
  assert.equal(parseTimeToMinutes('25:00'), -1);
});

test('isTimeInWindow handles standard and overnight windows', () => {
  assert.equal(isTimeInWindow('06:00', '07:00', 390), true);
  assert.equal(isTimeInWindow('06:00', '07:00', 359), false);
  assert.equal(isTimeInWindow('22:00', '05:00', 23 * 60), true);
  assert.equal(isTimeInWindow('22:00', '05:00', 120), true);
  assert.equal(isTimeInWindow('22:00', '05:00', 720), false);
});

test('isTaskActiveAt respects weekday, approval, and enabled state', () => {
  // 2026-11-23 is a Monday
  const monday0630 = new Date(2026, 10, 23, 6, 30, 0);
  const sunday0630 = new Date(2026, 10, 22, 6, 30, 0);
  assert.equal(isTaskActiveAt(sampleTask, monday0630), true);
  assert.equal(isTaskActiveAt(sampleTask, sunday0630), false);
  assert.equal(isTaskActiveAt({ ...sampleTask, enabled: false }, monday0630), false);
  assert.equal(isTaskActiveAt({ ...sampleTask, approvalStatus: 'pending' }, monday0630), false);
});

test('isButtonAllowedAt locks buttons strictly after cutoff time', () => {
  const at0640 = new Date(2026, 10, 23, 6, 40, 0);
  const at0650 = new Date(2026, 10, 23, 6, 50, 0);

  assert.equal(
    isButtonAllowedAt('present', sampleTask.buttonCutoffs, '06:00', '07:00', at0640).allowed,
    true
  );
  const lateCheck = isButtonAllowedAt('present', sampleTask.buttonCutoffs, '06:00', '07:00', at0650);
  assert.equal(lateCheck.allowed, false);
  assert.equal(lateCheck.reason, 'cutoff_passed');
  assert.equal(
    isButtonAllowedAt('late', sampleTask.buttonCutoffs, '06:00', '07:00', at0650).allowed,
    true
  );
});

test('generateDailyQrToken rotates deterministically by date', () => {
  const t1 = generateDailyQrToken('ORG01', 'task-1', '2026-11-21');
  const t2 = generateDailyQrToken('ORG01', 'task-1', '2026-11-21');
  const t3 = generateDailyQrToken('ORG01', 'task-1', '2026-11-22');
  assert.equal(t1, t2);
  assert.notEqual(t1, t3);
});

test('needsDailyReset detects date rollover', () => {
  assert.equal(needsDailyReset('2026-11-20', '2026-11-21'), true);
  assert.equal(needsDailyReset('2026-11-21', '2026-11-21'), false);
});
