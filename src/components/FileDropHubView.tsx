import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Cloud,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  FolderUp,
  Image as ImageIcon,
  Lock,
  MessageSquareText,
  Send,
  Settings2,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import type {
  DroppedFileAttachment,
  FileDropAllowedTypes,
  FileDropHubConfig,
  FileDropSubmission,
  LangCode,
  StorageMode,
  TenantData,
} from '../types/system';
import {
  formatFileSize,
  getAllowedFileCategoryLabels,
  getFileDropModeMeta,
  validateDropFiles,
  verifyDropPasscode,
} from '../utils/fileDrop';
import { isValidGasWebAppUrl } from '../utils/orgCode';
import { readAttachmentForStorage } from '../utils/imageCompression';
import {
  exportFileDropSubmissionsCsv,
  formatFileDropSummaryForLine,
  getItemRemainingDays,
} from '../utils/retention';
import { generateGoogleAppsScriptCode } from '../utils/gasExport';
import { testGasWebAppConnection } from '../utils/gasSync';

interface FileDropHubViewProps {
  tenant: TenantData;
  hub: FileDropHubConfig;
  lang: LangCode;
  effectiveNow: Date;
  onBackDashboard: () => void;
  onOpenEditModeModal: () => void;
  onSaveOpenPointSettings: (payload: {
    topic: string;
    sharedPasscode: string;
    allowedTypes: FileDropAllowedTypes;
  }) => void;
  onSubmitDrop: (submission: Omit<FileDropSubmission, 'id' | 'createdAt' | 'syncedToCentral'>) => void;
  onClearSubmissions: () => void;
  onUpdateStorageMode: (mode: StorageMode, gasUrl: string) => void;
}

const MAX_LOCAL_FILE_BYTES = 512 * 1024;

interface QueuedDropFile {
  id: string;
  raw: File;
  category: 'image' | 'pdf' | 'excel';
  oversized: boolean;
}

const ImageAttachmentThumb: React.FC<{ src: string; alt: string }> = ({ src, alt }) => {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <ImageIcon className="w-4 h-4 text-[var(--text-muted)] shrink-0" />;
  }
  return (
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className="w-10 h-10 object-cover tw-control-sm shrink-0 border tw-border"
    />
  );
};

