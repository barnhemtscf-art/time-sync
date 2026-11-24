import type { AuditLogEntry, LangCode, Member } from '../types/system';

export interface SplitParticipant {
  id: string;
  name: string;
  weight?: number;
}

export interface SplitResultRow {
  id: string;
  name: string;
  weight: number;
  amount: number;
}

export function calculateBudgetSplit(
  totalAmount: number,
  participants: SplitParticipant[]
): { rows: SplitResultRow[]; totalDistributed: number } {
  if (!Number.isFinite(totalAmount) || totalAmount <= 0 || participants.length === 0) {
    return {
      rows: participants.map((p) => ({
        id: p.id,
        name: p.name,
        weight: p.weight ?? 1,
        amount: 0,
      })),
      totalDistributed: 0,
    };
  }

  const sanitized = participants.map((p) => ({
    id: p.id,
    name: p.name,
    weight: p.weight && p.weight > 0 ? p.weight : 1,
  }));

  const totalWeight = sanitized.reduce((sum, p) => sum + p.weight, 0);
  const totalSatang = Math.round(totalAmount * 100);

  let allocatedSatang = 0;
  const baseRows = sanitized.map((p) => {
    const exact = (totalSatang * p.weight) / totalWeight;
    const floored = Math.floor(exact);
    allocatedSatang += floored;
    return {
      ...p,
      satang: floored,
      fraction: exact - floored,
    };
  });

  let remainder = totalSatang - allocatedSatang;
  const order = [...baseRows].sort((a, b) => b.fraction - a.fraction);
  for (let i = 0; i < order.length && remainder > 0; i += 1) {
    order[i].satang += 1;
    remainder -= 1;
  }

  const satangById = new Map(order.map((r) => [r.id, r.satang]));
  const rows: SplitResultRow[] = sanitized.map((p) => ({
    id: p.id,
    name: p.name,
    weight: p.weight,
    amount: (satangById.get(p.id) ?? 0) / 100,
  }));

  return {
    rows,
    totalDistributed: rows.reduce((sum, r) => sum + r.amount, 0),
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

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

export function exportLogsAndMembersCsv(logs: AuditLogEntry[], members: Member[]): string {
  const lines: string[] = [];
  lines.push('SECTION,DATE,TIME,TYPE,TASK,MEMBER,GROUP,STATUS,METHOD,ACTOR,OFFENSE_POINTS,NOTE');

  for (const log of logs) {
    lines.push(
      [
        'LOG',
        log.dateKey,
        log.timestamp,
        log.type,
        log.taskTitle ?? '',
        log.memberName ?? '',
        '',
        log.status ?? '',
        log.unlockMethod ?? '',
        log.actorName,
        '',
        log.note,
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  }

  for (const m of members) {
    lines.push(
      [
        'MEMBER',
        '',
        '',
        m.code,
        '',
        m.name,
        m.group,
        m.active ? 'active' : 'inactive',
        '',
        '',
        m.offensePoints,
        m.notes ?? '',
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  }

  return `\uFEFF${lines.join('\r\n')}`;
}

export function parseMembersCsv(csvText: string): Array<{ name: string; group: string; code: string }> {
  const clean = csvText.replace(/^\uFEFF/, '').trim();
  if (!clean) return [];
  const rows = clean.split(/\r?\n/).map(parseCsvLine);
  const results: Array<{ name: string; group: string; code: string }> = [];

  for (let i = 0; i < rows.length; i += 1) {
    const cols = rows[i];
    if (!cols[0] || cols[0].toLowerCase() === 'name' || cols[0].toLowerCase() === 'section') {
      continue;
    }
    if (cols[0] === 'MEMBER' && cols[5]) {
      results.push({
        name: cols[5],
        group: cols[6] || 'ทีมงาน / พนักงาน',
        code: cols[3] || `M${String(results.length + 1).padStart(3, '0')}`,
      });
    } else if (cols[0] !== 'LOG') {
      results.push({
        name: cols[0],
        group: cols[1] || 'ทีมงาน / พนักงาน',
        code: cols[2] || `M${String(results.length + 1).padStart(3, '0')}`,
      });
    }
  }
  return results;
}

export function isDemoPreviewQuery(query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  return /ตัวอย่าง|หน้าตัวอย่าง|ตัวอย่างการใช้งาน|ทดลองใช้|ทดลองเล่น|สาธิต|ขอดูหน้า|example|sample|demo|preview|tutorial/.test(
    q
  );
}

export function matchQaResponse(query: string, lang: LangCode): string {
  const q = query.trim().toLowerCase();
  if (!q) {
    return lang === 'th'
      ? 'กรุณาพิมพ์คำถาม เช่น เวลาเช็คชื่อ, รหัสฉุกเฉิน 8888, ของหาย หรือ โหวตลับ'
      : 'Please type a question such as check-in times, emergency code 8888, lost & found, or secret vote.';
  }

  if (isDemoPreviewQuery(q)) {
    return lang === 'th'
      ? 'ได้เลยครับ! น้องเมฆมีหน้าตัวอย่างการใช้งาน (Demo) ให้ลองดูคำสั่งเช็คชื่อตามเวลาและบอร์ดส่วนกลางของระบบ สามารถกดปุ่มด้านล่างเพื่อเข้าชมหน้าตัวอย่างได้เลยน้า~'
      : 'Sure! Cloud Mascot can open a live Usage Example (Demo Preview) of the time-window tasks and community board. Click the button below to view the sample page!';
  }

  if (/8888|ฉุกเฉิน|emergency|unlock|ปลดล็อค/.test(q)) {
    return lang === 'th'
      ? 'รหัสปลดล็อคฉุกเฉิน 8888 ใช้เมื่อพี่เลี้ยงไม่อยู่หน้างาน ให้กดที่คำสั่งที่ถึงเวลา (แถบสีเด่น) แล้วกรอก 8888 เพื่อเปิดรายชื่อเช็คชื่อได้ทันที โดยระบบจะบันทึกประวัติการใช้ 8888 ไว้ใน Log'
      : 'Emergency code 8888 allows instant roster check-in on an unlocked task when no staff is present. It does not grant backend access and is logged in the audit trail.';
  }

  if (/หาย|ของหาย|เก็บได้|lost|found/.test(q)) {
    return lang === 'th'
      ? 'สมาชิกและผู้ติดต่อสามารถแจ้งของหายหรือเก็บของได้ทันทีที่แท็บ "แจ้งของหาย / เก็บของได้" บนหน้าแรก ส่วนการกดปิดเคสเมื่อพบเจ้าของแล้วสงวนไว้เฉพาะพี่เลี้ยง/ผู้บริหารหลังบ้านเท่านั้น'
      : 'Anyone can report lost or found items in the Lost & Found tab on the home board. Closing a resolved case is restricted to staff and executives.';
  }

  if (/โหวต|vote|poll|ลับ/.test(q)) {
    return lang === 'th'
      ? 'แท็บ "โหวตลับ" เปิดให้สมาชิกลงคะแนนแบบไม่ระบุตัวตน และสามารถกด "+ เพิ่มตัวเลือก" เพื่อเสนอหัวข้อเพิ่มเติมได้ทันที'
      : 'The Secret Vote tab lets members cast anonymous ballots and add new choices with "+ Add Option".';
  }

  if (/เวลา|ล็อค|cutoff|สาย|มา|ขาด|time|window/.test(q)) {
    return lang === 'th'
      ? 'แต่ละคำสั่งจะเปิดให้กดเฉพาะช่วงเวลาที่กำหนดเท่านั้น และปุ่มเช็คชื่อ (มา/สาย/ลา/ขาด) มีเวลาเส้นตายแยกกัน หากเลยเวลาที่กำหนด ปุ่มนั้นจะล็อคอัตโนมัติและข้อมูลจะรีเซตใหม่ทุกวัน'
      : 'Tasks unlock strictly during their scheduled time window, and each status button has its own cutoff deadline. Daily status resets automatically each new day while keeping historical logs.';
  }

  if (/pin|เข้าสู่ระบบ|login|พี่เลี้ยง|ผู้บริหาร|admin/.test(q)) {
    return lang === 'th'
      ? 'กรุณาเข้าสู่ระบบด้วยรหัสองค์กร ก่อนเข้าใช้งานพื้นที่องค์กร จากนั้นผู้บริหารและพี่เลี้ยงสามารถกรอกรหัส PIN เพื่อเข้าศูนย์ควบคุมหลังบ้านได้ครับ'
      : 'Please sign in with your organization code first. Staff and executives can then enter their PIN inside the organization portal.';
  }

  return lang === 'th'
    ? 'ขอบคุณสำหรับคำถาม! คุณสามารถพิมพ์ถามเรื่องเวลาเช็คชื่อ รหัส 8888 แจ้งของหาย หรือสอบถามตัวอย่างการใช้งานได้เลยครับ'
    : 'Thank you for your question! Feel free to ask about check-in windows, code 8888, lost & found, or usage examples.';
}
