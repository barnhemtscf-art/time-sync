import type { LangCode } from '../types/system';

export const TRANSLATIONS: Record<
  LangCode,
  {
    appTitle: string;
    orgPrefix: string;
    themeMonoLight: string;
    themePastelMint: string;
    shapeRounded: string;
    shapeSquare: string;
    liveClock: string;
    simClockLabel: string;
    tasksSectionTitle: string;
    tasksSectionSubtitle: string;
    lockedOutWindow: string;
    unlockedActive: string;
    openTaskBtn: string;
    emergencyHint: string;
    boardSectionTitle: string;
    tabAnnouncements: string;
    tabPoll: string;
    tabDuties: string;
    tabKnowledge: string;
    tabGifts: string;
    tabLostFound: string;
    toggleImageShow: string;
    toggleImageHide: string;
    addOptionPlaceholder: string;
    addOptionBtn: string;
    voteBtn: string;
    votedBadge: string;
    lostFoundReportTitle: string;
    lostTypeLost: string;
    lostTypeFound: string;
    itemNamePlaceholder: string;
    locationPlaceholder: string;
    reporterPlaceholder: string;
    contactPlaceholder: string;
    submitReportBtn: string;
    caseOpen: string;
    caseResolved: string;
    adminOnlyCloseNote: string;
    loginBoxTitle: string;
    loginBoxSubtitle: string;
    orgCodeLabel: string;
    pinLabel: string;
    pinPlaceholder: string;
    loginBtn: string;
    invalidPinError: string;
    securityAssurance: string;
    logout: string;
    back: string;
    qaButtonLabel: string;
    qaTitle: string;
    qaInputPlaceholder: string;
    qaSendBtn: string;
    roleExecutive: string;
    roleCoExecutive: string;
    roleMentor: string;
    statusPresent: string;
    statusLate: string;
    statusLeave: string;
    statusAbsent: string;
    cutoffLocked: string;
    cutoffUntil: string;
    emergencyUnlockTitle: string;
    emergencyCodeLabel: string;
    verifyToOpenRoster: string;
    close: string;
  }
