import React, { useState } from 'react';
import { Check, Palette, UserPlus, X } from 'lucide-react';
import type { LangCode, ShapeMode, ThemeMode } from '../types/system';

interface ThemeOption {
  id: ThemeMode;
  labelTh: string;
  labelEn: string;
  swatchBg: string;
  swatchAccent: string;
  isPastel: boolean;
}

export const THEME_OPTIONS: ThemeOption[] = [
  { id: 'pastel-sky', labelTh: 'ฟ้าพาสเทล (เริ่มต้น)', labelEn: 'Sky Pastel (Default)', swatchBg: '#DCEBF7', swatchAccent: '#2E5B7D', isPastel: true },
  { id: 'pastel-mint', labelTh: 'ครีม-มินต์', labelEn: 'Cream & Mint', swatchBg: '#D5EDE7', swatchAccent: '#3B7F71', isPastel: true },
  { id: 'pastel-peach', labelTh: 'พีชพาสเทล', labelEn: 'Soft Peach', swatchBg: '#FADFD3', swatchAccent: '#B85D47', isPastel: true },
  { id: 'pastel-lavender', labelTh: 'ลาเวนเดอร์', labelEn: 'Soft Lavender', swatchBg: '#E4DBF4', swatchAccent: '#655096', isPastel: true },
  { id: 'pastel-rose', labelTh: 'โรสพิงค์', labelEn: 'Blush Rose', swatchBg: '#F8DAE1', swatchAccent: '#A34D60', isPastel: true },
  { id: 'mono-light', labelTh: 'ขาว-ดำ', labelEn: 'Monochrome Light', swatchBg: '#FFFFFF', swatchAccent: '#111111', isPastel: false },
];

interface ThemeShapeLangBarProps {
  theme: ThemeMode;
  onThemeChange: (t: ThemeMode) => void;
  shape: ShapeMode;
  onShapeChange: (s: ShapeMode) => void;
  lang: LangCode;
  onLangChange: (l: LangCode) => void;
  variant?: 'floating' | 'inline';
  onOpenApplicantMode?: () => void;
}

