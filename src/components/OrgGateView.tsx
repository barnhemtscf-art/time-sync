import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  FolderUp,
  Mail,
  ShieldCheck,
  UserPlus,
  X,
} from 'lucide-react';
import type { LangCode, OrgAccountMode, TenantData } from '../types/system';
import {
  buildOrgCodeEmailHref,
  generateUniqueMemberCode,
  generateUniqueOrgCode,
  getDefaultOwnerRoleTitle,
  isMemberCodeDuplicate,
  normalizeOrgLookupKey,
  verifyGooglePortalAccess,
} from '../utils/orgCode';
import { CloudMascot } from './CloudMascot';

export interface RegisterOrgPayload {
  orgId: string;
  orgNameTh: string;
  orgNameEn: string;
  execPin: string;
  orgAccountMode: OrgAccountMode;
  orgCategory: string;
  ownerEmail?: string;
  ownerNickname: string;
  ownerFullName?: string;
  ownerTitle: string;
}

interface OrgGateViewProps {
  tenants: Record<string, TenantData>;
  liveTimeStr: string;
  showMascot: boolean;
  lang: LangCode;
  qaOpen?: boolean;
  onOpenQa?: () => void;
  onBackHome?: () => void;
  onEnterOrg: (orgId: string, options?: { skipDropModal?: boolean; openDropModal?: boolean }) => void;
  onRegisterMemberInOrg: (orgId: string, name: string, group: string, code: string, notes?: string) => void;
  onRegisterOrg: (payload: RegisterOrgPayload) => void;
}

const ORG_CATEGORIES_TH = [
  'ธุรกิจขนาดเล็ก (SME) / ออฟฟิศ',
  'มูลนิธิ / ศูนย์ดูแล / โรงเรียน',
  'ร้านค้า / อีเวนท์ / ทีมงานสื่อ',
  'ใช้งานส่วนตัว / ครอบครัว / กลุ่มเพื่อน',
  'ชมรม / สมาคม / หน่วยงาน',
  'อื่นๆ',
];

const ORG_CATEGORIES_EN = [
  'Small Business (SME) / Office',
  'Foundation / Care Center / School',
  'Shop / Event / Media Team',
  'Personal / Family / Friends',
  'Club / Association / Unit',
  'Other',
];

