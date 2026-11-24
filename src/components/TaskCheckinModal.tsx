import React, { useMemo, useState } from 'react';
import { Camera, Check, KeyRound, Lock, QrCode, ShieldAlert, UserCheck, X } from 'lucide-react';
import type {
  AttendanceStatus,
  DailyCheckinRecord,
  LangCode,
  Member,
  StaffUser,
  TimeTask,
  UnlockMethod,
} from '../types/system';
import { TRANSLATIONS } from '../i18n/translations';
import { generateDailyQrToken, getLocalDateKey, isButtonAllowedAt } from '../utils/timeWindow';
import { compressImageFileToDataUrl } from '../utils/imageCompression';

interface TaskCheckinModalProps {
  task: TimeTask;
  orgId: string;
  emergencyCode: string;
  staffList: StaffUser[];
  members: Member[];
  todayCheckins: DailyCheckinRecord[];
  currentUser: StaffUser | null;
  effectiveNow: Date;
  lang: LangCode;
  allowSimulation?: boolean;
  onClose: () => void;
  onRecordUnlockLog: (actorName: string, method: UnlockMethod, note: string) => void;
  onMarkAttendance: (
    taskId: string,
    member: Member,
    status: AttendanceStatus,
    actorName: string,
    unlockMethod: UnlockMethod,
    photoDataUrl?: string
  ) => void;
}