export const ThemeShapeLangBar: React.FC<ThemeShapeLangBarProps> = ({
  theme,
  onThemeChange,
  shape,
  onShapeChange,
  lang,
  onLangChange,
  variant = 'floating',
  onOpenApplicantMode,
}) => {
  const [open, setOpen] = useState(false);

  const currentTheme = THEME_OPTIONS.find((x) => x.id === theme) ?? THEME_OPTIONS[0];

  const popoverPanel = open && (
    <div
      className={`w-80 tw-surface shadow-xl p-4 space-y-4 z-50 ${
        variant === 'floating'
          ? 'absolute bottom-12 right-0'
          : 'absolute top-11 right-0'
      }`}
      role="dialog"
      aria-label={lang === 'th' ? 'เลือกธีมสี รูปทรง และภาษา' : 'Theme, Shape & Language'}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold">
          {lang === 'th' ? 'ธีมสี รูปทรง & ภาษา' : 'Theme, Shape & Language'}
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={lang === 'th' ? 'ปิด' : 'Close'}
          className="p-1 tw-btn-ghost"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Monochrome Options */}
      <div className="space-y-1.5">
        <div className="text-xs text-[var(--text-muted)]">
          {lang === 'th' ? 'โหมดองค์กรมาตรฐาน (ซ่อนมาสคอต)' : 'Enterprise Monochrome (No Mascot)'}
        </div>
        <div className="grid grid-cols-1 gap-1.5">
          {THEME_OPTIONS.filter((t) => !t.isPastel).map((opt) => {
            const active = theme === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onThemeChange(opt.id)}
                className={`px-2.5 py-2 text-xs font-medium tw-control-sm border flex items-center gap-2 text-left ${
                  active
                    ? 'border-[var(--accent-bg)] bg-[var(--bg-subtle)] font-semibold'
                    : 'tw-border hover:bg-[var(--bg-subtle)]'
                }`}
              >
                <span
                  className="w-4 h-4 rounded-full border border-black/20 shrink-0 flex items-center justify-center"
                  style={{ backgroundColor: opt.swatchBg }}
                >
                  {active && <Check className="w-2.5 h-2.5" style={{ color: opt.swatchAccent }} />}
                </span>
                <span className="truncate">{lang === 'th' ? opt.labelTh : opt.labelEn}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 6 Pastel Themes (Shows Cloud Mascot) */}
      <div className="space-y-1.5">
        <div className="text-xs text-[var(--text-muted)]">
          {lang === 'th' ? 'โทนสีพาสเทล (เปิดมาสคอตน้องเมฆ)' : 'Pastel Palettes (Shows Cloud Mascot)'}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {THEME_OPTIONS.filter((t) => t.isPastel).map((opt) => {
            const active = theme === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onThemeChange(opt.id)}
                className={`px-2.5 py-2 text-xs font-medium tw-control-sm border flex items-center gap-2 text-left ${
                  active
                    ? 'border-[var(--accent-bg)] bg-[var(--bg-subtle)] font-semibold'
                    : 'tw-border hover:bg-[var(--bg-subtle)]'
                }`}
              >
                <span
                  className="w-4 h-4 rounded-full border border-black/15 shrink-0 flex items-center justify-center"
                  style={{ backgroundColor: opt.swatchBg }}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: opt.swatchAccent }}
                  />
                </span>
                <span className="truncate">{lang === 'th' ? opt.labelTh : opt.labelEn}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Shape & Language */}
      <div className="pt-2 border-t tw-border grid grid-cols-2 gap-2">
        <div>
          <div className="text-xs text-[var(--text-muted)] mb-1">
            {lang === 'th' ? 'รูปทรง' : 'Corner Shape'}
          </div>
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => onShapeChange('rounded')}
              className={`py-1.5 text-xs font-medium tw-control-sm ${
                shape === 'rounded' ? 'tw-btn-primary' : 'tw-btn-ghost'
              }`}
            >
              {lang === 'th' ? 'ขอบมน' : 'Rounded'}
            </button>
            <button
              type="button"
              onClick={() => onShapeChange('square')}
              className={`py-1.5 text-xs font-medium tw-control-sm ${
                shape === 'square' ? 'tw-btn-primary' : 'tw-btn-ghost'
              }`}
            >
              {lang === 'th' ? 'เหลี่ยม' : 'Square'}
            </button>
          </div>
        </div>

        <div>
          <div className="text-xs text-[var(--text-muted)] mb-1">
            {lang === 'th' ? 'ภาษา' : 'Language'}
          </div>
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => onLangChange('th')}
              className={`py-1.5 text-xs font-medium tw-control-sm ${
                lang === 'th' ? 'tw-btn-primary' : 'tw-btn-ghost'
              }`}
            >
              ไทย
            </button>
            <button
              type="button"
              onClick={() => onLangChange('en')}
              className={`py-1.5 text-xs font-medium tw-control-sm ${
                lang === 'en' ? 'tw-btn-primary' : 'tw-btn-ghost'
              }`}
            >
              EN
            </button>
          </div>
        </div>
      </div>

      {onOpenApplicantMode && (
        <div className="pt-2 border-t tw-border">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onOpenApplicantMode();
            }}
            className="w-full py-2 px-3 text-xs font-medium tw-btn-soft inline-flex items-center justify-center gap-1.5"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{lang === 'th' ? 'เปิดโหมดผู้สมัครเข้าใช้งาน' : 'Open Applicant Mode'}</span>
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label={lang === 'th' ? 'ธีมสี รูปทรง และภาษา' : 'Theme, shape and language'}
        className="px-3.5 py-2 text-xs font-medium tw-btn-ghost shadow-sm inline-flex items-center gap-2 whitespace-nowrap shrink-0"
      >
        <span
          className="w-3 h-3 rounded-full border border-black/20 shrink-0"
          style={{ backgroundColor: currentTheme.isPastel ? currentTheme.swatchBg : currentTheme.swatchAccent }}
        />
        <Palette className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
        <span>
          {lang === 'th' ? 'ธีมสี & รูปทรง · TH' : 'Theme & Shape · EN'}
        </span>
      </button>

      {popoverPanel}
    </div>
  );
};
