import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, CreditCard, Download, Link2 } from 'lucide-react';
import type { LangCode } from '../types/system';
import { buildDirectPortalUrl } from '../utils/profileCard';

interface OrgBusinessCardProps {
  orgId: string;
  orgNameTh: string;
  orgNameEn: string;
  lang: LangCode;
  defaultTarget?: 'profile' | 'drop' | 'home';
}

export const OrgBusinessCard: React.FC<OrgBusinessCardProps> = ({
  orgId,
  orgNameTh,
  orgNameEn,
  lang,
  defaultTarget = 'profile',
}) => {
  const [targetView, setTargetView] = useState<'profile' | 'drop' | 'home'>(defaultTarget);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);

  const shareUrl =
    typeof window !== 'undefined'
      ? buildDirectPortalUrl(window.location.href, orgId, targetView)
      : buildDirectPortalUrl('https://example.local/', orgId, targetView);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(shareUrl, {
      width: 280,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [shareUrl]);

  const targetCaptionTh =
    targetView === 'profile'
      ? 'สแกน QR หรือกรอกรหัสองค์กร เพื่อฝากประวัติ / อัปเดตข้อมูลส่วนตัว'
      : targetView === 'drop'
      ? 'สแกน QR หรือกรอกรหัสองค์กร เพื่อแวะฝากไฟล์และเอกสารรวม'
      : 'สแกน QR หรือกรอกรหัสองค์กร เพื่อเข้าสู่หน้าหลักองค์กร';

  const targetCaptionEn =
    targetView === 'profile'
      ? 'Scan QR or enter Org Code to submit your profile or update info'
      : targetView === 'drop'
      ? 'Scan QR or enter Org Code to drop files or documents'
      : 'Scan QR or enter Org Code to open organization portal';

  const handleDownloadBusinessCardPng = () => {
    if (!qrDataUrl) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1000;
      canvas.height = 580;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Dignified off-white editorial card background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 1000, 580);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 4;
      ctx.strokeRect(20, 20, 960, 540);

      // Subtle top accent bar
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(20, 20, 960, 14);

      // Left column: Org Name, Org Code, Caption
      ctx.fillStyle = '#475569';
      ctx.font = '600 22px sans-serif';
      ctx.fillText(
        targetView === 'profile'
          ? 'PORTAL FOR PROFILE & INFO SUBMISSION'
          : targetView === 'drop'
          ? 'SHARED FILE DROP PORTAL'
          : 'ORGANIZATION ACCESS CARD',
        64,
        104
      );

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 42px sans-serif';
      ctx.fillText(orgNameTh.slice(0, 28), 64, 174);

      if (orgNameEn && orgNameEn !== orgNameTh) {
        ctx.fillStyle = '#475569';
        ctx.font = '500 24px sans-serif';
        ctx.fillText(orgNameEn.slice(0, 40), 64, 214);
      }

      // Org Code Badge box
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(64, 260, 360, 104);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.strokeRect(64, 260, 360, 104);

      ctx.fillStyle = '#64748b';
      ctx.font = '600 18px sans-serif';
      ctx.fillText('รหัสองค์กร (ORGANIZATION CODE)', 86, 294);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 40px monospace';
      ctx.fillText(orgId, 86, 344);

      ctx.fillStyle = '#334155';
      ctx.font = '500 21px sans-serif';
      ctx.fillText(
        lang === 'th' ? targetCaptionTh : targetCaptionEn,
        64,
        436
      );

      ctx.fillStyle = '#64748b';
      ctx.font = '400 18px sans-serif';
      ctx.fillText(
        'ระบบไม่เก็บข้อมูลส่วนตัวถาวร · ข้อมูลพักบนระบบ 14 วันหรือส่งตรงเข้าองค์กร',
        64,
        506
      );

      // Right column: QR Code
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(640, 108, 300, 360);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.strokeRect(640, 108, 300, 360);
      ctx.drawImage(img, 665, 130, 250, 250);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('สแกนเพื่อเข้าใช้งานทันที', 790, 424);
      ctx.textAlign = 'left';

      const pngUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = `BusinessCard_${orgId}_${targetView}.png`;
      a.click();
    };
    img.src = qrDataUrl;
  };

  return (
    <section className="tw-surface p-5 space-y-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
          <div>
            <h3 className="text-sm font-bold">
              {lang === 'th'
                ? 'นามบัตรรหัสองค์กร & QR Code สำหรับพิมพ์หรือแจกลูกค้า'
                : 'Organization Business Card & Direct QR Code'}
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              {lang === 'th'
                ? 'นำการ์ดนี้ไปใส่นามบัตรหรือป้ายหน้าร้าน ผู้ติดต่อสแกนแล้วเข้ากรอกข้อมูลได้ทันทีโดยไม่ต้องพิมพ์รหัสเอง'
                : 'Share or print this card so visitors can scan straight into your profile or file-drop portal.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'profile', labelTh: 'QR ฝากประวัติ', labelEn: 'Profile QR' },
              { id: 'drop', labelTh: 'QR ฝากไฟล์รวม', labelEn: 'File Drop QR' },
              { id: 'home', labelTh: 'QR หน้าหลัก', labelEn: 'Org Home QR' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setTargetView(opt.id)}
              className={`px-2.5 py-1.5 text-xs font-medium tw-control-sm ${
                targetView === opt.id ? 'tw-btn-primary' : 'tw-btn-ghost'
              }`}
            >
              {lang === 'th' ? opt.labelTh : opt.labelEn}
            </button>
          ))}
        </div>
      </div>

      {/* Visual Business Card Preview */}
      <div className="p-5 border tw-border tw-control bg-[var(--bg-surface)] flex flex-col sm:flex-row items-center justify-between gap-5">
        <div className="space-y-3 min-w-0 flex-1 w-full">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {targetView === 'profile'
              ? lang === 'th'
                ? 'จุดรับฝากประวัติ / อัปเดตข้อมูล'
                : 'Profile & Info Submission Portal'
              : targetView === 'drop'
              ? lang === 'th'
                ? 'จุดฝากไฟล์รวม'
                : 'Shared File Drop Hub'
              : lang === 'th'
              ? 'พอร์ทัลองค์กร'
              : 'Organization Portal'}
          </div>

          <div>
            <div className="text-lg font-bold tracking-tight truncate">{orgNameTh}</div>
            {orgNameEn && orgNameEn !== orgNameTh && (
              <div className="text-xs text-[var(--text-secondary)] truncate">{orgNameEn}</div>
            )}
          </div>

          <div className="inline-flex flex-col px-3.5 py-2 tw-subtle border tw-border tw-control-sm">
            <span className="text-[11px] font-medium text-[var(--text-muted)]">
              {lang === 'th' ? 'รหัสองค์กร (Organization Code)' : 'Organization Code'}
            </span>
            <span className="font-mono-tabular text-base font-bold tracking-wider">{orgId}</span>
          </div>

          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            {lang === 'th' ? targetCaptionTh : targetCaptionEn}
          </p>
        </div>

        <div className="p-3 tw-subtle border tw-border tw-control-sm flex flex-col items-center gap-1.5 shrink-0">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`QR Code for ${orgId}`}
              className="w-32 h-32 bg-white p-1 border tw-border"
            />
          ) : (
            <div className="w-32 h-32 bg-white border tw-border flex items-center justify-center text-xs text-[var(--text-muted)]">
              QR...
            </div>
          )}
          <span className="text-[11px] font-medium text-[var(--text-muted)]">
            {lang === 'th' ? 'สแกนเพื่อเข้าใช้งาน' : 'Scan to Open'}
          </span>
        </div>
      </div>

      {/* Share & Download Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] min-w-0 flex-1">
          <Link2 className="w-3.5 h-3.5 shrink-0" />
          <span className="font-mono-tabular truncate">{shareUrl}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard?.writeText(shareUrl);
              setCopiedLink(true);
              window.setTimeout(() => setCopiedLink(false), 2500);
            }}
            className="px-3 py-1.5 text-xs font-medium tw-btn-ghost inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>
              {copiedLink
                ? lang === 'th'
                  ? 'คัดลอกลิงก์แล้ว'
                  : 'Link Copied'
                : lang === 'th'
                ? 'คัดลอกลิงก์ตรง'
                : 'Copy Direct Link'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleDownloadBusinessCardPng}
            disabled={!qrDataUrl}
            className="px-3.5 py-1.5 text-xs font-semibold tw-btn-primary inline-flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{lang === 'th' ? 'ดาวน์โหลดนามบัตร (.png)' : 'Download Card (.png)'}</span>
          </button>
        </div>
      </div>
    </section>
  );
};
