import React, { useEffect, useRef, useState } from 'react';
import type { LangCode } from '../types/system';

interface CloudMascotProps {
  visible: boolean;
  hasActiveTasks?: boolean;
  lang?: LangCode;
  qaOpen?: boolean;
  isPrivacyHiding?: boolean;
  showCompanion?: boolean;
  silentPrivacy?: boolean;
  onOpenQa?: () => void;
}

type MascotMood = 'idle' | 'happy' | 'wink' | 'shy';

export const CloudMascot: React.FC<CloudMascotProps> = ({
  visible,
  hasActiveTasks = false,
  lang = 'th',
  qaOpen = false,
  isPrivacyHiding = false,
  showCompanion = false,
  silentPrivacy = false,
  onOpenQa,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [offsetX, setOffsetX] = useState(0); // percentage from -36 to 36
  const [dragging, setDragging] = useState(false);
  const [isPeekingDown, setIsPeekingDown] = useState(false);
  const [mood, setMood] = useState<MascotMood>('idle');
  const [reactionText, setReactionText] = useState<string | null>(null);
  const peekTimerRef = useRef<number | null>(null);
  const resetTimerRef = useRef<number | null>(null);

  const dragStartRef = useRef<{ startClientX: number; startOffset: number; moved: boolean }>({
    startClientX: 0,
    startOffset: 0,
    moved: false,
  });

  useEffect(() => {
    return () => {
      if (peekTimerRef.current !== null) window.clearTimeout(peekTimerRef.current);
      if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
    };
  }, []);

  if (!visible) return null;

  const phrasesTh = qaOpen
    ? ['ปิดหน้าต่างถาม-ตอบนะ~', 'เรียกใช้น้องเมฆใหม่ได้ตลอดเลย']
    : hasActiveTasks
    ? ['เปิดถาม-ตอบให้นะ~', 'ถามน้องเมฆได้ทุกเรื่องเลย!', 'ถึงเวลาเช็คชื่อแล้ว~']
    : ['เปิดถาม-ตอบให้นะ~', 'ถามน้องเมฆได้เลย!', 'ลากน้องเมฆไปมาได้ด้วยนะ'];

  const phrasesEn = qaOpen
    ? ['Closing Q&A~', 'Tap me anytime for help!']
    : hasActiveTasks
    ? ['Opening Auto Q&A~', 'Ask me anything!', 'Time to check in!']
    : ['Opening Auto Q&A~', 'Ask me anything!', 'Slide me along the top!'];

  const triggerPlayfulReaction = () => {
    if (peekTimerRef.current !== null) window.clearTimeout(peekTimerRef.current);
    if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);

    const moods: MascotMood[] = ['happy', 'wink', 'shy'];
    const nextMood = moods[Math.floor(Math.random() * moods.length)];
    const pool = lang === 'th' ? phrasesTh : phrasesEn;
    const nextPhrase = pool[Math.floor(Math.random() * pool.length)];

    // Quick peek-a-boo duck down & pop back up
    setIsPeekingDown(true);
    setMood(nextMood);
    setReactionText(nextPhrase);

    peekTimerRef.current = window.setTimeout(() => {
      setIsPeekingDown(false);
    }, 260);

    resetTimerRef.current = window.setTimeout(() => {
      setMood('idle');
      setReactionText(null);
    }, 2400);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    dragStartRef.current = {
      startClientX: e.clientX,
      startOffset: offsetX,
      moved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragging || !trackRef.current) return;
    const trackWidth = trackRef.current.offsetWidth || 360;
    const deltaPx = e.clientX - dragStartRef.current.startClientX;
    if (Math.abs(deltaPx) > 4) {
      dragStartRef.current.moved = true;
    }
    const deltaPct = (deltaPx / trackWidth) * 100;
    const clamped = Math.max(-36, Math.min(36, dragStartRef.current.startOffset + deltaPct));
    setOffsetX(clamped);
  };

  const handlePointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    if (!dragStartRef.current.moved) {
      triggerPlayfulReaction();
      onOpenQa?.();
    }
  };

  return (
    <div
      ref={trackRef}
      aria-hidden={qaOpen || undefined}
      className="relative w-full h-11 flex items-end justify-center select-none pointer-events-none z-20"
      data-testid="cloud-mascot"
      data-privacy-hiding={isPrivacyHiding ? 'true' : 'false'}
    >
      {/* Horizontal sliding container (drops away smoothly when docked onto Q&A box) */}
      <div
        className={`relative flex flex-col items-center transition-all duration-300 ease-out ${
          qaOpen
            ? 'opacity-0 translate-y-6 scale-75 pointer-events-none'
            : 'opacity-100 pointer-events-auto'
        }`}
        style={{
          transform: `translateX(${offsetX * 2.8}px)`,
        }}
      >
        {/* Playful speech bubble or PIN privacy notice (suppressed when silentPrivacy is true) */}
        {!qaOpen && !silentPrivacy && (isPrivacyHiding || reactionText) && (
          <div
            className="mb-1.5 px-2.5 py-1 text-[11px] font-medium tw-surface shadow-sm whitespace-nowrap"
            role="status"
          >
            {isPrivacyHiding
              ? lang === 'th'
                ? 'หลับตาให้แล้ว ไม่แอบดู PIN น้า~'
                : 'Eyes closed, not peeking at your PIN~'
              : reactionText}
          </div>
        )}

        {/* Interactive Cloud Button (click to open Auto Q&A + peek, drag horizontally to slide) */}
        <button
          type="button"
          tabIndex={qaOpen ? -1 : 0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') setOffsetX((x) => Math.max(-36, x - 6));
            if (e.key === 'ArrowRight') setOffsetX((x) => Math.min(36, x + 6));
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              triggerPlayfulReaction();
              onOpenQa?.();
            }
          }}
          aria-expanded={onOpenQa ? qaOpen : undefined}
          aria-label={
            lang === 'th'
              ? 'มาสคอตน้องเมฆ กดเพื่อเปิดถาม-ตอบอัตโนมัติ หรือลากเลื่อนซ้ายขวาได้'
              : 'Cloud mascot: click to open Auto Q&A or drag horizontally'
          }
          title={
            lang === 'th'
              ? 'กดน้องเมฆเพื่อเปิดถาม-ตอบอัตโนมัติ หรือลากเลื่อนซ้าย-ขวาได้'
              : 'Click Cloud to open Auto Q&A or drag left/right'
          }
          className={`group relative -mb-3.5 bg-transparent border-0 p-0 focus-visible:outline-none ${
            dragging ? 'cursor-grabbing' : 'cursor-pointer'
          }`}
        >
          {!reactionText && !isPrivacyHiding && !dragging && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 px-2 py-0.5 text-[10px] font-medium tw-surface shadow-xs whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-150"
            >
              {lang === 'th' ? 'ถาม-ตอบอัตโนมัติ' : 'Auto Q&A'}
            </span>
          )}
          <div
            className={`flex items-end transition-transform duration-300 ease-out ${
              showCompanion
                ? 'translate-y-0 scale-105'
                : isPrivacyHiding
                ? 'translate-y-0'
                : isPeekingDown
                ? 'translate-y-4 scale-95'
                : dragging
                ? '-translate-y-1 scale-105'
                : 'tw-cloud-peek'
            }`}
          >
            <svg
              width="116"
              height="64"
              viewBox="0 0 116 64"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <radialGradient id="cloudGradTop" cx="50%" cy="28%" r="72%">
                  <stop offset="0%" stopColor="#FFFFFF" />
                  <stop offset="72%" stopColor="#F5F8FC" />
                  <stop offset="100%" stopColor="#E1E8F2" />
                </radialGradient>
                <filter id="cloudShadowTop" x="-15%" y="-15%" width="130%" height="140%">
                  <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#1E293B" floodOpacity="0.14" />
                </filter>
                {/* Clip cloud body cleanly at card top rim (y=51) while paws remain outside */}
                <clipPath id="cloudRimClipTop">
                  <rect x="-12" y="-12" width="140" height="63" />
                </clipPath>
              </defs>

              <g clipPath="url(#cloudRimClipTop)">
                {/* Head/body group ducks gently on PIN, stays perched warmly when introducing companion */}
                <g
                  style={{
                    transform:
                      isPrivacyHiding && !showCompanion
                        ? 'translateY(14px)'
                        : showCompanion
                        ? 'translateY(-1px)'
                        : 'translateY(0px)',
                    transition: 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                >
                  {/* Tiny floating sparkle/star when happy or active tasks (hidden while hiding eyes) */}
                  {!isPrivacyHiding && (mood === 'happy' || hasActiveTasks) && (
                    <g className="tw-cloud-sparkle">
                      <path
                        d="M97 10L98.5 13.5L102 15L98.5 16.5L97 20L95.5 16.5L92 15L95.5 13.5L97 10Z"
                        fill="#93C5FD"
                      />
                      <circle cx="17" cy="14" r="2.2" fill="#F9A8D4" />
                    </g>
                  )}

                  {/* Cloud body */}
                  <g filter="url(#cloudShadowTop)">
                    <path
                      d="M24 47C14.6 47 7 40.3 7 32C7 25.1 12.2 19.3 19.3 17.6C22.4 9.7 30.2 4 39.5 4C46.5 4 52.8 7.2 56.8 12.2C59.8 10.6 63.3 9.7 67 9.7C78.1 9.7 87.2 17.7 88.2 28C94.7 29.1 99.6 34.4 99.6 40.8C99.6 43.1 98.9 45.2 97.7 47H24Z"
                      transform="translate(5, 5)"
                      fill="url(#cloudGradTop)"
                    />
                  </g>

                  {/* Eyes: closed tightly when typing PIN, otherwise mood/blinking */}
                  {isPrivacyHiding ? (
                    <>
                      <path d="M40.5 32.5C42 35.8 46.5 35.8 48 32.5" stroke="#1F2937" strokeWidth="2.3" strokeLinecap="round" />
                      <path d="M67.5 32.5C69 35.8 73.5 35.8 75 32.5" stroke="#1F2937" strokeWidth="2.3" strokeLinecap="round" />
                    </>
                  ) : mood === 'happy' ? (
                    <>
                      <path d="M41 36C42.5 32.5 46.5 32.5 48 36" stroke="#1F2937" strokeWidth="2.3" strokeLinecap="round" />
                      <path d="M68 36C69.5 32.5 73.5 32.5 75 36" stroke="#1F2937" strokeWidth="2.3" strokeLinecap="round" />
                    </>
                  ) : mood === 'wink' ? (
                    <>
                      <circle cx="45" cy="35" r="3.6" fill="#1F2937" />
                      <circle cx="43.8" cy="33.7" r="1.2" fill="#FFFFFF" />
                      <path d="M68 35.5C69.5 33 73.5 33 75 35.5" stroke="#1F2937" strokeWidth="2.3" strokeLinecap="round" />
                    </>
                  ) : (
                    <g className="tw-cloud-blink" style={{ transformOrigin: '58px 35px' }}>
                      <circle cx="45" cy="35" r="3.6" fill="#1F2937" />
                      <circle cx="43.8" cy="33.7" r="1.2" fill="#FFFFFF" />
                      <circle cx="71" cy="35" r="3.6" fill="#1F2937" />
                      <circle cx="69.8" cy="33.7" r="1.2" fill="#FFFFFF" />
                    </g>
                  )}

                  {/* Rosy cheeks */}
                  <ellipse
                    cx="37.5"
                    cy="39.5"
                    rx={mood === 'shy' || isPrivacyHiding ? 5.6 : 4.6}
                    ry={mood === 'shy' || isPrivacyHiding ? 3.2 : 2.6}
                    fill="#F4A6B8"
                    fillOpacity={mood === 'shy' || isPrivacyHiding ? '0.82' : '0.6'}
                  />
                  <ellipse
                    cx="78.5"
                    cy="39.5"
                    rx={mood === 'shy' || isPrivacyHiding ? 5.6 : 4.6}
                    ry={mood === 'shy' || isPrivacyHiding ? 3.2 : 2.6}
                    fill="#F4A6B8"
                    fillOpacity={mood === 'shy' || isPrivacyHiding ? '0.82' : '0.6'}
                  />

                  {/* Cute :3 mouth */}
                  <path
                    d="M54.5 37.8C55.2 39.6 57.2 39.8 58 38.2C58.8 39.8 60.8 39.6 61.5 37.8"
                    stroke="#1F2937"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              </g>

              {/* Paws gripping the top rim (stay anchored even when head ducks behind card) */}
              <g filter="url(#cloudShadowTop)">
                <ellipse cx="34" cy="53.5" rx="8.5" ry="5.5" fill="url(#cloudGradTop)" />
                <ellipse cx="82" cy="53.5" rx="8.5" ry="5.5" fill="url(#cloudGradTop)" />
              </g>
              <path d="M31.5 53V55.5M34 52.8V55.7M36.5 53V55.5" stroke="#CBD5E1" strokeWidth="1.1" strokeLinecap="round" />
              <path d="M79.5 53V55.5M82 52.8V55.7M84.5 53V55.5" stroke="#CBD5E1" strokeWidth="1.1" strokeLinecap="round" />
            </svg>

            {/* Companion Little Cloud in Soft Sky-Mist Pastel Blue (appears when entering Org Code) */}
            {showCompanion && (
              <svg
                data-testid="cloud-companion"
                width="86"
                height="50"
                viewBox="0 0 116 64"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="-ml-3 tw-cloud-buddy-in shrink-0"
              >
                <defs>
                  <radialGradient id="cloudGradCompanion" cx="48%" cy="24%" r="76%">
                    <stop offset="0%" stopColor="#F8FBFF" />
                    <stop offset="65%" stopColor="#E1EEFE" />
                    <stop offset="100%" stopColor="#C4DCFA" />
                  </radialGradient>
                  <filter id="cloudShadowCompanion" x="-15%" y="-15%" width="130%" height="140%">
                    <feDropShadow dx="0" dy="3" stdDeviation="2.2" floodColor="#1E3A5F" floodOpacity="0.16" />
                  </filter>
                  <clipPath id="cloudRimClipCompanion">
                    <rect x="-12" y="-12" width="140" height="63" />
                  </clipPath>
                </defs>

                <g clipPath="url(#cloudRimClipCompanion)">
                  <g className="tw-cloud-sparkle">
                    <path
                      d="M96 9L97.4 12.2L100.6 13.5L97.4 14.8L96 18L94.6 14.8L91.4 13.5L94.6 12.2L96 9Z"
                      fill="#FBBF24"
                    />
                  </g>

                  <g filter="url(#cloudShadowCompanion)">
                    <path
                      d="M24 47C14.6 47 7 40.3 7 32C7 25.1 12.2 19.3 19.3 17.6C22.4 9.7 30.2 4 39.5 4C46.5 4 52.8 7.2 56.8 12.2C59.8 10.6 63.3 9.7 67 9.7C78.1 9.7 87.2 17.7 88.2 28C94.7 29.1 99.6 34.4 99.6 40.8C99.6 43.1 98.9 45.2 97.7 47H24Z"
                      transform="translate(5, 6)"
                      fill="url(#cloudGradCompanion)"
                    />
                  </g>

                  {/* Cheerful shy closed-arc eyes protecting the org code together */}
                  <path d="M40.5 34.5C42 31.2 46.5 31.2 48 34.5" stroke="#1E293B" strokeWidth="2.4" strokeLinecap="round" />
                  <path d="M67.5 34.5C69 31.2 73.5 31.2 75 34.5" stroke="#1E293B" strokeWidth="2.4" strokeLinecap="round" />

                  <ellipse cx="37.5" cy="39.5" rx="5" ry="2.8" fill="#F4A6B8" fillOpacity="0.72" />
                  <ellipse cx="78.5" cy="39.5" rx="5" ry="2.8" fill="#F4A6B8" fillOpacity="0.72" />

                  <path
                    d="M54.5 38.2C55.2 39.9 57.2 40.1 58 38.6C58.8 40.1 60.8 39.9 61.5 38.2"
                    stroke="#1E293B"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>

                <g filter="url(#cloudShadowCompanion)">
                  <ellipse cx="34" cy="53.5" rx="8.5" ry="5.5" fill="url(#cloudGradCompanion)" />
                  <ellipse cx="82" cy="53.5" rx="8.5" ry="5.5" fill="url(#cloudGradCompanion)" />
                </g>
              </svg>
            )}
          </div>
        </button>
      </div>
    </div>
  );
};

