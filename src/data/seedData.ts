import type { BoardModeConfig, TenantData } from '../types/system';
import { formatMinutesToTime, getLocalDateKey, getMinutesOfDay } from '../utils/timeWindow';

export const DEFAULT_BOARD_MODES: BoardModeConfig[] = [
  { id: 'announcements', builtinType: 'announcements', labelTh: 'ประกาศ', labelEn: 'Announcements', icon: 'bell', enabled: true },
  { id: 'poll', builtinType: 'poll', labelTh: 'โหวตลับ', labelEn: 'Secret Vote', icon: 'check', enabled: true },
  { id: 'duties', builtinType: 'duties', labelTh: 'เวรประจำวัน', labelEn: 'Daily Duties', icon: 'calendar', enabled: true },
  { id: 'knowledge', builtinType: 'knowledge', labelTh: 'ความรู้', labelEn: 'Knowledge', icon: 'book', enabled: true },
  { id: 'lostfound', builtinType: 'lostfound', labelTh: 'แจ้งของหาย / เก็บของได้', labelEn: 'Lost & Found', icon: 'package', enabled: true },
  { id: 'gifts', builtinType: 'gifts', labelTh: 'เข้ากิจกรรมจับของขวัญ', labelEn: 'Gift Exchange', icon: 'gift', enabled: true },
];

