import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Briefcase,
  Camera,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileBadge2,
  Lock,
  Plus,
  Send,
  Settings2,
  ShieldCheck,
  Trash2,
  UserCheck,
} from 'lucide-react';
import type {
  LangCode,
  ProfileCardFieldConfig,
  ProfileCardKind,
  ProfileCardSubmission,
  ProfileDropHubConfig,
  TenantData,
} from '../types/system';
import { compressImageFileToDataUrl } from '../utils/imageCompression';
import {
  generatePrintableProfileHtml,
  getFormalMonogram,
  getProfileKindLabel,
  PRESET_AVAILABILITY_TH,
  PRESET_SKILL_TAGS_TH,
} from '../utils/profileCard';
import {
  exportProfileSubmissionsCsv,
  formatProfileSummaryForLine,
  getItemRemainingDays,
} from '../utils/retention';
import { OrgBusinessCard } from './OrgBusinessCard';

interface ProfileDropHubViewProps {
  tenant: TenantData;
  profileHub: ProfileDropHubConfig;
  lang: LangCode;
  effectiveNow: Date;
  onBackDashboard: () => void;
  onSubmitProfile: (
    submission: Omit<ProfileCardSubmission, 'id' | 'createdAt' | 'syncedToCentral'>
  ) => void;
  onUpdateProfileSettings: (payload: {
    requirePasscode: boolean;
    passcode: string;
    fields: ProfileCardFieldConfig;
  }) => void;
  onClearProfileSubmissions: () => void;
}

