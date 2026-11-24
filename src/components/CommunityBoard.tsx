import React, { useEffect, useState } from 'react';
import {
  Bell,
  BookOpen,
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileBadge2,
  Gift,
  Megaphone,
  PackageSearch,
  Plus,
  Shuffle,
  Sparkles,
} from 'lucide-react';
import type {
  AnnouncementItem,
  BoardModeConfig,
  BoardModeIcon,
  DailyDutyItem,
  GiftExchangeState,
  KnowledgeArticle,
  LangCode,
  LostFoundItem,
  SecretPoll,
} from '../types/system';
import { TRANSLATIONS } from '../i18n/translations';
import { DEFAULT_BOARD_MODES } from '../data/seedData';

interface CommunityBoardProps {
  lang: LangCode;
  boardModes?: BoardModeConfig[];
  announcements: AnnouncementItem[];
  poll: SecretPoll;
  duties: DailyDutyItem[];
  knowledge: KnowledgeArticle[];
  giftExchange: GiftExchangeState;
  lostFound: LostFoundItem[];
  sessionVoteKey: string;
  onCastVote: (optionId: string) => void;
  onAddPollOption: (text: string) => void;
  onDrawGiftPairs: () => void;
  onSubmitLostFound: (item: Omit<LostFoundItem, 'id' | 'createdAt' | 'status'>) => void;
  onOpenProfileDrop?: () => void;
  profileCount?: number;
}

const BOARD_ICON_MAP: Record<BoardModeIcon, React.ComponentType<{ className?: string }>> = {
  bell: Bell,
  check: CheckSquare,
  calendar: CalendarDays,
  book: BookOpen,
  package: PackageSearch,
  gift: Gift,
  sparkles: Sparkles,
  megaphone: Megaphone,
  clipboard: ClipboardList,
};

