import React, { useState } from 'react';
import { Eye, MessageCircleQuestion, Send, X } from 'lucide-react';
import type { LangCode } from '../types/system';
import { TRANSLATIONS } from '../i18n/translations';
import { isDemoPreviewQuery, matchQaResponse } from '../utils/budget';
import { CloudQaTopMascot } from './CloudMascot';

interface QaFloatingWidgetProps {
  lang: LangCode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTriggerButton?: boolean;
  showMascot?: boolean;
  isDemoPreviewActive?: boolean;
  onOpenDemoPreview?: () => void;
}

interface QaMessage {
  sender: 'user' | 'system';
  text: string;
  actionType?: 'open_demo';
}

export const QaFloatingWidget: React.FC<QaFloatingWidgetProps> = ({
  lang,
  open: controlledOpen,
  onOpenChange,
  showTriggerButton = true,
  showMascot = true,
  isDemoPreviewActive = false,
  onOpenDemoPreview,
}) => {
  const t = TRANSLATIONS[lang];
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = (next: boolean | ((prev: boolean) => boolean)) => {
    const resolved = typeof next === 'function' ? next(open) : next;
    if (onOpenChange) {
      onOpenChange(resolved);
    } else {
      setInternalOpen(resolved);
    }
  };
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<QaMessage[]>([]);

  const welcomeText =
    lang === 'th'
      ? 'สวัสดีครับ มีคำถามเกี่ยวกับเวลาเช็คชื่อ รหัส 8888 หรือการแจ้งของหาย สามารถเลือกหัวข้อหรือพิมพ์ถามได้เลย'
      : 'Hello! Select a topic or ask a question about check-in windows, code 8888, or lost & found.';

  const displayedMessages: QaMessage[] = [{ sender: 'system', text: welcomeText }, ...messages];

  const quickTopics =
    lang === 'th'
      ? ['รหัส 8888 ใช้ยังไง', 'แจ้งของหาย', 'เวลาปุ่มเช็คชื่อ', 'โหวตลับ']
      : ['How to use 8888', 'Lost & Found', 'Cutoff times', 'Secret vote'];

  const askQuestion = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const answer = matchQaResponse(trimmed, lang);
    const showDemoAction = Boolean(onOpenDemoPreview) && isDemoPreviewQuery(trimmed);
    setMessages((prev) => [
      ...prev,
      { sender: 'user', text: trimmed },
      {
        sender: 'system',
        text: answer,
        actionType: showDemoAction ? 'open_demo' : undefined,
      },
    ]);
    setInput('');
  };

  return (
    <div className="relative">
      {open && (
        <div
          className={`${
            showTriggerButton ? 'absolute bottom-12 right-0' : 'fixed bottom-16 right-4'
          } w-80 sm:w-96 z-50 flex flex-col`}
          role="dialog"
          aria-label={t.qaTitle}
        >
          {/* Cloud Mascot perched cleanly on the top edge of the Q&A dialog */}
          <CloudQaTopMascot
            visible={showMascot}
            lang={lang}
            onCloseQa={() => setOpen(false)}
          />

          <div className="w-full tw-surface shadow-xl overflow-hidden flex flex-col max-h-[68vh] relative z-10">
            <div className="flex items-center justify-between px-4 py-3 border-b tw-border">
              <span className="text-xs font-semibold">{t.qaTitle}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t.close}
                className="p-1 tw-btn-ghost"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-3 border-b tw-border flex flex-wrap gap-1.5">
              {quickTopics.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => askQuestion(topic)}
                  className="px-2.5 py-1 text-xs tw-btn-ghost whitespace-nowrap"
                >
                  {topic}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 text-xs">
              {displayedMessages.map((m, i) => (
                <div
                  key={i}
                  className={`p-2.5 tw-control space-y-2 ${
                    m.sender === 'user'
                      ? 'ml-6 tw-btn-primary border-none'
                      : 'mr-4 tw-subtle text-[var(--text-primary)]'
                  }`}
                >
                  <div>{m.text}</div>
                  {m.actionType === 'open_demo' && onOpenDemoPreview && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenDemoPreview();
                        setOpen(false);
                      }}
                      className="w-full py-1.5 px-2.5 text-xs font-semibold tw-btn-soft inline-flex items-center justify-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>
                        {isDemoPreviewActive
                          ? lang === 'th'
                            ? 'กำลังดูหน้าตัวอย่างการใช้งาน'
                            : 'Viewing Usage Example (Demo)'
                          : lang === 'th'
                          ? 'เปิดดูหน้าตัวอย่างการใช้งาน'
                          : 'Open Usage Example (Demo)'}
                      </span>
                    </button>
                  )}
                </div>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                askQuestion(input);
              }}
              className="p-2.5 border-t tw-border flex gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t.qaInputPlaceholder}
                aria-label={t.qaInputPlaceholder}
                className="flex-1 px-2.5 py-1.5 text-xs tw-input"
              />
              <button
                type="submit"
                aria-label={t.qaSendBtn}
                className="px-3 py-1.5 text-xs font-medium tw-btn-primary inline-flex items-center gap-1"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}

      {showTriggerButton && (
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="px-3.5 py-2 text-xs font-medium tw-btn-ghost shadow-sm inline-flex items-center gap-1.5 whitespace-nowrap"
        >
          <MessageCircleQuestion className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
          <span>{t.qaButtonLabel}</span>
        </button>
      )}
    </div>
  );
};
