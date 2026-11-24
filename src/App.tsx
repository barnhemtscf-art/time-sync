import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  FolderUp,
  KeyRound,
  Lock,
  QrCode,
  Settings2,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import {
  isPastelTheme,
  type AttendanceStatus,
  type AuditLogEntry,
  type BoardModeConfig,
  type FileDropAllowedTypes,
  type FileDropHubConfig,
  type FileDropModeId,
  type FileDropSubmission,
  type LangCode,
  type LostFoundItem,
  type Member,
  type ProfileCardFieldConfig,
  type ProfileCardSubmission,
  type ProfileDropHubConfig,
  type ShapeMode,
  type StaffUser,
  type StorageMode,
  type TenantData,
  type ThemeMode,
  type TimeTask,
  type UnlockMethod,
} from './types/system';
import { createSeedTenants, createTenantSeedForMode, DEFAULT_BOARD_MODES } from './data/seedData';
import { TRANSLATIONS } from './i18n/translations';
import { getDefaultFileDropHub } from './utils/fileDrop';
import { getDefaultProfileDropHub } from './utils/profileCard';
import {
  generateUniqueMemberCode,
  inferDropModeFromCategory,
  isMemberCodeDuplicate,
  isValidGasWebAppUrl,
  normalizeOrgLookupKey,
} from './utils/orgCode';
import { getLocalDateKey, isTaskActiveAt, needsDailyReset, parseTimeToMinutes } from './utils/timeWindow';
import {
  clearFileDropSubmissions,
  clearProfileDropSubmissions,
  purgeExpiredTenantRecords,
} from './utils/retention';
import {
  sendCheckinToGasWebApp,
  sendDropToGasWebApp,
  sendProfileToGasWebApp,
} from './utils/gasSync';
import { ThemeShapeLangBar } from './components/ThemeShapeLangBar';
import { CloudMascot } from './components/CloudMascot';
import { OrgGateView, type RegisterOrgPayload } from './components/OrgGateView';
import { CommunityBoard } from './components/CommunityBoard';
import { TaskCheckinModal } from './components/TaskCheckinModal';
import { QaFloatingWidget } from './components/QaFloatingWidget';
import { StaffBackend } from './components/StaffBackend';
import { ExecutiveBackend } from './components/ExecutiveBackend';
import { FileDropModeModal } from './components/FileDropModeModal';
import { FileDropHubView } from './components/FileDropHubView';
import { ProfileDropHubView } from './components/ProfileDropHubView';

const STORAGE_KEY_TENANTS = 'tw_saas_tenants_v1';
const STORAGE_KEY_ACTIVE_ORG = 'tw_saas_active_org_v1';

