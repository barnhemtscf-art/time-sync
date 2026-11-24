import React, { useEffect, useState } from 'react';
import {
  Briefcase,
  FolderUp,
  GraduationCap,
  HeartHandshake,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type { FileDropHubConfig, FileDropModeId, LangCode } from '../types/system';
import {
  FILE_DROP_MODES,
  getFileDropModeMeta,
  resolveLocationTitleUpdate,
} from '../utils/fileDrop';

interface FileDropModeModalProps {
  open: boolean;
  lang: LangCode;
  orgNameTh: string;
  orgNameEn: string;
  existingHub?: FileDropHubConfig;
  initialModeSelected?: boolean;
  onConfirm: (payload: {
    modeId: FileDropModeId;
    customLocationTitle: string;
    customCategoryLabel?: string;
  }) => void;
  onSkip: () => void;
}

const MODE_ICONS: Record<FileDropModeId, React.ComponentType<{ className?: string }>> = {
  org_edu: GraduationCap,
  biz_event: Briefcase,
  personal_family: HeartHandshake,
  custom: SlidersHorizontal,
};

export const FileDropModeModal: React.FC<FileDropModeModalProps> = ({
  open,
  lang,
  orgNameTh,
  orgNameEn,
  existingHub,
  initialModeSelected = false,
  onConfirm,
  onSkip,
}) => {
  const [selectedMode, setSelectedMode] = useState<FileDropModeId | null>(
    initialModeSelected ? (existingHub?.modeId ?? 'org_edu') : null
  );
  const [locationInput, setLocationInput] = useState(existingHub?.customLocationTitle ?? '');
  const [customCategoryInput, setCustomCategoryInput] = useState(
    existingHub?.customCategoryLabel ?? ''
  );

  useEffect(() => {
    if (!open) return;
    setSelectedMode(initialModeSelected ? (existingHub?.modeId ?? 'org_edu') : null);
    setLocationInput(existingHub?.customLocationTitle ?? '');
    setCustomCategoryInput(existingHub?.customCategoryLabel ?? '');
  }, [open, initialModeSelected, existingHub]);

  if (!open) return null;

  const activeMeta = selectedMode ? getFileDropModeMeta(selectedMode) : null;
  const fallbackTitle = lang === 'th' ? orgNameTh : orgNameEn;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMode) return;
    const resolvedTitle = resolveLocationTitleUpdate(
      existingHub?.customLocationTitle,
      locationInput,
      fallbackTitle
    );
    const resolvedCategory =
      selectedMode === 'custom'
        ? customCategoryInput.trim() || existingHub?.customCategoryLabel || undefined
        : undefined;

    onConfirm({
      modeId: selectedMode,
      customLocationTitle: resolvedTitle,
      customCategoryLabel: resolvedCategory,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="file-drop-mode-modal-title"
    >
      <div className="w-full max-w-2xl tw-surface shadow-lg overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b tw-border flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FolderUp className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
              <h2 id="file-drop-mode-modal-title" className="text-base font-bold">
                {lang === 'th' ? 'เลือกโหมดจุดฝากไฟล์รวม' : 'Select Shared File Drop Hub Mode'}
              </h2>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {lang === 'th'
                ? 'ไม่ต้องเข้าบ่อย แค่แวะเข้ามาฝากไฟล์หรือข้อความรวมกันในจุดเดียวก็ได้'
                : 'No need to check in often — just drop files or messages together in one shared hub.'}
            </p>
          </div>

          <button
            type="button"
            onClick={onSkip}
            aria-label={lang === 'th' ? 'ปิดหน้าต่างเลือกโหมด' : 'Close mode selector'}
            className="p-1.5 tw-btn-ghost shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label={lang === 'th' ? 'โหมดจุดฝากไฟล์รวม' : 'Drop Hub Modes'}>
            {FILE_DROP_MODES.map((mode) => {
              const Icon = MODE_ICONS[mode.id];
              const isSelected = selectedMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setSelectedMode(mode.id)}
                  className={`text-left p-4 border tw-control transition-all flex items-start gap-3 cursor-pointer ${
                    isSelected
                      ? 'tw-active-task shadow-xs'
                      : 'tw-border bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)]'
                  }`}
                >
                  <div
                    className={`w-9 h-9 tw-control-sm flex items-center justify-center shrink-0 mt-0.5 ${
                      isSelected ? 'bg-[var(--bg-surface)] text-[var(--text-primary)]' : 'tw-subtle text-[var(--text-secondary)]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <div className="text-sm font-semibold">
                      {lang === 'th' ? mode.titleTh : mode.titleEn}
                    </div>
                    <p
                      className={`text-xs leading-relaxed ${
                        isSelected ? 'opacity-90' : 'text-[var(--text-muted)]'
                      }`}
                    >
                      {lang === 'th' ? mode.descTh : mode.descEn}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Revealed immediately after clicking any mode */}
          {activeMeta && (
            <div className="p-4 tw-subtle border tw-border tw-control space-y-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="file-drop-location-input"
                  className="block text-xs font-semibold text-[var(--text-primary)]"
                >
                  {lang === 'th'
                    ? 'ชื่อสถานที่ / หน่วยงาน / กลุ่ม / หัวข้อจุดรวมไฟล์'
                    : 'Location / Organization / Group / Collection Hub Title'}
                </label>
                <input
                  id="file-drop-location-input"
                  type="text"
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  placeholder={lang === 'th' ? activeMeta.placeholderTh : activeMeta.placeholderEn}
                  className="w-full px-3.5 py-2.5 text-sm tw-input"
                />
                {existingHub?.customLocationTitle && (
                  <p className="text-xs text-[var(--text-muted)]">
                    {lang === 'th'
                      ? `ค่าเดิมที่ตั้งไว้: "${existingHub.customLocationTitle}" (จะคงค่าเดิมไว้หากไม่ได้กรอกชื่อใหม่)`
                      : `Previous saved title: "${existingHub.customLocationTitle}" (kept if left unchanged)`}
                  </p>
                )}
              </div>

              {selectedMode === 'custom' && (
                <div className="space-y-1.5">
                  <label
                    htmlFor="file-drop-custom-category"
                    className="block text-xs font-medium text-[var(--text-secondary)]"
                  >
                    {lang === 'th'
                      ? 'ชื่อหมวดหมู่ที่คุณตั้งเอง (ไม่บังคับ)'
                      : 'Custom Category Label (Optional)'}
                  </label>
                  <input
                    id="file-drop-custom-category"
                    type="text"
                    value={customCategoryInput}
                    onChange={(e) => setCustomCategoryInput(e.target.value)}
                    placeholder={
                      lang === 'th'
                        ? 'เช่น ฝ่ายประสานงาน / โปรเจกต์ภาพถ่าย'
                        : 'e.g. Media Team / Special Archive'
                    }
                    className="w-full px-3.5 py-2 text-sm tw-input"
                  />
                </div>
              )}
            </div>
          )}

          {/* Footer Buttons */}
          <div className="pt-2 border-t tw-border flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={onSkip}
              className="px-4 py-2 text-xs font-medium tw-btn-ghost"
            >
              {lang === 'th' ? 'ข้าม / กลับหน้าหลัก' : 'Skip / Back to Dashboard'}
            </button>

            <button
              type="submit"
              disabled={!selectedMode}
              className="px-5 py-2.5 text-xs font-semibold tw-btn-primary inline-flex items-center gap-2"
            >
              <FolderUp className="w-4 h-4" />
              <span>
                {lang === 'th'
                  ? initialModeSelected
                    ? 'บันทึกและเปิดจุดฝากไฟล์รวม'
                    : 'เข้าสู่จุดฝากไฟล์รวม'
                  : initialModeSelected
                  ? 'Save & Open Drop Hub'
                  : 'Open File Drop Hub'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