export const TaskCheckinModal: React.FC<TaskCheckinModalProps> = ({
  task,
  orgId,
  emergencyCode,
  staffList,
  members,
  todayCheckins,
  currentUser,
  effectiveNow,
  lang,
  allowSimulation = false,
  onClose,
  onRecordUnlockLog,
  onMarkAttendance,
}) => {
  const t = TRANSLATIONS[lang];
  const dateKey = getLocalDateKey(effectiveNow);
  const dailyQrCode = useMemo(
    () => generateDailyQrToken(orgId, task.id, dateKey),
    [orgId, task.id, dateKey]
  );

  // If already logged in as staff/executive AND task only requires tap/pin, allow immediate roster or require task-specific verification if QR/photo.
  const initialUnlocked = Boolean(
    currentUser && (task.authMethod === 'pin' || task.authMethod === 'tap')
  );

  const [unlocked, setUnlocked] = useState(initialUnlocked);
  const [unlockActor, setUnlockActor] = useState(currentUser?.name ?? '');
  const [usedMethod, setUsedMethod] = useState<UnlockMethod>(
    currentUser ? 'pin' : task.authMethod
  );

  // Auth input states (hidden on home page until this modal opens!)
  const [pinInput, setPinInput] = useState('');
  const [qrInput, setQrInput] = useState('');
  const [tapName, setTapName] = useState(staffList[0]?.name ?? '');
  const [emergencyInput, setEmergencyInput] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [authError, setAuthError] = useState('');
  const [showEmergencyBox, setShowEmergencyBox] = useState(false);

  const [revealedMembers, setRevealedMembers] = useState<Record<string, boolean>>({});
  const [maskNames, setMaskNames] = useState(false);
  const [filterGroup, setFilterGroup] = useState<string>('all');

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      if (!m.active) return false;
      if (task.targetGroup !== 'all' && m.group !== task.targetGroup) return false;
      if (filterGroup !== 'all' && m.group !== filterGroup) return false;
      return true;
    });
  }, [members, task.targetGroup, filterGroup]);

  const groups = useMemo(() => {
    const set = new Set(members.filter((m) => m.active).map((m) => m.group));
    return Array.from(set);
  }, [members]);

  const handlePrimaryAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (task.authMethod === 'pin') {
      const found = staffList.find((s) => s.pin === pinInput.trim());
      if (found) {
        setUnlocked(true);
        setUnlockActor(found.name);
        setUsedMethod('pin');
        onRecordUnlockLog(found.name, 'pin', `ยืนยัน PIN เปิดคำสั่ง "${task.titleTh}"`);
        return;
      }
      if (pinInput.trim() === emergencyCode) {
        triggerEmergencyUnlock();
        return;
      }
      setAuthError(lang === 'th' ? 'รหัส PIN ไม่ถูกต้อง' : 'Invalid PIN');
      return;
    }

    if (task.authMethod === 'tap') {
      if (!tapName.trim()) {
        setAuthError(lang === 'th' ? 'กรุณาเลือกหรือระบุชื่อผู้ยืนยัน' : 'Please select or enter a name');
        return;
      }
      setUnlocked(true);
      setUnlockActor(tapName);
      setUsedMethod('tap');
      onRecordUnlockLog(tapName, 'tap', `กดชื่อยืนยันเปิดคำสั่ง "${task.titleTh}"`);
      return;
    }

    if (task.authMethod === 'qr' || task.authMethod === 'daily_qr') {
      const expected =
        task.authMethod === 'daily_qr' ? dailyQrCode : task.staticQrSecret || `${orgId}-QR`;
      if (qrInput.trim().toUpperCase() === expected.toUpperCase()) {
        const actor = currentUser?.name || (lang === 'th' ? 'สแกน QR จุดตรวจ' : 'QR Checkpoint');
        setUnlocked(true);
        setUnlockActor(actor);
        setUsedMethod(task.authMethod);
        onRecordUnlockLog(actor, task.authMethod, `สแกน ${task.authMethod} เปิดคำสั่ง "${task.titleTh}"`);
        return;
      }
      setAuthError(
        allowSimulation
          ? lang === 'th'
            ? `รหัส QR ไม่ตรงกัน (โหมดทดสอบ: ${expected})`
            : `QR token mismatch (Demo expected: ${expected})`
          : lang === 'th'
          ? 'รหัส QR ไม่ถูกต้อง กรุณาสแกน QR ประจำจุดหรือขอรหัสจากผู้ดูแล'
          : 'Invalid QR token. Please scan the official checkpoint QR.'
      );
      return;
    }

    if (task.authMethod === 'photo') {
      if (!photoPreview) {
        setAuthError(lang === 'th' ? 'กรุณาถ่ายรูปหรือแนบภาพจุดเช็คอินก่อนยืนยัน' : 'Please capture or upload a check-in photo');
        return;
      }
      const actor = currentUser?.name || (lang === 'th' ? 'ภาพยืนยันจุดเช็คอิน' : 'Photo Check-in');
      setUnlocked(true);
      setUnlockActor(actor);
      setUsedMethod('photo');
      onRecordUnlockLog(actor, 'photo', `ถ่ายภาพยืนยันจุดเช็คอิน "${task.titleTh}"`);
    }
  };

  const triggerEmergencyUnlock = () => {
    const actor = lang === 'th' ? `ปลดล็อคฉุกเฉิน (${emergencyCode})` : `Emergency (${emergencyCode})`;
    setUnlocked(true);
    setUnlockActor(actor);
    setUsedMethod('emergency_8888');
    onRecordUnlockLog(
      actor,
      'emergency_8888',
      `ปลดล็อคฉุกเฉินด้วยรหัส ${emergencyCode} สำหรับคำสั่ง "${task.titleTh}"`
    );
  };

  const handleEmergencySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (emergencyInput.trim() === emergencyCode) {
      triggerEmergencyUnlock();
    } else {
      setAuthError(lang === 'th' ? 'รหัสฉุกเฉินไม่ถูกต้อง' : 'Invalid emergency code');
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImageFileToDataUrl(file);
    if (compressed) {
      setPhotoPreview(compressed);
    }
  };

  const handleSimulateCheckpointPhoto = () => {
    // Creates a clean canvas timestamp stamp image for instant testing without camera hardware
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#111111';
      ctx.fillRect(0, 0, 480, 240);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(`CHECK-IN PHOTO · ${orgId}`, 28, 76);
      ctx.font = '16px monospace';
      ctx.fillText(`${task.titleEn}`, 28, 120);
      ctx.fillText(`TIME: ${effectiveNow.toTimeString().slice(0, 8)}`, 28, 160);
      setPhotoPreview(canvas.toDataURL('image/png'));
    }
  };

  const statusButtons: Array<{ key: AttendanceStatus; label: string }> = [
    { key: 'present', label: t.statusPresent },
    { key: 'late', label: t.statusLate },
    { key: 'leave', label: t.statusLeave },
    { key: 'absent', label: t.statusAbsent },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-modal-title"
    >
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col tw-surface shadow-xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b tw-border">
          <div>
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] font-mono-tabular">
              <span>{task.startTime}–{task.endTime}</span>
              <span aria-hidden="true">·</span>
              <span>
                {task.authMethod === 'pin' && (lang === 'th' ? 'ยืนยันด้วย PIN' : 'PIN Auth')}
                {task.authMethod === 'tap' && (lang === 'th' ? 'กดชื่อยืนยัน' : 'Name Tap')}
                {task.authMethod === 'qr' && (lang === 'th' ? 'สแกน QR Code' : 'QR Code')}
                {task.authMethod === 'daily_qr' && (lang === 'th' ? 'QR เปลี่ยนรายวัน' : 'Daily Rotating QR')}
                {task.authMethod === 'photo' && (lang === 'th' ? 'ถ่ายรูปจุดเช็คอิน' : 'Photo Check-in')}
              </span>
              {unlocked && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium text-[var(--text-primary)]">{unlockActor}</span>
                </>
              )}
            </div>
            <h2 id="task-modal-title" className="text-lg font-semibold mt-0.5">
              {lang === 'th' ? task.titleTh : task.titleEn}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium tw-btn-ghost flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <X className="w-3.5 h-3.5" />
            <span>{t.close}</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {!unlocked ? (
            <div className="max-w-md mx-auto space-y-5">
              <div className="text-sm text-[var(--text-secondary)]">
                {t.verifyToOpenRoster}
              </div>

              <form onSubmit={handlePrimaryAuth} className="space-y-4">
                {task.authMethod === 'pin' && (
                  <div>
                    <label htmlFor="task-pin-input" className="block text-xs font-medium mb-1.5">
                      {lang === 'th' ? 'กรอกรหัส PIN พี่เลี้ยง/ผู้บริหาร (หรือ 8888)' : 'Enter Staff PIN (or 8888)'}
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="task-pin-input"
                        type="password"
                        value={pinInput}
                        onChange={(e) => setPinInput(e.target.value)}
                        placeholder="••••"
                        className="flex-1 px-3 py-2 text-sm tw-input font-mono-tabular"
                        autoFocus
                      />
                      <button type="submit" className="px-4 py-2 text-sm font-medium tw-btn-primary whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <KeyRound className="w-4 h-4" />
                          {lang === 'th' ? 'ยืนยันเปิดรายชื่อ' : 'Unlock Roster'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {task.authMethod === 'tap' && (
                  <div className="space-y-3">
                    <label htmlFor="task-tap-select" className="block text-xs font-medium">
                      {lang === 'th' ? 'เลือกชื่อผู้เปิดเช็คชื่อ' : 'Select staff/mentor confirming'}
                    </label>
                    <select
                      id="task-tap-select"
                      value={tapName}
                      onChange={(e) => setTapName(e.target.value)}
                      className="w-full px-3 py-2 text-sm tw-input"
                    >
                      {staffList.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name} ({s.title || s.role})
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="w-full py-2.5 text-sm font-medium tw-btn-primary inline-flex items-center justify-center gap-2">
                      <UserCheck className="w-4 h-4" />
                      <span>{lang === 'th' ? 'กดยืนยันเปิดรายชื่อทันที' : 'Confirm & Open Roster'}</span>
                    </button>
                  </div>
                )}

                {(task.authMethod === 'qr' || task.authMethod === 'daily_qr') && (
                  <div className="space-y-3">
                    {allowSimulation ? (
                      <div className="p-4 border tw-border tw-control tw-subtle flex items-center justify-between gap-4">
                        <div>
                          <div className="text-xs font-medium text-[var(--text-secondary)]">
                            {task.authMethod === 'daily_qr'
                              ? lang === 'th'
                                ? 'QR Code ประจำวันนี้ (โหมดทดสอบ/ผู้ดูแล)'
                                : 'Today Rotating QR Token (Simulation)'
                              : lang === 'th'
                              ? 'QR Code ประจำจุดคำสั่ง (โหมดทดสอบ/ผู้ดูแล)'
                              : 'Checkpoint QR Token (Simulation)'}
                          </div>
                          <div className="mt-1 font-mono-tabular text-sm font-semibold">
                            {task.authMethod === 'daily_qr'
                              ? dailyQrCode
                              : task.staticQrSecret || `${orgId}-QR`}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setQrInput(
                              task.authMethod === 'daily_qr'
                                ? dailyQrCode
                                : task.staticQrSecret || `${orgId}-QR`
                            )
                          }
                          className="px-3 py-1.5 text-xs font-medium tw-btn-ghost inline-flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <QrCode className="w-4 h-4" />
                          <span>{lang === 'th' ? 'จำลองสแกน QR' : 'Simulate Scan'}</span>
                        </button>
                      </div>
                    ) : (
                      <div className="p-3.5 border tw-border tw-control tw-subtle text-xs text-[var(--text-secondary)]">
                        {lang === 'th'
                          ? 'โหมดยืนยันจริง: กรุณาสแกนหรือกรอกรหัส QR ประจำจุด/ประจำวันที่ได้รับจากผู้ดูแล'
                          : 'Strict Check-in: Please scan or enter the official checkpoint QR token.'}
                      </div>
                    )}

                    <div>
                      <label htmlFor="task-qr-input" className="block text-xs font-medium mb-1.5">
                        {lang === 'th' ? 'รหัสจากการสแกน QR' : 'Scanned QR Payload'}
                      </label>
                      <div className="flex gap-2">
                        <input
                          id="task-qr-input"
                          type="text"
                          value={qrInput}
                          onChange={(e) => setQrInput(e.target.value)}
                          placeholder={lang === 'th' ? 'สแกนหรือกรอกรหัส QR' : 'Scan or paste QR code'}
                          className="flex-1 px-3 py-2 text-sm tw-input font-mono-tabular"
                        />
                        <button type="submit" className="px-4 py-2 text-sm font-medium tw-btn-primary whitespace-nowrap">
                          {lang === 'th' ? 'ยืนยัน QR' : 'Verify QR'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {task.authMethod === 'photo' && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <label className="px-3 py-2 text-xs font-medium tw-btn-ghost cursor-pointer inline-flex items-center gap-1.5">
                        <Camera className="w-4 h-4" />
                        <span>{lang === 'th' ? 'ถ่ายภาพ / เลือกไฟล์จุดเช็คอิน' : 'Capture / Upload Photo'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handlePhotoUpload}
                          className="hidden"
                        />
                      </label>
                      {allowSimulation && (
                        <button
                          type="button"
                          onClick={handleSimulateCheckpointPhoto}
                          className="px-3 py-2 text-xs font-medium tw-btn-ghost"
                        >
                          {lang === 'th' ? 'จำลองภาพประทับเวลาจุดตรวจ' : 'Capture Timestamp Snapshot'}
                        </button>
                      )}
                    </div>
                    {photoPreview && (
                      <img
                        src={photoPreview}
                        alt="Check-in checkpoint verification"
                        className="w-full h-36 object-cover border tw-border tw-control"
                      />
                    )}
                    <button type="submit" className="w-full py-2.5 text-sm font-medium tw-btn-primary">
                      {lang === 'th' ? 'ยืนยันภาพถ่ายและเปิดรายชื่อ' : 'Verify Photo & Open Roster'}
                    </button>
                  </div>
                )}
              </form>

              {authError && (
                <div className="text-xs font-medium px-3 py-2 border tw-border tw-subtle text-[var(--text-primary)]">
                  {authError}
                </div>
              )}

              {/* Emergency 8888 Gate */}
              <div className="pt-4 border-t tw-border">
                {!showEmergencyBox ? (
                  <button
                    type="button"
                    onClick={() => setShowEmergencyBox(true)}
                    className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline underline-offset-4 inline-flex items-center gap-1.5"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>{t.emergencyUnlockTitle}</span>
                  </button>
                ) : (
                  <form onSubmit={handleEmergencySubmit} className="space-y-2 p-3 border tw-border tw-control tw-subtle">
                    <div className="text-xs font-medium">
                      {lang === 'th'
                        ? 'ปลดล็อคฉุกเฉินหน้างาน (ไม่เปิดหลังบ้าน และบันทึก Log อัตโนมัติ)'
                        : 'On-site emergency unlock (no backend access, audit-logged)'}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={emergencyInput}
                        onChange={(e) => setEmergencyInput(e.target.value)}
                        placeholder={lang === 'th' ? 'กรอกรหัส 8888' : 'Enter 8888'}
                        className="flex-1 px-3 py-1.5 text-sm tw-input font-mono-tabular"
                        aria-label={t.emergencyCodeLabel}
                      />
                      <button type="submit" className="px-3 py-1.5 text-xs font-medium tw-btn-primary whitespace-nowrap">
                        {lang === 'th' ? 'ปลดล็อคทันที' : 'Unlock Now'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          ) : (
            /* Auto-Popup Clean Roster: 1 row = 1 member, clean status buttons with strict cutoff enforcement */
            <div className="space-y-4">
              {/* Cutoff Rule Legend & Group Filter */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b tw-border">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFilterGroup('all')}
                    className={`px-2.5 py-1 text-xs font-medium tw-control-sm ${
                      filterGroup === 'all' ? 'tw-btn-primary' : 'tw-btn-ghost'
                    }`}
                  >
                    {lang === 'th' ? `ทั้งหมด (${members.filter((m) => m.active).length})` : `All (${members.filter((m) => m.active).length})`}
                  </button>
                  {groups.map((grp) => (
                    <button
                      key={grp}
                      type="button"
                      onClick={() => setFilterGroup(grp)}
                      className={`px-2.5 py-1 text-xs font-medium tw-control-sm ${
                        filterGroup === grp ? 'tw-btn-primary' : 'tw-btn-ghost'
                      }`}
                    >
                      {grp}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setMaskNames((prev) => !prev);
                      setRevealedMembers({});
                    }}
                    className={`px-2.5 py-1 text-xs font-medium tw-control-sm ${
                      maskNames ? 'tw-btn-primary' : 'tw-btn-ghost'
                    }`}
                  >
                    {maskNames
                      ? lang === 'th'
                        ? 'แสดงชื่อทั้งหมด'
                        : 'Show All Names'
                      : lang === 'th'
                      ? 'ซ่อนชื่อ (กดปุ่มเพื่อโชว์)'
                      : 'Mask Names'}
                  </button>
                </div>

                {/* Strict Cutoff Summary */}
                <div className="text-xs text-[var(--text-muted)] font-mono-tabular flex flex-wrap gap-2">
                  {statusButtons.map((sb) => {
                    const check = isButtonAllowedAt(
                      sb.key,
                      task.buttonCutoffs,
                      task.startTime,
                      task.endTime,
                      effectiveNow
                    );
                    if (!check.cutoffTime) return null;
                    return (
                      <span key={sb.key}>
                        {sb.label} {t.cutoffUntil} {check.cutoffTime}
                        {!check.allowed ? ` (${t.cutoffLocked})` : ''}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Roster List: 1 row = 1 member */}
              <div className="divide-y tw-border border tw-border tw-control">
                {filteredMembers.map((member) => {
                  const existing = todayCheckins.find(
                    (c) => c.taskId === task.id && c.memberId === member.id
                  );
                  const isNameRevealed = !maskNames || Boolean(revealedMembers[member.id]);

                  return (
                    <div
                      key={member.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--bg-subtle)] transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-[180px]">
                        <span className="font-mono-tabular text-xs text-[var(--text-muted)] w-8">
                          {member.code}
                        </span>
                        {isNameRevealed ? (
                          <div>
                            <div className="text-sm font-medium">{member.name}</div>
                            <div className="text-xs text-[var(--text-muted)]">{member.group}</div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setRevealedMembers((prev) => ({ ...prev, [member.id]: true }))
                            }
                            className="px-2.5 py-1 text-xs font-medium tw-btn-ghost"
                          >
                            {task.showNameButtonLabel || (lang === 'th' ? 'แสดงชื่อ' : 'Show Name')}
                          </button>
                        )}
                      </div>

                      {/* Status Buttons with Strict Cutoff Lock */}
                      <div className="flex items-center gap-1.5">
                        {statusButtons.map((sb) => {
                          const check = isButtonAllowedAt(
                            sb.key,
                            task.buttonCutoffs,
                            task.startTime,
                            task.endTime,
                            effectiveNow
                          );
                          const isSelected = existing?.status === sb.key;

                          return (
                            <button
                              key={sb.key}
                              type="button"
                              disabled={!check.allowed}
                              title={
                                !check.allowed
                                  ? `${sb.label}: ${t.cutoffLocked} (${check.cutoffTime || task.endTime})`
                                  : check.cutoffTime
                                  ? `${t.cutoffUntil} ${check.cutoffTime}`
                                  : sb.label
                              }
                              onClick={() =>
                                onMarkAttendance(
                                  task.id,
                                  member,
                                  sb.key,
                                  unlockActor,
                                  usedMethod,
                                  photoPreview || undefined
                                )
                              }
                              className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 tw-control-sm inline-flex items-center gap-1 ${
                                isSelected ? 'tw-btn-primary' : 'tw-btn-ghost'
                              }`}
                            >
                              {!check.allowed ? (
                                <Lock className="w-3 h-3 opacity-60" />
                              ) : isSelected ? (
                                <Check className="w-3 h-3" />
                              ) : null}
                              <span>{sb.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