export const OrgGateView: React.FC<OrgGateViewProps> = ({
  tenants,
  liveTimeStr,
  showMascot,
  lang,
  qaOpen,
  onOpenQa,
  onBackHome,
  onEnterOrg,
  onRegisterMemberInOrg,
  onRegisterOrg,
}) => {
  const [orgInput, setOrgInput] = useState('');
  const [isSecretFieldFocused, setIsSecretFieldFocused] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [mode, setMode] = useState<'entry' | 'register' | 'google'>('entry');

  // Register page sub-mode: primary open new org/hub (default) vs join existing org as member
  const [regTab, setRegTab] = useState<'org' | 'member'>('org');

  // Google Workspace verified portal input (prevents listing secret organizations)
  const [googleOrgInput, setGoogleOrgInput] = useState('');
  const [googleEmailInput, setGoogleEmailInput] = useState('');

  // New Member Registration state
  const [joinOrgId, setJoinOrgId] = useState('');
  const [memberName, setMemberName] = useState('');
  const [groupChoice, setGroupChoice] = useState('ทีมพี่โต');
  const [customGroup, setCustomGroup] = useState('');
  const [memberCode, setMemberCode] = useState('');
  const [contactNote, setContactNote] = useState('');
  const [memberDone, setMemberDone] = useState<{
    orgId: string;
    name: string;
    group: string;
    code: string;
  } | null>(null);

  // Register New Organization / File Drop Hub (Main Applicant) matching reference UI
  const [autoOrgCode, setAutoOrgCode] = useState(() => generateUniqueOrgCode(tenants));
  const [selectedAccountMode, setSelectedAccountMode] = useState<OrgAccountMode>('org_2tier');
  const [regOrgName, setRegOrgName] = useState('');
  const [regOrgCategory, setRegOrgCategory] = useState(ORG_CATEGORIES_TH[0]);
  const [regEmail, setRegEmail] = useState('');
  const [regExecPin, setRegExecPin] = useState('');
  const [regOwnerFullName, setRegOwnerFullName] = useState('');
  const [regOwnerTitle, setRegOwnerTitle] = useState(() =>
    getDefaultOwnerRoleTitle('org_2tier', lang)
  );
  const [titleManuallyEdited, setTitleManuallyEdited] = useState(false);
  const [createdOrgSummary, setCreatedOrgSummary] = useState<RegisterOrgPayload | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    if (!titleManuallyEdited) {
      setRegOwnerTitle(getDefaultOwnerRoleTitle(selectedAccountMode, lang));
    }
  }, [selectedAccountMode, lang, titleManuallyEdited]);

  const handleOpenRegistration = () => {
    setErrorMsg('');
    setMemberDone(null);
    setCreatedOrgSummary(null);
    setCopiedCode(false);
    setAutoOrgCode(generateUniqueOrgCode(tenants));
    setJoinOrgId(orgInput.trim().toUpperCase());
    setRegTab('org');
    setMode('register');
  };

  const handleSelectAccountMode = (nextMode: OrgAccountMode) => {
    setSelectedAccountMode(nextMode);
    if (nextMode === 'org_2tier') {
      setRegOrgCategory(lang === 'th' ? ORG_CATEGORIES_TH[0] : ORG_CATEGORIES_EN[0]);
    } else if (nextMode === 'foundation_3tier') {
      setRegOrgCategory(lang === 'th' ? ORG_CATEGORIES_TH[1] : ORG_CATEGORIES_EN[1]);
    } else {
      setRegOrgCategory(lang === 'th' ? ORG_CATEGORIES_TH[2] : ORG_CATEGORIES_EN[2]);
    }
  };

  const handleEnterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const matchedKey = normalizeOrgLookupKey(orgInput, tenants);
    if (!matchedKey) {
      setErrorMsg(
        lang === 'th'
          ? 'ไม่พบรหัสองค์กรที่ระบุ กรุณาตรวจสอบรหัสจากผู้บริหาร หรือกดสมัครสมาชิกใหม่'
          : 'Organization code not found. Please verify with your executive or register.'
      );
      return;
    }
    onEnterOrg(matchedKey);
  };

  const handleMemberRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const targetOrgKey = normalizeOrgLookupKey(joinOrgId, tenants);
    const targetTenant = targetOrgKey ? tenants[targetOrgKey] : undefined;
    if (!targetOrgKey || !targetTenant) {
      setErrorMsg(
        lang === 'th'
          ? `ไม่พบรหัสองค์กร "${joinOrgId.trim().toUpperCase() || '-'}" กรุณาตรวจสอบรหัสองค์กร`
          : `Organization "${joinOrgId.trim().toUpperCase() || '-'}" not found.`
      );
      return;
    }
    const finalGroup = groupChoice === '__other__' ? customGroup.trim() : groupChoice;
    if (!memberName.trim() || !finalGroup) {
      setErrorMsg(
        lang === 'th'
          ? 'กรุณากรอกชื่อผู้สมัครและเลือกกลุ่ม/ทีมให้ครบถ้วน'
          : 'Please enter applicant name and team/group.'
      );
      return;
    }
    const suggestedCode = generateUniqueMemberCode(targetTenant.members);
    const finalCode = (memberCode.trim() || suggestedCode).toUpperCase();
    if (isMemberCodeDuplicate(finalCode, targetTenant.members)) {
      setErrorMsg(
        lang === 'th'
          ? `รหัสสมาชิก "${finalCode}" มีอยู่ในองค์กรนี้แล้ว กรุณาใช้รหัสอื่นหรือเว้นว่างเพื่อสร้างอัตโนมัติ`
          : `Member code "${finalCode}" already exists in this organization. Please choose another or leave blank.`
      );
      return;
    }
    onRegisterMemberInOrg(
      targetOrgKey,
      memberName.trim(),
      finalGroup,
      finalCode,
      contactNote.trim() || undefined
    );
    setMemberDone({
      orgId: targetOrgKey,
      name: memberName.trim(),
      group: finalGroup,
      code: finalCode,
    });
    setMemberName('');
    setMemberCode('');
    setCustomGroup('');
    setContactNote('');
  };

  const handleOrgRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!regOrgName.trim()) {
      setErrorMsg(
        lang === 'th'
          ? 'กรุณากรอกชื่อองค์กร / โรงเรียน / ธุรกิจ'
          : 'Please enter organization / school / business name.'
      );
      return;
    }
    if (!regOwnerFullName.trim()) {
      setErrorMsg(
        lang === 'th'
          ? 'กรุณาระบุชื่อ-นามสกุลของผู้สมัครหลักให้ครบถ้วน'
          : 'Please enter the primary applicant full name.'
      );
      return;
    }
    const cleanPin = regExecPin.trim();
    if (!/^\d{4}$/.test(cleanPin)) {
      setErrorMsg(
        lang === 'th'
          ? 'กรุณากำหนดรหัส PIN ตัวเลข 4 หลักสำหรับผู้ดูแลหลัก'
          : 'Please set a 4-digit numeric PIN for the primary administrator.'
      );
      return;
    }

    const finalCode = tenants[autoOrgCode] ? generateUniqueOrgCode(tenants) : autoOrgCode;
    const formalFullName = regOwnerFullName.trim();
    const payload: RegisterOrgPayload = {
      orgId: finalCode,
      orgNameTh: regOrgName.trim(),
      orgNameEn: regOrgName.trim(),
      execPin: cleanPin,
      orgAccountMode: selectedAccountMode,
      orgCategory: regOrgCategory,
      ownerEmail: regEmail.trim() || undefined,
      ownerNickname: formalFullName,
      ownerFullName: formalFullName,
      ownerTitle:
        regOwnerTitle.trim() || getDefaultOwnerRoleTitle(selectedAccountMode, lang),
    };

    onRegisterOrg(payload);
    setCreatedOrgSummary(payload);
  };

  const isOrgCodeActive =
    (mode === 'entry' && (isSecretFieldFocused || orgInput.length > 0)) ||
    (mode === 'google' && (isSecretFieldFocused || googleOrgInput.length > 0)) ||
    (mode === 'register' && regTab === 'member' && !memberDone && (isSecretFieldFocused || joinOrgId.length > 0));

  const isPrivacyHiding =
    isSecretFieldFocused ||
    (mode === 'entry' && orgInput.length > 0) ||
    (mode === 'google' && googleOrgInput.length > 0) ||
    (mode === 'register' && regTab === 'member' && !memberDone && joinOrgId.length > 0) ||
    (mode === 'register' && regTab === 'org' && !createdOrgSummary && regExecPin.length > 0);

  const resolvedJoinOrgKey = normalizeOrgLookupKey(joinOrgId, tenants);
  const resolvedJoinOrg = resolvedJoinOrgKey ? tenants[resolvedJoinOrgKey] : undefined;
  const isJoinOrgTwoTier = resolvedJoinOrg?.orgAccountMode === 'org_2tier';

  const isWideOrgRegister = mode === 'register' && regTab === 'org';
  const categories = lang === 'th' ? ORG_CATEGORIES_TH : ORG_CATEGORIES_EN;

  return (
    <div className="min-h-[calc(100vh-120px)] flex flex-col items-center justify-center pt-10 pb-24 px-4">
      <div className={`w-full transition-all ${isWideOrgRegister ? 'max-w-[600px]' : 'max-w-[440px]'}`}>
        <CloudMascot
          visible={showMascot}
          lang={lang}
          qaOpen={qaOpen}
          isPrivacyHiding={isPrivacyHiding}
          showCompanion={isOrgCodeActive}
          silentPrivacy
          onOpenQa={onOpenQa}
        />

        <div className="tw-surface p-6 sm:p-7 shadow-sm space-y-5">
          {/* Segmented Digital Clock Box on Entry & Google & Member Join */}
          {!isWideOrgRegister && (
            <div className="tw-subtle border tw-border tw-control py-4 px-5 text-center">
              <div className="font-mono-tabular text-4xl font-bold tracking-widest whitespace-nowrap">
                {liveTimeStr}
              </div>
            </div>
          )}

          {mode === 'entry' && (
            <>
              <form onSubmit={handleEnterSubmit} className="space-y-3.5">
                {/* 1. ช่องใส่รหัสองค์กร */}
                <div className="relative">
                  <Building2 className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={orgInput}
                    onFocus={() => setIsSecretFieldFocused(true)}
                    onBlur={() => setIsSecretFieldFocused(false)}
                    onChange={(e) => setOrgInput(e.target.value)}
                    placeholder={lang === 'th' ? 'รหัสองค์กร' : 'Organization Code'}
                    aria-label={lang === 'th' ? 'รหัสองค์กร' : 'Organization Code'}
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm tw-input font-mono-tabular uppercase"
                  />
                </div>

                {errorMsg && (
                  <div className="text-xs px-3 py-2 border tw-border tw-subtle font-medium">
                    {errorMsg}
                  </div>
                )}

                {/* 2. ลงชื่อเข้าใช้ */}
                <button
                  type="submit"
                  className="w-full py-2.5 text-sm font-semibold tw-btn-soft"
                >
                  {lang === 'th' ? 'ลงชื่อเข้าใช้' : 'Sign In'}
                </button>
              </form>

              {/* 3. สมัครสมาชิกใหม่ */}
              <button
                type="button"
                onClick={handleOpenRegistration}
                className="w-full py-2.5 text-sm font-medium tw-btn-ghost inline-flex items-center justify-center gap-2"
              >
                <UserPlus className="w-4 h-4 text-[var(--text-muted)]" />
                <span>{lang === 'th' ? 'สมัครสมาชิกใหม่' : 'Register New Member'}</span>
              </button>

              <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                <div className="flex-1 h-px bg-[var(--border-hairline)]" />
                <span>{lang === 'th' ? 'หรือ' : 'or'}</span>
                <div className="flex-1 h-px bg-[var(--border-hairline)]" />
              </div>

              <button
                type="button"
                onClick={() => {
                  setErrorMsg('');
                  setMode('google');
                }}
                className="w-full py-2.5 text-sm font-medium tw-btn-ghost inline-flex items-center justify-center gap-2.5"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <span>{lang === 'th' ? 'ลงชื่อเข้าใช้ด้วย Google' : 'Sign in with Google'}</span>
              </button>

              {onBackHome && (
                <button
                  type="button"
                  onClick={onBackHome}
                  className="w-full py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] inline-flex items-center justify-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>{lang === 'th' ? 'กลับหน้าหลัก' : 'Back to Home'}</span>
                </button>
              )}
            </>
          )}

          {mode === 'register' && regTab === 'org' && (
            <div className="space-y-4">
              {/* Top Header matching attached screenshot */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h2 className="text-base sm:text-lg font-bold tracking-tight">
                    {lang === 'th'
                      ? 'แบบฟอร์มลงทะเบียนเปิดองค์กร / จุดรับข้อมูลใหม่'
                      : 'Organization & Hub Registration Form'}
                  </h2>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                    {lang === 'th'
                      ? 'ระบบจัดสรรรหัสองค์กรเฉพาะตัวโดยอัตโนมัติ พร้อมบันทึกสำหรับส่งเข้าอีเมล และสามารถปรับรหัสภายหลังได้อย่างอิสระ'
                      : 'A unique organization code is issued automatically, ready for email dispatch and customizable anytime in settings.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg('');
                    setMode('entry');
                  }}
                  aria-label={lang === 'th' ? 'ปิดหน้าต่างสมัครสมาชิก' : 'Close registration'}
                  className="p-1.5 tw-btn-ghost shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {createdOrgSummary ? (
                /* Post-Registration Confirmation Screen */
                <div className="p-5 tw-subtle border tw-border tw-control space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 tw-btn-soft flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-bold">
                        {lang === 'th'
                          ? 'เปิดองค์กรและออกรหัสองค์กรอัตโนมัติสำเร็จ'
                          : 'Organization & Unique Code Created'}
                      </div>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {createdOrgSummary.orgNameTh} · {createdOrgSummary.ownerFullName || createdOrgSummary.ownerNickname} ({createdOrgSummary.ownerTitle})
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 bg-[var(--bg-surface)] border tw-border tw-control flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {lang === 'th' ? 'รหัสองค์กร / จุดรวมไฟล์ของคุณ' : 'Your Organization Code'}
                      </div>
                      <div className="font-mono-tabular text-lg font-bold tracking-wider">
                        {createdOrgSummary.orgId}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await navigator.clipboard?.writeText(createdOrgSummary.orgId);
                          setCopiedCode(true);
                        }}
                        className="px-3 py-1.5 text-xs font-medium tw-btn-ghost inline-flex items-center gap-1.5"
                      >
                        {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedCode ? (lang === 'th' ? 'คัดลอกแล้ว' : 'Copied') : (lang === 'th' ? 'คัดลอกรหัส' : 'Copy Code')}</span>
                      </button>

                      {createdOrgSummary.ownerEmail && (
                        <a
                          href={buildOrgCodeEmailHref({
                            email: createdOrgSummary.ownerEmail,
                            orgId: createdOrgSummary.orgId,
                            orgName: createdOrgSummary.orgNameTh,
                            ownerPin: createdOrgSummary.execPin,
                          })}
                          className="px-3 py-1.5 text-xs font-medium tw-btn-ghost inline-flex items-center gap-1.5"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span>
                            {lang === 'th'
                              ? `ส่งเข้า ${createdOrgSummary.ownerEmail}`
                              : `Email to ${createdOrgSummary.ownerEmail}`}
                          </span>
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-[var(--text-muted)]">
                    {lang === 'th'
                      ? `รหัส PIN ผู้ดูแลหลัก: ${createdOrgSummary.execPin} · สามารถปรับเปลี่ยนรหัสองค์กรได้ภายหลังในส่วนตั้งค่าระบบ`
                      : `Primary Admin PIN: ${createdOrgSummary.execPin} · Org code can be updated anytime in settings.`}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const isFileDropMode = createdOrgSummary.orgAccountMode === 'file_drop';
                      onEnterOrg(createdOrgSummary.orgId, {
                        openDropModal: isFileDropMode,
                        skipDropModal: !isFileDropMode,
                      });
                    }}
                    className="w-full py-2.5 text-sm font-semibold tw-btn-primary"
                  >
                    {lang === 'th'
                      ? `เข้าสู่พื้นที่ใช้งาน (${createdOrgSummary.orgId})`
                      : `Enter Workspace (${createdOrgSummary.orgId})`}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleOrgRegisterSubmit} className="space-y-4">
                  {/* Auto-generated Unique Code Banner */}
                  <div className="p-3.5 tw-subtle border tw-border tw-control flex items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <ShieldCheck className="w-4 h-4 text-[var(--text-secondary)] shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold">
                          {lang === 'th'
                            ? 'รหัสองค์กร / จุดรวมไฟล์ที่ระบบออกให้ครั้งแรก (อัตโนมัติ)'
                            : 'Auto-Issued Unique Organization / Hub Code'}
                        </div>
                        <div className="text-xs text-[var(--text-muted)] mt-0.5">
                          {lang === 'th'
                            ? 'รับรองไม่ซ้ำกับองค์กรอื่น · สามารถเปลี่ยนรหัสเองภายหลังได้ในเมนูตั้งค่า'
                            : 'Guaranteed unique · Customizable later in backend settings'}
                        </div>
                      </div>
                    </div>

                    <div
                      data-testid="auto-org-code"
                      className="px-3.5 py-2 bg-[var(--bg-surface)] border tw-border tw-control-sm font-mono-tabular text-sm font-bold tracking-wider whitespace-nowrap shrink-0"
                    >
                      {autoOrgCode}
                    </div>
                  </div>

                  {/* 3 Registration Modes */}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold">
                      {lang === 'th'
                        ? 'เลือกรูปแบบการสมัครใช้งาน (3 แบบ) *'
                        : 'Select Account Structure Mode (3 Options) *'}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleSelectAccountMode('org_2tier')}
                        aria-pressed={selectedAccountMode === 'org_2tier'}
                        className={`text-left p-3.5 border tw-control transition-colors space-y-1 cursor-pointer ${
                          selectedAccountMode === 'org_2tier'
                            ? 'tw-btn-soft border-[var(--accent-bg)]'
                            : 'tw-border bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)]'
                        }`}
                      >
                        <div className="text-xs font-bold">
                          {lang === 'th'
                            ? '1) โหมดองค์กร/ทีมงานทั่วไป (2 ระดับ)'
                            : '1) Standard Organization / Team (2 Tiers)'}
                        </div>
                        <div className="text-xs opacity-80 leading-relaxed">
                          {lang === 'th'
                            ? '1. หัวหน้า + 2. พนักงาน · ซ่อนส่วนสมาชิก/เด็กออกทั้งหมด'
                            : '1. Head + 2. Staff · Hides child/student member sections'}
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectAccountMode('foundation_3tier')}
                        aria-pressed={selectedAccountMode === 'foundation_3tier'}
                        className={`text-left p-3.5 border tw-control transition-colors space-y-1 cursor-pointer ${
                          selectedAccountMode === 'foundation_3tier'
                            ? 'tw-btn-soft border-[var(--accent-bg)]'
                            : 'tw-border bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)]'
                        }`}
                      >
                        <div className="text-xs font-bold">
                          {lang === 'th'
                            ? '2) โหมดมูลนิธิ/ศูนย์ดูแล (3 ระดับ)'
                            : '2) Foundation / Care Center (3 Tiers)'}
                        </div>
                        <div className="text-xs opacity-80 leading-relaxed">
                          {lang === 'th'
                            ? 'ผู้บริหาร / พี่เลี้ยง / สมาชิก (คงโครงสร้างเดิมครบถ้วน)'
                            : 'Executive / Mentor / Member (full existing structure)'}
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectAccountMode('file_drop')}
                        aria-pressed={selectedAccountMode === 'file_drop'}
                        className={`sm:col-span-2 text-left p-3.5 border tw-control transition-colors flex items-start gap-2.5 cursor-pointer ${
                          selectedAccountMode === 'file_drop'
                            ? 'tw-btn-soft border-[var(--accent-bg)]'
                            : 'tw-border bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)]'
                        }`}
                      >
                        <FolderUp className="w-4 h-4 shrink-0 mt-0.5 opacity-80" />
                        <div className="space-y-0.5">
                          <div className="text-xs font-bold">
                            {lang === 'th'
                              ? '3) โหมดจุดฝากไฟล์รวม (4 รูปแบบ: องค์กร / ธุรกิจ / ส่วนตัว / กำหนดเอง)'
                              : '3) Shared File Drop Hub (4 Sub-modes: Org / Business / Personal / Custom)'}
                          </div>
                          <div className="text-xs opacity-80 leading-relaxed">
                            {lang === 'th'
                              ? 'ไม่ต้องเข้าบ่อย แค่แวะเข้ามาฝากไฟล์หรือข้อความรวมกันในจุดเดียวก็ได้'
                              : 'No need to check in often — drop files or messages together in one hub.'}
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Organization Name */}
                  <div className="space-y-1">
                    <label htmlFor="reg-org-name-input" className="block text-xs font-medium">
                      {lang === 'th' ? 'ชื่อองค์กร / โรงเรียน / ธุรกิจ *' : 'Organization / School / Business Name *'}
                    </label>
                    <input
                      id="reg-org-name-input"
                      type="text"
                      required
                      value={regOrgName}
                      onChange={(e) => setRegOrgName(e.target.value)}
                      placeholder={lang === 'th' ? 'เช่น มูลนิธิแสงตะวัน / คาเฟ่สุขใจ' : 'e.g. Sunlight Foundation / Happy Cafe'}
                      className="w-full px-3.5 py-2.5 text-sm tw-input"
                    />
                  </div>

                  {/* Organization Type */}
                  <div className="space-y-1">
                    <label htmlFor="reg-org-category" className="block text-xs font-medium">
                      {lang === 'th' ? 'ประเภทองค์กร' : 'Organization Type'}
                    </label>
                    <select
                      id="reg-org-category"
                      value={regOrgCategory}
                      onChange={(e) => setRegOrgCategory(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm tw-input"
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Applicant Gmail */}
                  <div className="space-y-1">
                    <label htmlFor="reg-owner-email" className="block text-xs font-medium">
                      {lang === 'th'
                        ? 'อีเมล Gmail ผู้สมัคร (สำหรับรับรหัสเข้าใช้งานทางอีเมล)'
                        : 'Applicant Gmail (for receiving workspace access code)'}
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="reg-owner-email"
                        type="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="yourname@gmail.com"
                        className="w-full pl-10 pr-3.5 py-2.5 text-sm tw-input"
                      />
                    </div>
                  </div>

                  {/* Primary Applicant / Authorized Owner (Formal & Authoritative) */}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold tracking-wide">
                      {lang === 'th' ? 'ข้อมูลผู้สมัครหลัก / ผู้มีอำนาจลงนาม' : 'Primary Applicant / Authorized Owner'}
                    </div>
                    <div className="space-y-2.5">
                      <div>
                        <label htmlFor="reg-owner-fullname" className="block text-xs font-medium mb-1">
                          {lang === 'th' ? 'ชื่อ-นามสกุล ผู้สมัครหลัก *' : 'Primary Applicant Full Name *'}
                        </label>
                        <input
                          id="reg-owner-fullname"
                          type="text"
                          required
                          value={regOwnerFullName}
                          onChange={(e) => setRegOwnerFullName(e.target.value)}
                          placeholder={lang === 'th' ? 'ระบุชื่อ-นามสกุลจริง (เช่น นายธนกฤต วงศ์สุวรรณ)' : 'Enter legal full name'}
                          aria-label={lang === 'th' ? 'ชื่อ-นามสกุล ผู้สมัครหลัก' : 'Primary Applicant Full Name'}
                          className="w-full px-3.5 py-2.5 text-sm tw-input"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label htmlFor="reg-owner-title" className="block text-xs font-medium mb-1">
                            {lang === 'th' ? 'ตำแหน่ง / บทบาทหน้าที่' : 'Official Title / Position'}
                          </label>
                          <input
                            id="reg-owner-title"
                            type="text"
                            value={regOwnerTitle}
                            onChange={(e) => {
                              setTitleManuallyEdited(true);
                              setRegOwnerTitle(e.target.value);
                            }}
                            placeholder={lang === 'th' ? 'หัวหน้าหน่วยงาน / ผู้บริหาร' : 'Director / Head'}
                            aria-label={lang === 'th' ? 'ตำแหน่งผู้สมัครหลัก' : 'Owner Role Title'}
                            className="w-full px-3.5 py-2.5 text-sm tw-input"
                          />
                        </div>

                        <div>
                          <label htmlFor="reg-exec-pin" className="block text-xs font-medium mb-1">
                            {lang === 'th' ? 'กำหนดรหัส PIN ผู้ดูแล 4 หลัก *' : 'Administrator 4-Digit PIN *'}
                          </label>
                          <input
                            id="reg-exec-pin"
                            type="text"
                            inputMode="numeric"
                            maxLength={4}
                            required
                            value={regExecPin}
                            onFocus={() => setIsSecretFieldFocused(true)}
                            onBlur={() => setIsSecretFieldFocused(false)}
                            onChange={(e) => setRegExecPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            placeholder={lang === 'th' ? 'รหัส PIN ตัวเลข 4 หลัก *' : '4-Digit Numeric PIN *'}
                            aria-label={lang === 'th' ? 'กำหนดรหัส PIN ผู้ดูแล 4 หลัก' : 'Set 4-Digit PIN'}
                            className="w-full px-3.5 py-2.5 text-sm tw-input font-mono-tabular"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {errorMsg && (
                    <div className="text-xs px-3 py-2 border tw-border tw-subtle font-medium">
                      {errorMsg}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-2.5 text-sm font-semibold tw-btn-soft"
                  >
                    {lang === 'th'
                      ? 'เปิดองค์กรและออกรหัสองค์กรอัตโนมัติ'
                      : 'Open Organization & Issue Unique Code'}
                  </button>
                </form>
              )}

              {/* Subtle link to existing member registration inside an existing org */}
              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg('');
                    setMemberDone(null);
                    setRegTab('member');
                  }}
                  className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline underline-offset-4"
                >
                  {lang === 'th'
                    ? 'มีรหัสองค์กรอยู่แล้ว? สมัครเป็นสมาชิกในองค์กร'
                    : 'Already have an org code? Join as a member'}
                </button>
              </div>
            </div>
          )}

          {mode === 'register' && regTab === 'member' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg('');
                    setRegTab('org');
                  }}
                  className="px-2.5 py-1 text-xs font-medium tw-btn-ghost inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{lang === 'th' ? 'กลับ' : 'Back'}</span>
                </button>
                <h2 className="text-sm font-bold">
                  {lang === 'th' ? 'สมัครสมาชิกในองค์กรที่มีรหัสแล้ว' : 'Join Existing Organization'}
                </h2>
              </div>

              {errorMsg && (
                <div className="text-xs px-3 py-2 border tw-border tw-subtle font-medium">
                  {errorMsg}
                </div>
              )}

              {memberDone ? (
                <div className="p-4 tw-subtle border tw-border tw-control space-y-2.5 text-center">
                  <div className="w-9 h-9 mx-auto tw-btn-soft flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="text-sm font-bold">
                    {lang === 'th' ? 'สมัครสมาชิกใหม่สำเร็จ' : 'Member Registered'}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    {(lang === 'th'
                      ? tenants[memberDone.orgId]?.orgNameTh
                      : tenants[memberDone.orgId]?.orgNameEn) || ''}{' '}
                    · {memberDone.name} ({memberDone.code}) · {memberDone.group}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setMemberDone(null)}
                      className="flex-1 py-2 text-xs font-medium tw-btn-ghost"
                    >
                      {lang === 'th' ? 'สมัครเพิ่ม' : 'Add Another'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onEnterOrg(memberDone.orgId)}
                      className="flex-1 py-2 text-xs font-semibold tw-btn-soft"
                    >
                      {lang === 'th' ? 'เข้าหน้าหลักองค์กร' : 'Enter Organization'}
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleMemberRegisterSubmit} className="space-y-3">
                  <input
                    type="text"
                    required
                    value={joinOrgId}
                    onFocus={() => setIsSecretFieldFocused(true)}
                    onBlur={() => setIsSecretFieldFocused(false)}
                    onChange={(e) => setJoinOrgId(e.target.value)}
                    placeholder={lang === 'th' ? 'รหัสองค์กร' : 'Organization Code'}
                    aria-label={lang === 'th' ? 'รหัสองค์กร' : 'Organization Code'}
                    className="w-full px-3.5 py-2.5 text-sm tw-input font-mono-tabular uppercase"
                  />
                  <input
                    type="text"
                    required
                    value={memberName}
                    onChange={(e) => setMemberName(e.target.value)}
                    placeholder={lang === 'th' ? 'ชื่อ-นามสกุล ผู้ลงทะเบียน *' : 'Applicant Full Name *'}
                    aria-label={lang === 'th' ? 'ชื่อ-นามสกุล ผู้ลงทะเบียน' : 'Applicant Full Name'}
                    className="w-full px-3.5 py-2.5 text-sm tw-input"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={groupChoice}
                      onChange={(e) => setGroupChoice(e.target.value)}
                      aria-label={lang === 'th' ? 'ทีม / กลุ่ม' : 'Team / Group'}
                      className="px-3 py-2.5 text-sm tw-input"
                    >
                      {isJoinOrgTwoTier ? (
                        <>
                          <option value="ทีมงาน / พนักงาน">ทีมงาน / พนักงาน</option>
                          <option value="ฝ่ายประสานงาน">ฝ่ายประสานงาน</option>
                        </>
                      ) : (
                        <>
                          <option value="ทีมพี่โต">ทีมพี่โต</option>
                          <option value="ทีมน้องเล็ก">ทีมน้องเล็ก</option>
                        </>
                      )}
                      <option value="__other__">{lang === 'th' ? 'อื่นๆ (ระบุเอง)' : 'Other'}</option>
                    </select>
                    <input
                      type="text"
                      value={memberCode}
                      onChange={(e) => setMemberCode(e.target.value)}
                      placeholder={lang === 'th' ? 'รหัสสมาชิก (อัตโนมัติ)' : 'Member Code (Auto)'}
                      className="px-3 py-2.5 text-sm tw-input font-mono-tabular uppercase"
                    />
                  </div>
                  {groupChoice === '__other__' && (
                    <input
                      type="text"
                      required
                      value={customGroup}
                      onChange={(e) => setCustomGroup(e.target.value)}
                      placeholder={lang === 'th' ? 'ระบุชื่อทีม / กลุ่ม' : 'Specify team / group'}
                      className="w-full px-3.5 py-2.5 text-sm tw-input"
                    />
                  )}
                  <input
                    type="text"
                    value={contactNote}
                    onChange={(e) => setContactNote(e.target.value)}
                    placeholder={lang === 'th' ? 'เบอร์ติดต่อ / หมายเหตุ (ไม่บังคับ)' : 'Contact / Note (Optional)'}
                    className="w-full px-3.5 py-2.5 text-sm tw-input"
                  />
                  <button type="submit" className="w-full py-2.5 text-xs font-semibold tw-btn-soft">
                    {lang === 'th' ? 'ยืนยันสมัครสมาชิกใหม่' : 'Confirm Registration'}
                  </button>
                </form>
              )}
            </div>
          )}

          {mode === 'google' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setErrorMsg('');
                const res = verifyGooglePortalAccess(googleOrgInput, googleEmailInput, tenants);
                if (!res.ok) {
                  if (res.reason === 'invalid_org') {
                    setErrorMsg(
                      lang === 'th'
                        ? 'ไม่พบรหัสองค์กรนี้ (เพื่อความปลอดภัย ระบบไม่แสดงรายชื่อองค์กรทั้งหมด)'
                        : 'Organization code not found.'
                    );
                  } else if (res.reason === 'invalid_email') {
                    setErrorMsg(
                      lang === 'th'
                        ? 'กรุณากรอกอีเมล Gmail ให้ถูกต้อง'
                        : 'Please enter a valid Gmail address.'
                    );
                  } else {
                    setErrorMsg(
                      lang === 'th'
                        ? 'อีเมลไม่ตรงกับอีเมลผู้สมัครหลักที่ผูกไว้กับองค์กรนี้'
                        : 'Email does not match the registered owner Gmail for this organization.'
                    );
                  }
                  return;
                }
                onEnterOrg(res.orgId);
              }}
              className="space-y-3"
            >
              <div className="space-y-1">
                <div className="text-sm font-semibold">
                  {lang === 'th' ? 'ยืนยันตัวตนเข้าสู่องค์กรด้วย Gmail' : 'Verify Organization Access with Gmail'}
                </div>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  {lang === 'th'
                    ? 'กรอกรหัสองค์กรและอีเมล Gmail ที่ลงทะเบียนไว้ (ระบบซ่อนรายชื่อองค์กรอื่นเพื่อรักษาความลับ)'
                    : 'Enter your Organization Code and registered Gmail (other organizations remain hidden for privacy).'}
                </p>
              </div>

              <input
                type="text"
                required
                value={googleOrgInput}
                onFocus={() => setIsSecretFieldFocused(true)}
                onBlur={() => setIsSecretFieldFocused(false)}
                onChange={(e) => setGoogleOrgInput(e.target.value)}
                placeholder={lang === 'th' ? 'รหัสองค์กร (เช่น ORG-XXXX)' : 'Organization Code (e.g. ORG-XXXX)'}
                aria-label={lang === 'th' ? 'รหัสองค์กรสำหรับ Gmail' : 'Organization Code for Gmail'}
                className="w-full px-3.5 py-2.5 text-sm tw-input font-mono-tabular uppercase"
              />

              <input
                type="email"
                required
                value={googleEmailInput}
                onChange={(e) => setGoogleEmailInput(e.target.value)}
                placeholder="yourname@gmail.com"
                aria-label={lang === 'th' ? 'อีเมล Gmail' : 'Gmail Address'}
                className="w-full px-3.5 py-2.5 text-sm tw-input"
              />

              {errorMsg && (
                <div className="text-xs px-3 py-2 border tw-border tw-subtle font-medium">
                  {errorMsg}
                </div>
              )}

              <button type="submit" className="w-full py-2.5 text-xs font-semibold tw-btn-soft">
                {lang === 'th' ? 'ยืนยันและเข้าสู่องค์กร' : 'Verify & Enter Organization'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setErrorMsg('');
                  setMode('entry');
                }}
                className="w-full py-2 text-xs tw-btn-ghost"
              >
                {lang === 'th' ? 'กลับ' : 'Back'}
              </button>
            </form>
          )}

          <div className="pt-3 border-t tw-border text-center text-xs text-[var(--text-muted)]">
            {lang === 'th'
              ? 'ระบบแยกพื้นที่ข้อมูลแต่ละองค์กรเป็นอิสระและปลอดภัย'
              : 'Each organization workspace is isolated and securely audit-logged'}
          </div>
        </div>
      </div>
    </div>
  );
};