interface CloudQaTopMascotProps {
  visible: boolean;
  lang?: LangCode;
  onCloseQa?: () => void;
}

/** Top-perching Cloud Mascot that sits cleanly on the top edge of the Auto Q&A box */
export const CloudQaTopMascot: React.FC<CloudQaTopMascotProps> = ({
  visible,
  lang = 'th',
  onCloseQa,
}) => {
  if (!visible) return null;

  return (
    <div
      className="relative flex justify-end pr-6 sm:pr-8 -mb-3.5 z-20 select-none tw-cloud-drop-in"
      data-testid="cloud-qa-top-mascot"
    >
      <button
        type="button"
        onClick={onCloseQa}
        aria-label={
          lang === 'th'
            ? 'น้องเมฆเกาะด้านบนกล่องถาม-ตอบ กดเพื่อปิดหน้าต่างถาม-ตอบ'
            : 'Cloud mascot perched above Q&A box: click to close Q&A'
        }
        title={
          lang === 'th'
            ? 'กดน้องเมฆเพื่อปิดหน้าต่างถาม-ตอบ'
            : 'Click Cloud to close Auto Q&A'
        }
        className="group relative bg-transparent border-0 p-0 cursor-pointer focus-visible:outline-none"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 px-2 py-0.5 text-[10px] font-medium tw-surface shadow-xs whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-150"
        >
          {lang === 'th' ? 'ปิดถาม-ตอบ' : 'Close Q&A'}
        </span>

        <div className="tw-cloud-peek transition-transform duration-200 group-hover:scale-105">
          <svg
            width="104"
            height="58"
            viewBox="0 0 116 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <radialGradient id="cloudGradQaTop" cx="50%" cy="28%" r="72%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="72%" stopColor="#F5F8FC" />
                <stop offset="100%" stopColor="#E1E8F2" />
              </radialGradient>
              <filter id="cloudShadowQaTop" x="-15%" y="-15%" width="130%" height="140%">
                <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#1E293B" floodOpacity="0.14" />
              </filter>
            </defs>

            {/* Sparkles above Q&A box */}
            <g className="tw-cloud-sparkle">
              <path
                d="M97 10L98.5 13.5L102 15L98.5 16.5L97 20L95.5 16.5L92 15L95.5 13.5L97 10Z"
                fill="#93C5FD"
              />
              <circle cx="17" cy="14" r="2.2" fill="#F9A8D4" />
            </g>

            {/* Cloud body */}
            <g filter="url(#cloudShadowQaTop)">
              <path
                d="M24 47C14.6 47 7 40.3 7 32C7 25.1 12.2 19.3 19.3 17.6C22.4 9.7 30.2 4 39.5 4C46.5 4 52.8 7.2 56.8 12.2C59.8 10.6 63.3 9.7 67 9.7C78.1 9.7 87.2 17.7 88.2 28C94.7 29.1 99.6 34.4 99.6 40.8C99.6 43.1 98.9 45.2 97.7 47H24Z"
                transform="translate(5, 5)"
                fill="url(#cloudGradQaTop)"
              />
            </g>

            {/* Blinking friendly eyes */}
            <g className="tw-cloud-blink" style={{ transformOrigin: '58px 35px' }}>
              <circle cx="45" cy="35" r="3.6" fill="#1F2937" />
              <circle cx="43.8" cy="33.7" r="1.2" fill="#FFFFFF" />
              <circle cx="71" cy="35" r="3.6" fill="#1F2937" />
              <circle cx="69.8" cy="33.7" r="1.2" fill="#FFFFFF" />
            </g>

            {/* Rosy cheeks */}
            <ellipse cx="37.5" cy="39.5" rx="4.6" ry="2.6" fill="#F4A6B8" fillOpacity="0.65" />
            <ellipse cx="78.5" cy="39.5" rx="4.6" ry="2.6" fill="#F4A6B8" fillOpacity="0.65" />

            {/* Cute :3 mouth */}
            <path
              d="M54.5 37.8C55.2 39.6 57.2 39.8 58 38.2C58.8 39.8 60.8 39.6 61.5 37.8"
              stroke="#1F2937"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Paws gripping top edge of Q&A box */}
            <g filter="url(#cloudShadowQaTop)">
              <ellipse cx="34" cy="53.5" rx="8.5" ry="5.5" fill="url(#cloudGradQaTop)" />
              <ellipse cx="82" cy="53.5" rx="8.5" ry="5.5" fill="url(#cloudGradQaTop)" />
            </g>
            <path d="M31.5 53V55.5M34 52.8V55.7M36.5 53V55.5" stroke="#CBD5E1" strokeWidth="1.1" strokeLinecap="round" />
            <path d="M79.5 53V55.5M82 52.8V55.7M84.5 53V55.5" stroke="#CBD5E1" strokeWidth="1.1" strokeLinecap="round" />
          </svg>
        </div>
      </button>
    </div>
  );
};