> = {
  th: {
    appTitle: 'TimeWindow SaaS',
    orgPrefix: 'องค์กร',
    themeMonoLight: 'ขาว-ดำ',
    themePastelMint: 'ครีม-มินต์',
    shapeRounded: 'ขอบมน',
    shapeSquare: 'แบบเหลี่ยม',
    liveClock: 'เวลาปัจจุบัน',
    simClockLabel: 'จำลองเวลาทดสอบ',
    tasksSectionTitle: 'คำสั่งควบคุมตามช่วงเวลา',
    tasksSectionSubtitle: 'ถึงเวลาแล้วแถบจะขึ้นสีเด่น กดเพื่อยืนยันตัวตนและเปิดรายชื่อเช็คชื่อทันที',
    lockedOutWindow: 'ล็อค / นอกเวลา',
    unlockedActive: 'ถึงเวลาทำงาน',
    openTaskBtn: 'เปิดเช็คชื่อ',
    emergencyHint: 'ไม่มีพี่เลี้ยง? กดคำสั่งที่ถึงเวลาแล้วใช้รหัสฉุกเฉิน 8888',
    boardSectionTitle: 'บอร์ดส่วนกลางสมาชิก',
    tabAnnouncements: 'ประกาศ',
    tabPoll: 'โหวตลับ',
    tabDuties: 'เวรประจำวัน',
    tabKnowledge: 'ความรู้',
    tabGifts: 'กิจกรรมจับของขวัญ',
    tabLostFound: 'แจ้งของหาย / เก็บของได้',
    toggleImageShow: '🖼️ ดูรูป',
    toggleImageHide: '🖼️ ซ่อนรูป',
    addOptionPlaceholder: 'พิมพ์ตัวเลือกเพิ่มเติม...',
    addOptionBtn: '+ เพิ่มตัวเลือก',
    voteBtn: 'ลงคะแนนลับ',
    votedBadge: 'โหวตแล้ว',
    lostFoundReportTitle: 'แจ้งของหาย หรือ เก็บของได้ (เปิดให้สมาชิกแจ้งได้ทันที)',
    lostTypeLost: 'แจ้งของหาย',
    lostTypeFound: 'เก็บของได้',
    itemNamePlaceholder: 'ชื่อสิ่งของ เช่น กระเป๋าดินสอ, บัตรนักเรียน',
    locationPlaceholder: 'สถานที่พบ / ทำหาย',
    reporterPlaceholder: 'ชื่อผู้แจ้ง',
    contactPlaceholder: 'ช่องทางติดต่อ / จุดฝากของ',
    submitReportBtn: 'ส่งรายการแจ้ง',
    caseOpen: 'รอตรวจสอบ',
    caseResolved: 'พบเจ้าของ / ปิดเคสแล้ว',
    adminOnlyCloseNote: 'สงวนสิทธิ์การกดปิดเคสไว้เฉพาะพี่เลี้ยง/ผู้บริหารหลังบ้านเท่านั้น',
    loginBoxTitle: 'เข้าสู่ระบบหลังบ้าน',
    loginBoxSubtitle: 'เฉพาะผู้บริหารและพนักงาน/พี่เลี้ยง',
    orgCodeLabel: 'รหัสองค์กร (Tenant)',
    pinLabel: 'รหัส PIN 4 หลัก',
    pinPlaceholder: 'กรอก PIN ของท่าน',
    loginBtn: 'เข้าสู่ระบบ',
    invalidPinError: 'รหัส PIN หรือรหัสองค์กรไม่ถูกต้อง',
    securityAssurance: 'เชื่อมต่อปลอดภัยระดับองค์กร · ข้อมูลแยกอิสระตามรหัสองค์กรและบันทึก Log ทุกการปลดล็อค',
    logout: 'ออกจากระบบ',
    back: 'กลับ',
    qaButtonLabel: 'ถาม-ตอบอัตโนมัติ',
    qaTitle: 'ผู้ช่วยถาม-ตอบอัตโนมัติ',
    qaInputPlaceholder: 'พิมพ์คำถาม เช่น 8888, ของหาย, เวลาเช็คชื่อ...',
    qaSendBtn: 'ถาม',
    roleExecutive: 'ผู้บริหาร',
    roleCoExecutive: 'ผู้บริหารร่วม',
    roleMentor: 'พี่เลี้ยง / พนักงาน',
    statusPresent: 'มา',
    statusLate: 'สาย',
    statusLeave: 'ลา',
    statusAbsent: 'ขาด',
    cutoffLocked: 'เลยเวลาที่กำหนด',
    cutoffUntil: 'ห้ามเกิน',
    emergencyUnlockTitle: 'ปลดล็อคฉุกเฉิน (8888)',
    emergencyCodeLabel: 'รหัสฉุกเฉินองค์กร',
    verifyToOpenRoster: 'ยืนยันตัวตนเพื่อเปิดรายชื่อเช็คชื่อ',
    close: 'ปิด',
  },
  en: {
    appTitle: 'TimeWindow SaaS',
    orgPrefix: 'Organization',
    themeMonoLight: 'Mono Light',
    themePastelMint: 'Cream & Mint',
    shapeRounded: 'Rounded',
    shapeSquare: 'Square',
    liveClock: 'Current Time',
    simClockLabel: 'Preview Clock',
    tasksSectionTitle: 'Time-Window Tasks',
    tasksSectionSubtitle: 'Tasks unlock and highlight automatically when their scheduled window begins',
    lockedOutWindow: 'Locked / Out of Window',
    unlockedActive: 'Active Now',
    openTaskBtn: 'Open Roster',
    emergencyHint: 'No mentor on-site? Click an active task and enter emergency code 8888',
    boardSectionTitle: 'Member Community Board',
    tabAnnouncements: 'Announcements',
    tabPoll: 'Secret Vote',
    tabDuties: 'Daily Duties',
    tabKnowledge: 'Knowledge',
    tabGifts: 'Gift Exchange',
    tabLostFound: 'Lost & Found',
    toggleImageShow: '🖼️ View Photo',
    toggleImageHide: '🖼️ Hide Photo',
    addOptionPlaceholder: 'Add a new choice...',
    addOptionBtn: '+ Add Option',
    voteBtn: 'Cast Secret Vote',
    votedBadge: 'Voted',
    lostFoundReportTitle: 'Report Lost or Found Item (Public Member Access)',
    lostTypeLost: 'Lost Item',
    lostTypeFound: 'Found Item',
    itemNamePlaceholder: 'Item name e.g. Water bottle, ID card',
    locationPlaceholder: 'Location lost / found',
    reporterPlaceholder: 'Your name',
    contactPlaceholder: 'Contact or drop-off point',
    submitReportBtn: 'Submit Report',
    caseOpen: 'Open Case',
    caseResolved: 'Resolved / Returned',
    adminOnlyCloseNote: 'Closing resolved cases is restricted to staff & executives in the backend.',
    loginBoxTitle: 'Staff & Executive Portal',
    loginBoxSubtitle: 'Authorized personnel only',
    orgCodeLabel: 'Organization Code',
    pinLabel: '4-Digit PIN',
    pinPlaceholder: 'Enter staff PIN',
    loginBtn: 'Sign In',
    invalidPinError: 'Invalid organization code or PIN',
    securityAssurance: 'Enterprise Tenant Isolation · All attendance actions and emergency unlocks are audit-logged',
    logout: 'Logout',
    back: 'Back',
    qaButtonLabel: 'Q&A Helper',
    qaTitle: 'Automated Q&A Helper',
    qaInputPlaceholder: 'Ask about 8888, lost items, cutoff times...',
    qaSendBtn: 'Ask',
    roleExecutive: 'Executive',
    roleCoExecutive: 'Co-Executive',
    roleMentor: 'Mentor / Staff',
    statusPresent: 'Present',
    statusLate: 'Late',
    statusLeave: 'Leave',
    statusAbsent: 'Absent',
    cutoffLocked: 'Cutoff Passed',
    cutoffUntil: 'Until',
    emergencyUnlockTitle: 'Emergency Unlock (8888)',
    emergencyCodeLabel: 'Org Emergency Code',
    verifyToOpenRoster: 'Verify identity to open attendance roster',
    close: 'Close',
  },
};
