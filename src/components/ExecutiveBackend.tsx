import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Calculator,
  Check,
  Clock,
  Copy,
  Database,
  Download,
  LayoutGrid,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type {
  AuthMethod,
  BoardModeConfig,
  BoardModeIcon,
  LangCode,
  OrgAccountMode,
  StaffUser,
  StorageMode,
  TenantData,
  TimeTask,
} from '../types/system';
import { TRANSLATIONS } from '../i18n/translations';
import { DEFAULT_BOARD_MODES } from '../data/seedData';
import { calculateBudgetSplit, exportLogsAndMembersCsv, parseMembersCsv } from '../utils/budget';
import { generateGoogleAppsScriptCode, generateSingleFileHtmlBundle } from '../utils/gasExport';
import { generateUniqueOrgCode, isValidGasWebAppUrl } from '../utils/orgCode';
import { isTaskActiveAt } from '../utils/timeWindow';
import { testGasWebAppConnection } from '../utils/gasSync';
import { OrgBusinessCard } from './OrgBusinessCard';

type ExecTab = 'tasks' | 'members' | 'board' | 'budget' | 'coexec' | 'database';

interface ExecutiveBackendProps {
  tenant: TenantData;
  allTenants: Record<string, TenantData>;
  currentUser: StaffUser;
  effectiveNow: Date;
  simulatedTimeStr: string | null;
  lang: LangCode;
  onSetSimulatedTime: (hhmm: string | null) => void;
  onOpenTask: (task: TimeTask) => void;
  onApproveTask: (taskId: string, approve: boolean) => void;
  onCreateTask: (task: Omit<TimeTask, 'id' | 'approvalStatus'>) => void;
  onToggleTaskEnabled: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onAddMember: (name: string, group: string, code: string) => void;
  onAdjustOffense: (memberId: string, delta: number, mode: 'reduce' | 'clear') => void;
  onAdjustCustomUnit: (memberId: string, unitId: string, delta: number) => void;
  onCreateCustomUnit: (nameTh: string, nameEn: string, unitLabel: string) => void;
  onToggleCustomUnit: (unitId: string) => void;
  onDeleteCustomUnit: (unitId: string) => void;
  onResolveLostFound: (id: string) => void;
  onCreateCoAdminInvite: (invitedName: string) => void;
  onAcceptCoAdminInvite: (code: string, name: string, pin: string) => void;
  onSwitchTenant: (orgId: string) => void;
  onCreateTenant: (
    orgId: string,
    orgNameTh: string,
    orgNameEn: string,
    execPin: string,
    extra?: { orgAccountMode?: OrgAccountMode }
  ) => void;
  onOpenOrgGate: () => void;
  onTriggerDailyReset: () => void;
  onClearTemporaryRecords?: () => void;
  onUpdateStorageMode: (mode: StorageMode, gasUrl: string) => void;
  onImportMembersCsv: (rows: Array<{ name: string; group: string; code: string }>) => void;
  onUpdateBoardModes: (modes: BoardModeConfig[]) => void;
  onRenameOrgId?: (oldOrgId: string, newOrgId: string) => boolean;
}