export const FileDropHubView: React.FC<FileDropHubViewProps> = ({
  tenant,
  hub,
  lang,
  effectiveNow,
  onBackDashboard,
  onOpenEditModeModal,
  onSaveOpenPointSettings,
  onSubmitDrop,
  onClearSubmissions,
  onUpdateStorageMode,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'send' | 'configure'>('send');

  // "เปิดจุดรับไฟล์" state
  const [topicInput, setTopicInput] = useState(hub.topic);
  const [passcodeSettingInput, setPasscodeSettingInput] = useState(hub.sharedPasscode);
  const [allowedTypesDraft, setAllowedTypesDraft] = useState<FileDropAllowedTypes>(hub.allowedTypes);
  const [configSavedMsg, setConfigSavedMsg] = useState('');

  // "แวะมาส่งไฟล์" state
  const [senderName, setSenderName] = useState('');
  const [enteredPasscode, setEnteredPasscode] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [queuedFiles, setQueuedFiles] = useState<QueuedDropFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dropError, setDropError] = useState('');
  const [dropSuccess, setDropSuccess] = useState('');
  const [isSubmittingDrop, setIsSubmittingDrop] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Central Google Drive / Google Sheets config (keeps existing structure intact)
  const [gasUrlDraft, setGasUrlDraft] = useState(tenant.gasWebAppUrl);
  const [centralSaveMsg, setCentralSaveMsg] = useState('');
  const [showGasGuide, setShowGasGuide] = useState(false);
  const [isTestingGas, setIsTestingGas] = useState(false);

  // Export & Pack-up ("เก็บครบแล้ว — ล้างข้อมูล & แยกย้าย")
  const [historyActionMsg, setHistoryActionMsg] = useState('');
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const modeMeta = getFileDropModeMeta(hub.modeId);
  const allowedLabels = useMemo(
    () => getAllowedFileCategoryLabels(hub.allowedTypes, lang),
    [hub.allowedTypes, lang]
  );

  const acceptAttribute = useMemo(() => {
    const tokens: string[] = [];
    if (hub.allowedTypes.image) tokens.push('image/*');
    if (hub.allowedTypes.pdf) tokens.push('.pdf,application/pdf');
    if (hub.allowedTypes.excel) {
      tokens.push(
        '.xls,.xlsx,.csv,.ods,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv'
      );
    }
    return tokens.join(',') || undefined;
  }, [hub.allowedTypes]);

  const handleQueueRawFiles = (fileList: FileList | File[]) => {
    setDropError('');
    setDropSuccess('');
    const incoming = Array.from(fileList);
    if (incoming.length === 0) return;

    const { accepted, rejected } = validateDropFiles(incoming, hub.allowedTypes);
    if (accepted.length > 0) {
      setQueuedFiles((prev) => [
        ...prev,
        ...accepted.map((item, idx) => ({
          id: `qf-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
          raw: item.file,
          category: item.category,
          oversized: item.category !== 'image' && item.file.size > MAX_LOCAL_FILE_BYTES,
        })),
      ]);
    }
    if (rejected.length > 0) {
      setDropError(
        rejected.map((r) => (lang === 'th' ? r.reasonTh : r.reasonEn)).join(' · ')
      );
    }
  };

  const handleSaveHostConfig = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveOpenPointSettings({
      topic: topicInput.trim() || hub.topic,
      sharedPasscode: passcodeSettingInput.trim(),
      allowedTypes: allowedTypesDraft,
    });
    setConfigSavedMsg(
      lang === 'th'
        ? 'บันทึกการตั้งค่าจุดรับไฟล์แล้ว (เก็บข้อมูลและประวัติไฟล์ที่ส่งมาแล้วไว้ครบ)'
        : 'Drop point settings saved (all existing files and history preserved).'
    );
  };

  const handleSubmitSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setDropError('');
    setDropSuccess('');

    if (!senderName.trim()) {
      setDropError(lang === 'th' ? 'กรุณากรอกชื่อผู้ส่ง' : 'Please enter sender name.');
      return;
    }

    if (!verifyDropPasscode(hub.sharedPasscode, enteredPasscode)) {
      setDropError(
        lang === 'th'
          ? 'รหัสกลางไม่ถูกต้อง กรุณาตรวจสอบกับผู้เปิดจุดรับไฟล์'
          : 'Incorrect shared passcode. Please check with the drop point host.'
      );
      return;
    }

    const trimmedMsg = messageInput.trim();
    if (trimmedMsg && !hub.allowedTypes.text) {
      setDropError(
        lang === 'th'
          ? 'จุดรับไฟล์นี้ปิดรับข้อความชั่วคราว กรุณาแนบเฉพาะไฟล์ประเภทที่เปิดรับ'
          : 'Text messages are currently disabled for this drop point.'
      );
      return;
    }

    // Re-validate queued files against current allowedTypes in case host updated settings
    const { accepted, rejected } = validateDropFiles(
      queuedFiles.map((q) => q.raw),
      hub.allowedTypes
    );
    if (rejected.length > 0) {
      setDropError(
        rejected.map((r) => (lang === 'th' ? r.reasonTh : r.reasonEn)).join(' · ')
      );
      return;
    }

    if (accepted.length === 0 && !trimmedMsg) {
      setDropError(
        lang === 'th'
          ? 'กรุณาเลือกไฟล์อย่างน้อย 1 ไฟล์ หรือพิมพ์ข้อความที่ต้องการฝาก'
          : 'Please attach at least one file or enter a message.'
      );
      return;
    }

    setIsSubmittingDrop(true);
    try {
      const attachments: DroppedFileAttachment[] = await Promise.all(
        accepted.map(async (item, idx) => ({
          id: `att-${Date.now()}-${idx}`,
          name: item.file.name,
          size: item.file.size,
          mimeType: item.file.type || 'application/octet-stream',
          category: item.category,
          dataUrl: await readAttachmentForStorage(item.file, item.category === 'image'),
        }))
      );

      onSubmitDrop({
        senderName: senderName.trim(),
        topic: hub.topic,
        locationTitle: hub.customLocationTitle,
        modeId: hub.modeId,
        message: trimmedMsg || undefined,
        files: attachments,
      });

      setQueuedFiles([]);
      setMessageInput('');
      setDropSuccess(
        lang === 'th'
          ? `ส่งเข้าจุดรวม "${hub.customLocationTitle}" เรียบร้อยแล้ว`
          : `Submitted to "${hub.customLocationTitle}" successfully.`
      );
    } finally {
      setIsSubmittingDrop(false);
    }
  };

  const handleCopyLineSummary = async () => {
    const text = formatFileDropSummaryForLine(hub, lang, effectiveNow);
    await navigator.clipboard?.writeText(text);
    setHistoryActionMsg(
      lang === 'th'
        ? 'คัดลอกสรุปรายการสำหรับส่งเข้า LINE แล้ว (กดวางในแชทได้เลย)'
        : 'Copied LINE-ready summary to clipboard.'
    );
  };

  const handleExportCsv = () => {
    const csv = exportFileDropSubmissionsCsv(hub);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tenant.orgId}_FileDrop.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setHistoryActionMsg(
      lang === 'th' ? 'ส่งออกไฟล์ Excel / CSV เรียบร้อยแล้ว' : 'Exported Excel / CSV file.'
    );
  };

  return (
    <div className="max-w-[920px] mx-auto px-4 sm:px-6 pt-8 pb-24 space-y-6">
      {/* Main Header Card */}
      <section className="tw-surface p-6 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <span>{lang === 'th' ? 'จุดฝากไฟล์รวม' : 'Shared File Drop Hub'}</span>
              <span aria-hidden="true">·</span>
              <span>{lang === 'th' ? modeMeta.titleTh : modeMeta.titleEn}</span>
              {hub.modeId === 'custom' && hub.customCategoryLabel && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{hub.customCategoryLabel}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular">
                {lang === 'th'
                  ? `ฝากแล้ว ${hub.submissions.length} รายการ`
                  : `${hub.submissions.length} items`}
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight break-words">
              {hub.customLocationTitle}
            </h1>

            <p className="text-xs text-[var(--text-secondary)]">
              {lang === 'th'
                ? 'ไม่ต้องเข้าบ่อย แค่แวะเข้ามาฝากไฟล์หรือข้อความรวมกันในจุดเดียวก็ได้'
                : 'No need to log in often — just drop files or messages together in one place.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenEditModeModal}
              className="px-3.5 py-2 text-xs font-semibold tw-btn-soft inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>
                {lang === 'th' ? 'แก้ไขการตั้งค่า / เปลี่ยนโหมด' : 'Edit Settings / Change Mode'}
              </span>
            </button>

            <button
              type="button"
              onClick={onBackDashboard}
              className="px-3.5 py-2 text-xs font-medium tw-btn-ghost inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{lang === 'th' ? 'กลับหน้าหลักองค์กร' : 'Back to Org Home'}</span>
            </button>
          </div>
        </div>

        {/* Calm Privacy & Rolling 14-Day Policy Notice */}
        <div className="px-3.5 py-2.5 tw-subtle border tw-border tw-control-sm flex items-start gap-2 text-xs text-[var(--text-secondary)]">
          <ShieldCheck className="w-4 h-4 text-[var(--text-primary)] shrink-0 mt-0.5" />
          <span>
            {lang === 'th'
              ? 'เว็บไม่เก็บข้อมูลส่วนตัวถาวร · ระบบเก็บแต่ละรายการไว้นาน 14 วันนับจากวันที่ส่ง และลบเฉพาะรายการที่เก่าเกิน 14 วันอัตโนมัติ (งานใหม่ที่เพิ่งส่งยังอยู่ครบ 14 วันเต็ม) หรือส่งเข้า Google Drive/Sheets ของคุณเองได้'
              : 'Zero permanent retention · Each item stays for 14 days from its submission date and expires individually (new items always keep their full 14 days), or sync directly to your own Google Drive/Sheets.'}
          </span>
        </div>

        {/* Mode Switcher: "แวะมาส่งไฟล์" vs "เปิดจุดรับไฟล์" */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t tw-border">
          <div className="flex items-center gap-1.5" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeSubTab === 'send'}
              onClick={() => {
                setActiveSubTab('send');
                setDropError('');
                setDropSuccess('');
              }}
              className={`px-4 py-2 text-xs font-semibold tw-control-sm inline-flex items-center gap-1.5 ${
                activeSubTab === 'send' ? 'tw-btn-primary' : 'tw-btn-ghost'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>{lang === 'th' ? 'แวะมาส่งไฟล์' : 'Drop Files / Send'}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeSubTab === 'configure'}
              onClick={() => {
                setTopicInput(hub.topic);
                setPasscodeSettingInput(hub.sharedPasscode);
                setAllowedTypesDraft(hub.allowedTypes);
                setConfigSavedMsg('');
                setActiveSubTab('configure');
              }}
              className={`px-4 py-2 text-xs font-semibold tw-control-sm inline-flex items-center gap-1.5 ${
                activeSubTab === 'configure' ? 'tw-btn-primary' : 'tw-btn-ghost'
              }`}
            >
              <FolderUp className="w-3.5 h-3.5" />
              <span>{lang === 'th' ? 'เปิดจุดรับไฟล์' : 'Open / Configure Drop Point'}</span>
            </button>
          </div>

          <div className="text-xs text-[var(--text-muted)]">
            <span>{lang === 'th' ? 'เปิดรับ: ' : 'Accepting: '}</span>
            <span className="font-medium text-[var(--text-secondary)]">
              {allowedLabels.length > 0
                ? allowedLabels.join(' · ')
                : lang === 'th'
                ? 'ยังไม่ได้เลือกประเภทไฟล์'
                : 'None selected'}
            </span>
          </div>
        </div>
      </section>

      {/* TAB A: แวะมาส่งไฟล์ */}
      {activeSubTab === 'send' && (
        <section className="tw-surface p-6 space-y-5 shadow-xs">
          <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b tw-border">
            <div>
              <h2 className="text-sm font-bold">
                {lang === 'th' ? `หัวข้อเรื่อง: ${hub.topic}` : `Topic: ${hub.topic}`}
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {hub.sharedPasscode.trim()
                  ? lang === 'th'
                    ? 'จุดรับไฟล์นี้มีการตั้งรหัสกลาง — กรุณากรอกรหัสกลางก่อนส่ง'
                    : 'This drop point requires a shared passcode.'
                  : lang === 'th'
                  ? 'ยังไม่ได้ตั้งรหัสกลาง (สามารถตั้งรหัสกลางได้ที่แท็บ "เปิดจุดรับไฟล์")'
                  : 'No shared passcode set yet (configure in Open Drop Point tab).'}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmitSend} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="drop-sender-name" className="block text-xs font-medium">
                  {lang === 'th' ? 'ชื่อผู้ส่ง' : 'Sender Name'}
                </label>
                <input
                  id="drop-sender-name"
                  type="text"
                  required
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder={lang === 'th' ? 'เช่น คุณครูเอ / ต้นกล้า / ฝ่ายสื่อ' : 'e.g. Sender name'}
                  className="w-full px-3.5 py-2.5 text-sm tw-input"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="drop-shared-passcode" className="block text-xs font-medium">
                  {lang === 'th' ? 'รหัสกลาง' : 'Shared Passcode'}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="drop-shared-passcode"
                    type="text"
                    value={enteredPasscode}
                    onChange={(e) => setEnteredPasscode(e.target.value)}
                    placeholder={
                      hub.sharedPasscode.trim()
                        ? lang === 'th'
                          ? 'กรอกรหัสกลางที่ผู้เปิดจุดรับไฟล์กำหนด'
                          : 'Enter shared passcode'
                        : lang === 'th'
                        ? 'รหัสกลาง (ถ้าผู้เปิดจุดตั้งไว้)'
                        : 'Passcode (if configured)'
                    }
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm tw-input font-mono-tabular"
                  />
                </div>
              </div>
            </div>

            {/* Drag-and-Drop Multi-File Area */}
            <div className="space-y-2">
              <label className="block text-xs font-medium">
                {lang === 'th'
                  ? 'เลือก หรือ ลากวางหลายไฟล์พร้อมกัน'
                  : 'Select or Drag & Drop Multiple Files'}
              </label>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files?.length) {
                    handleQueueRawFiles(e.dataTransfer.files);
                  }
                }}
                className={`p-6 border-2 border-dashed tw-control text-center space-y-3 transition-colors ${
                  isDragging
                    ? 'border-[var(--accent-bg)] bg-[var(--bg-hover)]'
                    : 'tw-border tw-subtle'
                }`}
              >
                <Upload className="w-6 h-6 mx-auto text-[var(--text-muted)]" />
                <div className="space-y-1">
                  <div className="text-xs font-semibold">
                    {lang === 'th'
                      ? 'ลากไฟล์มาวางที่นี่ หรือกดปุ่มเพื่อเลือกหลายไฟล์พร้อมกัน'
                      : 'Drag files here or click to choose multiple files'}
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {lang === 'th'
                      ? `ประเภทไฟล์ที่อนุญาต: ${allowedLabels.join(', ') || 'ปิดรับไฟล์ชั่วคราว'}`
                      : `Allowed: ${allowedLabels.join(', ') || 'None'}`}
                  </div>
                </div>

                <div>
                  <input
                    ref={fileInputRef}
                    id="drop-multi-file-input"
                    type="file"
                    multiple
                    accept={acceptAttribute}
                    onChange={(e) => {
                      if (e.target.files) handleQueueRawFiles(e.target.files);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 text-xs font-semibold tw-btn-ghost inline-flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{lang === 'th' ? 'เลือกไฟล์ (หลายไฟล์ได้)' : 'Choose Files'}</span>
                  </button>
                </div>
              </div>

              {queuedFiles.length > 0 && (
                <div className="space-y-2">
                  {queuedFiles.some((qf) => qf.oversized) && (
                    <div className="px-3.5 py-2 text-xs border tw-border tw-subtle text-[var(--text-secondary)]">
                      {lang === 'th'
                        ? 'หมายเหตุ: ไฟล์ที่มีขนาดเกิน 512 KB จะบันทึกเฉพาะชื่อและขนาดอ้างอิงในโหมดเบราว์เซอร์ (เพื่อป้องกันหน่วยความจำเต็ม)'
                        : 'Note: Files over 512 KB store reference metadata only in browser storage.'}
                    </div>
                  )}
                  <div className="divide-y tw-border border tw-border tw-control">
                    {queuedFiles.map((qf) => (
                      <div
                        key={qf.id}
                        className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {qf.category === 'image' ? (
                            <ImageIcon className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                          ) : qf.category === 'excel' ? (
                            <FileSpreadsheet className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                          ) : (
                            <FileText className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                          )}
                          <span className="font-medium truncate">{qf.raw.name}</span>
                          <span className="text-[var(--text-muted)] font-mono-tabular shrink-0">
                            {formatFileSize(qf.raw.size)}
                          </span>
                          {qf.oversized && (
                            <span className="text-xs text-[var(--text-muted)] shrink-0">
                              {lang === 'th' ? '(อ้างอิงชื่อไฟล์ >512 KB)' : '(Metadata only >512 KB)'}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setQueuedFiles((prev) => prev.filter((item) => item.id !== qf.id))
                          }
                          aria-label={`Remove ${qf.raw.name}`}
                          className="p-1 tw-btn-ghost shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Text Message Input */}
            <div className="space-y-1.5">
              <label htmlFor="drop-message-input" className="block text-xs font-medium">
                {lang === 'th'
                  ? 'หรือพิมพ์ข้อความส่งเข้าจุดรวม'
                  : 'Or Write a Message to Drop Point'}
              </label>
              <textarea
                id="drop-message-input"
                rows={3}
                disabled={!hub.allowedTypes.text}
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder={
                  hub.allowedTypes.text
                    ? lang === 'th'
                      ? 'พิมพ์โน้ต รายละเอียด หรือข้อความสรุปที่จะฝากไว้พร้อมไฟล์...'
                      : 'Write a message or note to include in the drop point...'
                    : lang === 'th'
                    ? 'ผู้เปิดจุดรับไฟล์ปิดการส่งข้อความไว้ชั่วคราว'
                    : 'Text submissions are currently disabled by the host.'
                }
                className="w-full px-3.5 py-2.5 text-sm tw-input disabled:opacity-60"
              />
            </div>

            {dropError && (
              <div
                role="alert"
                className="px-3.5 py-2.5 text-xs font-medium border tw-border tw-subtle text-[var(--text-primary)]"
              >
                {dropError}
              </div>
            )}

            {dropSuccess && (
              <div className="px-3.5 py-2.5 text-xs font-medium border tw-border tw-subtle flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{dropSuccess}</span>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmittingDrop}
                className="px-5 py-2.5 text-xs font-semibold tw-btn-primary inline-flex items-center gap-2 disabled:opacity-60"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {isSubmittingDrop
                    ? lang === 'th'
                      ? 'กำลังย่อรูปและส่ง...'
                      : 'Preparing & Sending...'
                    : lang === 'th'
                    ? 'ส่งไฟล์ / ข้อความเข้าจุดรวม'
                    : 'Submit to Drop Hub'}
                </span>
              </button>
            </div>
          </form>
        </section>
      )}

      {/* TAB B: เปิดจุดรับไฟล์ */}
      {activeSubTab === 'configure' && (
        <section className="tw-surface p-6 space-y-5 shadow-xs">
          <div>
            <h2 className="text-sm font-bold">
              {lang === 'th' ? 'ตั้งค่าเปิดจุดรับไฟล์' : 'Configure Open File Drop Point'}
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {lang === 'th'
                ? 'ปรับปรุงหัวข้อ รหัสกลาง และประเภทไฟล์ที่อนุญาตได้ตลอดเวลาโดยไม่ลบข้อมูลหรือไฟล์เดิม'
                : 'Update topic, shared passcode, and allowed file types anytime without deleting prior files.'}
            </p>
          </div>

          <form onSubmit={handleSaveHostConfig} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="host-topic-input" className="block text-xs font-medium">
                  {lang === 'th' ? 'ตั้งหัวข้อเรื่อง' : 'Drop Point Topic'}
                </label>
                <input
                  id="host-topic-input"
                  type="text"
                  required
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  placeholder={
                    lang === 'th'
                      ? 'เช่น ส่งใบงานกิจกรรม / สลิปค่าใช้จ่ายทริป'
                      : 'e.g. Activity Worksheets / Trip Receipts'
                  }
                  className="w-full px-3.5 py-2.5 text-sm tw-input"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="host-passcode-input" className="block text-xs font-medium">
                  {lang === 'th' ? 'ตั้งรหัสกลาง' : 'Set Shared Passcode'}
                </label>
                <input
                  id="host-passcode-input"
                  type="text"
                  value={passcodeSettingInput}
                  onChange={(e) => setPasscodeSettingInput(e.target.value)}
                  placeholder={
                    lang === 'th'
                      ? 'เช่น 1234 หรือเว้นว่างหากไม่ต้องใช้รหัส'
                      : 'e.g. 1234 or leave blank'
                  }
                  className="w-full px-3.5 py-2.5 text-sm tw-input font-mono-tabular"
                />
              </div>
            </div>

            {/* Allowed File Types Checkboxes */}
            <div className="space-y-2">
              <div className="text-xs font-medium">
                {lang === 'th'
                  ? 'ติ๊กเลือกรับประเภทไฟล์และข้อความ'
                  : 'Select Accepted File & Content Types'}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {(
                  [
                    { key: 'image', labelTh: 'รูปภาพ', labelEn: 'Images', icon: ImageIcon },
                    { key: 'text', labelTh: 'ข้อความ', labelEn: 'Text', icon: MessageSquareText },
                    { key: 'pdf', labelTh: 'PDF', labelEn: 'PDF', icon: FileText },
                    { key: 'excel', labelTh: 'เอ็กเซล', labelEn: 'Excel', icon: FileSpreadsheet },
                  ] as const
                ).map((opt) => {
                  const Icon = opt.icon;
                  const checked = allowedTypesDraft[opt.key];
                  return (
                    <label
                      key={opt.key}
                      className={`p-3 border tw-control cursor-pointer flex items-center gap-2.5 text-xs font-medium transition-colors ${
                        checked
                          ? 'tw-active-task'
                          : 'tw-border bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setAllowedTypesDraft((prev) => ({
                            ...prev,
                            [opt.key]: e.target.checked,
                          }))
                        }
                        className="w-4 h-4 accent-current shrink-0"
                      />
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{lang === 'th' ? opt.labelTh : opt.labelEn}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {configSavedMsg && (
              <div className="px-3.5 py-2.5 text-xs font-medium border tw-border tw-subtle flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{configSavedMsg}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={onOpenEditModeModal}
                className="px-3.5 py-2 text-xs font-medium tw-btn-ghost inline-flex items-center gap-1.5"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>
                  {lang === 'th' ? 'แก้ไขการตั้งค่า / เปลี่ยนโหมด' : 'Edit Settings / Change Mode'}
                </span>
              </button>

              <button
                type="submit"
                className="px-5 py-2.5 text-xs font-semibold tw-btn-primary"
              >
                {lang === 'th' ? 'บันทึกการตั้งค่าจุดรับไฟล์' : 'Save Drop Point Settings'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Central Google Drive / Google Sheets Connection Structure (Preserved & Connected) */}
      <section className="tw-surface p-5 space-y-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Cloud className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
            <div>
              <h2 className="text-xs font-semibold">
                {lang === 'th'
                  ? 'การเชื่อมต่อไปยัง Google Drive / Google Sheets ของบัญชีคุณเอง'
                  : 'Your Google Drive / Google Sheets Connection'}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                {tenant.storageMode === 'google_sheets_gas'
                  ? lang === 'th'
                    ? 'โหมด Google Sheets / Drive ส่วนตัวเปิดอยู่ · รูปและไฟล์จะส่งเข้า Drive + บันทึกลิงก์ลง Sheet ของคุณทันที'
                    : 'Personal Google Drive / Sheets sync active'
                  : lang === 'th'
                  ? 'โหมดพักข้อมูลหน้าเว็บ 14 วัน (ตัดรายชิ้นที่เกิน 14 วัน) · หรือสลับเชื่อม Drive / Sheets ของคุณเอง'
                  : '14-Day Rolling Browser Mode · Ready to connect your Google Drive / Sheets'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowGasGuide((prev) => !prev)}
              className="px-3 py-1.5 text-xs font-medium tw-btn-ghost whitespace-nowrap"
            >
              {showGasGuide
                ? lang === 'th'
                  ? 'ซ่อนวิธีเชื่อม 3 ขั้นตอน'
                  : 'Hide 3-Step Guide'
                : lang === 'th'
                ? 'วิธีเชื่อม Drive / Sheet (3 ขั้นตอน)'
                : '3-Step Drive/Sheet Guide'}
            </button>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard?.writeText(generateGoogleAppsScriptCode(tenant.orgId));
                setCentralSaveMsg(
                  lang === 'th'
                    ? 'คัดลอกโค้ด Code.gs (รองรับ DriveApp + Google Sheets) แล้ว'
                    : 'Copied DriveApp + Sheets Code.gs to clipboard'
                );
              }}
              className="px-3 py-1.5 text-xs font-medium tw-btn-ghost inline-flex items-center gap-1 whitespace-nowrap"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{lang === 'th' ? 'คัดลอก Code.gs' : 'Copy Code.gs'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const nextMode: StorageMode =
                  tenant.storageMode === 'google_sheets_gas' ? 'central_14d' : 'google_sheets_gas';
                onUpdateStorageMode(nextMode, gasUrlDraft);
                setCentralSaveMsg(
                  nextMode === 'google_sheets_gas'
                    ? lang === 'th'
                      ? 'เปิดโหมดส่งเข้า Google Drive / Sheets ของคุณแล้ว'
                      : 'Switched to Google Drive / Sheets mode'
                    : lang === 'th'
                    ? 'สลับกลับโหมดพักข้อมูลหน้าเว็บ 14 วันแล้ว'
                    : 'Switched to 14-day rolling browser mode'
                );
              }}
              className="px-3 py-1.5 text-xs font-medium tw-btn-ghost whitespace-nowrap"
            >
              {tenant.storageMode === 'google_sheets_gas'
                ? lang === 'th'
                  ? 'กำลังใช้ Drive / Sheets'
                  : 'Google Sync On'
                : lang === 'th'
                ? 'เปิดใช้โหมด Drive / Sheets'
                : 'Enable Google Sync'}
            </button>
          </div>
        </div>

        {showGasGuide && (
          <div className="p-3.5 tw-subtle border tw-border tw-control-sm text-xs space-y-1.5 text-[var(--text-secondary)]">
            <div className="font-semibold text-[var(--text-primary)]">
              {lang === 'th'
                ? 'ตั้งค่าครั้งเดียวเพื่อให้คนนอกส่งรูป/ไฟล์เข้า Google Drive & Sheets ของคุณโดยไม่ต้องล็อกอิน:'
                : 'One-time setup so anyone can drop photos/files into your own Google Drive & Sheets:'}
            </div>
            <div>
              {lang === 'th'
                ? '1) สร้าง Google Sheet ในบัญชีของคุณ -> กดเมนู ส่วนขยาย (Extensions) -> Apps Script'
                : '1) Open your Google Sheet -> Extensions -> Apps Script'}
            </div>
            <div>
              {lang === 'th'
                ? '2) กดปุ่ม "คัดลอก Code.gs" ด้านบนไปวางแทนโค้ดเดิม แล้วกดบันทึก (Ctrl+S)'
                : '2) Click "Copy Code.gs" above, paste into Code.gs, and save'}
            </div>
            <div>
              {lang === 'th'
                ? '3) กด Deploy -> New deployment -> เลือก Web app -> Execute as: Me -> Who has access: Anyone -> นำลิงก์ /exec มาวางช่องด้านล่าง'
                : '3) Deploy -> New deployment -> Web app -> Execute as: Me -> Who has access: Anyone -> paste the /exec URL below'}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <input
            type="url"
            value={gasUrlDraft}
            onChange={(e) => setGasUrlDraft(e.target.value)}
            placeholder="https://script.google.com/macros/s/.../exec (URL ของคุณ)"
            aria-label={lang === 'th' ? 'URL Google Apps Script ส่วนกลาง' : 'Central Google Apps Script URL'}
            className="flex-1 min-w-[220px] px-3 py-2 text-xs tw-input font-mono-tabular"
          />
          <button
            type="button"
            disabled={isTestingGas}
            onClick={async () => {
              const trimmed = gasUrlDraft.trim();
              if (!isValidGasWebAppUrl(trimmed)) {
                setCentralSaveMsg(
                  lang === 'th'
                    ? 'กรุณาวางลิงก์ https://script.google.com/macros/s/.../exec ก่อนทดสอบ'
                    : 'Please enter a valid https://script.google.com/.../exec URL first.'
                );
                return;
              }
              setIsTestingGas(true);
              const res = await testGasWebAppConnection(trimmed, tenant.orgId);
              setIsTestingGas(false);
              setCentralSaveMsg(
                res.synced
                  ? lang === 'th'
                    ? 'ทดสอบส่งสัญญาณสำเร็จ! ลิงก์พร้อมรับรูปเข้า Drive และ Sheet แล้ว'
                    : 'Connection verified! Ready to save files into Drive & Sheets.'
                  : lang === 'th'
                  ? `เชื่อมต่อไม่สำเร็จ (${res.error ?? 'ตรวจสอบสิทธิ์ Anyone'})`
                  : `Connection failed (${res.error ?? 'Check Anyone access'})`
              );
            }}
            className="px-3.5 py-2 text-xs font-medium tw-btn-ghost whitespace-nowrap disabled:opacity-60"
          >
            {isTestingGas
              ? lang === 'th'
                ? 'กำลังทดสอบ...'
                : 'Testing...'
              : lang === 'th'
              ? 'ทดสอบเชื่อมต่อ'
              : 'Test Sync'}
          </button>
          <button
            type="button"
            onClick={() => {
              const trimmed = gasUrlDraft.trim();
              if (trimmed && !isValidGasWebAppUrl(trimmed)) {
                setCentralSaveMsg(
                  lang === 'th'
                    ? 'URL ไม่ถูกต้อง: กรุณาระบุลิงก์ https://script.google.com/macros/s/.../exec จาก Google Apps Script'
                    : 'Invalid URL: please enter a valid https://script.google.com/... Web App URL.'
                );
                return;
              }
              onUpdateStorageMode(trimmed ? 'google_sheets_gas' : tenant.storageMode, trimmed);
              setCentralSaveMsg(
                lang === 'th'
                  ? 'บันทึกการเชื่อมต่อ Google Drive / Sheets แล้ว (ข้อมูลเดิมทั้งหมดยังอยู่ครบ)'
                  : 'Google Drive / Sheets connection saved.'
              );
            }}
            className="px-4 py-2 text-xs font-semibold tw-btn-soft whitespace-nowrap"
          >
            {lang === 'th' ? 'บันทึกการเชื่อมต่อ' : 'Save Connection'}
          </button>
        </div>
        {centralSaveMsg && <div className="text-xs text-[var(--text-secondary)]">{centralSaveMsg}</div>}
      </section>

      {/* Submitted History List + 1-Click LINE/Excel Export & Pack-and-Leave Purge */}
      <section className="tw-surface p-6 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold">
              {lang === 'th'
                ? `รายการไฟล์และข้อความที่ฝากไว้ (${hub.submissions.length})`
                : `Submitted Files & Messages (${hub.submissions.length})`}
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {lang === 'th'
                ? 'เก็บรายชิ้น 14 วันนับจากวันที่ส่ง · ส่งออกเข้า LINE / Excel หรือล้างแยกย้ายได้ทันที'
                : 'Each item kept 14 days from submission · Export to LINE / Excel or clear anytime'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyLineSummary}
              className="px-3 py-1.5 text-xs font-semibold tw-btn-soft inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{lang === 'th' ? 'คัดลอกสรุปส่งเข้า LINE' : 'Copy Summary for LINE'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3 py-1.5 text-xs font-medium tw-btn-ghost inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{lang === 'th' ? 'ส่งออก Excel (CSV)' : 'Export Excel (CSV)'}</span>
            </button>

            {hub.submissions.length > 0 && !confirmClearAll && (
              <button
                type="button"
                onClick={() => setConfirmClearAll(true)}
                className="px-3 py-1.5 text-xs font-medium tw-btn-ghost inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>
                  {lang === 'th' ? 'เก็บครบแล้ว — ล้าง & แยกย้าย' : 'Collected All — Clear & Leave'}
                </span>
              </button>
            )}
          </div>
        </div>

        {confirmClearAll && (
          <div className="p-3.5 tw-subtle border tw-border tw-control-sm flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="font-medium">
              {lang === 'th'
                ? `ยืนยันล้างรายการฝากทั้งหมด (${hub.submissions.length} รายการ)? ชื่อสถานที่ หัวข้อ และรหัสกลางจะยังอยู่ครบ`
                : `Confirm clearing all ${hub.submissions.length} submitted items? Location, topic, and passcode remain intact.`}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmClearAll(false)}
                className="px-3 py-1.5 text-xs font-medium tw-btn-ghost"
              >
                {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  onClearSubmissions();
                  setConfirmClearAll(false);
                  setHistoryActionMsg(
                    lang === 'th'
                      ? 'ล้างรายการที่ฝากไว้เรียบร้อยแล้ว — พร้อมเริ่มรอบใหม่หรือแยกย้ายได้เลย'
                      : 'Cleared all temporary dropped items cleanly.'
                  );
                }}
                className="px-3.5 py-1.5 text-xs font-semibold tw-btn-primary"
              >
                {lang === 'th' ? 'ยืนยันล้างทันที' : 'Confirm Clear Now'}
              </button>
            </div>
          </div>
        )}

        {historyActionMsg && (
          <div className="px-3.5 py-2 text-xs font-medium border tw-border tw-subtle flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>{historyActionMsg}</span>
          </div>
        )}

        {hub.submissions.length === 0 ? (
          <div className="p-6 tw-subtle border tw-border tw-control text-center text-xs text-[var(--text-muted)]">
            {lang === 'th'
              ? 'ยังไม่มีรายการที่ฝากไว้ในจุดนี้ — ลองส่งไฟล์หรือข้อความในแท็บ "แวะมาส่งไฟล์" ด้านบนได้เลย'
              : 'No items dropped here yet — send files or messages using the Drop Files tab above.'}
          </div>
        ) : (
          <div className="divide-y tw-border border tw-border tw-control">
            {hub.submissions.map((sub) => {
              const daysLeft = getItemRemainingDays(sub.createdAt, effectiveNow);
              return (
                <div key={sub.id} className="p-4 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-[var(--text-primary)]">{sub.senderName}</span>
                      <span aria-hidden="true">·</span>
                      <span>{sub.topic}</span>
                      <span aria-hidden="true">·</span>
                      <span>{sub.locationTitle}</span>
                    </div>
                    <div className="font-mono-tabular flex flex-wrap items-center gap-2">
                      <span>{sub.createdAt}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {lang === 'th' ? `อยู่ต่อ ${daysLeft} วัน` : `${daysLeft}d left`}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {sub.syncedToCentral
                          ? lang === 'th'
                            ? 'ส่งเข้า Drive/Sheets แล้ว'
                            : 'Synced to Drive/Sheets'
                          : lang === 'th'
                          ? 'พักบนหน้าเว็บ (14 วัน)'
                          : 'Browser 14d Hold'}
                      </span>
                    </div>
                  </div>

                  {sub.message && (
                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
                      {sub.message}
                    </p>
                  )}

                  {sub.files.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {sub.files.map((file) => (
                        <div
                          key={file.id}
                          className="p-2.5 tw-subtle border tw-border tw-control-sm flex items-center justify-between gap-2.5"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {file.category === 'image' && file.dataUrl ? (
                              <ImageAttachmentThumb src={file.dataUrl} alt={file.name} />
                            ) : file.category === 'image' ? (
                              <ImageIcon className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                            ) : file.category === 'excel' ? (
                              <FileSpreadsheet className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                            ) : (
                              <FileText className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                            )}
                            <div className="min-w-0">
                              <div className="text-xs font-medium truncate">{file.name}</div>
                              <div className="text-xs text-[var(--text-muted)] font-mono-tabular">
                                {file.category.toUpperCase()} · {formatFileSize(file.size)}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {file.driveUrl && (
                              <a
                                href={file.driveUrl}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`Open ${file.name} in Google Drive`}
                                className="px-2 py-1 text-xs tw-btn-ghost inline-flex items-center gap-1"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>Drive</span>
                              </a>
                            )}
                            {file.dataUrl ? (
                              <a
                                href={file.dataUrl}
                                download={file.name}
                                aria-label={`Download ${file.name}`}
                                className="p-1.5 tw-btn-ghost shrink-0"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            ) : !file.driveUrl ? (
                              <span className="text-xs text-[var(--text-muted)] shrink-0">
                                {lang === 'th' ? 'เฉพาะข้อมูลอ้างอิง (>512 KB)' : 'Metadata only'}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