function formatFullLocalizedDate(date: Date, lang: LangCode): string {
  if (lang === 'th') {
    const weekdays = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
    const months = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
    ];
    return `วัน${weekdays[date.getDay()]}ที่ ${date.getDate()} ${months[date.getMonth()]} พ.ศ. ${date.getFullYear() + 543}`;
  }
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatSpacedClock(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export default function App() {
  // Default to Sky Pastel (pastel-sky) as requested for first customer impression
  const [theme, setTheme] = useState<ThemeMode>('pastel-sky');
  const [shape, setShape] = useState<ShapeMode>('rounded');
  const [lang, setLang] = useState<LangCode>('th');
  const [hasEnteredOrg, setHasEnteredOrg] = useState(false);
  const [isDemoPreview, setIsDemoPreview] = useState(false);
  const [showOrgGate, setShowOrgGate] = useState(true);
  const [qaOpen, setQaOpen] = useState(false);
  const [showDropModeModal, setShowDropModeModal] = useState(false);
  const [dropModeModalInitialSelected, setDropModeModalInitialSelected] = useState(false);
  const [activeHomeSection, setActiveHomeSection] = useState<
    'dashboard' | 'file_drop' | 'profile_drop'
  >('dashboard');

  const [tenants, setTenants] = useState<Record<string, TenantData>>(() => {
    const initNow = new Date();
    try {
      const raw = localStorage.getItem(STORAGE_KEY_TENANTS);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, TenantData>;
        if (parsed && parsed.ORG01) {
          const cleaned: Record<string, TenantData> = {};
          for (const [key, item] of Object.entries(parsed)) {
            cleaned[key] = purgeExpiredTenantRecords(item, initNow).tenant;
          }
          return cleaned;
        }
      }
    } catch {
      // Fallback cleanly to deterministic seed data
    }
    return createSeedTenants(initNow);
  });

  const [activeOrgId, setActiveOrgId] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_ACTIVE_ORG) || 'ORG01';
    } catch {
      return 'ORG01';
    }
  });

  const [currentUser, setCurrentUser] = useState<StaffUser | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());
  const [simulatedTimeStr, setSimulatedTimeStr] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string>('');
  const [demoTenantState, setDemoTenantState] = useState<TenantData>(() => {
    const seed = createSeedTenants(new Date()).ORG01;
    return { ...seed, strictFieldAuth: false };
  });

  // Screenshot 1 layout state
  const [loginPin, setLoginPin] = useState('');
  const [isPinFocused, setIsPinFocused] = useState(false);
  const [showPinText, setShowPinText] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [tasksExpanded, setTasksExpanded] = useState(false);

  // Auto-Popup Roster Modal State
  const [activeModalTask, setActiveModalTask] = useState<TimeTask | null>(null);
  const [sessionVoteKey] = useState(() => `sess-${Math.random().toString(36).slice(2, 10)}`);

  const t = TRANSLATIONS[lang];
  const storedActiveTenant = tenants[activeOrgId] ?? tenants.ORG01 ?? Object.values(tenants)[0];
  const activeTenant = isDemoPreview ? demoTenantState : storedActiveTenant;
  const activeFileDropHub: FileDropHubConfig = useMemo(
    () =>
      activeTenant.fileDropHub ??
      getDefaultFileDropHub(activeTenant.orgNameTh, activeTenant.orgNameEn),
    [activeTenant]
  );
  const activeProfileHub: ProfileDropHubConfig = useMemo(
    () =>
      activeTenant.profileHub ??
      getDefaultProfileDropHub(activeTenant.orgNameTh, activeTenant.orgNameEn),
    [activeTenant]
  );
  const showMascot = isPastelTheme(theme);

  // Direct URL / QR Business Card routing: ?org=ORGID&view=profile|drop|home
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const orgParam = params.get('org');
    if (!orgParam) return;
    const matchedKey = normalizeOrgLookupKey(orgParam, tenants);
    if (!matchedKey) return;

    const viewParam = params.get('view');
    const target = tenants[matchedKey];
    setActiveOrgId(matchedKey);
    setHasEnteredOrg(true);
    setIsDemoPreview(false);
    setShowOrgGate(false);
    setShowDropModeModal(false);
    if (viewParam === 'profile') {
      setActiveHomeSection('profile_drop');
    } else if (viewParam === 'drop' || target?.orgAccountMode === 'file_drop') {
      setActiveHomeSection('file_drop');
    } else {
      setActiveHomeSection('dashboard');
    }
    // Run once on initial page load for QR scan entry
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-shape', shape);
  }, [theme, shape]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TENANTS, JSON.stringify(tenants));
      localStorage.setItem(STORAGE_KEY_ACTIVE_ORG, activeOrgId);
      setStorageWarning('');
    } catch {
      setStorageWarning(
        lang === 'th'
          ? 'พื้นที่จัดเก็บในเบราว์เซอร์ใกล้เต็มแล้ว ระบบไม่สามารถบันทึกข้อมูลล่าสุดลงเครื่องได้ กรุณาส่งออก Excel/CSV หรือเชื่อมต่อ Google Apps Script'
          : 'Browser storage quota exceeded. Please export CSV or connect Google Apps Script to avoid data loss.'
      );
    }
  }, [tenants, activeOrgId, lang]);

  // 1-second tick for crisp HH : MM : SS live clock matching reference screenshots
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const effectiveNow = useMemo(() => {
    if (!simulatedTimeStr) return now;
    const mins = parseTimeToMinutes(simulatedTimeStr);
    if (mins < 0) return now;
    const copy = new Date(now);
    copy.setHours(Math.floor(mins / 60), mins % 60, now.getSeconds(), 0);
    return copy;
  }, [now, simulatedTimeStr]);

  // Automatic Daily Reset + Rolling 14-Day Item Expiry when local date rolls over
  useEffect(() => {
    const currentDateKey = getLocalDateKey(effectiveNow);
    if (activeTenant && needsDailyReset(activeTenant.lastResetDateKey, currentDateKey)) {
      setTenants((prev) => {
        const target = prev[activeTenant.orgId];
        if (!target || !needsDailyReset(target.lastResetDateKey, currentDateKey)) return prev;
        const resetLog: AuditLogEntry = {
          id: `log-reset-${Date.now()}`,
          dateKey: currentDateKey,
          timestamp: '00:00',
          type: 'daily_reset',
          actorName: 'System Daily Reset',
          note: 'รีเซตสถานะเช็คชื่อรายวันอัตโนมัติ (คงรายการล่าสุดไว้ 14 วัน และตัดเฉพาะรายการที่เก่าเกิน 14 วัน)',
        };
        const withReset: TenantData = {
          ...target,
          lastResetDateKey: currentDateKey,
          todayCheckins: [],
          logs: [resetLog, ...target.logs],
        };
        return {
          ...prev,
          [target.orgId]: purgeExpiredTenantRecords(withReset, effectiveNow).tenant,
        };
      });
    }
  }, [activeTenant, effectiveNow]);

  const updateActiveTenant = (updater: (prev: TenantData) => TenantData) => {
    if (isDemoPreview) {
      setDemoTenantState((prev) => updater(prev));
      return;
    }
    setTenants((prev) => {
      const current = prev[storedActiveTenant.orgId];
      if (!current) return prev;
      return {
        ...prev,
        [storedActiveTenant.orgId]: updater(current),
      };
    });
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!hasEnteredOrg && isDemoPreview) {
      setLoginError(
        lang === 'th'
          ? 'โหมดหน้าตัวอย่างไม่สามารถเข้าหลังบ้านได้ กรุณากลับหน้าเข้าสู่ระบบและใส่รหัสองค์กรก่อน'
          : 'Backend login is disabled in Demo Preview. Please return to Login and sign in with your Organization Code first.'
      );
      return;
    }
    const foundStaff = activeTenant.staff.find((s) => s.pin === loginPin.trim());
    if (!foundStaff) {
      setLoginError(t.invalidPinError);
      return;
    }
    setCurrentUser(foundStaff);
    setLoginPin('');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSimulatedTimeStr(null);
  };

  const handleRecordUnlockLog = (
    task: TimeTask,
    actorName: string,
    method: UnlockMethod,
    note: string
  ) => {
    const dateKey = getLocalDateKey(effectiveNow);
    const timeStr = effectiveNow.toTimeString().slice(0, 5);
    const log: AuditLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      dateKey,
      timestamp: timeStr,
      type: method === 'emergency_8888' ? 'emergency_unlock' : 'attendance',
      taskId: task.id,
      taskTitle: task.titleTh,
      actorName,
      unlockMethod: method,
      note,
    };
    updateActiveTenant((prev) => ({
      ...prev,
      logs: [log, ...prev.logs],
    }));
  };

  const handleMarkAttendance = (
    taskId: string,
    member: Member,
    status: AttendanceStatus,
    actorName: string,
    unlockMethod: UnlockMethod,
    photoDataUrl?: string
  ) => {
    const dateKey = getLocalDateKey(effectiveNow);
    const timeStr = effectiveNow.toTimeString().slice(0, 5);
    const task = activeTenant.tasks.find((tk) => tk.id === taskId);
    const logEntry: AuditLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      dateKey,
      timestamp: timeStr,
      type: 'attendance',
      taskId,
      taskTitle: task?.titleTh ?? '',
      memberId: member.id,
      memberName: member.name,
      status,
      actorName,
      unlockMethod,
      note: `เช็คชื่อ "${task?.titleTh ?? ''}" สถานะ: ${status}`,
    };

    updateActiveTenant((prev) => {
      const filteredCheckins = prev.todayCheckins.filter(
        (c) => !(c.taskId === taskId && c.memberId === member.id)
      );
      const newCheckin = {
        taskId,
        memberId: member.id,
        status,
        timestamp: timeStr,
        recordedBy: actorName,
        unlockMethod,
        photoDataUrl,
      };
      return {
        ...prev,
        todayCheckins: [newCheckin, ...filteredCheckins],
        logs: [logEntry, ...prev.logs],
      };
    });

    if (
      !isDemoPreview &&
      activeTenant.storageMode === 'google_sheets_gas' &&
      isValidGasWebAppUrl(activeTenant.gasWebAppUrl)
    ) {
      void sendCheckinToGasWebApp(
        activeTenant.gasWebAppUrl,
        activeTenant.orgId,
        logEntry,
        photoDataUrl
      );
    }
  };

  const handleCastVote = (optionId: string) => {
    updateActiveTenant((prev) => {
      if (prev.poll.votedSessionKeys.includes(sessionVoteKey)) return prev;
      return {
        ...prev,
        poll: {
          ...prev.poll,
          votedSessionKeys: [...prev.poll.votedSessionKeys, sessionVoteKey],
          options: prev.poll.options.map((opt) =>
            opt.id === optionId ? { ...opt, votes: opt.votes + 1 } : opt
          ),
        },
      };
    });
  };

  const handleAddPollOption = (text: string) => {
    updateActiveTenant((prev) => ({
      ...prev,
      poll: {
        ...prev.poll,
        options: [
          ...prev.poll.options,
          { id: `opt-${Date.now()}`, text, votes: 0 },
        ],
      },
    }));
  };

  const handleDrawGiftPairs = () => {
    updateActiveTenant((prev) => {
      const pool = [...prev.giftExchange.participants];
      if (pool.length < 2) return prev;
      for (let i = pool.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      const pairs = pool.map((giver, idx) => ({
        giver,
        receiver: pool[(idx + 1) % pool.length],
      }));
      return {
        ...prev,
        giftExchange: {
          ...prev.giftExchange,
          pairs,
        },
      };
    });
  };

  const handleSubmitLostFound = (item: Omit<LostFoundItem, 'id' | 'createdAt' | 'status'>) => {
    const dateKey = getLocalDateKey(effectiveNow);
    const timeStr = effectiveNow.toTimeString().slice(0, 5);
    const newItem: LostFoundItem = {
      ...item,
      id: `lf-${Date.now()}`,
      createdAt: `${dateKey} ${timeStr}`,
      status: 'open',
    };
    updateActiveTenant((prev) => ({
      ...prev,
      lostFound: [newItem, ...prev.lostFound],
    }));
  };

  const handleResolveLostFound = (id: string) => {
    if (!currentUser) return;
    const dateKey = getLocalDateKey(effectiveNow);
    const timeStr = effectiveNow.toTimeString().slice(0, 5);
    updateActiveTenant((prev) => {
      const target = prev.lostFound.find((x) => x.id === id);
      const log: AuditLogEntry = {
        id: `log-lf-${Date.now()}`,
        dateKey,
        timestamp: timeStr,
        type: 'lost_found_close',
        actorName: currentUser.name,
        note: `ปิดเคสของหาย/เก็บได้: ${target?.itemName ?? id}`,
      };
      return {
        ...prev,
        lostFound: prev.lostFound.map((item) =>
          item.id === id ? { ...item, status: 'resolved', resolvedBy: currentUser.name } : item
        ),
        logs: [log, ...prev.logs],
      };
    });
  };

  const handleSubmitTaskDraft = (draft: Omit<TimeTask, 'id' | 'approvalStatus' | 'enabled'>) => {
    const newTask: TimeTask = {
      ...draft,
      id: `task-${Date.now()}`,
      enabled: true,
      approvalStatus: 'pending',
    };
    updateActiveTenant((prev) => ({
      ...prev,
      tasks: [...prev.tasks, newTask],
    }));
  };

  const handleApproveTask = (taskId: string, approve: boolean) => {
    if (!currentUser) return;
    const dateKey = getLocalDateKey(effectiveNow);
    const timeStr = effectiveNow.toTimeString().slice(0, 5);
    updateActiveTenant((prev) => {
      const target = prev.tasks.find((tk) => tk.id === taskId);
      const log: AuditLogEntry = {
        id: `log-app-${Date.now()}`,
        dateKey,
        timestamp: timeStr,
        type: 'task_approval',
        taskId,
        taskTitle: target?.titleTh,
        actorName: currentUser.name,
        note: approve
          ? `อนุมัติคำสั่ง "${target?.titleTh ?? ''}"`
          : `ไม่อนุมัติคำสั่ง "${target?.titleTh ?? ''}"`,
      };
      return {
        ...prev,
        tasks: prev.tasks.map((tk) =>
          tk.id === taskId
            ? { ...tk, approvalStatus: approve ? 'approved' : 'rejected', enabled: approve }
            : tk
        ),
        logs: [log, ...prev.logs],
      };
    });
  };

  const handleCreateTask = (task: Omit<TimeTask, 'id' | 'approvalStatus'>) => {
    const newTask: TimeTask = {
      ...task,
      id: `task-${Date.now()}`,
      approvalStatus: 'approved',
    };
    updateActiveTenant((prev) => ({
      ...prev,
      tasks: [newTask, ...prev.tasks],
    }));
  };

  const handleToggleTaskEnabled = (taskId: string) => {
    updateActiveTenant((prev) => ({
      ...prev,
      tasks: prev.tasks.map((tk) => (tk.id === taskId ? { ...tk, enabled: !tk.enabled } : tk)),
    }));
  };

  const handleDeleteTask = (taskId: string) => {
    updateActiveTenant((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((tk) => tk.id !== taskId),
    }));
  };

  const handleAddMember = (name: string, group: string, code: string, notes?: string) => {
    const newMember: Member = {
      id: `m-${Date.now()}`,
      name,
      group,
      code,
      offensePoints: 0,
      customUnitScores: {},
      notes,
      active: true,
    };
    updateActiveTenant((prev) => ({
      ...prev,
      members: [...prev.members, newMember],
    }));
  };

  const handleRegisterMemberInOrg = (
    orgId: string,
    name: string,
    group: string,
    code: string,
    notes?: string
  ) => {
    const newMember: Member = {
      id: `m-${Date.now()}`,
      name,
      group,
      code,
      offensePoints: 0,
      customUnitScores: {},
      notes,
      active: true,
    };
    setTenants((prev) => {
      const target = prev[orgId];
      if (!target) return prev;
      return {
        ...prev,
        [orgId]: {
          ...target,
          members: [...target.members, newMember],
        },
      };
    });
  };

  const handleAdjustOffense = (memberId: string, delta: number, mode: 'reduce' | 'clear') => {
    if (!currentUser) return;
    const dateKey = getLocalDateKey(effectiveNow);
    const timeStr = effectiveNow.toTimeString().slice(0, 5);
    updateActiveTenant((prev) => {
      const target = prev.members.find((m) => m.id === memberId);
      const nextPoints =
        mode === 'clear' ? 0 : Math.max(0, (target?.offensePoints ?? 0) + delta);
      const log: AuditLogEntry = {
        id: `log-off-${Date.now()}`,
        dateKey,
        timestamp: timeStr,
        type: 'offense_adjust',
        memberId,
        memberName: target?.name,
        actorName: currentUser.name,
        unlockMethod: 'admin_adjust',
        note:
          mode === 'clear'
            ? `ล้างความผิดทั้งหมดให้ ${target?.name ?? ''}`
            : `ปรับแต้มความผิด ${target?.name ?? ''} (${delta > 0 ? `+${delta}` : delta} → ${nextPoints})`,
      };
      return {
        ...prev,
        members: prev.members.map((m) =>
          m.id === memberId ? { ...m, offensePoints: nextPoints } : m
        ),
        logs: [log, ...prev.logs],
      };
    });
  };

  const handleAdjustCustomUnit = (memberId: string, unitId: string, delta: number) => {
    updateActiveTenant((prev) => ({
      ...prev,
      members: prev.members.map((m) => {
        if (m.id !== memberId) return m;
        const curr = m.customUnitScores[unitId] ?? 0;
        return {
          ...m,
          customUnitScores: {
            ...m.customUnitScores,
            [unitId]: Math.max(0, curr + delta),
          },
        };
      }),
    }));
  };

  const handleCreateCustomUnit = (nameTh: string, nameEn: string, unitLabel: string) => {
    updateActiveTenant((prev) => ({
      ...prev,
      customUnits: [
        ...prev.customUnits,
        { id: `unit-${Date.now()}`, nameTh, nameEn, unitLabel, active: true },
      ],
    }));
  };

  const handleToggleCustomUnit = (unitId: string) => {
    updateActiveTenant((prev) => ({
      ...prev,
      customUnits: prev.customUnits.map((u) =>
        u.id === unitId ? { ...u, active: !u.active } : u
      ),
    }));
  };

  const handleDeleteCustomUnit = (unitId: string) => {
    updateActiveTenant((prev) => ({
      ...prev,
      customUnits: prev.customUnits.filter((u) => u.id !== unitId),
    }));
  };

  const handleCreateCoAdminInvite = (invitedName: string) => {
    const code = `CO-EXEC-${Math.floor(1000 + Math.random() * 9000)}`;
    const dateKey = getLocalDateKey(effectiveNow);
    updateActiveTenant((prev) => ({
      ...prev,
      coAdminInvites: [
        { code, invitedName, invitedAt: dateKey, accepted: false },
        ...prev.coAdminInvites,
      ],
    }));
  };

  const handleAcceptCoAdminInvite = (code: string, name: string, pin: string) => {
    const newCoExec: StaffUser = {
      id: `st-co-${Date.now()}`,
      name,
      role: 'co_executive',
      pin,
      orgId: activeTenant.orgId,
      title: 'ผู้บริหารร่วม',
    };
    updateActiveTenant((prev) => ({
      ...prev,
      coAdminInvites: prev.coAdminInvites.map((inv) =>
        inv.code === code ? { ...inv, accepted: true } : inv
      ),
      staff: [...prev.staff, newCoExec],
    }));
    setCurrentUser(newCoExec);
  };

  const handleCreateTenant = (
    orgId: string,
    orgNameTh: string,
    orgNameEn: string,
    execPin: string,
    extra?: Partial<RegisterOrgPayload> & { autoEnter?: boolean }
  ) => {
    const autoEnter = extra?.autoEnter ?? true;
    if (tenants[orgId]) {
      setActiveOrgId(orgId);
      if (autoEnter) {
        setHasEnteredOrg(true);
        setIsDemoPreview(false);
        setShowOrgGate(false);
      }
      return;
    }
    const accountMode = extra?.orgAccountMode ?? 'foundation_3tier';
    const created = createTenantSeedForMode({
      orgId,
      orgNameTh,
      orgNameEn,
      execPin,
      orgAccountMode: accountMode,
      orgCategory: extra?.orgCategory,
      ownerEmail: extra?.ownerEmail,
      ownerNickname: extra?.ownerNickname,
      ownerTitle: extra?.ownerTitle,
      now: effectiveNow,
    });
    const baseHub = getDefaultFileDropHub(orgNameTh, orgNameEn);
    created.fileDropHub = {
      ...baseHub,
      modeId: inferDropModeFromCategory(extra?.orgCategory),
      customLocationTitle: orgNameTh,
    };
    setTenants((prev) => ({ ...prev, [orgId]: created }));
    setActiveOrgId(orgId);
    if (autoEnter) {
      setHasEnteredOrg(true);
      setIsDemoPreview(false);
      setShowOrgGate(false);
    }
  };

  const handleRenameOrgId = (oldOrgId: string, newOrgId: string): boolean => {
    const cleanNew = newOrgId.trim().toUpperCase();
    if (!cleanNew || cleanNew === oldOrgId || tenants[cleanNew] || !tenants[oldOrgId]) {
      return false;
    }
    setTenants((prev) => {
      const target = prev[oldOrgId];
      if (!target || prev[cleanNew]) return prev;
      const next = { ...prev };
      delete next[oldOrgId];
      next[cleanNew] = {
        ...target,
        orgId: cleanNew,
        staff: target.staff.map((s) => ({ ...s, orgId: cleanNew })),
      };
      return next;
    });
    setActiveOrgId(cleanNew);
    setCurrentUser((prev) => (prev ? { ...prev, orgId: cleanNew } : null));
    return true;
  };

  const handleUpdateBoardModes = (boardModes: BoardModeConfig[]) => {
    updateActiveTenant((prev) => ({
      ...prev,
      boardModes,
    }));
  };

  const handleConfirmDropMode = ({
    modeId,
    customLocationTitle,
    customCategoryLabel,
  }: {
    modeId: FileDropModeId;
    customLocationTitle: string;
    customCategoryLabel?: string;
  }) => {
    const dateKey = getLocalDateKey(effectiveNow);
    const timeStr = effectiveNow.toTimeString().slice(0, 5);
    updateActiveTenant((prev) => {
      const existing = prev.fileDropHub ?? getDefaultFileDropHub(prev.orgNameTh, prev.orgNameEn);
      return {
        ...prev,
        fileDropHub: {
          ...existing,
          modeId,
          customLocationTitle,
          customCategoryLabel,
          updatedAt: `${dateKey} ${timeStr}`,
        },
      };
    });
    setShowDropModeModal(false);
    setActiveHomeSection('file_drop');
  };

  const handleSaveOpenPointSettings = ({
    topic,
    sharedPasscode,
    allowedTypes,
  }: {
    topic: string;
    sharedPasscode: string;
    allowedTypes: FileDropAllowedTypes;
  }) => {
    const dateKey = getLocalDateKey(effectiveNow);
    const timeStr = effectiveNow.toTimeString().slice(0, 5);
    updateActiveTenant((prev) => {
      const existing = prev.fileDropHub ?? getDefaultFileDropHub(prev.orgNameTh, prev.orgNameEn);
      return {
        ...prev,
        fileDropHub: {
          ...existing,
          topic,
          sharedPasscode,
          allowedTypes,
          updatedAt: `${dateKey} ${timeStr}`,
        },
      };
    });
  };

  const handleSubmitFileDrop = (
    submission: Omit<FileDropSubmission, 'id' | 'createdAt' | 'syncedToCentral'>
  ) => {
    const dateKey = getLocalDateKey(effectiveNow);
    const timeStr = effectiveNow.toTimeString().slice(0, 5);
    const createdAt = `${dateKey} ${timeStr}`;
    const dropId = `drop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const gasReady =
      !isDemoPreview &&
      activeTenant.storageMode === 'google_sheets_gas' &&
      isValidGasWebAppUrl(activeTenant.gasWebAppUrl);

    const newSub: FileDropSubmission = {
      ...submission,
      id: dropId,
      createdAt,
      syncedToCentral: false,
    };

    updateActiveTenant((prev) => {
      const existing = prev.fileDropHub ?? getDefaultFileDropHub(prev.orgNameTh, prev.orgNameEn);
      const fileNamesSummary =
        submission.files.length > 0
          ? ` (${submission.files.map((f) => f.name).join(', ')})`
          : '';
      const log: AuditLogEntry = {
        id: `log-drop-${Date.now()}`,
        dateKey,
        timestamp: timeStr,
        type: 'file_drop',
        actorName: submission.senderName,
        note: `ฝากไฟล์/ข้อความเข้าจุดรวม "${submission.locationTitle}": ${submission.topic}${fileNamesSummary}`,
      };
      return {
        ...prev,
        fileDropHub: {
          ...existing,
          submissions: [newSub, ...existing.submissions],
        },
        logs: [log, ...prev.logs],
      };
    });

    if (gasReady) {
      void sendDropToGasWebApp(activeTenant.gasWebAppUrl, activeTenant.orgId, newSub).then(
        (res) => {
          if (!res.synced) return;
          updateActiveTenant((prev) => {
            if (!prev.fileDropHub) return prev;
            return {
              ...prev,
              fileDropHub: {
                ...prev.fileDropHub,
                submissions: prev.fileDropHub.submissions.map((item) => {
                  if (item.id !== dropId) return item;
                  return {
                    ...item,
                    syncedToCentral: true,
                    files: item.files.map((f) => ({
                      ...f,
                      driveUrl: res.driveUrls?.[f.id] ?? res.driveUrls?.[f.name] ?? f.driveUrl,
                    })),
                  };
                }),
              },
            };
          });
        }
      );
    }
  };

  const handleClearFileDropSubmissions = () => {
    updateActiveTenant((prev) => clearFileDropSubmissions(prev));
  };

  const handleSubmitProfileDrop = (
    submission: Omit<ProfileCardSubmission, 'id' | 'createdAt' | 'syncedToCentral'>
  ) => {
    const dateKey = getLocalDateKey(effectiveNow);
    const timeStr = effectiveNow.toTimeString().slice(0, 5);
    const createdAt = `${dateKey} ${timeStr}`;
    const profileId = `prof-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const gasReady =
      !isDemoPreview &&
      activeTenant.storageMode === 'google_sheets_gas' &&
      isValidGasWebAppUrl(activeTenant.gasWebAppUrl);

    const newCard: ProfileCardSubmission = {
      ...submission,
      id: profileId,
      createdAt,
      syncedToCentral: false,
    };

    updateActiveTenant((prev) => {
      const existing =
        prev.profileHub ?? getDefaultProfileDropHub(prev.orgNameTh, prev.orgNameEn);
      const kindLabel = submission.kind === 'job_apply' ? 'สมัครงาน/ฝากประวัติ' : 'อัปเดตข้อมูล';
      const log: AuditLogEntry = {
        id: `log-prof-${Date.now()}`,
        dateKey,
        timestamp: timeStr,
        type: 'profile_drop',
        actorName: submission.fullName,
        note: `ส่งการ์ด${kindLabel}ถึงผู้บริหาร: ${submission.fullName}${submission.targetRoleOrGroup ? ` (${submission.targetRoleOrGroup})` : ''}`,
      };
      return {
        ...prev,
        profileHub: {
          ...existing,
          submissions: [newCard, ...existing.submissions],
        },
        logs: [log, ...prev.logs],
      };
    });

    if (gasReady) {
      void sendProfileToGasWebApp(activeTenant.gasWebAppUrl, activeTenant.orgId, newCard).then(
        (res) => {
          if (!res.synced) return;
          updateActiveTenant((prev) => {
            if (!prev.profileHub) return prev;
            return {
              ...prev,
              profileHub: {
                ...prev.profileHub,
                submissions: prev.profileHub.submissions.map((item) =>
                  item.id === profileId
                    ? {
                        ...item,
                        syncedToCentral: true,
                        photoDriveUrl: res.driveUrl ?? item.photoDriveUrl,
                      }
                    : item
                ),
              },
            };
          });
        }
      );
    }
  };

  const handleUpdateProfileSettings = ({
    requirePasscode,
    passcode,
    fields,
  }: {
    requirePasscode: boolean;
    passcode: string;
    fields: ProfileCardFieldConfig;
  }) => {
    const dateKey = getLocalDateKey(effectiveNow);
    const timeStr = effectiveNow.toTimeString().slice(0, 5);
    updateActiveTenant((prev) => {
      const existing =
        prev.profileHub ?? getDefaultProfileDropHub(prev.orgNameTh, prev.orgNameEn);
      return {
        ...prev,
        profileHub: {
          ...existing,
          requirePasscode,
          passcode,
          fields,
          updatedAt: `${dateKey} ${timeStr}`,
        },
      };
    });
  };

  const handleClearProfileSubmissions = () => {
    updateActiveTenant((prev) => clearProfileDropSubmissions(prev));
  };

  const handleClearTemporaryRecords = () => {
    updateActiveTenant((prev) => ({
      ...clearProfileDropSubmissions(clearFileDropSubmissions(prev)),
      todayCheckins: [],
      logs: [],
    }));
  };

  const handleTriggerDailyReset = () => {
    const dateKey = getLocalDateKey(effectiveNow);
    const timeStr = effectiveNow.toTimeString().slice(0, 5);
    updateActiveTenant((prev) =>
      purgeExpiredTenantRecords(
        {
          ...prev,
          lastResetDateKey: dateKey,
          todayCheckins: [],
          logs: [
            {
              id: `log-reset-${Date.now()}`,
              dateKey,
              timestamp: timeStr,
              type: 'daily_reset',
              actorName: currentUser?.name ?? 'System',
              note: 'รีเซตสถานะเช็คชื่อรายวันเรียบร้อย (คงรายการล่าสุดไว้ 14 วัน และตัดเฉพาะรายการที่เกิน 14 วัน)',
            },
            ...prev.logs,
          ],
        },
        effectiveNow
      ).tenant
    );
  };

  const handleUpdateStorageMode = (mode: StorageMode, gasUrl: string) => {
    updateActiveTenant((prev) => ({
      ...prev,
      storageMode: mode,
      gasWebAppUrl: gasUrl,
    }));
  };

  const handleImportMembersCsv = (rows: Array<{ name: string; group: string; code: string }>) => {
    updateActiveTenant((prev) => {
      const existingNames = new Set(prev.members.map((m) => m.name.trim().toLowerCase()));
      const runningMembers = [...prev.members];
      const newOnes: Member[] = [];
      for (let i = 0; i < rows.length; i += 1) {
        const r = rows[i];
        const cleanName = r.name.trim();
        if (!cleanName || existingNames.has(cleanName.toLowerCase())) continue;
        existingNames.add(cleanName.toLowerCase());
        const candidateCode = r.code.trim().toUpperCase();
        const finalCode =
          candidateCode && !isMemberCodeDuplicate(candidateCode, runningMembers)
            ? candidateCode
            : generateUniqueMemberCode(runningMembers);
        const memberObj: Member = {
          id: `m-imp-${Date.now()}-${i}`,
          name: cleanName,
          group: r.group.trim() || 'ทีมงาน / พนักงาน',
          code: finalCode,
          offensePoints: 0,
          customUnitScores: {},
          active: true,
        };
        runningMembers.push(memberObj);
        newOnes.push(memberObj);
      }
      return {
        ...prev,
        members: runningMembers,
      };
    });
  };

  const homeTasks = activeTenant.tasks.filter(
    (tk) => tk.approvalStatus === 'approved' && tk.enabled
  );
  const activeTasksCount = homeTasks.filter((tk) => isTaskActiveAt(tk, effectiveNow)).length;
  const firstQrOrActiveTask =
    homeTasks.find((tk) => isTaskActiveAt(tk, effectiveNow) && (tk.authMethod === 'qr' || tk.authMethod === 'daily_qr')) ||
    homeTasks.find((tk) => isTaskActiveAt(tk, effectiveNow)) ||
    null;

  const spacedClock = formatSpacedClock(effectiveNow);
  const fullDateLabel = formatFullLocalizedDate(effectiveNow, lang);

  return (
    <div className="min-h-screen tw-canvas flex flex-col">
      {storageWarning && (
        <div
          role="alert"
          className="border-b tw-border bg-[var(--bg-subtle)] px-4 py-2 text-xs flex items-center justify-between gap-3"
        >
          <span className="font-medium">{storageWarning}</span>
          <button
            type="button"
            onClick={() => setStorageWarning('')}
            className="px-2 py-0.5 tw-btn-ghost shrink-0"
          >
            {lang === 'th' ? 'รับทราบ' : 'Dismiss'}
          </button>
        </div>
      )}
      {/* Logged-in Header Bar OR Demo Preview Header Bar */}
      {(currentUser || isDemoPreview) && (
        <header className="border-b tw-border bg-[var(--bg-surface)]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-bold tracking-tight whitespace-nowrap">
              {currentUser ? (
                <>
                  {currentUser.role !== 'mentor' ? `${activeTenant.orgId} · ` : ''}
                  {lang === 'th' ? activeTenant.orgNameTh : activeTenant.orgNameEn}
                </>
              ) : lang === 'th' ? (
                `หน้าตัวอย่างการใช้งาน (Demo) · ${activeTenant.orgNameTh}`
              ) : (
                `Usage Example (Demo) · ${activeTenant.orgNameEn}`
              )}
            </span>

            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-mono-tabular text-[var(--text-muted)] whitespace-nowrap">
                {spacedClock}
              </span>

              <ThemeShapeLangBar
                theme={theme}
                onThemeChange={setTheme}
                shape={shape}
                onShapeChange={setShape}
                lang={lang}
                onLangChange={setLang}
                variant="inline"
              />

              {currentUser ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-4 py-1.5 text-xs font-semibold tw-btn-primary whitespace-nowrap shrink-0"
                >
                  {t.logout}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsDemoPreview(false);
                    setShowOrgGate(true);
                  }}
                  className="px-4 py-1.5 text-xs font-semibold tw-btn-primary whitespace-nowrap shrink-0"
                >
                  {lang === 'th' ? 'กลับหน้าเข้าสู่ระบบ' : 'Back to Login'}
                </button>
              )}
            </div>
          </div>
        </header>
      )}

      {/* Main Centered Layout */}
      <main className="flex-1 w-full">
        {currentUser ? (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 pb-20">
            {currentUser.role === 'mentor' ? (
              <StaffBackend
                tenant={activeTenant}
                currentUser={currentUser}
                effectiveNow={effectiveNow}
                lang={lang}
                onOpenTask={(task) => setActiveModalTask(task)}
                onSubmitTaskDraft={handleSubmitTaskDraft}
                onResolveLostFound={handleResolveLostFound}
              />
            ) : (
              <ExecutiveBackend
                tenant={activeTenant}
                allTenants={tenants}
                currentUser={currentUser}
                effectiveNow={effectiveNow}
                simulatedTimeStr={simulatedTimeStr}
                lang={lang}
                onSetSimulatedTime={setSimulatedTimeStr}
                onOpenTask={(task) => setActiveModalTask(task)}
                onApproveTask={handleApproveTask}
                onCreateTask={handleCreateTask}
                onToggleTaskEnabled={handleToggleTaskEnabled}
                onDeleteTask={handleDeleteTask}
                onAddMember={handleAddMember}
                onAdjustOffense={handleAdjustOffense}
                onAdjustCustomUnit={handleAdjustCustomUnit}
                onCreateCustomUnit={handleCreateCustomUnit}
                onToggleCustomUnit={handleToggleCustomUnit}
                onDeleteCustomUnit={handleDeleteCustomUnit}
                onResolveLostFound={handleResolveLostFound}
                onCreateCoAdminInvite={handleCreateCoAdminInvite}
                onAcceptCoAdminInvite={handleAcceptCoAdminInvite}
                onSwitchTenant={(orgId) => setActiveOrgId(orgId)}
                onCreateTenant={handleCreateTenant}
                onOpenOrgGate={() => {
                  setCurrentUser(null);
                  setHasEnteredOrg(false);
                  setIsDemoPreview(false);
                  setShowOrgGate(true);
                }}
                onTriggerDailyReset={handleTriggerDailyReset}
                onClearTemporaryRecords={handleClearTemporaryRecords}
                onUpdateStorageMode={handleUpdateStorageMode}
                onImportMembersCsv={handleImportMembersCsv}
                onUpdateBoardModes={handleUpdateBoardModes}
                onRenameOrgId={handleRenameOrgId}
              />
            )}
          </div>
        ) : showOrgGate ? (
          /* SCREENSHOT 2: Login & Applicant Entry Gate (requires login first before viewing organization/sample page) */
          <OrgGateView
            tenants={tenants}
            liveTimeStr={spacedClock}
            showMascot={showMascot}
            lang={lang}
            qaOpen={qaOpen}
            onOpenQa={() => setQaOpen((prev) => !prev)}
            onBackHome={hasEnteredOrg ? () => setShowOrgGate(false) : undefined}
            onEnterOrg={(orgId, options) => {
              const target = tenants[orgId];
              setActiveOrgId(orgId);
              setHasEnteredOrg(true);
              setIsDemoPreview(false);
              setShowOrgGate(false);
              setTasksExpanded(false);
              setActiveHomeSection(target?.orgAccountMode === 'file_drop' ? 'file_drop' : 'dashboard');
              setDropModeModalInitialSelected(target?.orgAccountMode === 'file_drop');
              const shouldOpenDropModal =
                options?.openDropModal ?? !options?.skipDropModal;
              setShowDropModeModal(shouldOpenDropModal);
            }}
            onRegisterMemberInOrg={handleRegisterMemberInOrg}
            onRegisterOrg={(payload) => {
              handleCreateTenant(
                payload.orgId,
                payload.orgNameTh,
                payload.orgNameEn,
                payload.execPin,
                { ...payload, autoEnter: false }
              );
            }}
          />
        ) : activeHomeSection === 'file_drop' ? (
          <FileDropHubView
            tenant={activeTenant}
            hub={activeFileDropHub}
            lang={lang}
            effectiveNow={effectiveNow}
            onBackDashboard={() => setActiveHomeSection('dashboard')}
            onOpenEditModeModal={() => {
              setDropModeModalInitialSelected(true);
              setShowDropModeModal(true);
            }}
            onSaveOpenPointSettings={handleSaveOpenPointSettings}
            onSubmitDrop={handleSubmitFileDrop}
            onClearSubmissions={handleClearFileDropSubmissions}
            onUpdateStorageMode={handleUpdateStorageMode}
          />
        ) : activeHomeSection === 'profile_drop' ? (
          <ProfileDropHubView
            tenant={activeTenant}
            profileHub={activeProfileHub}
            lang={lang}
            effectiveNow={effectiveNow}
            onBackDashboard={() => setActiveHomeSection('dashboard')}
            onSubmitProfile={handleSubmitProfileDrop}
            onUpdateProfileSettings={handleUpdateProfileSettings}
            onClearProfileSubmissions={handleClearProfileSubmissions}
          />
        ) : (
          /* SCREENSHOT 1: Centered Single-Card Dashboard + Middle Cloud & File Drop Hub + Member Community Board Below */
          <div className="max-w-[1040px] mx-auto px-4 sm:px-6 pt-8 pb-24 space-y-6">
            <div>
              {/* Main Hero Card matching Screenshot 1 */}
              <section className="tw-surface p-6 sm:p-8 shadow-xs space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 items-start">
                  {/* Left Column (7 cols): Org Title (TH/EN separate lines) + Staff PIN Box + QR Button */}
                  <div className="md:col-span-7 space-y-4">
                    <div className="space-y-2">
                      <div className="space-y-0.5">
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight leading-snug">
                          {lang === 'th' ? activeTenant.orgNameTh : activeTenant.orgNameEn}
                        </h1>
                        <div className="text-sm sm:text-base font-medium text-[var(--text-secondary)]">
                          {lang === 'th' ? activeTenant.orgNameEn : activeTenant.orgNameTh}
                        </div>
                      </div>

                      <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                        {activeTenant.orgAccountMode === 'org_2tier'
                          ? lang === 'th'
                            ? 'เฉพาะหัวหน้าและพนักงานเท่านั้น · ใช้งานบอร์ดและเช็คชื่อหน้าแรกได้ทันที'
                            : 'Reserved for heads and staff · Use the community board and check-in immediately'
                          : lang === 'th'
                          ? 'เฉพาะผู้บริหารและพนักงาน/พี่เลี้ยงเท่านั้น · สมาชิกใช้งานบอร์ดและเช็คชื่อหน้าแรกได้ทันทีโดยไม่ต้องล็อคอิน'
                          : 'Reserved for executives and staff · Members can use the community board immediately without logging in'}
                      </p>
                    </div>

                    <form onSubmit={handleLoginSubmit} className="space-y-3">
                      <div className="relative">
                        <KeyRound className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          id="staff-pin-input"
                          type={showPinText ? 'text' : 'password'}
                          inputMode="numeric"
                          value={loginPin}
                          onFocus={() => setIsPinFocused(true)}
                          onBlur={() => setIsPinFocused(false)}
                          onChange={(e) => setLoginPin(e.target.value)}
                          placeholder={
                            activeTenant.orgAccountMode === 'org_2tier'
                              ? lang === 'th'
                                ? 'รหัส PIN หลังบ้าน (เฉพาะหัวหน้า / พนักงาน)'
                                : 'Backend PIN (Heads / Staff only)'
                              : lang === 'th'
                              ? 'รหัส PIN หลังบ้าน (เฉพาะผู้บริหาร / พนักงาน / พี่เลี้ยง)'
                              : 'Backend PIN (Executives / Staff / Mentors only)'
                          }
                          aria-label={t.pinLabel}
                          className="w-full pl-10 pr-10 py-2.5 text-sm tw-input font-mono-tabular"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPinText((p) => !p)}
                          aria-label={lang === 'th' ? 'แสดง/ซ่อนรหัส PIN' : 'Toggle PIN visibility'}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        >
                          {showPinText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>

                      {loginError && (
                        <div className="text-xs font-medium px-3 py-2 border tw-border tw-subtle">
                          {loginError}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="submit"
                          className="py-2.5 px-4 text-sm font-semibold tw-btn-soft"
                        >
                          {t.loginBtn}
                        </button>

                        <button
                          type="button"
                          disabled={!firstQrOrActiveTask}
                          onClick={() => {
                            if (firstQrOrActiveTask) setActiveModalTask(firstQrOrActiveTask);
                          }}
                          className="py-2.5 px-4 text-sm font-medium tw-btn-ghost inline-flex items-center justify-center gap-2 whitespace-nowrap"
                        >
                          <QrCode className="w-4 h-4 text-[var(--text-secondary)]" />
                          <span>{lang === 'th' ? 'สแกน QR Code' : 'Scan QR Code'}</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setIsDemoPreview(false);
                          setShowOrgGate(true);
                        }}
                        className="w-full py-2 px-3 text-xs font-medium tw-btn-ghost inline-flex items-center justify-center gap-1.5 text-[var(--text-secondary)]"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>
                          {lang === 'th'
                            ? 'โหมดผู้สมัครเข้าใช้งาน (ลงทะเบียนสมาชิกใหม่)'
                            : 'Applicant Mode (New Member Registration)'}
                        </span>
                      </button>
                    </form>
                  </div>

                  {/* Right Column (5 cols): Full Thai Buddhist Date + Large HH : MM : SS Clock + Daily Highlight */}
                  <div className="md:col-span-5 md:border-l md:tw-border md:pl-8 space-y-5">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                        <Calendar className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                        <span>{fullDateLabel}</span>
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {lang === 'th' ? 'เวลาจริงปัจจุบัน (HH:MM:SS)' : 'Live Time (HH:MM:SS)'}
                      </div>
                      <div
                        className="font-mono-tabular text-3xl sm:text-4xl font-bold tracking-wider whitespace-nowrap"
                        data-testid="live-clock-hms"
                      >
                        {spacedClock}
                      </div>
                    </div>

                    <div className="pt-4 border-t tw-border space-y-1">
                      <div className="text-xs text-[var(--text-muted)]">
                        {lang === 'th' ? 'ไฮไลท์ประจำวัน' : 'Daily Highlight'}
                      </div>
                      <div className="text-sm font-semibold">
                        {activeTenant.orgAccountMode === 'org_2tier'
                          ? lang === 'th'
                            ? 'ตารางเช็คชื่อ & งานทีมงานประจำวัน'
                            : 'Daily Team Schedule & Check-in'
                          : activeTenant.orgAccountMode === 'file_drop'
                          ? lang === 'th'
                            ? 'จุดฝากไฟล์รวม & ประวัติส่งเอกสาร'
                            : 'Shared File Drop Hub & History'
                          : lang === 'th'
                          ? 'เวรประจำวัน: ทีมพี่โต & ทีมน้องเล็ก'
                          : 'Daily Duty: Senior & Junior Teams'}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {activeTenant.orgAccountMode === 'org_2tier'
                          ? lang === 'th'
                            ? 'ไม่มีหัวหน้าอยู่จุดตรวจ? กดคำสั่งที่ถึงเวลาแล้วกรอกรหัสฉุกเฉิน 8888 ได้ทันที'
                            : 'No supervisor present? Click an active task and enter emergency code 8888'
                          : lang === 'th'
                          ? 'ไม่มีพี่เลี้ยง? กดคำสั่งที่ถึงเวลาแล้วกรอกรหัสฉุกเฉิน 8888 ได้ทันที'
                          : 'No mentor present? Click an active task and enter emergency code 8888'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Single Consolidated Task Command Button (flashes when activeTasksCount > 0) */}
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setTasksExpanded((prev) => !prev)}
                    aria-expanded={tasksExpanded}
                    data-active-tasks={activeTasksCount}
                    className={`w-full text-left tw-banner px-4 py-3.5 flex flex-wrap items-center justify-between gap-3 transition-opacity hover:opacity-95 cursor-pointer ${
                      activeTasksCount > 0 ? 'tw-task-flash' : 'opacity-75'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 tw-btn-primary flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">
                          {lang === 'th'
                            ? `คำสั่งเช็คชื่อตามเวลา (รวม ${homeTasks.length} คำสั่ง)`
                            : `Time-Window Tasks (${homeTasks.length} Scheduled)`}
                        </div>
                        <div className="text-xs opacity-80">
                          {activeTasksCount > 0
                            ? t.tasksSectionSubtitle
                            : lang === 'th'
                            ? 'ยังไม่ถึงช่วงเวลาคำสั่ง · กดเพื่อดูตารางเวลาทั้งหมด'
                            : 'No active window right now · Click to view full schedule'}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`px-3.5 py-1.5 text-xs font-semibold tw-btn-primary inline-flex items-center gap-2 whitespace-nowrap shrink-0 ${
                        activeTasksCount > 0 ? 'animate-pulse' : 'opacity-70'
                      }`}
                    >
                      {activeTasksCount > 0 && (
                        <span
                          className="w-2 h-2 rounded-full bg-current inline-block"
                          aria-hidden="true"
                        />
                      )}
                      <span>
                        {activeTasksCount > 0
                          ? lang === 'th'
                            ? `ถึงเวลา ${activeTasksCount} คำสั่ง`
                            : `${activeTasksCount} Active Now`
                          : lang === 'th'
                          ? 'ล็อค / นอกเวลา'
                          : 'Locked'}
                      </span>
                      {tasksExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </span>
                  </button>

                  {/* Expanded Time-Window Task Rows (1 row = 1 task) */}
                  {tasksExpanded && (
                    <div className="space-y-2" aria-label={t.tasksSectionTitle}>
                      {homeTasks.map((task) => {
                        const active = isTaskActiveAt(task, effectiveNow);
                        const doneCount = activeTenant.todayCheckins.filter(
                          (c) => c.taskId === task.id
                        ).length;

                        if (active) {
                          return (
                            <button
                              key={task.id}
                              type="button"
                              onClick={() => setActiveModalTask(task)}
                              className="w-full text-left px-4 py-3 tw-active-task flex flex-wrap items-center justify-between gap-3 transition-transform active:scale-[0.995] cursor-pointer"
                            >
                              <div>
                                <div className="flex items-center gap-2 text-xs font-mono-tabular opacity-90">
                                  <span>{task.startTime}–{task.endTime}</span>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-semibold">{t.unlockedActive}</span>
                                  <span aria-hidden="true">·</span>
                                  <span>
                                    {doneCount}/{activeTenant.members.filter((m) => m.active).length}
                                  </span>
                                </div>
                                <div className="text-sm font-semibold mt-0.5">
                                  {lang === 'th' ? task.titleTh : task.titleEn}
                                </div>
                              </div>

                              <span className="px-3.5 py-1.5 text-xs font-semibold bg-[var(--bg-surface)] text-[var(--text-primary)] tw-control-sm whitespace-nowrap shrink-0">
                                {t.openTaskBtn}
                              </span>
                            </button>
                          );
                        }

                        return (
                          <div
                            key={task.id}
                            aria-disabled="true"
                            className="w-full px-4 py-3 border tw-border tw-control tw-subtle opacity-60 flex flex-wrap items-center justify-between gap-3 select-none"
                          >
                            <div>
                              <div className="flex items-center gap-2 text-xs font-mono-tabular text-[var(--text-muted)]">
                                <span>{task.startTime}–{task.endTime}</span>
                                <span aria-hidden="true">·</span>
                                <span>{t.lockedOutWindow}</span>
                              </div>
                              <div className="text-sm font-medium mt-0.5">
                                {lang === 'th' ? task.titleTh : task.titleEn}
                              </div>
                            </div>

                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] whitespace-nowrap">
                              <Lock className="w-3.5 h-3.5" />
                              <span>{t.lockedOutWindow}</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Security Assurance Text below card matching Screenshot 1 */}
                <div className="pt-2 border-t tw-border text-center text-xs text-[var(--text-muted)]">
                  {t.securityAssurance}
                </div>
              </section>
            </div>

            {/* Middle Centered Card: Cloud Mascot perched on top + Shared File Drop Hub only */}
            <div data-testid="middle-hub-container">
              <CloudMascot
                visible={showMascot}
                hasActiveTasks={activeTasksCount > 0}
                lang={lang}
                qaOpen={qaOpen}
                isPrivacyHiding={isPinFocused || loginPin.length > 0}
                onOpenQa={() => setQaOpen((prev) => !prev)}
              />

              <section className="tw-surface px-5 py-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 tw-subtle border tw-border tw-control-sm flex items-center justify-center shrink-0">
                    <FolderUp className="w-4 h-4 text-[var(--text-secondary)]" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">
                      {lang === 'th'
                        ? `จุดฝากไฟล์รวม · ${activeFileDropHub.customLocationTitle}`
                        : `File Drop Hub · ${activeFileDropHub.customLocationTitle}`}
                    </div>
                    <div className="text-xs text-[var(--text-muted)] truncate">
                      {lang === 'th'
                        ? `ไม่ต้องเข้าบ่อย แค่แวะเข้ามาฝากไฟล์หรือข้อความรวมกันในจุดเดียว เก็บรายชิ้น 14 วัน · ${activeFileDropHub.submissions.length} รายการ`
                        : `Drop files or messages in one temporary spot (14-day rolling retention) · ${activeFileDropHub.submissions.length} items`}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setDropModeModalInitialSelected(true);
                      setShowDropModeModal(true);
                    }}
                    className="px-3 py-2 text-xs font-medium tw-btn-ghost inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    <span>{lang === 'th' ? 'เลือกโหมด / ตั้งค่า' : 'Choose Mode / Settings'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveHomeSection('file_drop')}
                    className="px-3.5 py-2 text-xs font-semibold tw-btn-soft inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <FolderUp className="w-3.5 h-3.5" />
                    <span>{lang === 'th' ? 'เปิดจุดฝากไฟล์รวม' : 'Open File Drop Hub'}</span>
                  </button>
                </div>
              </section>
            </div>

            {/* Community Board Card Below Main Card matching Screenshot 1 */}
            <CommunityBoard
              lang={lang}
              boardModes={activeTenant.boardModes}
              announcements={activeTenant.announcements}
              poll={activeTenant.poll}
              duties={activeTenant.duties}
              knowledge={activeTenant.knowledge}
              giftExchange={activeTenant.giftExchange}
              lostFound={activeTenant.lostFound}
              sessionVoteKey={sessionVoteKey}
              onCastVote={handleCastVote}
              onAddPollOption={handleAddPollOption}
              onDrawGiftPairs={handleDrawGiftPairs}
              onSubmitLostFound={handleSubmitLostFound}
              onOpenProfileDrop={() => setActiveHomeSection('profile_drop')}
              profileCount={activeProfileHub.submissions.length}
            />
          </div>
        )}
      </main>

      {/* Post-Login / Registration File Drop Mode Selector Modal */}
      <FileDropModeModal
        open={showDropModeModal && !showOrgGate && !currentUser}
        lang={lang}
        orgNameTh={activeTenant.orgNameTh}
        orgNameEn={activeTenant.orgNameEn}
        existingHub={activeTenant.fileDropHub}
        initialModeSelected={dropModeModalInitialSelected}
        onConfirm={handleConfirmDropMode}
        onSkip={() => setShowDropModeModal(false)}
      />

      {/* Auto-Popup Roster + Hidden-Until-Click Verification Modal */}
      {activeModalTask && (
        <TaskCheckinModal
          task={activeModalTask}
          orgId={activeTenant.orgId}
          emergencyCode={activeTenant.emergencyCode}
          staffList={activeTenant.staff}
          members={activeTenant.members}
          todayCheckins={activeTenant.todayCheckins}
          currentUser={currentUser}
          effectiveNow={effectiveNow}
          lang={lang}
          allowSimulation={isDemoPreview || Boolean(currentUser) || activeTenant.strictFieldAuth === false}
          onClose={() => setActiveModalTask(null)}
          onRecordUnlockLog={(actorName, method, note) =>
            handleRecordUnlockLog(activeModalTask, actorName, method, note)
          }
          onMarkAttendance={handleMarkAttendance}
        />
      )}

      {/* Bottom-Right Floating Dock matching Screenshot 1 (Theme/Pastel/Shape/Lang Picker + Q&A fallback when mascot hidden) */}
      <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2">
        <QaFloatingWidget
          lang={lang}
          open={qaOpen}
          onOpenChange={setQaOpen}
          showTriggerButton={!showMascot || Boolean(currentUser)}
          showMascot={showMascot}
          isDemoPreviewActive={isDemoPreview}
          onOpenDemoPreview={() => {
            const freshDemo = createSeedTenants(effectiveNow).ORG01;
            setDemoTenantState({ ...freshDemo, strictFieldAuth: false });
            setIsDemoPreview(true);
            setShowOrgGate(false);
          }}
        />
        {!currentUser && !isDemoPreview && (
          <ThemeShapeLangBar
            theme={theme}
            onThemeChange={setTheme}
            shape={shape}
            onShapeChange={setShape}
            lang={lang}
            onLangChange={setLang}
            variant="floating"
            onOpenApplicantMode={hasEnteredOrg ? () => setShowOrgGate(true) : undefined}
          />
        )}
      </div>
    </div>
  );
}