export const ExecutiveBackend: React.FC<ExecutiveBackendProps> = ({
  tenant,
  allTenants,
  currentUser,
  effectiveNow,
  simulatedTimeStr,
  lang,
  onSetSimulatedTime,
  onOpenTask,
  onApproveTask,
  onCreateTask,
  onToggleTaskEnabled,
  onDeleteTask,
  onAddMember,
  onAdjustOffense,
  onAdjustCustomUnit,
  onCreateCustomUnit,
  onToggleCustomUnit,
  onDeleteCustomUnit,
  onResolveLostFound,
  onCreateCoAdminInvite,
  onAcceptCoAdminInvite,
  onSwitchTenant,
  onCreateTenant,
  onOpenOrgGate,
  onTriggerDailyReset,
  onClearTemporaryRecords,
  onUpdateStorageMode,
  onImportMembersCsv,
  onUpdateBoardModes,
  onRenameOrgId,
}) => {
  const t = TRANSLATIONS[lang];
  const [activeTab, setActiveTab] = useState<ExecTab>('tasks');

  // New Task Creator State
  const [taskTitleTh, setTaskTitleTh] = useState('');
  const [taskTitleEn, setTaskTitleEn] = useState('');
  const [taskStart, setTaskStart] = useState('06:00');
  const [taskEnd, setTaskEnd] = useState('07:00');
  const [taskAuth, setTaskAuth] = useState<AuthMethod>('pin');
  const [cutoffPresent, setCutoffPresent] = useState('06:45');
  const [cutoffLate, setCutoffLate] = useState('07:00');
  const [showNameLabel, setShowNameLabel] = useState('เช็คชื่อ');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);

  // Add Member with "อื่นๆ" (Other) custom group input
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberCode, setNewMemberCode] = useState('');
  const [groupChoice, setGroupChoice] = useState('ทีมพี่โต');
  const [customGroupOther, setCustomGroupOther] = useState('');

  // Custom Counting Units
  const [unitNameTh, setUnitNameTh] = useState('');
  const [unitNameEn, setUnitNameEn] = useState('');
  const [unitLabel, setUnitLabel] = useState('แต้ม');

  // Budget Splitter
  const [budgetTotal, setBudgetTotal] = useState<string>('1500');
  const [budgetFilter, setBudgetFilter] = useState<'all' | 'ทีมพี่โต' | 'ทีมน้องเล็ก'>('all');
  const [weights, setWeights] = useState<Record<string, number>>({});

  // Co-Executive & Tenant
  const [inviteName, setInviteName] = useState('');
  const [acceptCode, setAcceptCode] = useState('');
  const [acceptName, setAcceptName] = useState('');
  const [acceptPin, setAcceptPin] = useState('9022');
  const [newOrgId, setNewOrgId] = useState(() => generateUniqueOrgCode(allTenants));
  const [newOrgNameTh, setNewOrgNameTh] = useState('');
  const [newOrgPin, setNewOrgPin] = useState('9000');
  const [newOrgAccountMode, setNewOrgAccountMode] = useState<OrgAccountMode>('org_2tier');
  const [newOrgError, setNewOrgError] = useState('');
  const [renameOrgInput, setRenameOrgInput] = useState(tenant.orgId);
  const [renameOrgMsg, setRenameOrgMsg] = useState('');
  const isTwoTierOrg = tenant.orgAccountMode === 'org_2tier';

  // Database & GAS
  const [gasUrlInput, setGasUrlInput] = useState(tenant.gasWebAppUrl);
  const [copyFeedback, setCopyFeedback] = useState('');
  const [isTestingGas, setIsTestingGas] = useState(false);
  const [confirmPurgeAll, setConfirmPurgeAll] = useState(false);
  const [logFilter, setLogFilter] = useState<string>('all');

  // Community Board Modes Management
  const [newModeLabelTh, setNewModeLabelTh] = useState('');
  const [newModeLabelEn, setNewModeLabelEn] = useState('');
  const [newModeIcon, setNewModeIcon] = useState<BoardModeIcon>('sparkles');
  const [newModeContentTh, setNewModeContentTh] = useState('');

  const boardModes: BoardModeConfig[] =
    tenant.boardModes && tenant.boardModes.length > 0 ? tenant.boardModes : DEFAULT_BOARD_MODES;

  const pendingTasks = tenant.tasks.filter((tk) => tk.approvalStatus === 'pending');

  const handleAddBoardMode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModeLabelTh.trim()) return;
    const created: BoardModeConfig = {
      id: `custom-${Date.now()}`,
      labelTh: newModeLabelTh.trim(),
      labelEn: newModeLabelEn.trim() || newModeLabelTh.trim(),
      icon: newModeIcon,
      enabled: true,
      customContentTh: newModeContentTh.trim() || undefined,
      customContentEn: newModeContentTh.trim() || undefined,
    };
    onUpdateBoardModes([...boardModes, created]);
    setNewModeLabelTh('');
    setNewModeLabelEn('');
    setNewModeContentTh('');
  };

  const handlePatchBoardMode = (modeId: string, patch: Partial<BoardModeConfig>) => {
    onUpdateBoardModes(
      boardModes.map((m) => (m.id === modeId ? { ...m, ...patch } : m))
    );
  };

  const handleMoveBoardMode = (idx: number, dir: -1 | 1) => {
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= boardModes.length) return;
    const next = [...boardModes];
    [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
    onUpdateBoardModes(next);
  };

  const handleDeleteBoardMode = (modeId: string) => {
    onUpdateBoardModes(boardModes.filter((m) => m.id !== modeId));
  };

  const handleCreateTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitleTh.trim()) return;
    onCreateTask({
      titleTh: taskTitleTh.trim(),
      titleEn: taskTitleEn.trim() || taskTitleTh.trim(),
      descriptionTh: `กำหนดรอบเวลา ${taskStart}–${taskEnd}`,
      descriptionEn: `Scheduled window ${taskStart}–${taskEnd}`,
      startTime: taskStart,
      endTime: taskEnd,
      daysOfWeek: selectedDays.length > 0 ? selectedDays : [0, 1, 2, 3, 4, 5, 6],
      authMethod: taskAuth,
      buttonCutoffs: {
        present: cutoffPresent || undefined,
        late: cutoffLate || undefined,
      },
      showNameButtonLabel: showNameLabel.trim() || 'เช็คชื่อ',
      enabled: true,
      targetGroup: 'all',
    });
    setTaskTitleTh('');
    setTaskTitleEn('');
  };

  const handleAddMemberSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalGroup = groupChoice === '__other__' ? customGroupOther.trim() : groupChoice;
    if (!newMemberName.trim() || !finalGroup) return;
    onAddMember(
      newMemberName.trim(),
      finalGroup,
      newMemberCode.trim() || `M${String(tenant.members.length + 1).padStart(2, '0')}`
    );
    setNewMemberName('');
    setNewMemberCode('');
    setCustomGroupOther('');
  };

  const handleCreateUnitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitNameTh.trim()) return;
    onCreateCustomUnit(unitNameTh.trim(), unitNameEn.trim() || unitNameTh.trim(), unitLabel.trim() || 'หน่วย');
    setUnitNameTh('');
    setUnitNameEn('');
  };

  const budgetParticipants = useMemo(() => {
    return tenant.members
      .filter((m) => m.active && (budgetFilter === 'all' || m.group === budgetFilter))
      .map((m) => ({
        id: m.id,
        name: `${m.name} (${m.group})`,
        weight: weights[m.id] ?? 1,
      }));
  }, [tenant.members, budgetFilter, weights]);

  const budgetResult = useMemo(() => {
    return calculateBudgetSplit(Number(budgetTotal) || 0, budgetParticipants);
  }, [budgetTotal, budgetParticipants]);

  const downloadFile = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const parsed = parseMembersCsv(reader.result);
        if (parsed.length > 0) {
          onImportMembersCsv(parsed);
          setCopyFeedback(
            lang === 'th' ? `นำเข้าข้อมูลสมาชิก ${parsed.length} รายการเรียบร้อย` : `Imported ${parsed.length} members`
          );
        }
      }
    };
    reader.readAsText(file);
  };

  const dayLabels =
    lang === 'th'
      ? ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']
      : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-6">
      {/* Executive Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b tw-border">
        <div className="flex items-center gap-3">
          {activeTab !== 'tasks' && (
            <button
              type="button"
              onClick={() => setActiveTab('tasks')}
              className="px-3 py-1.5 text-xs font-medium tw-btn-ghost inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{t.back}</span>
            </button>
          )}
          <div>
            <h1 className="text-lg font-semibold">
              {lang === 'th' ? 'ศูนย์ควบคุมผู้บริหาร (Executive Console)' : 'Executive Control Console'}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
              <span>
                {currentUser.name} ·{' '}
                {currentUser.role === 'co_executive' ? t.roleCoExecutive : t.roleExecutive} ·{' '}
                {tenant.orgId} · {tenant.orgNameTh} / {tenant.orgNameEn}
              </span>
              <button
                type="button"
                onClick={onOpenOrgGate}
                className="px-2.5 py-0.5 text-xs font-medium tw-btn-ghost inline-flex items-center gap-1"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>{lang === 'th' ? 'เปลี่ยนรหัสองค์กร' : 'Switch Organization'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Simulated Time Preview Control */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[var(--text-muted)] inline-flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {t.simClockLabel}:
          </span>
          <input
            type="time"
            value={simulatedTimeStr ?? effectiveNow.toTimeString().slice(0, 5)}
            onChange={(e) => onSetSimulatedTime(e.target.value || null)}
            aria-label={t.simClockLabel}
            className="px-2 py-1 text-xs tw-input font-mono-tabular"
          />
          {simulatedTimeStr && (
            <button
              type="button"
              onClick={() => onSetSimulatedTime(null)}
              className="px-2.5 py-1 text-xs tw-btn-ghost"
            >
              {lang === 'th' ? 'กลับเวลาจริง' : 'Live Time'}
            </button>
          )}
        </div>
      </div>

      {/* Executive Navigation Tabs */}
      <div className="flex flex-wrap gap-1.5" role="tablist">
        {(
          [
            { id: 'tasks', labelTh: `คำสั่ง & อนุมัติ (${pendingTasks.length})`, labelEn: `Tasks (${pendingTasks.length})`, icon: ShieldCheck },
            {
              id: 'members',
              labelTh: isTwoTierOrg ? 'พนักงาน & หน่วยนับ' : 'สมาชิก & หน่วยนับ',
              labelEn: isTwoTierOrg ? 'Staff & Units' : 'Members & Units',
              icon: Users,
            },
            { id: 'board', labelTh: 'จัดการโหมดบอร์ด', labelEn: 'Board Modes', icon: LayoutGrid },
            { id: 'budget', labelTh: 'คำนวณงบประมาณ', labelEn: 'Budget Split', icon: Calculator },
            { id: 'coexec', labelTh: 'ผู้บริหาร & Multi-Tenant', labelEn: 'Co-Exec & Orgs', icon: UserPlus },
            { id: 'database', labelTh: 'Log รีเซต & GAS/CSV', labelEn: 'Logs & GAS/CSV', icon: Database },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 text-xs font-medium tw-control-sm inline-flex items-center gap-1.5 whitespace-nowrap ${
                active ? 'tw-btn-primary' : 'tw-btn-ghost'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{lang === 'th' ? tab.labelTh : tab.labelEn}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: Tasks & Approvals */}
      {activeTab === 'tasks' && (
        <div className="space-y-6">
          {pendingTasks.length > 0 && (
            <section className="tw-surface p-5 space-y-3">
              <h2 className="text-sm font-semibold">
                {lang === 'th' ? 'คำสั่งรออนุมัติจากพี่เลี้ยง' : 'Pending Drafts for Approval'}
              </h2>
              <div className="divide-y tw-border border tw-border tw-control">
                {pendingTasks.map((pt) => (
                  <div key={pt.id} className="p-3.5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs text-[var(--text-muted)] font-mono-tabular">
                        {pt.startTime}–{pt.endTime} · {pt.authMethod} · {lang === 'th' ? 'ผู้ร่าง' : 'By'}: {pt.proposedBy}
                      </div>
                      <div className="text-sm font-semibold">{pt.titleTh}</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onApproveTask(pt.id, true)}
                        className="px-3 py-1.5 text-xs font-medium tw-btn-primary inline-flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{lang === 'th' ? 'อนุมัติ' : 'Approve'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onApproveTask(pt.id, false)}
                        className="px-3 py-1.5 text-xs font-medium tw-btn-ghost inline-flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>{lang === 'th' ? 'ไม่อนุมัติ' : 'Reject'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Create Time-Window Task */}
          <section className="tw-surface p-5 space-y-4">
            <h2 className="text-sm font-semibold">
              {lang === 'th' ? 'สร้างคำสั่งควบคุมตามช่วงเวลาใหม่' : 'Create Time-Window Task'}
            </h2>
            <form onSubmit={handleCreateTaskSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="text"
                required
                value={taskTitleTh}
                onChange={(e) => setTaskTitleTh(e.target.value)}
                placeholder={lang === 'th' ? 'ชื่อคำสั่ง (ไทย) เช่น ไปโรงเรียน' : 'Task Name (TH)'}
                className="px-3 py-2 text-sm tw-input"
              />
              <input
                type="text"
                value={taskTitleEn}
                onChange={(e) => setTaskTitleEn(e.target.value)}
                placeholder="Task Name (EN)"
                className="px-3 py-2 text-sm tw-input"
              />
              <select
                value={taskAuth}
                onChange={(e) => setTaskAuth(e.target.value as AuthMethod)}
                className="px-3 py-2 text-sm tw-input"
                aria-label="Verification Method"
              >
                <option value="pin">{lang === 'th' ? 'ยืนยัน: กรอก PIN' : 'Auth: PIN'}</option>
                <option value="tap">{lang === 'th' ? 'ยืนยัน: กดชื่อยืนยัน' : 'Auth: Tap Name'}</option>
                <option value="qr">{lang === 'th' ? 'ยืนยัน: สแกน QR Code' : 'Auth: QR Code'}</option>
                <option value="daily_qr">{lang === 'th' ? 'ยืนยัน: QR เปลี่ยนรายวัน' : 'Auth: Daily Rotating QR'}</option>
                <option value="photo">{lang === 'th' ? 'ยืนยัน: ถ่ายภาพจุดเช็คอิน' : 'Auth: Photo Check-in'}</option>
              </select>

              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">
                  {lang === 'th' ? 'เวลาเริ่มคำสั่ง' : 'Window Start'}
                </label>
                <input
                  type="time"
                  value={taskStart}
                  onChange={(e) => setTaskStart(e.target.value)}
                  className="w-full px-3 py-2 text-sm tw-input font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">
                  {lang === 'th' ? 'เวลาสิ้นสุดคำสั่ง' : 'Window End'}
                </label>
                <input
                  type="time"
                  value={taskEnd}
                  onChange={(e) => setTaskEnd(e.target.value)}
                  className="w-full px-3 py-2 text-sm tw-input font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">
                  {lang === 'th' ? 'ข้อความบนปุ่มโชว์ชื่อ' : 'Show-Name Button Label'}
                </label>
                <input
                  type="text"
                  value={showNameLabel}
                  onChange={(e) => setShowNameLabel(e.target.value)}
                  className="w-full px-3 py-2 text-sm tw-input"
                />
              </div>

              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">
                  {lang === 'th' ? 'เส้นตายปุ่ม "มา" (ห้ามเกิน)' : '"Present" Cutoff'}
                </label>
                <input
                  type="time"
                  value={cutoffPresent}
                  onChange={(e) => setCutoffPresent(e.target.value)}
                  className="w-full px-3 py-2 text-sm tw-input font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">
                  {lang === 'th' ? 'เส้นตายปุ่ม "สาย" (ห้ามเกิน)' : '"Late" Cutoff'}
                </label>
                <input
                  type="time"
                  value={cutoffLate}
                  onChange={(e) => setCutoffLate(e.target.value)}
                  className="w-full px-3 py-2 text-sm tw-input font-mono-tabular"
                />
              </div>
              <div className="flex flex-col justify-end gap-2">
                <div className="grid grid-cols-7 gap-1">
                  {dayLabels.map((lbl, idx) => {
                    const active = selectedDays.includes(idx);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() =>
                          setSelectedDays((prev) =>
                            prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx]
                          )
                        }
                        className={`py-1.5 text-xs tw-control-sm text-center ${
                          active ? 'tw-btn-primary' : 'tw-btn-ghost'
                        }`}
                      >
                        {lbl}
                      </button>
                    );
                  })}
                </div>
                <button type="submit" className="w-full py-2 text-xs font-medium tw-btn-primary">
                  {lang === 'th' ? '+ เพิ่มคำสั่งควบคุมเวลา' : '+ Add Time-Window Task'}
                </button>
              </div>
            </form>
          </section>

          {/* Existing Tasks Table */}
          <section className="tw-surface p-5 space-y-3">
            <h2 className="text-sm font-semibold">
              {lang === 'th' ? 'คำสั่งทั้งหมดในระบบ (วนซ้ำต่อเนื่องตามวันและเวลาที่ตั้งไว้)' : 'All Configured Tasks'}
            </h2>
            <div className="divide-y tw-border border tw-border tw-control">
              {tenant.tasks.map((tk) => {
                const activeNow = isTaskActiveAt(tk, effectiveNow);
                return (
                  <div key={tk.id} className="p-3.5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs text-[var(--text-muted)] font-mono-tabular">
                        {tk.startTime}–{tk.endTime} · {tk.authMethod} ·{' '}
                        {tk.enabled ? (activeNow ? t.unlockedActive : t.lockedOutWindow) : lang === 'th' ? 'ปิดชั่วคราว' : 'Paused'}
                      </div>
                      <div className="text-sm font-semibold">
                        {lang === 'th' ? tk.titleTh : tk.titleEn}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {activeNow && (
                        <button
                          type="button"
                          onClick={() => onOpenTask(tk)}
                          className="px-3 py-1.5 text-xs font-medium tw-btn-primary"
                        >
                          {t.openTaskBtn}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onToggleTaskEnabled(tk.id)}
                        className="px-2.5 py-1.5 text-xs tw-btn-ghost inline-flex items-center gap-1"
                      >
                        {tk.enabled ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        <span>{tk.enabled ? (lang === 'th' ? 'ปิดชั่วคราว' : 'Pause') : (lang === 'th' ? 'เปิดใช้งาน' : 'Enable')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteTask(tk.id)}
                        aria-label={`Delete ${tk.titleTh}`}
                        className="px-2.5 py-1.5 text-xs tw-btn-ghost inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: Members, Offense Points & Custom Counting Units */}
      {activeTab === 'members' && (
        <div className="space-y-6">
          {/* Add Member with "อื่นๆ" custom option */}
          <section className="tw-surface p-5 space-y-3">
            <h2 className="text-sm font-semibold">
              {lang === 'th' ? 'เพิ่มรายชื่อสมาชิก (มีตัวเลือก "อื่นๆ" ระบุทีม/ตำแหน่งเองได้)' : 'Add Member (with custom "Other" group option)'}
            </h2>
            <form onSubmit={handleAddMemberSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <input
                type="text"
                required
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                placeholder={lang === 'th' ? 'ชื่อสมาชิก' : 'Member Name'}
                className="px-3 py-2 text-sm tw-input"
              />
              <input
                type="text"
                value={newMemberCode}
                onChange={(e) => setNewMemberCode(e.target.value)}
                placeholder={lang === 'th' ? 'รหัส (เช่น S11)' : 'Code (e.g. S11)'}
                className="px-3 py-2 text-sm tw-input font-mono-tabular"
              />
              <select
                value={groupChoice}
                onChange={(e) => setGroupChoice(e.target.value)}
                aria-label="Member Group"
                className="px-3 py-2 text-sm tw-input"
              >
                <option value="ทีมพี่โต">{isTwoTierOrg ? 'ทีมงาน / พนักงาน' : 'ทีมพี่โต'}</option>
                {!isTwoTierOrg && <option value="ทีมน้องเล็ก">ทีมน้องเล็ก</option>}
                <option value="อาสาสมัคร">{isTwoTierOrg ? 'ฝ่ายประสานงาน' : 'อาสาสมัคร'}</option>
                <option value="__other__">{lang === 'th' ? 'อื่นๆ (ระบุเอง)' : 'Other (Specify)'}</option>
              </select>
              <button type="submit" className="px-4 py-2 text-xs font-medium tw-btn-primary inline-flex items-center justify-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                <span>{lang === 'th' ? 'เพิ่มรายชื่อ' : 'Add Member'}</span>
              </button>
              {groupChoice === '__other__' && (
                <input
                  type="text"
                  required
                  value={customGroupOther}
                  onChange={(e) => setCustomGroupOther(e.target.value)}
                  placeholder={lang === 'th' ? 'พิมพ์ชื่อกลุ่ม/ตำแหน่งเอง...' : 'Enter custom group/role...'}
                  className="sm:col-span-4 px-3 py-2 text-sm tw-input"
                />
              )}
            </form>
          </section>

          {/* Custom Counting Units with Pause/Disable & Delete per unit */}
          <section className="tw-surface p-5 space-y-4">
            <h2 className="text-sm font-semibold">
              {lang === 'th' ? 'จัดการหน่วยนับอิสระ (Custom Units)' : 'Custom Counting Units'}
            </h2>
            <form onSubmit={handleCreateUnitSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <input
                type="text"
                required
                value={unitNameTh}
                onChange={(e) => setUnitNameTh(e.target.value)}
                placeholder={lang === 'th' ? 'ชื่อหน่วยนับ (เช่น แต้มความดี)' : 'Unit Name (TH)'}
                className="px-3 py-2 text-sm tw-input"
              />
              <input
                type="text"
                value={unitNameEn}
                onChange={(e) => setUnitNameEn(e.target.value)}
                placeholder="Unit Name (EN)"
                className="px-3 py-2 text-sm tw-input"
              />
              <input
                type="text"
                value={unitLabel}
                onChange={(e) => setUnitLabel(e.target.value)}
                placeholder={lang === 'th' ? 'คำต่อท้าย (แต้ม / ดาว)' : 'Suffix (pts)'}
                className="px-3 py-2 text-sm tw-input"
              />
              <button type="submit" className="px-4 py-2 text-xs font-medium tw-btn-primary">
                {lang === 'th' ? '+ สร้างหน่วยนับอิสระ' : '+ Add Unit'}
              </button>
            </form>

            <div className="divide-y tw-border border tw-border tw-control">
              {tenant.customUnits.map((u) => (
                <div key={u.id} className="p-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">
                      {lang === 'th' ? u.nameTh : u.nameEn} ({u.unitLabel})
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {u.active ? (lang === 'th' ? 'กำลังทำงาน' : 'Active') : (lang === 'th' ? 'หยุดทำงานชั่วคราว' : 'Paused')}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onToggleCustomUnit(u.id)}
                      className="px-3 py-1.5 text-xs font-medium tw-btn-ghost inline-flex items-center gap-1"
                    >
                      {u.active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      <span>{u.active ? (lang === 'th' ? 'หยุดทำงาน/ปิดใช้งาน' : 'Pause/Disable') : (lang === 'th' ? 'เปิดใช้งาน' : 'Enable')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteCustomUnit(u.id)}
                      className="px-3 py-1.5 text-xs font-medium tw-btn-ghost inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{lang === 'th' ? 'ลบ' : 'Delete'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Member Points, Reduce/Clear Offense + Lost & Found */}
          <section className="tw-surface p-5 space-y-3">
            <h2 className="text-sm font-semibold">
              {lang === 'th' ? 'สมาชิก · ล้างความผิด / ลดแต้ม / เพิ่มคะแนนหน่วยนับ (บันทึก Log ทุกครั้ง)' : 'Members · Offense Adjustments & Custom Unit Scores'}
            </h2>
            <div className="divide-y tw-border border tw-border tw-control">
              {tenant.members.map((m) => (
                <div key={m.id} className="p-3.5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">
                      <span className="font-mono-tabular text-xs text-[var(--text-muted)] mr-2">{m.code}</span>
                      {m.name}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">{m.group}</div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {!isTwoTierOrg && (
                      <>
                        <span className="text-xs font-mono-tabular mr-1">
                          {lang === 'th' ? `ความผิด: ${m.offensePoints}` : `Offense: ${m.offensePoints}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => onAdjustOffense(m.id, -1, 'reduce')}
                          disabled={m.offensePoints <= 0}
                          className="px-2.5 py-1 text-xs tw-btn-ghost"
                        >
                          {lang === 'th' ? 'ลดแต้มความผิด (-1)' : 'Reduce (-1)'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onAdjustOffense(m.id, 0, 'clear')}
                          disabled={m.offensePoints <= 0}
                          className="px-2.5 py-1 text-xs tw-btn-ghost"
                        >
                          {lang === 'th' ? 'ล้างความผิด' : 'Clear Offense'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onAdjustOffense(m.id, 1, 'reduce')}
                          className="px-2.5 py-1 text-xs tw-btn-ghost"
                        >
                          +1
                        </button>
                      </>
                    )}

                    {tenant.customUnits
                      .filter((u) => u.active)
                      .map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => onAdjustCustomUnit(m.id, u.id, 1)}
                          className="px-2.5 py-1 text-xs tw-btn-primary font-mono-tabular"
                        >
                          +1 {u.nameTh} ({m.customUnitScores[u.id] ?? 0})
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Lost & Found Admin Close Case */}
          <section className="tw-surface p-5 space-y-3">
            <h2 className="text-sm font-semibold">
              {lang === 'th' ? 'ปิดเคสแจ้งของหาย / เก็บของได้ (เฉพาะหลังบ้าน)' : 'Close Lost & Found Cases'}
            </h2>
            <div className="divide-y tw-border border tw-border tw-control">
              {tenant.lostFound.map((lf) => (
                <div key={lf.id} className="p-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs">
                    <strong>{lf.itemName}</strong> · {lf.location} · {lf.reporterName}
                  </div>
                  {lf.status === 'open' ? (
                    <button
                      type="button"
                      onClick={() => onResolveLostFound(lf.id)}
                      className="px-3 py-1 text-xs font-medium tw-btn-primary"
                    >
                      {lang === 'th' ? 'ปิดเคส / พบเจ้าของแล้ว' : 'Close Case'}
                    </button>
                  ) : (
                    <span className="text-xs text-[var(--text-muted)]">{t.caseResolved}</span>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* TAB: Community Board Modes Management */}
      {activeTab === 'board' && (
        <div className="space-y-6">
          <section className="tw-surface p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">
                  {lang === 'th'
                    ? 'เพิ่มโหมดใหม่ในบอร์ดส่วนกลาง (หน้าแรก)'
                    : 'Add New Community Board Mode'}
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {lang === 'th'
                    ? 'เพิ่มแท็บโหมดใหม่ หรือกำหนดชื่อและข้อความให้สมาชิกอ่านบนหน้าแรกได้ทันที'
                    : 'Create custom board tabs visible on your organization front page'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onUpdateBoardModes(DEFAULT_BOARD_MODES.map((m) => ({ ...m })))}
                className="px-3 py-1.5 text-xs font-medium tw-btn-ghost inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{lang === 'th' ? 'คืนค่าโหมดเริ่มต้น' : 'Reset Defaults'}</span>
              </button>
            </div>

            <form onSubmit={handleAddBoardMode} className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <input
                type="text"
                required
                value={newModeLabelTh}
                onChange={(e) => setNewModeLabelTh(e.target.value)}
                placeholder={lang === 'th' ? 'ชื่อโหมด (ไทย) เช่น เมนูอาหาร' : 'Mode Name (TH)'}
                className="px-3 py-2 text-sm tw-input"
              />
              <input
                type="text"
                value={newModeLabelEn}
                onChange={(e) => setNewModeLabelEn(e.target.value)}
                placeholder={lang === 'th' ? 'ชื่อโหมด (อังกฤษ)' : 'Mode Name (EN)'}
                className="px-3 py-2 text-sm tw-input"
              />
              <select
                value={newModeIcon}
                onChange={(e) => setNewModeIcon(e.target.value as BoardModeIcon)}
                aria-label={lang === 'th' ? 'เลือกไอคอนโหมด' : 'Select Mode Icon'}
                className="px-3 py-2 text-sm tw-input"
              >
                <option value="sparkles">{lang === 'th' ? 'ไอคอน: พิเศษ / ทั่วไป' : 'Icon: Sparkles'}</option>
                <option value="megaphone">{lang === 'th' ? 'ไอคอน: ประชาสัมพันธ์' : 'Icon: Megaphone'}</option>
                <option value="clipboard">{lang === 'th' ? 'ไอคอน: รายการ / กติกา' : 'Icon: Clipboard'}</option>
                <option value="bell">{lang === 'th' ? 'ไอคอน: กระดิ่ง' : 'Icon: Bell'}</option>
                <option value="calendar">{lang === 'th' ? 'ไอคอน: ปฏิทิน' : 'Icon: Calendar'}</option>
                <option value="book">{lang === 'th' ? 'ไอคอน: หนังสือ' : 'Icon: Book'}</option>
                <option value="gift">{lang === 'th' ? 'ไอคอน: ของขวัญ' : 'Icon: Gift'}</option>
              </select>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold tw-btn-primary inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{lang === 'th' ? 'เพิ่มโหมดใหม่' : 'Add Mode'}</span>
              </button>
              <textarea
                rows={2}
                value={newModeContentTh}
                onChange={(e) => setNewModeContentTh(e.target.value)}
                placeholder={
                  lang === 'th'
                    ? 'ข้อความ / รายละเอียดที่จะแสดงในโหมดนี้ (ไม่บังคับ)'
                    : 'Optional description or notice text to show inside this tab...'
                }
                className="sm:col-span-4 px-3 py-2 text-sm tw-input"
              />
            </form>
          </section>

          <section className="tw-surface p-5 space-y-3">
            <h2 className="text-sm font-semibold">
              {lang === 'th'
                ? 'แก้ไขชื่อ เปิด/ปิดการใช้งาน และจัดลำดับโหมดบอร์ดส่วนกลาง'
                : 'Edit, Toggle & Reorder Community Board Modes'}
            </h2>

            <div className="divide-y tw-border border tw-border tw-control">
              {boardModes.map((mode, idx) => (
                <div key={mode.id} className="p-3.5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2 py-0.5 font-medium tw-subtle border tw-border tw-control-sm">
                        {mode.builtinType
                          ? lang === 'th'
                            ? 'โหมดระบบ'
                            : 'Built-in'
                          : lang === 'th'
                          ? 'โหมดที่เพิ่มเอง'
                          : 'Custom'}
                      </span>
                      <span className={mode.enabled ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]'}>
                        {mode.enabled
                          ? lang === 'th'
                            ? 'เปิดแสดงบนหน้าแรก'
                            : 'Visible on Home'
                          : lang === 'th'
                          ? 'ปิดการใช้งานอยู่'
                          : 'Disabled'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveBoardMode(idx, -1)}
                        aria-label={lang === 'th' ? 'เลื่อนขึ้น' : 'Move up'}
                        className="p-1.5 tw-btn-ghost"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === boardModes.length - 1}
                        onClick={() => handleMoveBoardMode(idx, 1)}
                        aria-label={lang === 'th' ? 'เลื่อนลง' : 'Move down'}
                        className="p-1.5 tw-btn-ghost"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePatchBoardMode(mode.id, { enabled: !mode.enabled })}
                        className={`px-3 py-1.5 text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap ${
                          mode.enabled ? 'tw-btn-ghost' : 'tw-btn-primary'
                        }`}
                      >
                        {mode.enabled ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        <span>
                          {mode.enabled
                            ? lang === 'th'
                              ? 'ปิดใช้งาน'
                              : 'Disable'
                            : lang === 'th'
                            ? 'เปิดใช้งาน'
                            : 'Enable'}
                        </span>
                      </button>
                      {!mode.builtinType && (
                        <button
                          type="button"
                          onClick={() => handleDeleteBoardMode(mode.id)}
                          aria-label={`Delete ${mode.labelTh}`}
                          className="p-1.5 tw-btn-ghost"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={mode.labelTh}
                      onChange={(e) => handlePatchBoardMode(mode.id, { labelTh: e.target.value })}
                      aria-label={`${mode.id} TH label`}
                      placeholder={lang === 'th' ? 'ชื่อโหมด (ไทย)' : 'Thai Label'}
                      className="px-3 py-1.5 text-xs tw-input"
                    />
                    <input
                      type="text"
                      value={mode.labelEn}
                      onChange={(e) => handlePatchBoardMode(mode.id, { labelEn: e.target.value })}
                      aria-label={`${mode.id} EN label`}
                      placeholder="English Label"
                      className="px-3 py-1.5 text-xs tw-input"
                    />
                    <select
                      value={mode.icon}
                      onChange={(e) =>
                        handlePatchBoardMode(mode.id, { icon: e.target.value as BoardModeIcon })
                      }
                      aria-label={`${mode.id} icon`}
                      className="px-3 py-1.5 text-xs tw-input"
                    >
                      <option value="bell">Bell (ประกาศ)</option>
                      <option value="check">Check (โหวตลับ)</option>
                      <option value="calendar">Calendar (เวรประจำวัน)</option>
                      <option value="book">Book (ความรู้)</option>
                      <option value="package">Package (ของหาย)</option>
                      <option value="gift">Gift (จับของขวัญ)</option>
                      <option value="sparkles">Sparkles (พิเศษ)</option>
                      <option value="megaphone">Megaphone (ประชาสัมพันธ์)</option>
                      <option value="clipboard">Clipboard (รายการ)</option>
                    </select>
                  </div>

                  {!mode.builtinType && (
                    <textarea
                      rows={2}
                      value={mode.customContentTh ?? ''}
                      onChange={(e) =>
                        handlePatchBoardMode(mode.id, {
                          customContentTh: e.target.value,
                          customContentEn: e.target.value,
                        })
                      }
                      placeholder={lang === 'th' ? 'แก้ไขข้อความภายในโหมดนี้...' : 'Edit custom tab content...'}
                      className="w-full px-3 py-1.5 text-xs tw-input"
                    />
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* TAB 3: Automatic Budget Split Calculator */}
      {activeTab === 'budget' && (
        <section className="tw-surface p-5 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold">
                {lang === 'th' ? 'ระบบคำนวณหารงบประมาณอัตโนมัติ' : 'Automatic Budget Split Calculator'}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                {lang === 'th'
                  ? 'หารเฉลี่ยหรือกำหนดน้ำหนักสัดส่วนอัตโนมัติพร้อมปัดเศษให้ลงตัวยอดรวมพอดี'
                  : 'Automatic equal or weighted budget splitting with exact remainder reconciliation'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                min="0"
                step="10"
                value={budgetTotal}
                onChange={(e) => setBudgetTotal(e.target.value)}
                aria-label="Total Budget Amount"
                className="w-36 px-3 py-1.5 text-sm tw-input font-mono-tabular"
              />
              <select
                value={budgetFilter}
                onChange={(e) => setBudgetFilter(e.target.value as 'all' | 'ทีมพี่โต' | 'ทีมน้องเล็ก')}
                aria-label="Participant Group Filter"
                className="px-3 py-1.5 text-sm tw-input"
              >
                <option value="all">{lang === 'th' ? 'สมาชิกทั้งหมด' : 'All Members'}</option>
                <option value="ทีมพี่โต">ทีมพี่โต</option>
                <option value="ทีมน้องเล็ก">ทีมน้องเล็ก</option>
              </select>
            </div>
          </div>

          <div className="divide-y tw-border border tw-border tw-control">
            {budgetResult.rows.map((row) => (
              <div key={row.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                <span>{row.name}</span>
                <div className="flex items-center gap-4">
                  <label className="text-xs text-[var(--text-muted)] inline-flex items-center gap-1.5">
                    <span>{lang === 'th' ? 'สัดส่วน' : 'Weight'}:</span>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={weights[row.id] ?? 1}
                      onChange={(e) =>
                        setWeights((prev) => ({
                          ...prev,
                          [row.id]: Math.max(1, Number(e.target.value) || 1),
                        }))
                      }
                      className="w-14 px-2 py-1 text-xs tw-input font-mono-tabular"
                    />
                  </label>
                  <span className="font-mono-tabular font-semibold w-24 text-right">
                    {row.amount.toFixed(2)} ฿
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center pt-2 text-sm font-semibold font-mono-tabular">
            <span>{lang === 'th' ? `ยอดรวมที่จัดสรรแล้ว (${budgetResult.rows.length} คน)` : `Total Allocated (${budgetResult.rows.length})`}</span>
            <span>{budgetResult.totalDistributed.toFixed(2)} ฿</span>
          </div>
        </section>
      )}

      {/* TAB 4: Co-Executive Invite & Multi-Tenant Management */}
      {activeTab === 'coexec' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="tw-surface p-5 space-y-4">
            <h2 className="text-sm font-semibold">
              {lang === 'th' ? 'เชิญผู้บริหารร่วม (Co-Executive)' : 'Invite Co-Executive'}
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!inviteName.trim()) return;
                onCreateCoAdminInvite(inviteName.trim());
                setInviteName('');
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder={lang === 'th' ? 'ชื่อผู้บริหารคนที่ 2' : 'Co-Executive Name'}
                className="flex-1 px-3 py-2 text-sm tw-input"
              />
              <button type="submit" className="px-3.5 py-2 text-xs font-medium tw-btn-primary whitespace-nowrap">
                {lang === 'th' ? 'สร้างคำเชิญ' : 'Send Invite'}
              </button>
            </form>

            <div className="divide-y tw-border border tw-border tw-control">
              {tenant.coAdminInvites.map((inv) => (
                <div key={inv.code} className="p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <div className="font-semibold">{inv.invitedName}</div>
                    <div className="font-mono-tabular text-[var(--text-muted)]">
                      {inv.code} · {inv.accepted ? (lang === 'th' ? 'ตอบรับแล้ว' : 'Accepted') : (lang === 'th' ? 'รอตอบรับ' : 'Pending')}
                    </div>
                  </div>
                  {!inv.accepted && (
                    <button
                      type="button"
                      onClick={() => setAcceptCode(inv.code)}
                      className="px-2.5 py-1 tw-btn-ghost"
                    >
                      {lang === 'th' ? 'ใช้รหัสนี้ตอบรับ' : 'Use Code'}
                    </button>
                  )}
                </div>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!acceptCode.trim() || !acceptName.trim() || !acceptPin.trim()) return;
                onAcceptCoAdminInvite(acceptCode.trim(), acceptName.trim(), acceptPin.trim());
                setAcceptCode('');
                setAcceptName('');
              }}
              className="p-3.5 border tw-border tw-control tw-subtle space-y-2.5"
            >
              <div className="text-xs font-semibold">
                {lang === 'th' ? 'ตอบรับคำเชิญเพื่อเข้ามุมมองผู้บริหารเหมือนกัน' : 'Accept Co-Executive Invite'}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={acceptCode}
                  onChange={(e) => setAcceptCode(e.target.value)}
                  placeholder="CO-EXEC-..."
                  className="px-2.5 py-1.5 text-xs tw-input font-mono-tabular"
                />
                <input
                  type="text"
                  value={acceptName}
                  onChange={(e) => setAcceptName(e.target.value)}
                  placeholder={lang === 'th' ? 'ชื่อผู้บริหารร่วม' : 'Name'}
                  className="px-2.5 py-1.5 text-xs tw-input"
                />
                <input
                  type="text"
                  value={acceptPin}
                  onChange={(e) => setAcceptPin(e.target.value)}
                  placeholder="PIN"
                  className="px-2.5 py-1.5 text-xs tw-input font-mono-tabular"
                />
              </div>
              <button type="submit" className="px-3 py-1.5 text-xs font-medium tw-btn-primary">
                {lang === 'th' ? 'ตอบรับคำเชิญและเข้าสู่มุมมองผู้บริหาร' : 'Accept & Switch to Co-Exec View'}
              </button>
            </form>
          </section>

          {/* Multi-Tenant SaaS Switcher */}
          <section className="tw-surface p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">
                {lang === 'th' ? 'จัดการองค์กร Multi-Tenant (SaaS)' : 'Multi-Tenant Organizations'}
              </h2>
              <button
                type="button"
                onClick={onOpenOrgGate}
                className="px-3 py-1.5 text-xs font-medium tw-btn-ghost inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{lang === 'th' ? 'เปิดหน้าเปลี่ยนรหัสองค์กร' : 'Open Organization Gate'}</span>
              </button>
            </div>
            <div className="divide-y tw-border border tw-border tw-control">
              {Object.values(allTenants).map((org) => (
                <div key={org.orgId} className="p-3 flex items-center justify-between gap-2 text-xs">
                  <div>
                    <div className="font-semibold">
                      {org.orgId} · {lang === 'th' ? org.orgNameTh : org.orgNameEn}
                    </div>
                    <div className="text-[var(--text-muted)]">
                      {org.members.length} members · {org.tasks.length} tasks
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSwitchTenant(org.orgId)}
                    disabled={org.orgId === tenant.orgId}
                    className="px-3 py-1.5 tw-btn-primary"
                  >
                    {org.orgId === tenant.orgId ? (lang === 'th' ? 'กำลังใช้งาน' : 'Active') : (lang === 'th' ? 'สลับองค์กร' : 'Switch')}
                  </button>
                </div>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setNewOrgError('');
                const cleanId = newOrgId.trim().toUpperCase();
                if (!cleanId || !newOrgNameTh.trim()) return;
                if (allTenants[cleanId]) {
                  setNewOrgError(
                    lang === 'th'
                      ? `รหัสองค์กร "${cleanId}" มีอยู่ในระบบแล้ว กรุณากดสุ่มหรือใช้รหัสอื่น`
                      : `Organization code "${cleanId}" already exists.`
                  );
                  return;
                }
                if (!/^\d{4}$/.test(newOrgPin.trim())) {
                  setNewOrgError(
                    lang === 'th' ? 'กรุณาระบุรหัส PIN ตัวเลข 4 หลัก' : 'Please enter a 4-digit PIN.'
                  );
                  return;
                }
                onCreateTenant(
                  cleanId,
                  newOrgNameTh.trim(),
                  newOrgNameTh.trim(),
                  newOrgPin.trim(),
                  { orgAccountMode: newOrgAccountMode }
                );
                setNewOrgId(generateUniqueOrgCode(allTenants));
                setNewOrgNameTh('');
              }}
              className="p-3.5 border tw-border tw-control tw-subtle space-y-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold">
                  {lang === 'th' ? 'สร้าง Tenant องค์กรใหม่ (รองรับทั้ง 3 รูปแบบ)' : 'Create New Tenant Organization'}
                </div>
                <button
                  type="button"
                  onClick={() => setNewOrgId(generateUniqueOrgCode(allTenants))}
                  className="text-xs underline text-[var(--text-secondary)]"
                >
                  {lang === 'th' ? 'สุ่มรหัสใหม่' : 'Generate Code'}
                </button>
              </div>
              <select
                value={newOrgAccountMode}
                onChange={(e) => setNewOrgAccountMode(e.target.value as OrgAccountMode)}
                aria-label={lang === 'th' ? 'เลือกรูปแบบองค์กร' : 'Organization Account Mode'}
                className="w-full px-2.5 py-1.5 text-xs tw-input"
              >
                <option value="org_2tier">
                  {lang === 'th' ? '1) โหมดองค์กร/ทีมงานทั่วไป (2 ระดับ)' : '1) Standard Org / Team (2 Tiers)'}
                </option>
                <option value="foundation_3tier">
                  {lang === 'th' ? '2) โหมดมูลนิธิ/ศูนย์ดูแล (3 ระดับ)' : '2) Foundation / Care Center (3 Tiers)'}
                </option>
                <option value="file_drop">
                  {lang === 'th' ? '3) โหมดจุดฝากไฟล์รวม' : '3) Shared File Drop Hub'}
                </option>
              </select>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={newOrgId}
                  onChange={(e) => setNewOrgId(e.target.value)}
                  placeholder="ORG-XXXX"
                  className="px-2.5 py-1.5 text-xs tw-input font-mono-tabular uppercase"
                />
                <input
                  type="text"
                  value={newOrgNameTh}
                  onChange={(e) => setNewOrgNameTh(e.target.value)}
                  placeholder={lang === 'th' ? 'ชื่อองค์กร' : 'Org Name'}
                  className="px-2.5 py-1.5 text-xs tw-input"
                />
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={newOrgPin}
                  onChange={(e) => setNewOrgPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="PIN 4 หลัก"
                  className="px-2.5 py-1.5 text-xs tw-input font-mono-tabular"
                />
              </div>
              {newOrgError && <div className="text-xs font-medium text-[var(--text-primary)]">{newOrgError}</div>}
              <button type="submit" className="px-3 py-1.5 text-xs font-medium tw-btn-primary">
                {lang === 'th' ? '+ สร้างองค์กรใหม่' : '+ Create Tenant'}
              </button>
            </form>

            {onRenameOrgId && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const nextId = renameOrgInput.trim().toUpperCase();
                  if (!nextId) return;
                  const ok = onRenameOrgId(tenant.orgId, nextId);
                  setRenameOrgMsg(
                    ok
                      ? lang === 'th'
                        ? `เปลี่ยนรหัสองค์กรเป็น ${nextId} เรียบร้อยแล้ว`
                        : `Organization code updated to ${nextId}`
                      : lang === 'th'
                      ? 'รหัสองค์กรนี้ซ้ำหรือใช้งานอยู่แล้ว กรุณาใช้รหัสอื่น'
                      : 'Code already in use or invalid'
                  );
                }}
                className="p-3.5 border tw-border tw-control tw-subtle space-y-2.5"
              >
                <div className="text-xs font-semibold">
                  {lang === 'th'
                    ? 'เปลี่ยนรหัสองค์กรของตนเอง (Customize Organization Code)'
                    : 'Customize Current Organization Code'}
                </div>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={renameOrgInput}
                    onChange={(e) => setRenameOrgInput(e.target.value)}
                    placeholder="ORG-CUSTOM"
                    className="flex-1 min-w-[160px] px-2.5 py-1.5 text-xs tw-input font-mono-tabular uppercase"
                  />
                  <button type="submit" className="px-3 py-1.5 text-xs font-medium tw-btn-soft whitespace-nowrap">
                    {lang === 'th' ? 'บันทึกรหัสองค์กรใหม่' : 'Update Org Code'}
                  </button>
                </div>
                {renameOrgMsg && <div className="text-xs text-[var(--text-secondary)]">{renameOrgMsg}</div>}
              </form>
            )}
          </section>

          <div className="lg:col-span-2">
            <OrgBusinessCard
              orgId={tenant.orgId}
              orgNameTh={tenant.orgNameTh}
              orgNameEn={tenant.orgNameEn}
              lang={lang}
              defaultTarget="profile"
            />
          </div>
        </div>
      )}

      {/* TAB 5: Daily Reset, Audit Logs, CSV & Google Apps Script Single-File Export */}
      {activeTab === 'database' && (
        <div className="space-y-6">
          {/* Storage Mode & Daily Reset (balanced equal-height cards + 2x2 action grid) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            <section className="tw-surface p-5 flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <h2 className="text-sm font-semibold">
                  {lang === 'th' ? 'โหมดฐานข้อมูลองค์กร (แยกโหมดชัดเจน)' : 'Database Storage Mode'}
                </h2>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => onUpdateStorageMode('central_14d', gasUrlInput)}
                    className={`w-full text-left p-3 border tw-control ${
                      tenant.storageMode === 'central_14d' ? 'tw-active-task' : 'tw-border'
                    }`}
                  >
                    <div className="text-xs font-semibold">
                      {lang === 'th'
                        ? '1. โหมดพักข้อมูลหน้าเว็บ (เก็บรายชิ้น 14 วัน ลบเฉพาะของเก่าเกิน 14 วัน)'
                        : '1. Rolling 14-Day Browser Mode (Item-by-Item Expiry)'}
                    </div>
                    <div className="text-xs opacity-80 mt-0.5">
                      {lang === 'th'
                        ? 'ไม่เก็บข้อมูลใครถาวร · รายการใหม่ยังอยู่ครบ 14 วันเต็ม ลบเฉพาะรายการที่ครบอายุ 14 วันแล้ว'
                        : 'Zero permanent storage · Each item stays 14 days from submission; only items aged 14+ days expire'}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onUpdateStorageMode('google_sheets_gas', gasUrlInput)}
                    className={`w-full text-left p-3 border tw-control ${
                      tenant.storageMode === 'google_sheets_gas' ? 'tw-active-task' : 'tw-border'
                    }`}
                  >
                    <div className="text-xs font-semibold">
                      {lang === 'th'
                        ? '2. โหมด Google Drive & Sheets ของคุณเอง (ส่งรูป/ไฟล์เข้าบัญชีคุณโดยตรง)'
                        : '2. Your Own Google Drive & Sheets Mode (Direct Owner Sync)'}
                    </div>
                    <div className="text-xs opacity-80 mt-0.5">
                      {lang === 'th'
                        ? 'ส่งรูปถ่ายเช็คอิน ไฟล์ฝาก และ Log เข้า Drive + Sheet ของเจ้าของโดยตรง (คนส่งไม่ต้องล็อกอิน Google)'
                        : 'Photos, dropped files, and logs sync directly into your own Drive & Sheets'}
                    </div>
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <input
                  type="url"
                  value={gasUrlInput}
                  onChange={(e) => setGasUrlInput(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="flex-1 min-w-[180px] px-3 py-2 text-xs tw-input font-mono-tabular"
                />
                <button
                  type="button"
                  disabled={isTestingGas}
                  onClick={async () => {
                    const trimmed = gasUrlInput.trim();
                    if (!isValidGasWebAppUrl(trimmed)) {
                      setCopyFeedback(
                        lang === 'th'
                          ? 'URL ไม่ถูกต้อง: ต้องเป็น https://script.google.com/macros/s/.../exec'
                          : 'Invalid GAS Web App URL'
                      );
                      return;
                    }
                    setIsTestingGas(true);
                    const res = await testGasWebAppConnection(trimmed, tenant.orgId);
                    setIsTestingGas(false);
                    setCopyFeedback(
                      res.synced
                        ? lang === 'th'
                          ? 'ทดสอบเชื่อมต่อ Drive & Sheets สำเร็จแล้ว'
                          : 'Drive & Sheets connection verified!'
                        : lang === 'th'
                        ? `เชื่อมต่อไม่สำเร็จ (${res.error ?? 'ตรวจสอบ Deploy: Anyone'})`
                        : `Connection failed (${res.error ?? 'Check Anyone access'})`
                    );
                  }}
                  className="px-3 py-2 text-xs font-medium tw-btn-ghost whitespace-nowrap disabled:opacity-60"
                >
                  {isTestingGas
                    ? lang === 'th'
                      ? 'กำลังทดสอบ...'
                      : 'Testing...'
                    : lang === 'th'
                    ? 'ทดสอบ'
                    : 'Test'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const trimmed = gasUrlInput.trim();
                    if (trimmed && !isValidGasWebAppUrl(trimmed)) {
                      setCopyFeedback(
                        lang === 'th'
                          ? 'URL ไม่ถูกต้อง: ต้องเป็น https://script.google.com/macros/s/.../exec'
                          : 'Invalid GAS Web App URL'
                      );
                      return;
                    }
                    onUpdateStorageMode(trimmed ? 'google_sheets_gas' : tenant.storageMode, trimmed);
                    setCopyFeedback(
                      lang === 'th'
                        ? 'บันทึกการเชื่อมต่อ Google Drive & Sheets แล้ว'
                        : 'Drive & Sheets settings saved'
                    );
                  }}
                  className="px-4 py-2 text-xs font-medium tw-btn-primary whitespace-nowrap"
                >
                  {lang === 'th' ? 'บันทึก' : 'Save'}
                </button>
              </div>
            </section>

            {/* Daily Reset & Exports (Clean 2x2 Grid) */}
            <section className="tw-surface p-5 flex flex-col justify-between gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">
                    {lang === 'th' ? 'รีเซตรายวัน & ส่งออก Single-File HTML / CSV' : 'Daily Reset & GAS / CSV Export'}
                  </h2>
                  <p className="text-xs text-[var(--text-muted)] font-mono-tabular mt-0.5">
                    {lang === 'th'
                      ? `รีเซตล่าสุด: ${tenant.lastResetDateKey} · ลบ Log เก่าเกิน 14 วันอัตโนมัติ`
                      : `Last reset: ${tenant.lastResetDateKey} · 14-day rolling purge`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={onTriggerDailyReset}
                    className="px-3 py-1.5 text-xs font-medium tw-btn-ghost inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{lang === 'th' ? 'รีเซตรายวันทันที' : 'Run Daily Reset'}</span>
                  </button>
                  {onClearTemporaryRecords && !confirmPurgeAll && (
                    <button
                      type="button"
                      onClick={() => setConfirmPurgeAll(true)}
                      className="px-3 py-1.5 text-xs font-medium tw-btn-ghost inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{lang === 'th' ? 'ล้าง Log/ไฟล์แยกย้าย' : 'Clear Logs & Drops'}</span>
                    </button>
                  )}
                </div>
              </div>

              {confirmPurgeAll && onClearTemporaryRecords && (
                <div className="p-3 tw-subtle border tw-border tw-control-sm flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span>
                    {lang === 'th'
                      ? 'ยืนยันล้างประวัติ Log และรายการฝากไฟล์ทั้งหมด (คงรายชื่อสมาชิก คำสั่ง และตั้งค่าองค์กรไว้ครบ)?'
                      : 'Clear all audit logs and file drop items (members, tasks, and org settings remain intact)?'}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmPurgeAll(false)}
                      className="px-2.5 py-1 tw-btn-ghost"
                    >
                      {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onClearTemporaryRecords();
                        setConfirmPurgeAll(false);
                        setCopyFeedback(
                          lang === 'th'
                            ? 'ล้างข้อมูลชั่วคราวทั้งหมดเรียบร้อยแล้ว (โครงสร้างองค์กรยังอยู่ครบ)'
                            : 'Cleared all temporary logs and file drop records.'
                        );
                      }}
                      className="px-3 py-1 tw-btn-primary font-semibold"
                    >
                      {lang === 'th' ? 'ยืนยันล้าง' : 'Confirm'}
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() =>
                    downloadFile(
                      `${tenant.orgId}_report.csv`,
                      exportLogsAndMembersCsv(tenant.logs, tenant.members),
                      'text/csv;charset=utf-8'
                    )
                  }
                  className="w-full px-3 py-2.5 text-xs font-medium tw-btn-ghost inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5 shrink-0" />
                  <span>{lang === 'th' ? 'ส่งออก Excel / CSV' : 'Export Excel CSV'}</span>
                </button>

                <label className="w-full px-3 py-2.5 text-xs font-medium tw-btn-ghost cursor-pointer inline-flex items-center justify-center gap-1.5 whitespace-nowrap">
                  <Upload className="w-3.5 h-3.5 shrink-0" />
                  <span>{lang === 'th' ? 'นำเข้าสมาชิก CSV' : 'Import Members CSV'}</span>
                  <input type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" />
                </label>

                <button
                  type="button"
                  onClick={() =>
                    downloadFile(
                      `TimeWindow_${tenant.orgId}_SingleFile.html`,
                      generateSingleFileHtmlBundle(tenant),
                      'text/html;charset=utf-8'
                    )
                  }
                  className="w-full px-3 py-2.5 text-xs font-medium tw-btn-primary inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5 shrink-0" />
                  <span>{lang === 'th' ? 'ดาวน์โหลด Single-File HTML' : 'Download Single-File HTML'}</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard?.writeText(generateGoogleAppsScriptCode(tenant.orgId));
                    setCopyFeedback(lang === 'th' ? 'คัดลอกโค้ด Code.gs สำหรับ Google Apps Script แล้ว' : 'Copied Code.gs to clipboard');
                  }}
                  className="w-full px-3 py-2.5 text-xs font-medium tw-btn-ghost inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <Copy className="w-3.5 h-3.5 shrink-0" />
                  <span>{lang === 'th' ? 'คัดลอก Code.gs' : 'Copy Code.gs'}</span>
                </button>
              </div>

              <div className="text-xs text-[var(--text-muted)] pt-1 border-t tw-border min-h-[20px]">
                {copyFeedback ||
                  (lang === 'th'
                    ? 'รองรับไฟล์ Excel UTF-8 CSV และแพ็กเกจเว็บเดี่ยวสำหรับใช้งานกับ Google Apps Script'
                    : 'Supports UTF-8 Excel CSV and standalone HTML bundles for Google Apps Script')}
              </div>
            </section>
          </div>

          {/* Historical Audit Logs */}
          <section className="tw-surface p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">
                {lang === 'th' ? 'ประวัติการทำงานและปลดล็อคย้อนหลัง (Audit Logs)' : 'Historical Audit Logs'}
              </h2>
              <select
                value={logFilter}
                onChange={(e) => setLogFilter(e.target.value)}
                aria-label="Filter Logs"
                className="px-3 py-1.5 text-xs tw-input"
              >
                <option value="all">{lang === 'th' ? 'ทุกประเภท' : 'All Types'}</option>
                <option value="attendance">{lang === 'th' ? 'การเช็คชื่อ' : 'Attendance'}</option>
                <option value="file_drop">{lang === 'th' ? 'ฝากไฟล์รวม' : 'File Drop Hub'}</option>
                <option value="profile_drop">{lang === 'th' ? 'ฝากประวัติ / อัปเดตข้อมูล' : 'Profile Cards'}</option>
                <option value="emergency_unlock">{lang === 'th' ? 'ปลดล็อคฉุกเฉิน 8888' : 'Emergency 8888'}</option>
                <option value="offense_adjust">{lang === 'th' ? 'ปรับ/ล้างแต้มความผิด' : 'Offense Adjustments'}</option>
                <option value="daily_reset">{lang === 'th' ? 'รีเซตรายวัน' : 'Daily Resets'}</option>
              </select>
            </div>

            <div className="divide-y tw-border border tw-border tw-control max-h-80 overflow-y-auto">
              {tenant.logs
                .filter((l) => logFilter === 'all' || l.type === logFilter)
                .map((log) => (
                  <div key={log.id} className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="font-mono-tabular text-[var(--text-muted)] mr-2">
                        {log.dateKey} {log.timestamp}
                      </span>
                      <span className="font-medium">{log.note}</span>
                      {log.memberName && (
                        <span className="text-[var(--text-secondary)]"> · {log.memberName}</span>
                      )}
                    </div>
                    <div className="text-[var(--text-muted)] font-mono-tabular">
                      {log.actorName}
                      {log.unlockMethod ? ` (${log.unlockMethod})` : ''}
                    </div>
                  </div>
                ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