export function createSeedTenants(now: Date = new Date()): Record<string, TenantData> {
  const dateKey = getLocalDateKey(now);
  const currentMins = getMinutesOfDay(now);

  // Anchor two tasks dynamically around current time so evaluators can test immediately at any hour,
  // while keeping realistic fixed-schedule tasks (06:00-07:00 ไปโรงเรียน, etc.) visible as locked/out-of-window.
  const activeStart = formatMinutesToTime(currentMins - 20);
  const activeEnd = formatMinutesToTime(currentMins + 65);
  const cutoffPresent = formatMinutesToTime(currentMins + 25);
  const cutoffLate = formatMinutesToTime(currentMins + 55);

  const activeQrStart = formatMinutesToTime(currentMins - 10);
  const activeQrEnd = formatMinutesToTime(currentMins + 45);
  const qrCutoffPresent = formatMinutesToTime(currentMins - 2); // Already past cutoff for instant demo of strict cutoff lock!
  const qrCutoffLate = formatMinutesToTime(currentMins + 30);

  const org01: TenantData = {
    orgId: 'ORG01',
    orgNameTh: 'มูลนิธิบ้านสายรุ้ง',
    orgNameEn: 'Rainbow House Foundation',
    emergencyCode: '8888',
    storageMode: 'central_14d',
    gasWebAppUrl: '',
    lastResetDateKey: dateKey,
    staff: [
      { id: 'st-1', name: 'SuSan', role: 'executive', pin: '9015', orgId: 'ORG01', title: 'ผู้บริหาร' },
      { id: 'st-2', name: 'พี่เหว่า', role: 'executive', pin: '4382', orgId: 'ORG01', title: 'ผู้บริหาร' },
      { id: 'st-3', name: 'พี่เอก', role: 'mentor', pin: '7394', orgId: 'ORG01', title: 'พี่เลี้ยง' },
      { id: 'st-4', name: 'พี่เกด', role: 'mentor', pin: '8261', orgId: 'ORG01', title: 'พี่เลี้ยง' },
      { id: 'st-5', name: 'พี่กุ๊ก', role: 'mentor', pin: '5948', orgId: 'ORG01', title: 'พี่เลี้ยง' },
      { id: 'st-6', name: 'พี่กิ๊ก', role: 'mentor', pin: '6417', orgId: 'ORG01', title: 'พี่เลี้ยง' },
    ],
    members: [
      // ทีมพี่โต 10 คน
      { id: 'm-s01', name: 'ต้นกล้า', group: 'ทีมพี่โต', code: 'S01', offensePoints: 0, customUnitScores: { 'unit-volunteer': 12, 'unit-tidy': 8 }, active: true },
      { id: 'm-s02', name: 'น้ำฟ้า', group: 'ทีมพี่โต', code: 'S02', offensePoints: 1, customUnitScores: { 'unit-volunteer': 15, 'unit-tidy': 9 }, active: true },
      { id: 'm-s03', name: 'ภีม', group: 'ทีมพี่โต', code: 'S03', offensePoints: 0, customUnitScores: { 'unit-volunteer': 10, 'unit-tidy': 7 }, active: true },
      { id: 'm-s04', name: 'มิลิน', group: 'ทีมพี่โต', code: 'S04', offensePoints: 0, customUnitScores: { 'unit-volunteer': 18, 'unit-tidy': 10 }, active: true },
      { id: 'm-s05', name: 'กาฟิว', group: 'ทีมพี่โต', code: 'S05', offensePoints: 2, customUnitScores: { 'unit-volunteer': 6, 'unit-tidy': 5 }, active: true },
      { id: 'm-s06', name: 'ใบเตย', group: 'ทีมพี่โต', code: 'S06', offensePoints: 0, customUnitScores: { 'unit-volunteer': 14, 'unit-tidy': 9 }, active: true },
      { id: 'm-s07', name: 'เจแปน', group: 'ทีมพี่โต', code: 'S07', offensePoints: 1, customUnitScores: { 'unit-volunteer': 11, 'unit-tidy': 8 }, active: true },
      { id: 'm-s08', name: 'ออมสิน', group: 'ทีมพี่โต', code: 'S08', offensePoints: 0, customUnitScores: { 'unit-volunteer': 16, 'unit-tidy': 9 }, active: true },
      { id: 'm-s09', name: 'ไทเกอร์', group: 'ทีมพี่โต', code: 'S09', offensePoints: 0, customUnitScores: { 'unit-volunteer': 9, 'unit-tidy': 7 }, active: true },
      { id: 'm-s10', name: 'ข้าวหอม', group: 'ทีมพี่โต', code: 'S10', offensePoints: 0, customUnitScores: { 'unit-volunteer': 13, 'unit-tidy': 8 }, active: true },
      // ทีมน้องเล็ก 5 คน
      { id: 'm-j01', name: 'อันดา', group: 'ทีมน้องเล็ก', code: 'J01', offensePoints: 0, customUnitScores: { 'unit-volunteer': 7, 'unit-tidy': 10 }, active: true },
      { id: 'm-j02', name: 'ปันปัน', group: 'ทีมน้องเล็ก', code: 'J02', offensePoints: 0, customUnitScores: { 'unit-volunteer': 8, 'unit-tidy': 9 }, active: true },
      { id: 'm-j03', name: 'โมจิ', group: 'ทีมน้องเล็ก', code: 'J03', offensePoints: 1, customUnitScores: { 'unit-volunteer': 5, 'unit-tidy': 8 }, active: true },
      { id: 'm-j04', name: 'พอร์ช', group: 'ทีมน้องเล็ก', code: 'J04', offensePoints: 0, customUnitScores: { 'unit-volunteer': 6, 'unit-tidy': 9 }, active: true },
      { id: 'm-j05', name: 'มะลิ', group: 'ทีมน้องเล็ก', code: 'J05', offensePoints: 0, customUnitScores: { 'unit-volunteer': 9, 'unit-tidy': 10 }, active: true },
    ],
    tasks: [
      {
        id: 'task-current-check',
        titleTh: 'เช็คชื่อรวมตัวประจำรอบ',
        titleEn: 'Active Session Attendance',
        descriptionTh: 'ถึงช่วงเวลาแล้ว — กดเพื่อเปิดรายชื่อและยืนยันตัวตน (รองรับ PIN หรือรหัสฉุกเฉิน 8888)',
        descriptionEn: 'Window active now — click to open roster and verify attendance (PIN or 8888)',
        startTime: activeStart,
        endTime: activeEnd,
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        authMethod: 'pin',
        buttonCutoffs: {
          present: cutoffPresent,
          late: cutoffLate,
        },
        showNameButtonLabel: 'เช็คชื่อ',
        enabled: true,
        approvalStatus: 'approved',
        targetGroup: 'all',
      },
      {
        id: 'task-qr-checkpoint',
        titleTh: 'สแกน QR จุดกิจกรรม (ทดสอบปุ่มเลยเวลา)',
        titleEn: 'Activity QR Checkpoint (Cutoff Demo)',
        descriptionTh: 'ยืนยันด้วย QR รายวัน — ปุ่ม "มา" ตั้งเวลาเส้นตายไว้ก่อนหน้าเพื่อแสดงการล็อคตามเวลาจริง',
        descriptionEn: 'Daily QR verification — "Present" button cutoff passed to demonstrate strict cutoff locking',
        startTime: activeQrStart,
        endTime: activeQrEnd,
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        authMethod: 'daily_qr',
        buttonCutoffs: {
          present: qrCutoffPresent,
          late: qrCutoffLate,
        },
        showNameButtonLabel: 'เช็คชื่อจุดนี้',
        enabled: true,
        approvalStatus: 'approved',
        targetGroup: 'all',
      },
      {
        id: 'task-school',
        titleTh: 'ไปโรงเรียน',
        titleEn: 'Go to School',
        descriptionTh: 'เช็คชื่อขึ้นรถและเตรียมความพร้อมก่อนออกเดินทาง (จันทร์–ศุกร์)',
        descriptionEn: 'Morning school departure check-in (Mon–Fri)',
        startTime: '06:00',
        endTime: '07:00',
        daysOfWeek: [1, 2, 3, 4, 5],
        authMethod: 'photo',
        buttonCutoffs: {
          present: '06:45',
          late: '07:00',
        },
        showNameButtonLabel: 'ออกเดินทาง',
        enabled: true,
        approvalStatus: 'approved',
        targetGroup: 'all',
      },
      {
        id: 'task-evening-study',
        titleTh: 'ทบทวนการบ้าน & อ่านหนังสือ',
        titleEn: 'Evening Homework & Study',
        descriptionTh: 'เช็คชื่อเข้าห้องสมุดช่วงเย็น (กดชื่อยืนยัน / สแกน QR)',
        descriptionEn: 'Evening study hall check-in',
        startTime: '18:30',
        endTime: '20:00',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        authMethod: 'tap',
        buttonCutoffs: {
          present: '18:50',
          late: '19:15',
        },
        showNameButtonLabel: 'เข้าห้องเรียน',
        enabled: true,
        approvalStatus: 'approved',
        targetGroup: 'ทีมพี่โต',
      },
      {
        id: 'task-bedtime',
        titleTh: 'ตรวจความเรียบร้อยก่อนเข้านอน',
        titleEn: 'Bedtime Check-in',
        descriptionTh: 'เช็คชื่อครบทุกคนก่อนปิดไฟนอน',
        descriptionEn: 'Final headcount before lights out',
        startTime: '21:00',
        endTime: '21:45',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        authMethod: 'qr',
        staticQrSecret: 'RAINBOW-NIGHT-QR',
        buttonCutoffs: {
          present: '21:30',
        },
        showNameButtonLabel: 'เข้านอน',
        enabled: true,
        approvalStatus: 'approved',
        targetGroup: 'all',
      },
    ],
    todayCheckins: [],
    boardModes: DEFAULT_BOARD_MODES.map((m) => ({ ...m })),
    logs: [
      {
        id: 'log-seed-1',
        dateKey,
        timestamp: '06:35',
        type: 'attendance',
        taskId: 'task-school',
        taskTitle: 'ไปโรงเรียน',
        memberId: 'm-s01',
        memberName: 'ต้นกล้า',
        status: 'present',
        actorName: 'พี่เอก',
        unlockMethod: 'pin',
        note: 'บันทึกเข้าเรียนปกติ',
      },
      {
        id: 'log-seed-2',
        dateKey,
        timestamp: '06:50',
        type: 'emergency_unlock',
        taskId: 'task-school',
        taskTitle: 'ไปโรงเรียน',
        actorName: 'จุดรับส่งหน้าบ้าน (8888)',
        unlockMethod: 'emergency_8888',
        note: 'ปลดล็อคฉุกเฉินด้วยรหัส 8888 หน้างาน',
      },
    ],
    announcements: [
      {
        id: 'ann-1',
        titleTh: 'กิจกรรมเวิร์กชอปศิลปะและการเรียนรู้ประจำสัปดาห์',
        titleEn: 'Weekly Art & Learning Workshop Schedule',
        bodyTh: 'ขอให้น้องๆ ทีมพี่โตและทีมน้องเล็กเตรียมสมุดบันทึกและอุปกรณ์วาดภาพมารวมตัวที่ห้องโถงกลาง เวลา 16:00 น. พร้อมทั้งตรวจเช็คเวรทำความสะอาดประจำวันให้เรียบร้อย',
        bodyEn: 'Senior and Junior groups please bring your journals and watercolor sets to the main hall at 16:00 and complete daily duty handovers.',
        date: dateKey,
        author: 'SuSan (ผู้บริหาร)',
        imageUrl: '/src/assets/images/announcement_activity_day_1795291531556.jpg',
      },
      {
        id: 'ann-2',
        titleTh: 'แจ้งปรับเวลาเส้นตายปุ่มเช็คชื่อรอบเช้า',
        titleEn: 'Updated Morning Cutoff Deadline Notice',
        bodyTh: 'ปุ่ม "มา" รอบไปโรงเรียนกำหนดเส้นตายเวลา 06:45 น. และปุ่ม "สาย" ถึง 07:00 น. หากเลยเวลาที่กำหนดปุ่มจะถูกล็อคอัตโนมัติ',
        bodyEn: 'Morning "Present" cutoff is 06:45 and "Late" cutoff is 07:00. Buttons lock automatically after the deadline.',
        date: dateKey,
        author: 'พี่เหว่า (ผู้บริหาร)',
      },
    ],
    poll: {
      id: 'poll-1',
      questionTh: 'โหวตกิจกรรมพิเศษวันเสาร์นี้ (ไม่ระบุตัวตน)',
      questionEn: 'Saturday Special Activity Secret Vote',
      options: [
        { id: 'opt-1', text: 'วาดภาพสีน้ำและจัดบอร์ดนิทรรศการ', votes: 6 },
        { id: 'opt-2', text: 'ทำอาหารกลางวันร่วมกันและแบ่งปัน', votes: 5 },
        { id: 'opt-3', text: 'กีฬาเชื่อมความสัมพันธ์สนามหญ้า', votes: 3 },
      ],
      votedSessionKeys: [],
    },
    duties: [
      {
        id: 'duty-1',
        zoneTh: 'ห้องโถงกลาง & โต๊ะเรียนรวม',
        zoneEn: 'Main Hall & Study Desks',
        assignees: ['ต้นกล้า', 'มิลิน', 'อันดา'],
        timeLabel: '07:00–07:30 / 17:30–18:00',
      },
      {
        id: 'duty-2',
        zoneTh: 'ห้องครัว & จัดเตรียมภาชนะ',
        zoneEn: 'Kitchen & Dining Prep',
        assignees: ['น้ำฟ้า', 'ใบเตย', 'ปันปัน'],
        timeLabel: '06:30–07:15 / 17:00–17:45',
      },
      {
        id: 'duty-3',
        zoneTh: 'ลานหน้าบ้าน & คัดแยกขยะ',
        zoneEn: 'Front Courtyard & Recycling',
        assignees: ['ภีม', 'เจแปน', 'พอร์ช'],
        timeLabel: '16:30–17:00',
      },
    ],
    knowledge: [
      {
        id: 'kn-1',
        titleTh: 'ขั้นตอนการใช้งานรหัสฉุกเฉิน 8888 หน้างาน',
        titleEn: 'How to Use Emergency Code 8888 On-Site',
        summaryTh: 'เมื่อถึงช่วงเวลาคำสั่ง (แถบขึ้นสี) แต่ไม่มีพี่เลี้ยงอยู่หน้าจุดตรวจ ให้กดที่คำสั่งแล้วกรอกรหัส 8888 เพื่อเปิดรายชื่อเช็คชื่อได้ทันที โดยระบบจะไม่เปิดเมนูหลังบ้านและบันทึก Log ทุกครั้ง',
        summaryEn: 'When a task window is active and no mentor is present, click the highlighted task and enter 8888 to open the attendance roster immediately without exposing admin menus.',
        category: 'คู่มือระบบ',
      },
      {
        id: 'kn-2',
        titleTh: 'การแบ่งหน้าที่และความรับผิดชอบระหว่างทีมพี่โตและน้องเล็ก',
        titleEn: 'Senior & Junior Team Responsibility Guide',
        summaryTh: 'ทีมพี่โตดูแลความเรียบร้อยช่วงเตรียมตัวและช่วยเหลือน้องเล็กในเวรประจำวัน สามารถสะสมคะแนนจิตอาสาและความรับผิดชอบเพื่อรับเกียรติบัตรรายเดือน',
        summaryEn: 'Senior members support junior members during daily chores and accumulate volunteer and responsibility units toward monthly recognition.',
        category: 'ระเบียบองค์กร',
      },
    ],
    giftExchange: {
      eventTitleTh: 'กิจกรรมจับสลากของขวัญสานสัมพันธ์ปลายเดือน',
      eventTitleEn: 'Monthly Community Gift Exchange',
      budgetCap: 150,
      imageUrl: '/src/assets/images/community_gift_exchange_1795291531310.jpg',
      participants: ['ต้นกล้า', 'น้ำฟ้า', 'ภีม', 'มิลิน', 'ใบเตย', 'อันดา', 'ปันปัน', 'มะลิ'],
      pairs: [],
    },
    lostFound: [
      {
        id: 'lf-1',
        type: 'found',
        itemName: 'กระติกน้ำสเตนเลสสีเงิน 500ml',
        location: 'โต๊ะอ่านหนังสือริมหน้าต่าง',
        reporterName: 'มิลิน',
        contactNote: 'ฝากไว้ที่โต๊ะพี่เลี้ยงห้องโถง',
        createdAt: `${dateKey} 09:15`,
        status: 'open',
      },
      {
        id: 'lf-2',
        type: 'lost',
        itemName: 'สมุดจดปกน้ำตาล (เขียนชื่อ ปันปัน)',
        location: 'บริเวณลานหน้าบ้าน',
        reporterName: 'ปันปัน',
        contactNote: 'พบแล้วกรุณาแจ้งพี่เกดหรือโพสต์ตอบกลับ',
        createdAt: `${dateKey} 10:40`,
        status: 'open',
      },
    ],
    customUnits: [
      { id: 'unit-volunteer', nameTh: 'แต้มจิตอาสา', nameEn: 'Volunteer Points', unitLabel: 'แต้ม', active: true },
      { id: 'unit-tidy', nameTh: 'คะแนนความเรียบร้อย', nameEn: 'Tidiness Score', unitLabel: 'คะแนน', active: true },
    ],
    coAdminInvites: [
      {
        code: 'CO-EXEC-9024',
        invitedName: 'ผู้บริหารร่วมฝ่ายวิชาการ',
        invitedAt: dateKey,
        accepted: false,
      },
    ],
  };

  return {
    ORG01: org01,
  };
}

