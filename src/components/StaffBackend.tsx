import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, ClipboardList, FilePlus2, Lock, PackageCheck, Users } from 'lucide-react';
import type {
  AuthMethod,
  LangCode,
  StaffUser,
  TenantData,
  TimeTask,
} from '../types/system';
import { TRANSLATIONS } from '../i18n/translations';
import { isTaskActiveAt } from '../utils/timeWindow';

type StaffSection = 'overview' | 'members' | 'draft' | 'lostfound';

interface StaffBackendProps {
  tenant: TenantData;
  currentUser: StaffUser;
  effectiveNow: Date;
  lang: LangCode;
  onOpenTask: (task: TimeTask) => void;
  onSubmitTaskDraft: (draft: Omit<TimeTask, 'id' | 'approvalStatus' | 'enabled'>) => void;
  onResolveLostFound: (id: string) => void;
}

export const StaffBackend: React.FC<StaffBackendProps> = ({
  tenant,
  currentUser,
  effectiveNow,
  lang,
  onOpenTask,
  onSubmitTaskDraft,
  onResolveLostFound,
}) => {
  const t = TRANSLATIONS[lang];
  const isTwoTierOrg = tenant.orgAccountMode === 'org_2tier';
  const [section, setSection] = useState<StaffSection>('overview');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Draft task form state
  const [draftTitleTh, setDraftTitleTh] = useState('');
  const [draftTitleEn, setDraftTitleEn] = useState('');
  const [draftStart, setDraftStart] = useState('15:00');
  const [draftEnd, setDraftEnd] = useState('16:00');
  const [draftAuth, setDraftAuth] = useState<AuthMethod>('pin');
  const [draftPresentCutoff, setDraftPresentCutoff] = useState('15:20');
  const [draftSuccessMsg, setDraftSuccessMsg] = useState('');

  const handleDraftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftTitleTh.trim()) return;
    onSubmitTaskDraft({
      titleTh: draftTitleTh.trim(),
      titleEn: draftTitleEn.trim() || draftTitleTh.trim(),
      descriptionTh: `ร่างคำสั่งโดย ${currentUser.name}`,
      descriptionEn: `Drafted by ${currentUser.name}`,
      startTime: draftStart,
      endTime: draftEnd,
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      authMethod: draftAuth,
      buttonCutoffs: {
        present: draftPresentCutoff || undefined,
      },
      showNameButtonLabel: 'เช็คชื่อ',
      proposedBy: currentUser.name,
      targetGroup: 'all',
    });
    setDraftTitleTh('');
    setDraftTitleEn('');
    setDraftSuccessMsg(
      lang === 'th'
        ? 'ส่งร่างคำสั่งให้ผู้บริหารอนุมัติเรียบร้อยแล้ว'
        : 'Task draft submitted for executive approval.'
    );
  };

  const selectedMember = tenant.members.find((m) => m.id === selectedMemberId) ?? null;
  const filteredMembers = tenant.members.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.group.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Section Header + Back button when in subview */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b tw-border">
        <div className="flex items-center gap-3">
          {section !== 'overview' && (
            <button
              type="button"
              onClick={() => {
                setSection('overview');
                setSelectedMemberId(null);
              }}
              className="px-3 py-1.5 text-xs font-medium tw-btn-ghost inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{t.back}</span>
            </button>
          )}
          <div>
            <h1 className="text-lg font-semibold">
              {isTwoTierOrg
                ? lang === 'th'
                  ? 'พื้นที่ปฏิบัติงานพนักงาน / ทีมงาน'
                  : 'Staff & Team Workspace'
                : lang === 'th'
                ? 'พื้นที่ปฏิบัติงานพี่เลี้ยง / พนักงาน'
                : 'Mentor & Field Staff Workspace'}
            </h1>
            <p className="text-xs text-[var(--text-muted)]">
              {currentUser.name} ·{' '}
              {currentUser.title || (isTwoTierOrg ? (lang === 'th' ? 'พนักงาน / ทีมงาน' : 'Team Staff') : t.roleMentor)} ·{' '}
              {lang === 'th' ? tenant.orgNameTh : tenant.orgNameEn}
            </p>
          </div>
        </div>

        {/* Clean sub-navigation */}
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: 'overview', labelTh: 'งานหน้างานวันนี้', labelEn: 'Field Tasks', icon: ClipboardList },
              { id: 'members', labelTh: 'ข้อมูลรายบุคคล', labelEn: 'Member Profiles', icon: Users },
              { id: 'draft', labelTh: 'ร่างคำสั่งส่งอนุมัติ', labelEn: 'Draft Task', icon: FilePlus2 },
              { id: 'lostfound', labelTh: 'จัดการของหาย', labelEn: 'Lost & Found', icon: PackageCheck },
            ] as const
          ).map((nav) => {
            const Icon = nav.icon;
            const active = section === nav.id;
            return (
              <button
                key={nav.id}
                type="button"
                onClick={() => {
                  setSection(nav.id);
                  setSelectedMemberId(null);
                }}
                className={`px-3 py-1.5 text-xs font-medium tw-control-sm inline-flex items-center gap-1.5 whitespace-nowrap ${
                  active ? 'tw-btn-primary' : 'tw-btn-ghost'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{lang === 'th' ? nav.labelTh : nav.labelEn}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Overview: Active Field Tasks */}
      {section === 'overview' && (
        <section className="tw-surface p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              {lang === 'th' ? 'คำสั่งควบคุมตามช่วงเวลา (กดคำสั่งที่ถึงเวลาเพื่อเช็คชื่อ)' : 'Scheduled Time-Window Tasks'}
            </h2>
            <span className="text-xs text-[var(--text-muted)] font-mono-tabular">
              {effectiveNow.toTimeString().slice(0, 5)}
            </span>
          </div>

          <div className="space-y-2.5">
            {tenant.tasks.map((task) => {
              const active = isTaskActiveAt(task, effectiveNow);
              const countDone = tenant.todayCheckins.filter((c) => c.taskId === task.id).length;
              return (
                <div
                  key={task.id}
                  className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 border tw-control transition-colors ${
                    active
                      ? 'tw-active-task'
                      : 'border-[var(--border-hairline)] bg-[var(--bg-subtle)] opacity-65'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2 text-xs font-mono-tabular opacity-85">
                      <span>{task.startTime}–{task.endTime}</span>
                      <span>·</span>
                      <span>
                        {task.approvalStatus === 'pending'
                          ? lang === 'th'
                            ? 'รออนุมัติ'
                            : 'Pending Approval'
                          : active
                          ? t.unlockedActive
                          : t.lockedOutWindow}
                      </span>
                      <span>·</span>
                      <span>
                        {countDone}/{tenant.members.filter((m) => m.active).length}
                      </span>
                    </div>
                    <div className="text-sm font-semibold mt-0.5">
                      {lang === 'th' ? task.titleTh : task.titleEn}
                    </div>
                  </div>

                  {active ? (
                    <button
                      type="button"
                      onClick={() => onOpenTask(task)}
                      className="px-3.5 py-1.5 text-xs font-semibold bg-[var(--bg-surface)] text-[var(--text-primary)] border border-transparent tw-control-sm whitespace-nowrap"
                    >
                      {t.openTaskBtn}
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium">
                      <Lock className="w-3.5 h-3.5" />
                      <span>{t.lockedOutWindow}</span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Member Directory & Individual Profile */}
      {section === 'members' && (
        <section className="tw-surface p-5 space-y-4">
          {selectedMember ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setSelectedMemberId(null)}
                className="px-3 py-1.5 text-xs font-medium tw-btn-ghost inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{t.back}</span>
              </button>

              <div className="p-4 border tw-border tw-control flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-mono-tabular text-[var(--text-muted)]">
                    {selectedMember.code} · {selectedMember.group}
                  </div>
                  <h3 className="text-base font-semibold mt-0.5">{selectedMember.name}</h3>
                </div>
                <div className="flex flex-wrap gap-4 text-xs font-mono-tabular">
                  {!isTwoTierOrg && (
                    <div>
                      <div className="text-[var(--text-muted)]">{lang === 'th' ? 'แต้มความผิด' : 'Offense Points'}</div>
                      <div className="text-base font-semibold">{selectedMember.offensePoints}</div>
                    </div>
                  )}
                  {tenant.customUnits
                    .filter((u) => u.active)
                    .map((u) => (
                      <div key={u.id}>
                        <div className="text-[var(--text-muted)]">{lang === 'th' ? u.nameTh : u.nameEn}</div>
                        <div className="text-base font-semibold">
                          {selectedMember.customUnitScores[u.id] ?? 0} {u.unitLabel}
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold mb-2">
                  {lang === 'th' ? 'ประวัติการเช็คชื่อล่าสุด' : 'Recent Member Logs'}
                </h4>
                <div className="divide-y tw-border border tw-border tw-control">
                  {tenant.logs
                    .filter((l) => l.memberId === selectedMember.id)
                    .slice(0, 15)
                    .map((l) => (
                      <div key={l.id} className="px-3 py-2 text-xs flex justify-between gap-2">
                        <span>
                          {l.dateKey} {l.timestamp} · {l.taskTitle || l.note}
                        </span>
                        <span className="font-semibold">{l.status || l.type}</span>
                      </div>
                    ))}
                  {tenant.logs.filter((l) => l.memberId === selectedMember.id).length === 0 && (
                    <div className="px-3 py-4 text-xs text-[var(--text-muted)]">
                      {lang === 'th' ? 'ยังไม่มีประวัติในระบบ' : 'No history yet'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold">
                  {lang === 'th' ? 'รายชื่อสมาชิกทั้งหมด (ดูข้อมูลรายบุคคล)' : 'Member Directory'}
                </h2>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={lang === 'th' ? 'ค้นหาชื่อ / ทีม / รหัส...' : 'Search name, group, code...'}
                  className="px-3 py-1.5 text-xs tw-input w-64"
                />
              </div>

              <div className="divide-y tw-border border tw-border tw-control">
                {filteredMembers.map((m) => (
                  <div
                    key={m.id}
                    className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-[var(--bg-subtle)]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono-tabular text-xs text-[var(--text-muted)] w-8">{m.code}</span>
                      <div>
                        <div className="text-sm font-medium">{m.name}</div>
                        <div className="text-xs text-[var(--text-muted)]">{m.group}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {!isTwoTierOrg && (
                        <span className="text-xs font-mono-tabular text-[var(--text-secondary)]">
                          {lang === 'th' ? `ความผิด: ${m.offensePoints}` : `Offense: ${m.offensePoints}`}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedMemberId(m.id)}
                        className="px-3 py-1 text-xs font-medium tw-btn-ghost"
                      >
                        {lang === 'th' ? 'ดูข้อมูล' : 'View'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Draft Task Proposal */}
      {section === 'draft' && (
        <section className="tw-surface p-5 max-w-xl">
          <h2 className="text-sm font-semibold mb-3">
            {lang === 'th' ? 'ร่างคำสั่งใหม่ส่งให้ผู้บริหารอนุมัติ' : 'Draft New Task for Executive Approval'}
          </h2>
          <form onSubmit={handleDraftSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1">
                {lang === 'th' ? 'ชื่อคำสั่ง (ภาษาไทย)' : 'Task Title (Thai)'}
              </label>
              <input
                type="text"
                required
                value={draftTitleTh}
                onChange={(e) => setDraftTitleTh(e.target.value)}
                placeholder={lang === 'th' ? 'เช่น ซ้อมดนตรี / ตรวจห้องนอน' : 'e.g. Music Practice'}
                className="w-full px-3 py-2 text-sm tw-input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                {lang === 'th' ? 'ชื่อคำสั่ง (English)' : 'Task Title (English)'}
              </label>
              <input
                type="text"
                value={draftTitleEn}
                onChange={(e) => setDraftTitleEn(e.target.value)}
                placeholder="Music Practice"
                className="w-full px-3 py-2 text-sm tw-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">
                  {lang === 'th' ? 'เวลาเริ่ม' : 'Start Time'}
                </label>
                <input
                  type="time"
                  value={draftStart}
                  onChange={(e) => setDraftStart(e.target.value)}
                  className="w-full px-3 py-2 text-sm tw-input font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">
                  {lang === 'th' ? 'เวลาสิ้นสุด' : 'End Time'}
                </label>
                <input
                  type="time"
                  value={draftEnd}
                  onChange={(e) => setDraftEnd(e.target.value)}
                  className="w-full px-3 py-2 text-sm tw-input font-mono-tabular"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">
                  {lang === 'th' ? 'วิธียืนยันตัวตน' : 'Verification Method'}
                </label>
                <select
                  value={draftAuth}
                  onChange={(e) => setDraftAuth(e.target.value as AuthMethod)}
                  className="w-full px-3 py-2 text-sm tw-input"
                >
                  <option value="pin">{lang === 'th' ? 'กรอก PIN' : 'PIN'}</option>
                  <option value="tap">{lang === 'th' ? 'กดชื่อยืนยัน' : 'Name Tap'}</option>
                  <option value="qr">QR Code</option>
                  <option value="daily_qr">{lang === 'th' ? 'QR เปลี่ยนรายวัน' : 'Daily Rotating QR'}</option>
                  <option value="photo">{lang === 'th' ? 'ถ่ายภาพจุดเช็คอิน' : 'Photo Check-in'}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">
                  {lang === 'th' ? 'เส้นตายปุ่ม "มา"' : '"Present" Cutoff'}
                </label>
                <input
                  type="time"
                  value={draftPresentCutoff}
                  onChange={(e) => setDraftPresentCutoff(e.target.value)}
                  className="w-full px-3 py-2 text-sm tw-input font-mono-tabular"
                />
              </div>
            </div>
            <button type="submit" className="px-4 py-2 text-xs font-medium tw-btn-primary">
              {lang === 'th' ? 'ส่งร่างคำสั่งให้ผู้บริหารอนุมัติ' : 'Submit Draft for Approval'}
            </button>
            {draftSuccessMsg && <div className="text-xs font-medium">{draftSuccessMsg}</div>}
          </form>
        </section>
      )}

      {/* Lost & Found Management (Backend-only Close Case) */}
      {section === 'lostfound' && (
        <section className="tw-surface p-5 space-y-3">
          <h2 className="text-sm font-semibold">
            {lang === 'th' ? 'จัดการเคสของหาย / เก็บของได้ (สิทธิ์ปิดเคสเฉพาะหลังบ้าน)' : 'Resolve Lost & Found Cases'}
          </h2>
          <div className="divide-y tw-border border tw-border tw-control">
            {tenant.lostFound.map((item) => (
              <div key={item.id} className="p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-[var(--text-muted)] font-mono-tabular">
                    {item.type === 'lost' ? t.lostTypeLost : t.lostTypeFound} · {item.createdAt} · {item.location}
                  </div>
                  <div className="text-sm font-medium">{item.itemName}</div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    {item.reporterName} · {item.contactNote}
                  </div>
                </div>
                {item.status === 'open' ? (
                  <button
                    type="button"
                    onClick={() => onResolveLostFound(item.id)}
                    className="px-3 py-1.5 text-xs font-medium tw-btn-primary inline-flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{lang === 'th' ? 'ปิดเคส / พบเจ้าของแล้ว' : 'Close Case / Returned'}</span>
                  </button>
                ) : (
                  <span className="text-xs font-medium text-[var(--text-muted)]">
                    {t.caseResolved} ({item.resolvedBy})
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