export const CommunityBoard: React.FC<CommunityBoardProps> = ({
  lang,
  boardModes,
  announcements,
  poll,
  duties,
  knowledge,
  giftExchange,
  lostFound,
  sessionVoteKey,
  onCastVote,
  onAddPollOption,
  onDrawGiftPairs,
  onSubmitLostFound,
  onOpenProfileDrop,
  profileCount = 0,
}) => {
  const t = TRANSLATIONS[lang];
  const resolvedModes = (boardModes && boardModes.length > 0 ? boardModes : DEFAULT_BOARD_MODES).filter(
    (m) => m.enabled
  );
  const [activeModeId, setActiveModeId] = useState<string>(resolvedModes[0]?.id ?? 'announcements');
  const [announcementIdx, setAnnouncementIdx] = useState(0);
  const [visibleImages, setVisibleImages] = useState<Record<string, boolean>>({});
  const [newOptionText, setNewOptionText] = useState('');

  // Keep activeModeId valid if modes are disabled or deleted
  useEffect(() => {
    if (resolvedModes.length > 0 && !resolvedModes.some((m) => m.id === activeModeId)) {
      setActiveModeId(resolvedModes[0].id);
    }
  }, [resolvedModes, activeModeId]);

  // Lost & Found public submission state
  const [lfType, setLfType] = useState<'lost' | 'found'>('lost');
  const [lfItemName, setLfItemName] = useState('');
  const [lfLocation, setLfLocation] = useState('');
  const [lfReporter, setLfReporter] = useState('');
  const [lfContact, setLfContact] = useState('');
  const [lfFeedback, setLfFeedback] = useState('');

  const hasVoted = poll.votedSessionKeys.includes(sessionVoteKey);
  const totalVotes = poll.options.reduce((sum, o) => sum + o.votes, 0);

  const primaryModes = resolvedModes.filter((m) => m.builtinType !== 'gifts');
  const giftMode = resolvedModes.find((m) => m.builtinType === 'gifts');
  const announcementsMode = resolvedModes.find((m) => m.builtinType === 'announcements');
  const activeMode = resolvedModes.find((m) => m.id === activeModeId) ?? resolvedModes[0];
  const activeBuiltin = activeMode?.builtinType;

  const handleAddOption = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newOptionText.trim();
    if (!cleaned) return;
    onAddPollOption(cleaned);
    setNewOptionText('');
  };

  const handleLostFoundSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lfItemName.trim() || !lfLocation.trim() || !lfReporter.trim()) return;
    onSubmitLostFound({
      type: lfType,
      itemName: lfItemName.trim(),
      location: lfLocation.trim(),
      reporterName: lfReporter.trim(),
      contactNote: lfContact.trim() || '-',
    });
    setLfItemName('');
    setLfLocation('');
    setLfReporter('');
    setLfContact('');
    setLfFeedback(
      lang === 'th'
        ? 'บันทึกแจ้งของหาย/เก็บของได้เรียบร้อยแล้ว'
        : 'Lost & Found report submitted.'
    );
  };

  const currentAnn =
    announcements.length > 0 ? announcements[announcementIdx % announcements.length] : null;

  return (
    <section className="tw-surface overflow-hidden shadow-xs" aria-label={t.boardSectionTitle}>
      {/* Top Row matching Screenshot 1 & 2: configurable mode tabs on left, Profile + Gift + < > pager on right */}
      <div className="px-3.5 sm:px-4 py-2.5 border-b tw-border flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex flex-wrap items-center gap-0.5" role="tablist">
          {primaryModes.map((mode) => {
            const Icon = BOARD_ICON_MAP[mode.icon] ?? Bell;
            const active = activeMode?.id === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveModeId(mode.id)}
                className={`px-2 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 tw-control-sm inline-flex items-center gap-1 transition-colors ${
                  active
                    ? 'bg-[var(--bg-subtle)] text-[var(--text-primary)] font-semibold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{lang === 'th' ? mode.labelTh : mode.labelEn}</span>
              </button>
            );
          })}
        </div>

        {(onOpenProfileDrop || giftMode || (announcementsMode && announcements.length > 0)) && (
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {onOpenProfileDrop && (
              <button
                type="button"
                onClick={onOpenProfileDrop}
                data-testid="board-profile-drop-btn"
                className="px-2.5 py-1.5 text-xs font-semibold tw-btn-primary tw-control-sm whitespace-nowrap inline-flex items-center gap-1"
              >
                <FileBadge2 className="w-3.5 h-3.5" />
                <span>
                  {lang === 'th'
                    ? profileCount > 0
                      ? `ฝากประวัติ / อัปเดตข้อมูลส่วนบุคคล (${profileCount})`
                      : 'ฝากประวัติ / อัปเดตข้อมูลส่วนบุคคล'
                    : profileCount > 0
                    ? `Profile / Info Update (${profileCount})`
                    : 'Profile / Info Update'}
                </span>
              </button>
            )}

            {giftMode && (
              <button
                type="button"
                onClick={() => setActiveModeId(giftMode.id)}
                className={`px-2 py-1.5 text-xs font-medium whitespace-nowrap inline-flex items-center gap-1 tw-control-sm ${
                  activeMode?.id === giftMode.id ? 'tw-btn-primary' : 'tw-btn-soft'
                }`}
              >
                {React.createElement(BOARD_ICON_MAP[giftMode.icon] ?? Gift, {
                  className: 'w-3.5 h-3.5',
                })}
                <span>{lang === 'th' ? giftMode.labelTh : giftMode.labelEn}</span>
              </button>
            )}

            {announcementsMode && announcements.length > 0 && (
              <div className="inline-flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setActiveModeId(announcementsMode.id);
                    setAnnouncementIdx(
                      (prev) => (prev - 1 + announcements.length) % Math.max(1, announcements.length)
                    );
                  }}
                  aria-label={lang === 'th' ? 'ประกาศก่อนหน้า' : 'Previous announcement'}
                  className="p-1.5 tw-btn-ghost"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveModeId(announcementsMode.id);
                    setAnnouncementIdx((prev) => (prev + 1) % Math.max(1, announcements.length));
                  }}
                  aria-label={lang === 'th' ? 'ประกาศถัดไป' : 'Next announcement'}
                  className="p-1.5 tw-btn-ghost"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tab Content */}
      <div className="p-5">
        {!activeMode && (
          <div className="text-center py-6 text-xs text-[var(--text-muted)]">
            {lang === 'th'
              ? 'ยังไม่มีโหมดที่เปิดใช้งานในบอร์ดส่วนกลาง (ผู้บริหารสามารถเปิดใช้งานได้ที่ศูนย์ควบคุมหลังบ้าน)'
              : 'No community board modes are currently enabled.'}
          </div>
        )}

        {/* 1. Announcements with carousel counter & 🖼️ ดูรูป toggle */}
        {activeBuiltin === 'announcements' && currentAnn && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-mono-tabular">
              <span>
                {lang === 'th' ? 'ประกาศสำคัญ' : 'Notice'} · {currentAnn.author} · {currentAnn.date}
              </span>
              <span>
                {(announcementIdx % announcements.length) + 1} / {announcements.length}
              </span>
            </div>

            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1 flex-1 min-w-[220px]">
                <h3 className="text-sm font-semibold">
                  {lang === 'th' ? currentAnn.titleTh : currentAnn.titleEn}
                </h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  {lang === 'th' ? currentAnn.bodyTh : currentAnn.bodyEn}
                </p>
              </div>

              {currentAnn.imageUrl && (
                <button
                  type="button"
                  onClick={() =>
                    setVisibleImages((prev) => ({
                      ...prev,
                      [currentAnn.id]: !prev[currentAnn.id],
                    }))
                  }
                  className="px-3 py-1.5 text-xs font-medium tw-btn-ghost whitespace-nowrap shrink-0"
                >
                  {visibleImages[currentAnn.id] ? t.toggleImageHide : t.toggleImageShow}
                </button>
              )}
            </div>

            {currentAnn.imageUrl && visibleImages[currentAnn.id] && (
              <div className="overflow-hidden border tw-border tw-control">
                <img
                  src={currentAnn.imageUrl}
                  alt={lang === 'th' ? currentAnn.titleTh : currentAnn.titleEn}
                  referrerPolicy="no-referrer"
                  className="w-full max-h-64 object-cover"
                />
              </div>
            )}
          </div>
        )}

        {/* 2. Secret Vote (stacked line-by-line options + "+ เพิ่มตัวเลือก") */}
        {activeBuiltin === 'poll' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">
                {lang === 'th' ? poll.questionTh : poll.questionEn}
              </h3>
              <span className="text-xs text-[var(--text-muted)] font-mono-tabular">
                {totalVotes} {lang === 'th' ? 'คะแนน' : 'votes'}
              </span>
            </div>

            <div className="space-y-2">
              {poll.options.map((opt) => {
                const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                return (
                  <div
                    key={opt.id}
                    className="flex flex-col gap-1.5 p-3 border tw-border tw-control"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">{opt.text}</span>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-[var(--text-muted)] font-mono-tabular">
                          {opt.votes} ({pct}%)
                        </span>
                        <button
                          type="button"
                          disabled={hasVoted}
                          onClick={() => onCastVote(opt.id)}
                          className="px-3 py-1 text-xs font-medium tw-btn-primary whitespace-nowrap"
                        >
                          {hasVoted ? t.votedBadge : t.voteBtn}
                        </button>
                      </div>
                    </div>
                    <div className="w-full h-1.5 tw-subtle overflow-hidden">
                      <div
                        className="h-full bg-[var(--accent-bg)] transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <form onSubmit={handleAddOption} className="flex gap-2 pt-2">
              <input
                type="text"
                value={newOptionText}
                onChange={(e) => setNewOptionText(e.target.value)}
                placeholder={t.addOptionPlaceholder}
                aria-label={t.addOptionPlaceholder}
                className="flex-1 px-3 py-2 text-sm tw-input"
              />
              <button
                type="submit"
                className="px-3.5 py-2 text-xs font-medium tw-btn-ghost whitespace-nowrap inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{lang === 'th' ? 'เพิ่มตัวเลือก' : 'Add Option'}</span>
              </button>
            </form>
          </div>
        )}

        {/* 3. Daily Duties */}
        {activeBuiltin === 'duties' && (
          <div className="divide-y tw-border">
            {duties.map((d) => (
              <div key={d.id} className="py-3 first:pt-0 last:pb-0 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">
                    {lang === 'th' ? d.zoneTh : d.zoneEn}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                    {d.assignees.join(' · ')}
                  </div>
                </div>
                <span className="text-xs text-[var(--text-muted)] font-mono-tabular">
                  {d.timeLabel}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* 4. Knowledge Base */}
        {activeBuiltin === 'knowledge' && (
          <div className="divide-y tw-border">
            {knowledge.map((item) => (
              <article key={item.id} className="py-3.5 first:pt-0 last:pb-0 space-y-1">
                <div className="text-xs text-[var(--text-muted)]">{item.category}</div>
                <h3 className="text-sm font-semibold">
                  {lang === 'th' ? item.titleTh : item.titleEn}
                </h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  {lang === 'th' ? item.summaryTh : item.summaryEn}
                </p>
              </article>
            ))}
          </div>
        )}

        {/* 5. Gift Exchange */}
        {activeBuiltin === 'gifts' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <Gift className="w-4 h-4" />
                  <span>{lang === 'th' ? giftExchange.eventTitleTh : giftExchange.eventTitleEn}</span>
                </h3>
                <div className="text-xs text-[var(--text-muted)] font-mono-tabular">
                  {lang === 'th'
                    ? `งบประมาณต่อชิ้นไม่เกิน ${giftExchange.budgetCap} บาท · ผู้เข้าร่วม ${giftExchange.participants.length} คน`
                    : `Budget cap ${giftExchange.budgetCap} THB · ${giftExchange.participants.length} participants`}
                </div>
              </div>
              <button
                type="button"
                onClick={onDrawGiftPairs}
                className="px-3.5 py-2 text-xs font-medium tw-btn-primary inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>{lang === 'th' ? 'สุ่มจับคู่ของขวัญ' : 'Draw Gift Pairs'}</span>
              </button>
            </div>

            {giftExchange.imageUrl && (
              <img
                src={giftExchange.imageUrl}
                alt={lang === 'th' ? giftExchange.eventTitleTh : giftExchange.eventTitleEn}
                referrerPolicy="no-referrer"
                className="w-full h-44 object-cover border tw-border tw-control"
              />
            )}

            {giftExchange.pairs.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {giftExchange.pairs.map((p, idx) => (
                  <div key={idx} className="px-3 py-2 text-xs border tw-border tw-control flex items-center justify-between">
                    <span className="font-medium">{p.giver}</span>
                    <span className="text-[var(--text-muted)]">→</span>
                    <span className="font-semibold">{p.receiver}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-[var(--text-secondary)]">
                {lang === 'th' ? 'รายชื่อผู้เข้าร่วม: ' : 'Participants: '}
                {giftExchange.participants.join(', ')}
              </div>
            )}
          </div>
        )}

        {/* 6. Lost & Found (Public submit, NO close-case button on Home) */}
        {activeBuiltin === 'lostfound' && (
          <div className="space-y-5">
            <form onSubmit={handleLostFoundSubmit} className="p-4 border tw-border tw-control tw-subtle space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold">{t.lostFoundReportTitle}</h3>
                <div className="inline-flex gap-1">
                  <button
                    type="button"
                    onClick={() => setLfType('lost')}
                    className={`px-2.5 py-1 text-xs font-medium tw-control-sm ${
                      lfType === 'lost' ? 'tw-btn-primary' : 'tw-btn-ghost'
                    }`}
                  >
                    {t.lostTypeLost}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLfType('found')}
                    className={`px-2.5 py-1 text-xs font-medium tw-control-sm ${
                      lfType === 'found' ? 'tw-btn-primary' : 'tw-btn-ghost'
                    }`}
                  >
                    {t.lostTypeFound}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  value={lfItemName}
                  onChange={(e) => setLfItemName(e.target.value)}
                  placeholder={t.itemNamePlaceholder}
                  aria-label={t.itemNamePlaceholder}
                  required
                  className="px-3 py-2 text-sm tw-input"
                />
                <input
                  type="text"
                  value={lfLocation}
                  onChange={(e) => setLfLocation(e.target.value)}
                  placeholder={t.locationPlaceholder}
                  aria-label={t.locationPlaceholder}
                  required
                  className="px-3 py-2 text-sm tw-input"
                />
                <input
                  type="text"
                  value={lfReporter}
                  onChange={(e) => setLfReporter(e.target.value)}
                  placeholder={t.reporterPlaceholder}
                  aria-label={t.reporterPlaceholder}
                  required
                  className="px-3 py-2 text-sm tw-input"
                />
                <input
                  type="text"
                  value={lfContact}
                  onChange={(e) => setLfContact(e.target.value)}
                  placeholder={t.contactPlaceholder}
                  aria-label={t.contactPlaceholder}
                  className="px-3 py-2 text-sm tw-input"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-[var(--text-muted)]">{t.adminOnlyCloseNote}</span>
                <button type="submit" className="px-4 py-2 text-xs font-medium tw-btn-primary whitespace-nowrap">
                  {t.submitReportBtn}
                </button>
              </div>
              {lfFeedback && <div className="text-xs font-medium">{lfFeedback}</div>}
            </form>

            <div className="divide-y tw-border">
              {lostFound.map((item) => (
                <div key={item.id} className="py-3 first:pt-0 last:pb-0 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-xs text-[var(--text-muted)] font-mono-tabular">
                      {item.type === 'lost' ? t.lostTypeLost : t.lostTypeFound} · {item.createdAt} · {item.location}
                    </div>
                    <div className="text-sm font-medium mt-0.5">{item.itemName}</div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      {lang === 'th' ? 'ผู้แจ้ง' : 'Reporter'}: {item.reporterName} · {item.contactNote}
                    </div>
                  </div>
                  <span className="text-xs font-medium text-[var(--text-secondary)]">
                    {item.status === 'resolved' ? t.caseResolved : t.caseOpen}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 7. Custom Organization-Added Modes */}
        {activeMode && !activeBuiltin && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              {React.createElement(BOARD_ICON_MAP[activeMode.icon] ?? Sparkles, {
                className: 'w-4 h-4 text-[var(--text-secondary)]',
              })}
              <h3 className="text-sm font-semibold">
                {lang === 'th' ? activeMode.labelTh : activeMode.labelEn}
              </h3>
            </div>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">
              {(lang === 'th' ? activeMode.customContentTh : activeMode.customContentEn) ||
                (lang === 'th'
                  ? 'ยังไม่มีรายละเอียดเพิ่มเติมในโหมดนี้ (ผู้บริหารสามารถแก้ไขเนื้อหาได้ที่ศูนย์ควบคุมหลังบ้าน)'
                  : 'No details added yet for this custom board mode.')}
            </p>
          </div>
        )}
      </div>
    </section>
  );
};