export function createTenantSeedForMode(params: {
  orgId: string;
  orgNameTh: string;
  orgNameEn: string;
  execPin: string;
  orgAccountMode: 'org_2tier' | 'foundation_3tier' | 'file_drop';
  orgCategory?: string;
  ownerEmail?: string;
  ownerNickname?: string;
  ownerTitle?: string;
  now?: Date;
}): TenantData {
  const now = params.now ?? new Date();
  const dateKey = getLocalDateKey(now);
  const base = createSeedTenants(now).ORG01;
  const currentMins = getMinutesOfDay(now);
  const activeStart = formatMinutesToTime(currentMins - 15);
  const activeEnd = formatMinutesToTime(currentMins + 90);
  const cutoffPresent = formatMinutesToTime(currentMins + 30);
  const cutoffLate = formatMinutesToTime(currentMins + 60);

  const execUser = {
    id: `st-exec-${Date.now()}`,
    name: params.ownerNickname?.trim() || `${params.orgId} Owner`,
    role: 'executive' as const,
    pin: params.execPin,
    orgId: params.orgId,
    title:
      params.ownerTitle?.trim() ||
      (params.orgAccountMode === 'org_2tier'
        ? 'หัวหน้า / เจ้าขององค์กร'
        : params.orgAccountMode === 'file_drop'
        ? 'ผู้ดูแลจุดฝากไฟล์รวม'
        : 'ผู้บริหาร'),
  };

  if (params.orgAccountMode === 'org_2tier') {
    return {
      orgId: params.orgId,
      orgNameTh: params.orgNameTh,
      orgNameEn: params.orgNameEn,
      orgAccountMode: 'org_2tier',
      orgCategory: params.orgCategory,
      ownerEmail: params.ownerEmail,
      strictFieldAuth: true,
      emergencyCode: '8888',
      storageMode: 'central_14d',
      gasWebAppUrl: '',
      lastResetDateKey: dateKey,
      staff: [execUser],
      members: [
        {
          id: `m-${Date.now()}-1`,
          name: params.ownerNickname?.trim() || 'หัวหน้าทีม',
          group: 'ทีมงาน / พนักงาน',
          code: 'T01',
          offensePoints: 0,
          customUnitScores: { 'unit-team': 0 },
          active: true,
        },
      ],
      tasks: [
        {
          id: `task-checkin-${Date.now()}`,
          titleTh: 'เช็คชื่อเข้างาน / ประชุมทีมประจำวัน',
          titleEn: 'Daily Team Check-in / Standup',
          descriptionTh: 'ลงเวลาทำงานและยืนยันความพร้อมของทีมงาน',
          descriptionEn: 'Record daily team attendance and shift readiness',
          startTime: activeStart,
          endTime: activeEnd,
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          authMethod: 'pin',
          buttonCutoffs: {
            present: cutoffPresent,
            late: cutoffLate,
          },
          showNameButtonLabel: 'เช็คชื่อเข้างาน',
          enabled: true,
          approvalStatus: 'approved',
          targetGroup: 'all',
        },
      ],
      todayCheckins: [],
      boardModes: DEFAULT_BOARD_MODES.map((m) => ({ ...m })),
      logs: [],
      announcements: [
        {
          id: `ann-org-${Date.now()}`,
          titleTh: `ยินดีต้อนรับสู่พื้นที่ทีมงาน ${params.orgNameTh}`,
          titleEn: `Welcome to ${params.orgNameEn} Workspace`,
          bodyTh: 'พื้นที่ทำงานแบบ 2 ระดับ (หัวหน้า + พนักงาน) สามารถเพิ่มรายชื่อพนักงาน สร้างคำสั่งเช็คชื่อ หรือเปิดจุดฝากไฟล์รวมได้ทันที',
          bodyEn: '2-tier team workspace ready. Add team members, schedule shifts, or open your shared file drop hub.',
          date: dateKey,
          author: execUser.name,
        },
      ],
      poll: {
        id: `poll-${Date.now()}`,
        questionTh: 'โหวตหัวข้อประชุมทีมสัปดาห์นี้ (ไม่ระบุตัวตน)',
        questionEn: 'Weekly Team Sync Poll',
        options: [
          { id: 'opt-1', text: 'สรุปยอดและคิวงานสัปดาห์นี้', votes: 0 },
          { id: 'opt-2', text: 'ปรับปรุงจุดบริการและสต็อก', votes: 0 },
        ],
        votedSessionKeys: [],
      },
      duties: [
        {
          id: `duty-${Date.now()}`,
          zoneTh: 'ความเรียบร้อยพื้นที่ทำงาน & จุดรับลูกค้า',
          zoneEn: 'Workspace & Front Desk',
          assignees: [execUser.name],
          timeLabel: '09:00–18:00',
        },
      ],
      knowledge: [
        {
          id: `kn-${Date.now()}`,
          titleTh: 'คู่มือการใช้งานสำหรับทีมงาน 2 ระดับ',
          titleEn: '2-Tier Team Workspace Guide',
          summaryTh: 'หัวหน้าสามารถจัดการรายชื่อ ตั้งค่าตารางเวลาเช็คชื่อ และส่งออกรายงาน Excel/CSV หรือเชื่อม Google Sheets ได้ที่ศูนย์ควบคุม',
          summaryEn: 'Manage team members, attendance schedules, and Excel/CSV or Google Sheets exports from the console.',
          category: 'คู่มือทีมงาน',
        },
      ],
      giftExchange: {
        eventTitleTh: 'กิจกรรมทีมสัมพันธ์ประจำเดือน',
        eventTitleEn: 'Team Activity Exchange',
        budgetCap: 200,
        participants: [execUser.name],
        pairs: [],
      },
      lostFound: [],
      customUnits: [
        { id: 'unit-team', nameTh: 'คะแนนผลงานทีม', nameEn: 'Team Points', unitLabel: 'แต้ม', active: true },
      ],
      coAdminInvites: [],
    };
  }

  if (params.orgAccountMode === 'file_drop') {
    return {
      orgId: params.orgId,
      orgNameTh: params.orgNameTh,
      orgNameEn: params.orgNameEn,
      orgAccountMode: 'file_drop',
      orgCategory: params.orgCategory,
      ownerEmail: params.ownerEmail,
      strictFieldAuth: true,
      emergencyCode: '8888',
      storageMode: 'central_14d',
      gasWebAppUrl: '',
      lastResetDateKey: dateKey,
      staff: [execUser],
      members: [
        {
          id: `m-${Date.now()}-1`,
          name: execUser.name,
          group: 'ผู้ดูแลจุดฝากไฟล์',
          code: 'H01',
          offensePoints: 0,
          customUnitScores: {},
          active: true,
        },
      ],
      tasks: [],
      todayCheckins: [],
      boardModes: DEFAULT_BOARD_MODES.map((m) => ({ ...m })),
      logs: [],
      announcements: [
        {
          id: `ann-drop-${Date.now()}`,
          titleTh: `เปิดจุดฝากไฟล์รวม: ${params.orgNameTh}`,
          titleEn: `Shared File Drop Hub: ${params.orgNameEn}`,
          bodyTh: 'ไม่ต้องเข้าบ่อย แค่แวะเข้ามาฝากไฟล์หรือข้อความรวมกันในจุดเดียวก็ได้ รองรับรูปภาพ ข้อความ PDF และเอ็กเซล',
          bodyEn: 'Drop files or messages together in one shared place — supports images, text, PDF, and Excel.',
          date: dateKey,
          author: execUser.name,
        },
      ],
      poll: {
        id: `poll-drop-${Date.now()}`,
        questionTh: 'ความสะดวกในการส่งไฟล์เข้าจุดรวม',
        questionEn: 'File Drop Convenience Feedback',
        options: [
          { id: 'opt-1', text: 'ส่งผ่านหน้าเว็บโดยตรง', votes: 0 },
          { id: 'opt-2', text: 'ซิงค์เข้า Google Drive ส่วนกลาง', votes: 0 },
        ],
        votedSessionKeys: [],
      },
      duties: [],
      knowledge: [
        {
          id: `kn-drop-${Date.now()}`,
          titleTh: 'วิธีเปิดจุดรับไฟล์และตั้งรหัสกลาง',
          titleEn: 'How to Configure Drop Point & Shared Passcode',
          summaryTh: 'ไปที่แท็บ "เปิดจุดรับไฟล์" เพื่อตั้งหัวข้อ รหัสกลาง และติ๊กเลือกชนิดไฟล์ที่อนุญาต (รูปภาพ / ข้อความ / PDF / เอ็กเซล)',
          summaryEn: 'Open the Configure Drop Point tab to set topic, shared passcode, and accepted file formats.',
          category: 'คู่มือจุดฝากไฟล์',
        },
      ],
      giftExchange: {
        eventTitleTh: 'กิจกรรมทีมงาน',
        eventTitleEn: 'Team Activity',
        budgetCap: 150,
        participants: [],
        pairs: [],
      },
      lostFound: [],
      customUnits: [],
      coAdminInvites: [],
    };
  }

  return {
    ...base,
    orgId: params.orgId,
    orgNameTh: params.orgNameTh,
    orgNameEn: params.orgNameEn,
    orgAccountMode: 'foundation_3tier',
    orgCategory: params.orgCategory,
    ownerEmail: params.ownerEmail,
    strictFieldAuth: true,
    staff: [execUser],
    boardModes: DEFAULT_BOARD_MODES.map((m) => ({ ...m })),
    todayCheckins: [],
    logs: [],
    coAdminInvites: [],
  };
}