export const ProfileDropHubView: React.FC<ProfileDropHubViewProps> = ({
  tenant,
  profileHub,
  lang,
  effectiveNow,
  onBackDashboard,
  onSubmitProfile,
  onUpdateProfileSettings,
  onClearProfileSubmissions,
}) => {
  const [activeTab, setActiveTab] = useState<'form' | 'inbox'>('form');

  // Form state for "ฝากประวัติ / อัปเดตข้อมูลส่วนตัว"
  const [kind, setKind] = useState<ProfileCardKind>('job_apply');
  const [fullName, setFullName] = useState('');
  const [targetRoleOrGroup, setTargetRoleOrGroup] = useState('');
  const [phoneOrContact, setPhoneOrContact] = useState('');
  const [email, setEmail] = useState('');
  const [headlineOrSummary, setHeadlineOrSummary] = useState('');
  const [educationOrAffiliation, setEducationOrAffiliation] = useState('');
  const [experienceOrNote, setExperienceOrNote] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [customSkillInput, setCustomSkillInput] = useState('');
  const [availability, setAvailability] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string>('');
  const [enteredPasscode, setEnteredPasscode] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Instant Submission Receipt Slip ("ใบยืนยันการฝากถึงผู้บริหาร")
  const [receiptSlip, setReceiptSlip] = useState<{
    refCode: string;
    fullName: string;
    kind: ProfileCardKind;
    timestamp: string;
    snapshot: Omit<ProfileCardSubmission, 'id' | 'createdAt' | 'syncedToCentral'>;
  } | null>(null);

  // Admin / Settings state
  const [requirePasscodeDraft, setRequirePasscodeDraft] = useState(profileHub.requirePasscode);
  const [passcodeDraft, setPasscodeDraft] = useState(profileHub.passcode);
  const [fieldsDraft, setFieldsDraft] = useState<ProfileCardFieldConfig>(profileHub.fields);
  const [adminMsg, setAdminMsg] = useState('');
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const fields = profileHub.fields;

  const toggleSkill = (skill: string) => {
    setSkills((prev) =>
      prev.includes(skill) ? prev.filter((item) => item !== skill) : [...prev, skill]
    );
  };

  const handleAddCustomSkill = () => {
    const clean = customSkillInput.trim();
    if (!clean) return;
    if (!skills.includes(clean)) {
      setSkills((prev) => [...prev, clean]);
    }
    setCustomSkillInput('');
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImageFileToDataUrl(file);
    if (compressed) {
      setPhotoDataUrl(compressed);
    }
  };

  const downloadHtmlCard = (
    sub: Omit<ProfileCardSubmission, 'id' | 'createdAt' | 'syncedToCentral'> & {
      createdAt?: string;
    }
  ) => {
    const html = generatePrintableProfileHtml(sub, tenant.orgNameTh, tenant.orgId);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ProfileCard_${(sub.fullName || 'Applicant').replace(/\s+/g, '_')}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (profileHub.requirePasscode) {
      if (enteredPasscode.trim() !== profileHub.passcode.trim()) {
        setFormError(
          lang === 'th'
            ? 'รหัสกลางไม่ถูกต้อง กรุณาตรวจสอบรหัสจากผู้บริหาร/หน่วยงาน'
            : 'Incorrect passcode. Please verify with the organization host.'
        );
        return;
      }
    }

    if (!fullName.trim() || !targetRoleOrGroup.trim() || !phoneOrContact.trim()) {
      setFormError(
        lang === 'th'
          ? 'กรุณากรอกชื่อ-นามสกุลจริง ตำแหน่ง/ฝ่าย และช่องทางติดต่อกลับให้ครบถ้วน'
          : 'Please complete Full Name, Role/Department, and Contact Info.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Omit<ProfileCardSubmission, 'id' | 'createdAt' | 'syncedToCentral'> = {
        kind,
        fullName: fullName.trim(),
        phoneOrContact: phoneOrContact.trim(),
        email: email.trim() || undefined,
        targetRoleOrGroup: targetRoleOrGroup.trim(),
        headlineOrSummary: headlineOrSummary.trim(),
        educationOrAffiliation: educationOrAffiliation.trim() || undefined,
        experienceOrNote: experienceOrNote.trim() || undefined,
        skills,
        availability: availability.trim() || undefined,
        emergencyContact: emergencyContact.trim() || undefined,
        photoDataUrl: photoDataUrl || undefined,
      };

      onSubmitProfile(payload);
      const nowStamp = `${effectiveNow.toISOString().slice(0, 10)} ${effectiveNow
        .toTimeString()
        .slice(0, 5)}`;
      setReceiptSlip({
        refCode: `PF-${Date.now().toString().slice(-6)}`,
        fullName: payload.fullName,
        kind: payload.kind,
        timestamp: nowStamp,
        snapshot: payload,
      });

      // Reset form cleanly for next applicant and reveal receipt slip at top
      setFullName('');
      setTargetRoleOrGroup('');
      setPhoneOrContact('');
      setEmail('');
      setHeadlineOrSummary('');
      setEducationOrAffiliation('');
      setExperienceOrNote('');
      setSkills([]);
      setAvailability('');
      setEmergencyContact('');
      setPhotoDataUrl('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const liveDraftSnapshot = useMemo(
    () => ({
      kind,
      fullName: fullName.trim() || (lang === 'th' ? 'ชื่อ-นามสกุล ผู้ฝากประวัติ' : 'Applicant Full Name'),
      phoneOrContact: phoneOrContact.trim() || (lang === 'th' ? '08X-XXX-XXXX / LINE ID' : 'Phone / Contact'),
      email: email.trim() || undefined,
      targetRoleOrGroup:
        targetRoleOrGroup.trim() ||
        (kind === 'job_apply'
          ? lang === 'th'
            ? 'ตำแหน่งที่สนใจ / สายงาน'
            : 'Target Position / Role'
          : lang === 'th'
          ? 'แผนก / ห้องเรียน / กลุ่มงาน'
          : 'Department / Class / Team'),
      headlineOrSummary:
        headlineOrSummary.trim() ||
        (kind === 'job_apply'
          ? lang === 'th'
            ? 'สรุปจุดเด่น ความตั้งใจ หรือประสบการณ์โดยย่อ...'
            : 'Brief professional summary...'
          : lang === 'th'
          ? 'ระบุรายละเอียดข้อมูลที่ต้องการอัปเดตให้ผู้บริหารรับทราบ...'
          : 'Specify details to update...'),
      educationOrAffiliation: educationOrAffiliation.trim() || undefined,
      experienceOrNote: experienceOrNote.trim() || undefined,
      skills,
      availability: availability.trim() || undefined,
      emergencyContact: emergencyContact.trim() || undefined,
      photoDataUrl: photoDataUrl || undefined,
    }),
    [
      kind,
      fullName,
      phoneOrContact,
      email,
      targetRoleOrGroup,
      headlineOrSummary,
      educationOrAffiliation,
      experienceOrNote,
      skills,
      availability,
      emergencyContact,
      photoDataUrl,
      lang,
    ]
  );

  return (
    <div className="max-w-[1040px] mx-auto px-4 sm:px-6 pt-8 pb-24 space-y-6">
      {/* Header Card */}
      <section className="tw-surface p-6 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <span>{tenant.orgId}</span>
              <span aria-hidden="true">·</span>
              <span>{lang === 'th' ? tenant.orgNameTh : tenant.orgNameEn}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular">
                {lang === 'th'
                  ? `ส่งแล้ว ${profileHub.submissions.length} รายการ`
                  : `${profileHub.submissions.length} profiles`}
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              {lang === 'th'
                ? 'ฝากประวัติ / อัปเดตข้อมูลส่วนบุคคล (ส่งผู้บริหาร)'
                : 'Submit Profile Card / Update Personal Info'}
            </h1>

            <p className="text-xs text-[var(--text-secondary)]">
              {lang === 'th'
                ? 'กรอกข้อมูลลงแบบฟอร์มมาตรฐานขององค์กร จัดหน้าเป็นการ์ดประวัติอัตโนมัติโดยไม่ต้องแต่งไฟล์เอง แล้วส่งถึงผู้บริหารได้ทันที'
                : 'Fill a clean standardized profile card without external design tools and send directly to leadership.'}
            </p>
          </div>

          <button
            type="button"
            onClick={onBackDashboard}
            className="px-3.5 py-2 text-xs font-medium tw-btn-ghost inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{lang === 'th' ? 'กลับหน้าหลักองค์กร' : 'Back to Org Home'}</span>
          </button>
        </div>

        {/* Calm Rolling 14-Day Privacy Banner */}
        <div className="px-3.5 py-2.5 tw-subtle border tw-border tw-control-sm flex items-start gap-2 text-xs text-[var(--text-secondary)]">
          <ShieldCheck className="w-4 h-4 text-[var(--text-primary)] shrink-0 mt-0.5" />
          <span>
            {lang === 'th'
              ? 'เว็บไม่เก็บข้อมูลส่วนตัวถาวร · ข้อมูลแต่ละใบจะอยู่ในระบบองค์กร 14 วันนับจากวันที่ส่ง และลบเฉพาะใบที่เก่าเกิน 14 วันอัตโนมัติ (หรือส่งเข้า Google Drive/Sheets ขององค์กรโดยตรง)'
              : 'Zero permanent personal data retention · Each card remains for 14 days from submission and expires individually, or syncs directly to the organization Drive/Sheets.'}
          </span>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t tw-border">
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={`px-4 py-2 text-xs font-semibold tw-control-sm inline-flex items-center gap-1.5 ${
              activeTab === 'form' ? 'tw-btn-primary' : 'tw-btn-ghost'
            }`}
          >
            <FileBadge2 className="w-3.5 h-3.5" />
            <span>{lang === 'th' ? 'กรอกการ์ดฝากประวัติ / อัปเดตข้อมูล' : 'Fill Profile Card'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('inbox')}
            className={`px-4 py-2 text-xs font-semibold tw-control-sm inline-flex items-center gap-1.5 ${
              activeTab === 'inbox' ? 'tw-btn-primary' : 'tw-btn-ghost'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>
              {lang === 'th'
                ? `รายการที่ส่งถึงผู้บริหาร (${profileHub.submissions.length}) & นามบัตร QR`
                : `Executive Inbox (${profileHub.submissions.length}) & Business Card`}
            </span>
          </button>
        </div>
      </section>

      {activeTab === 'form' && (
        <div className="space-y-6">
          {/* Instant Submission Slip ("ใบยืนยันการส่งถึงผู้บริหาร") */}
          {receiptSlip && (
            <section className="tw-surface p-5 border-2 border-[var(--accent-bg)] space-y-3 shadow-xs">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 tw-btn-primary flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-sm font-bold">
                      {lang === 'th'
                        ? 'ใบยืนยันการส่งข้อมูลถึงผู้บริหารเรียบร้อยแล้ว'
                        : 'Profile Submitted to Organization Successfully'}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      {lang === 'th'
                        ? `เลขอ้างอิง: ${receiptSlip.refCode} · ผู้ส่ง: ${receiptSlip.fullName} · องค์กร: ${tenant.orgNameTh} (${tenant.orgId}) · เวลา: ${receiptSlip.timestamp}`
                        : `Ref: ${receiptSlip.refCode} · Sender: ${receiptSlip.fullName} · Org: ${tenant.orgNameTh} (${tenant.orgId}) · ${receiptSlip.timestamp}`}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {lang === 'th'
                        ? 'ท่านสามารถบันทึกภาพหน้าจอนี้ หรือดาวน์โหลดการ์ดประวัติเก็บไว้เป็นหลักฐานได้ (ระบบดูแลรายการนี้ 14 วัน)'
                        : 'You may capture this slip or download your formatted profile card for your records.'}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => downloadHtmlCard(receiptSlip.snapshot)}
                    className="px-3 py-1.5 text-xs font-semibold tw-btn-soft inline-flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{lang === 'th' ? 'ดาวน์โหลดการ์ดที่ส่ง (.html)' : 'Download Card (.html)'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceiptSlip(null)}
                    className="px-3 py-1.5 text-xs font-medium tw-btn-ghost"
                  >
                    {lang === 'th' ? 'ปิดใบยืนยัน' : 'Dismiss'}
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Two-Column Builder: Formal Form (Left) + Live Dignified Profile Card Preview (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Form */}
            <form onSubmit={handleSubmitForm} className="lg:col-span-7 tw-surface p-6 space-y-4 shadow-xs">
              {/* Purpose Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setKind('job_apply')}
                  className={`p-3 text-left border tw-control flex items-start gap-2.5 transition-colors ${
                    kind === 'job_apply'
                      ? 'tw-active-task'
                      : 'tw-border bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)]'
                  }`}
                >
                  <Briefcase className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold">
                      {lang === 'th' ? '1. ฝากประวัติสมัครงาน / แนะนำตัว' : '1. Job Application / Profile'}
                    </div>
                    <div className="text-[11px] opacity-80">
                      {lang === 'th' ? 'สำหรับผู้ติดต่อ / ผู้สมัครงานใหม่' : 'For applicants & visitors'}
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setKind('member_update')}
                  className={`p-3 text-left border tw-control flex items-start gap-2.5 transition-colors ${
                    kind === 'member_update'
                      ? 'tw-active-task'
                      : 'tw-border bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)]'
                  }`}
                >
                  <UserCheck className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold">
                      {lang === 'th' ? '2. นักเรียน / พนักงาน อัปเดตข้อมูล' : '2. Staff / Student Info Update'}
                    </div>
                    <div className="text-[11px] opacity-80">
                      {lang === 'th' ? 'แจ้งเปลี่ยนเบอร์ ที่อยู่ ผู้ติดต่อฉุกเฉิน' : 'Update contact or records'}
                    </div>
                  </div>
                </button>
              </div>

              {profileHub.requirePasscode && (
                <div className="space-y-1">
                  <label htmlFor="profile-passcode-input" className="block text-xs font-semibold">
                    {lang === 'th' ? 'รหัสกลางสำหรับส่งข้อมูล *' : 'Organization Passcode *'}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="profile-passcode-input"
                      type="text"
                      required
                      value={enteredPasscode}
                      onChange={(e) => setEnteredPasscode(e.target.value)}
                      placeholder={lang === 'th' ? 'กรอกรหัสกลางที่ได้รับจากองค์กร' : 'Enter passcode'}
                      className="w-full pl-10 pr-3.5 py-2 text-sm tw-input font-mono-tabular"
                    />
                  </div>
                </div>
              )}

              {/* Photo Upload (Optional, Auto-compressed) */}
              {fields.showPhoto && (
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 tw-subtle border tw-border tw-control-sm">
                  <div className="flex items-center gap-3">
                    {photoDataUrl ? (
                      <img
                        src={photoDataUrl}
                        alt="Profile Preview"
                        className="w-12 h-14 object-cover border tw-border tw-control-sm"
                      />
                    ) : (
                      <div className="w-12 h-14 border tw-border tw-control-sm bg-[var(--bg-surface)] flex items-center justify-center text-xs font-bold text-[var(--text-muted)]">
                        {getFormalMonogram(fullName)}
                      </div>
                    )}
                    <div>
                      <div className="text-xs font-semibold">
                        {lang === 'th' ? 'รูปถ่ายหน้าตรง / รูปโปรไฟล์ (ไม่บังคับ)' : 'Formal Photo (Optional)'}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        {lang === 'th' ? 'ระบบย่อขนาดภาพอัตโนมัติเพื่อความรวดเร็ว' : 'Auto-compressed for fast upload'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="px-3 py-1.5 text-xs font-medium tw-btn-ghost cursor-pointer inline-flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5" />
                      <span>{lang === 'th' ? 'เลือกรูปภาพ' : 'Choose Photo'}</span>
                      <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                    </label>
                    {photoDataUrl && (
                      <button
                        type="button"
                        onClick={() => setPhotoDataUrl('')}
                        className="p-1.5 tw-btn-ghost"
                        aria-label="Remove photo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Formal Identity Fields (Zero informal nickname fields) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="profile-fullname" className="block text-xs font-semibold">
                    {lang === 'th' ? 'ชื่อ-นามสกุลจริง *' : 'Full Name *'}
                  </label>
                  <input
                    id="profile-fullname"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={lang === 'th' ? 'ระบุคำนำหน้า ชื่อ และนามสกุล' : 'e.g. Somchai Jaidee'}
                    className="w-full px-3.5 py-2 text-sm tw-input"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="profile-role" className="block text-xs font-semibold">
                    {kind === 'job_apply'
                      ? lang === 'th'
                        ? 'ตำแหน่งที่สมัคร / สายงาน *'
                        : 'Position Applied *'
                      : lang === 'th'
                      ? 'แผนก / ชั้นเรียน / ทีม *'
                      : 'Department / Class / Team *'}
                  </label>
                  <input
                    id="profile-role"
                    type="text"
                    required
                    value={targetRoleOrGroup}
                    onChange={(e) => setTargetRoleOrGroup(e.target.value)}
                    placeholder={
                      kind === 'job_apply'
                        ? lang === 'th'
                          ? 'เช่น เจ้าหน้าที่ประสานงาน / พนักงานหน้าร้าน'
                          : 'e.g. Coordinator / Front Staff'
                        : lang === 'th'
                        ? 'เช่น ฝ่ายบัญชี / นักเรียนชั้น ป.5'
                        : 'e.g. Accounting / Grade 5'
                    }
                    className="w-full px-3.5 py-2 text-sm tw-input"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="profile-contact" className="block text-xs font-semibold">
                    {lang === 'th' ? 'เบอร์โทรศัพท์ / ช่องทางติดต่อกลับ *' : 'Phone / Contact *'}
                  </label>
                  <input
                    id="profile-contact"
                    type="text"
                    required
                    value={phoneOrContact}
                    onChange={(e) => setPhoneOrContact(e.target.value)}
                    placeholder={lang === 'th' ? 'เช่น 081-234-5678 / LINE ID' : 'e.g. +66 81-234-5678'}
                    className="w-full px-3.5 py-2 text-sm tw-input"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="profile-email" className="block text-xs font-medium">
                    {lang === 'th' ? 'อีเมล (ถ้ามี)' : 'Email (Optional)'}
                  </label>
                  <input
                    id="profile-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full px-3.5 py-2 text-sm tw-input"
                  />
                </div>
              </div>

              {/* Headline / Summary */}
              <div className="space-y-1">
                <label htmlFor="profile-summary" className="block text-xs font-semibold">
                  {kind === 'job_apply'
                    ? lang === 'th'
                      ? 'สรุปประวัติย่อ / จุดเด่นของคุณ'
                      : 'Brief Summary / Strengths'
                    : lang === 'th'
                    ? 'รายละเอียดข้อมูลที่ต้องการแจ้งปรับปรุง'
                    : 'Details of Information Update'}
                </label>
                <textarea
                  id="profile-summary"
                  rows={2}
                  value={headlineOrSummary}
                  onChange={(e) => setHeadlineOrSummary(e.target.value)}
                  placeholder={
                    kind === 'job_apply'
                      ? lang === 'th'
                        ? 'เช่น มีความรับผิดชอบ ตรงต่อเวลา ถนัดงานประสานงานและดูแลเอกสาร...'
                        : 'Summarize your key strengths and background...'
                      : lang === 'th'
                      ? 'เช่น ขออัปเดตเบอร์โทรศัพท์ใหม่ ที่อยู่ปัจจุบัน หรือข้อมูลผู้ติดต่อฉุกเฉิน...'
                      : 'Specify updated address, phone, or notes...'
                  }
                  className="w-full px-3.5 py-2 text-sm tw-input"
                />
              </div>

              {fields.showEducation && (
                <div className="space-y-1">
                  <label htmlFor="profile-education" className="block text-xs font-medium">
                    {lang === 'th' ? 'วุฒิการศึกษา / สถานศึกษา / สังกัดเดิม' : 'Education / Affiliation'}
                  </label>
                  <input
                    id="profile-education"
                    type="text"
                    value={educationOrAffiliation}
                    onChange={(e) => setEducationOrAffiliation(e.target.value)}
                    placeholder={lang === 'th' ? 'เช่น ปริญญาตรี บริหารธุรกิจ / โรงเรียน...' : 'e.g. B.B.A. / School'}
                    className="w-full px-3.5 py-2 text-sm tw-input"
                  />
                </div>
              )}

              {fields.showExperience && (
                <div className="space-y-1">
                  <label htmlFor="profile-experience" className="block text-xs font-medium">
                    {lang === 'th' ? 'ประสบการณ์ทำงาน / ผลงาน / หมายเหตุเพิ่มเติม' : 'Experience / Notes'}
                  </label>
                  <textarea
                    id="profile-experience"
                    rows={2}
                    value={experienceOrNote}
                    onChange={(e) => setExperienceOrNote(e.target.value)}
                    placeholder={
                      lang === 'th'
                        ? 'ระบุประสบการณ์ที่เกี่ยวข้องหรือข้อมูลเพิ่มเติมสำหรับผู้บริหาร...'
                        : 'Relevant work history or additional notes...'
                    }
                    className="w-full px-3.5 py-2 text-sm tw-input"
                  />
                </div>
              )}

              {/* Quick-tap Skills */}
              {fields.showSkills && (
                <div className="space-y-2">
                  <div className="text-xs font-medium">
                    {lang === 'th' ? 'ทักษะและความสามารถ (แตะเลือกหรือพิมพ์เพิ่มเอง)' : 'Skills & Capabilities'}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_SKILL_TAGS_TH.map((tag) => {
                      const active = skills.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleSkill(tag)}
                          className={`px-2.5 py-1 text-xs border tw-control-sm transition-colors ${
                            active ? 'tw-active-task font-medium' : 'tw-border tw-btn-ghost'
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customSkillInput}
                      onChange={(e) => setCustomSkillInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomSkill();
                        }
                      }}
                      placeholder={lang === 'th' ? 'เพิ่มทักษะอื่นด้วยตนเอง...' : 'Add custom skill...'}
                      className="flex-1 px-3 py-1.5 text-xs tw-input"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomSkill}
                      className="px-3 py-1.5 text-xs font-medium tw-btn-ghost inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{lang === 'th' ? 'เพิ่ม' : 'Add'}</span>
                    </button>
                  </div>
                </div>
              )}

              {fields.showAvailability && (
                <div className="space-y-1.5">
                  <label htmlFor="profile-availability" className="block text-xs font-medium">
                    {lang === 'th' ? 'ความพร้อม / ช่วงเวลาที่สะดวก' : 'Availability'}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_AVAILABILITY_TH.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setAvailability(slot)}
                        className={`px-2.5 py-1 text-[11px] border tw-control-sm ${
                          availability === slot ? 'tw-btn-soft font-medium' : 'tw-border tw-btn-ghost'
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                  <input
                    id="profile-availability"
                    type="text"
                    value={availability}
                    onChange={(e) => setAvailability(e.target.value)}
                    placeholder={lang === 'th' ? 'ระบุช่วงเวลาที่สะดวกหรือวันที่เริ่มงานได้' : 'Availability details'}
                    className="w-full px-3.5 py-2 text-sm tw-input"
                  />
                </div>
              )}

              {fields.showEmergencyContact && (
                <div className="space-y-1">
                  <label htmlFor="profile-emergency" className="block text-xs font-medium">
                    {lang === 'th' ? 'ผู้ติดต่อกรณีฉุกเฉิน (ชื่อและความสัมพันธ์ / เบอร์โทร)' : 'Emergency Contact'}
                  </label>
                  <input
                    id="profile-emergency"
                    type="text"
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    placeholder={lang === 'th' ? 'เช่น คุณแม่สมศรี 089-XXX-XXXX' : 'Name & phone'}
                    className="w-full px-3.5 py-2 text-sm tw-input"
                  />
                </div>
              )}

              {formError && (
                <div role="alert" className="px-3.5 py-2 text-xs font-medium border tw-border tw-subtle">
                  {formError}
                </div>
              )}

              <div className="pt-2 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 text-xs font-semibold tw-btn-primary inline-flex items-center gap-2 disabled:opacity-60"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {isSubmitting
                      ? lang === 'th'
                        ? 'กำลังจัดทำการ์ดและส่ง...'
                        : 'Submitting...'
                      : lang === 'th'
                      ? 'ส่งการ์ดประวัติให้ผู้บริหาร'
                      : 'Submit Profile Card'}
                  </span>
                </button>
              </div>
            </form>

            {/* Right Column: Real-Time Dignified Profile Card Preview */}
            <aside className="lg:col-span-5 space-y-3 lg:sticky lg:top-6">
              <div className="tw-surface p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between gap-2 pb-3 border-b tw-border">
                  <div className="text-xs font-semibold text-[var(--text-muted)]">
                    {lang === 'th'
                      ? 'ตัวอย่างการ์ดประวัติสำเร็จรูป (จัดหน้าอัตโนมัติ)'
                      : 'Live Formatted Profile Card Preview'}
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadHtmlCard(liveDraftSnapshot)}
                    className="px-2.5 py-1 text-xs font-medium tw-btn-ghost inline-flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{lang === 'th' ? 'บันทึกการ์ด / พิมพ์ PDF' : 'Save / Print'}</span>
                  </button>
                </div>

                {/* Dignified Card Canvas */}
                <div className="p-5 border tw-border tw-control bg-[var(--bg-surface)] space-y-4">
                  <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] pb-2 border-b tw-border">
                    <span className="font-semibold text-[var(--text-secondary)]">
                      {getProfileKindLabel(liveDraftSnapshot.kind, lang)}
                    </span>
                    <span className="font-mono-tabular">
                      {tenant.orgNameTh} ({tenant.orgId})
                    </span>
                  </div>

                  <div className="flex items-start gap-4">
                    {liveDraftSnapshot.photoDataUrl ? (
                      <img
                        src={liveDraftSnapshot.photoDataUrl}
                        alt={liveDraftSnapshot.fullName}
                        className="w-16 h-20 object-cover border tw-border tw-control-sm shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-20 border tw-border tw-control-sm tw-subtle flex items-center justify-center text-base font-bold text-[var(--text-secondary)] shrink-0">
                        {getFormalMonogram(fullName)}
                      </div>
                    )}

                    <div className="min-w-0 space-y-1">
                      <div className="text-base font-bold leading-snug break-words">
                        {liveDraftSnapshot.fullName}
                      </div>
                      <div className="text-xs font-semibold text-[var(--text-secondary)]">
                        {liveDraftSnapshot.targetRoleOrGroup}
                      </div>
                      <div className="text-xs text-[var(--text-muted)] space-y-0.5 pt-1">
                        <div>{liveDraftSnapshot.phoneOrContact}</div>
                        {liveDraftSnapshot.email && <div>{liveDraftSnapshot.email}</div>}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t tw-border space-y-1">
                    <div className="text-[11px] font-semibold text-[var(--text-muted)]">
                      {lang === 'th' ? 'สรุปประวัติ / ข้อมูลที่แจ้ง' : 'Summary'}
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
                      {liveDraftSnapshot.headlineOrSummary}
                    </p>
                  </div>

                  {liveDraftSnapshot.educationOrAffiliation && (
                    <div className="pt-2 border-t tw-border space-y-0.5">
                      <div className="text-[11px] font-semibold text-[var(--text-muted)]">
                        {lang === 'th' ? 'การศึกษา / สังกัด' : 'Education / Affiliation'}
                      </div>
                      <div className="text-xs text-[var(--text-secondary)]">
                        {liveDraftSnapshot.educationOrAffiliation}
                      </div>
                    </div>
                  )}

                  {liveDraftSnapshot.experienceOrNote && (
                    <div className="pt-2 border-t tw-border space-y-0.5">
                      <div className="text-[11px] font-semibold text-[var(--text-muted)]">
                        {lang === 'th' ? 'ประสบการณ์ / หมายเหตุ' : 'Experience / Notes'}
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap">
                        {liveDraftSnapshot.experienceOrNote}
                      </div>
                    </div>
                  )}

                  {liveDraftSnapshot.skills.length > 0 && (
                    <div className="pt-2 border-t tw-border space-y-1.5">
                      <div className="text-[11px] font-semibold text-[var(--text-muted)]">
                        {lang === 'th' ? 'ทักษะและความสามารถ' : 'Skills'}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {liveDraftSnapshot.skills.map((skill) => (
                          <span
                            key={skill}
                            className="px-2 py-0.5 text-[11px] tw-subtle border tw-border tw-control-sm"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {(liveDraftSnapshot.availability || liveDraftSnapshot.emergencyContact) && (
                    <div className="pt-2 border-t tw-border text-xs text-[var(--text-secondary)] space-y-1">
                      {liveDraftSnapshot.availability && (
                        <div>
                          <span className="font-semibold text-[var(--text-muted)]">
                            {lang === 'th' ? 'ความพร้อม: ' : 'Availability: '}
                          </span>
                          {liveDraftSnapshot.availability}
                        </div>
                      )}
                      {liveDraftSnapshot.emergencyContact && (
                        <div>
                          <span className="font-semibold text-[var(--text-muted)]">
                            {lang === 'th' ? 'ผู้ติดต่อฉุกเฉิน: ' : 'Emergency: '}
                          </span>
                          {liveDraftSnapshot.emergencyContact}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </div>
      )}

      {activeTab === 'inbox' && (
        <div className="space-y-6">
          {/* Org Business Card & QR Code */}
          <OrgBusinessCard
            orgId={tenant.orgId}
            orgNameTh={tenant.orgNameTh}
            orgNameEn={tenant.orgNameEn}
            lang={lang}
            defaultTarget="profile"
          />

          {/* Form Field Configuration & Passcode */}
          <section className="tw-surface p-6 space-y-4 shadow-xs">
            <div>
              <h2 className="text-sm font-bold">
                {lang === 'th'
                  ? 'ตั้งค่าช่องกรอกและรหัสกลาง (ผู้บริหารเลือกเปิด-ปิดช่องได้)'
                  : 'Configure Form Fields & Passcode'}
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {lang === 'th'
                  ? 'ปรับได้ตามลักษณะองค์กร โดยไม่กระทบประวัติที่ผู้สมัครส่งเข้ามาแล้ว'
                  : 'Customize visible fields anytime without affecting existing submissions.'}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {(
                [
                  { key: 'showPhoto', labelTh: 'รูปถ่ายโปรไฟล์', labelEn: 'Photo Upload' },
                  { key: 'showEducation', labelTh: 'วุฒิการศึกษา / สังกัด', labelEn: 'Education' },
                  { key: 'showExperience', labelTh: 'ประสบการณ์ / หมายเหตุ', labelEn: 'Experience' },
                  { key: 'showSkills', labelTh: 'แท็กทักษะสำเร็จรูป', labelEn: 'Skill Tags' },
                  { key: 'showAvailability', labelTh: 'ช่วงเวลาที่สะดวก', labelEn: 'Availability' },
                  { key: 'showEmergencyContact', labelTh: 'ผู้ติดต่อฉุกเฉิน', labelEn: 'Emergency Contact' },
                ] as const
              ).map((item) => (
                <label
                  key={item.key}
                  className={`p-2.5 border tw-control-sm cursor-pointer flex items-center gap-2 text-xs font-medium ${
                    fieldsDraft[item.key] ? 'tw-active-task' : 'tw-border bg-[var(--bg-surface)]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={fieldsDraft[item.key]}
                    onChange={(e) =>
                      setFieldsDraft((prev) => ({ ...prev, [item.key]: e.target.checked }))
                    }
                    className="w-4 h-4 accent-current shrink-0"
                  />
                  <span>{lang === 'th' ? item.labelTh : item.labelEn}</span>
                </label>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t tw-border">
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requirePasscodeDraft}
                    onChange={(e) => setRequirePasscodeDraft(e.target.checked)}
                    className="w-4 h-4 accent-current"
                  />
                  <span>
                    {lang === 'th' ? 'ต้องกรอกรหัสกลางก่อนฝากประวัติ' : 'Require Passcode'}
                  </span>
                </label>
                {requirePasscodeDraft && (
                  <input
                    type="text"
                    value={passcodeDraft}
                    onChange={(e) => setPasscodeDraft(e.target.value)}
                    placeholder={lang === 'th' ? 'ตั้งรหัสกลาง' : 'Set passcode'}
                    className="px-3 py-1.5 text-xs tw-input font-mono-tabular w-36"
                  />
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  onUpdateProfileSettings({
                    requirePasscode: requirePasscodeDraft,
                    passcode: passcodeDraft.trim(),
                    fields: fieldsDraft,
                  });
                  setAdminMsg(
                    lang === 'th'
                      ? 'บันทึกการตั้งค่าหน้าฝากประวัติแล้ว'
                      : 'Profile form settings saved.'
                  );
                }}
                className="px-4 py-2 text-xs font-semibold tw-btn-soft"
              >
                {lang === 'th' ? 'บันทึกการตั้งค่า' : 'Save Settings'}
              </button>
            </div>
            {adminMsg && <div className="text-xs text-[var(--text-secondary)]">{adminMsg}</div>}
          </section>

          {/* Submissions List with 1-Click LINE Copy / Excel CSV / Pack & Leave Clear */}
          <section className="tw-surface p-6 space-y-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold">
                  {lang === 'th'
                    ? `การ์ดประวัติและข้อมูลที่ส่งถึงผู้บริหาร (${profileHub.submissions.length})`
                    : `Submitted Profile Cards (${profileHub.submissions.length})`}
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {lang === 'th'
                    ? 'เก็บรายใบ 14 วันนับจากวันที่ส่ง · พิมพ์การ์ดเป็น PDF หรือส่งออก Excel / LINE ได้ทันที'
                    : 'Each card stays 14 days · Print to PDF or export to Excel / LINE anytime'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const txt = formatProfileSummaryForLine(
                      profileHub.submissions,
                      tenant.orgNameTh,
                      lang,
                      effectiveNow
                    );
                    await navigator.clipboard?.writeText(txt);
                    setAdminMsg(
                      lang === 'th'
                        ? 'คัดลอกสรุปรายการฝากประวัติสำหรับส่งเข้า LINE แล้ว'
                        : 'Copied LINE summary to clipboard.'
                    );
                  }}
                  className="px-3 py-1.5 text-xs font-semibold tw-btn-soft inline-flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{lang === 'th' ? 'คัดลอกสรุปส่ง LINE' : 'Copy LINE Summary'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const csv = exportProfileSubmissionsCsv(profileHub.submissions);
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${tenant.orgId}_Profiles.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                    setAdminMsg(
                      lang === 'th'
                        ? 'ส่งออกไฟล์ Excel (CSV) รายการประวัติเรียบร้อยแล้ว'
                        : 'Exported CSV.'
                    );
                  }}
                  className="px-3 py-1.5 text-xs font-medium tw-btn-ghost inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{lang === 'th' ? 'ส่งออก Excel (CSV)' : 'Export CSV'}</span>
                </button>

                {profileHub.submissions.length > 0 && !confirmClearAll && (
                  <button
                    type="button"
                    onClick={() => setConfirmClearAll(true)}
                    className="px-3 py-1.5 text-xs font-medium tw-btn-ghost inline-flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{lang === 'th' ? 'เก็บครบแล้ว — ล้าง & แยกย้าย' : 'Clear All'}</span>
                  </button>
                )}
              </div>
            </div>

            {confirmClearAll && (
              <div className="p-3.5 tw-subtle border tw-border tw-control-sm flex flex-wrap items-center justify-between gap-3 text-xs">
                <span>
                  {lang === 'th'
                    ? `ยืนยันล้างรายการฝากประวัติทั้งหมด (${profileHub.submissions.length} รายการ)? การตั้งค่าองค์กรและฟอร์มยังคงอยู่ครบ`
                    : `Clear all ${profileHub.submissions.length} profile cards? Settings remain intact.`}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmClearAll(false)}
                    className="px-3 py-1.5 tw-btn-ghost"
                  >
                    {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClearProfileSubmissions();
                      setConfirmClearAll(false);
                      setAdminMsg(
                        lang === 'th'
                          ? 'ล้างรายการฝากประวัติเรียบร้อยแล้ว'
                          : 'Cleared all profile cards.'
                      );
                    }}
                    className="px-3.5 py-1.5 tw-btn-primary font-semibold"
                  >
                    {lang === 'th' ? 'ยืนยันล้างทันที' : 'Confirm Clear'}
                  </button>
                </div>
              </div>
            )}

            {profileHub.submissions.length === 0 ? (
              <div className="p-6 tw-subtle border tw-border tw-control text-center text-xs text-[var(--text-muted)]">
                {lang === 'th'
                  ? 'ยังไม่มีรายการฝากประวัติหรืออัปเดตข้อมูลเข้ามาในขณะนี้'
                  : 'No profile submissions yet.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {profileHub.submissions.map((sub) => {
                  const daysLeft = getItemRemainingDays(sub.createdAt, effectiveNow);
                  return (
                    <article
                      key={sub.id}
                      className="p-4 border tw-border tw-control bg-[var(--bg-surface)] space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          {sub.photoDataUrl ? (
                            <img
                              src={sub.photoDataUrl}
                              alt={sub.fullName}
                              className="w-12 h-14 object-cover border tw-border tw-control-sm shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-14 tw-subtle border tw-border tw-control-sm flex items-center justify-center text-xs font-bold shrink-0">
                              {getFormalMonogram(sub.fullName)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-xs text-[var(--text-muted)]">
                              {getProfileKindLabel(sub.kind, lang)}
                            </div>
                            <h3 className="text-sm font-bold truncate">{sub.fullName}</h3>
                            <div className="text-xs font-medium text-[var(--text-secondary)] truncate">
                              {sub.targetRoleOrGroup}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => downloadHtmlCard(sub)}
                          className="px-2.5 py-1 text-xs tw-btn-ghost inline-flex items-center gap-1 shrink-0"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{lang === 'th' ? 'การ์ด' : 'Card'}</span>
                        </button>
                      </div>

                      <div className="text-xs text-[var(--text-secondary)] space-y-1">
                        <div>
                          {lang === 'th' ? 'ติดต่อ: ' : 'Contact: '}
                          {sub.phoneOrContact}
                          {sub.email ? ` · ${sub.email}` : ''}
                        </div>
                        {sub.headlineOrSummary && (
                          <p className="text-[var(--text-muted)] line-clamp-3">
                            {sub.headlineOrSummary}
                          </p>
                        )}
                      </div>

                      {sub.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {sub.skills.map((sk) => (
                            <span
                              key={sk}
                              className="px-2 py-0.5 text-[11px] tw-subtle border tw-border tw-control-sm"
                            >
                              {sk}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="pt-2 border-t tw-border flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--text-muted)] font-mono-tabular">
                        <span>
                          {sub.createdAt} ·{' '}
                          {lang === 'th' ? `อยู่ต่อ ${daysLeft} วัน` : `${daysLeft}d left`}
                        </span>
                        <div className="flex items-center gap-2">
                          {sub.photoDriveUrl && (
                            <a
                              href={sub.photoDriveUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 underline"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Drive</span>
                            </a>
                          )}
                          <span>
                            {sub.syncedToCentral
                              ? lang === 'th'
                                ? 'ส่งเข้า Sheet/Drive แล้ว'
                                : 'Synced'
                              : lang === 'th'
                              ? 'พักบนหน้าเว็บ 14 วัน'
                              : '14d Hold'}
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
