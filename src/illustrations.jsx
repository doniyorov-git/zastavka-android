export function IllustrationGallery() {
  return (
    <svg viewBox="0 0 240 200" className="illustration" aria-hidden>
      <circle cx="120" cy="108" r="78" fill="#EEF1FF" />
      <rect x="78" y="38" width="84" height="124" rx="18" fill="#fff" stroke="#D7DCF5" strokeWidth="3" />
      <rect x="86" y="50" width="68" height="86" rx="10" fill="url(#g1)" />
      <rect x="86" y="142" width="22" height="6" rx="3" fill="#E4E8F6" />
      <rect x="112" y="142" width="36" height="6" rx="3" fill="#E4E8F6" />
      <rect x="42" y="58" width="52" height="86" rx="14" fill="#fff" stroke="#D7DCF5" strokeWidth="3" transform="rotate(-12 68 101)" />
      <rect x="50" y="70" width="36" height="54" rx="8" fill="#C9B6FF" transform="rotate(-12 68 97)" />
      <rect x="146" y="58" width="52" height="86" rx="14" fill="#fff" stroke="#D7DCF5" strokeWidth="3" transform="rotate(12 172 101)" />
      <rect x="154" y="70" width="36" height="54" rx="8" fill="#7C8FFF" transform="rotate(12 172 97)" />
      <circle cx="186" cy="46" r="10" fill="#FFC93C" />
      <circle cx="54" cy="150" r="8" fill="#B08CFF" opacity="0.7" />
      <defs>
        <linearGradient id="g1" x1="86" y1="50" x2="154" y2="136">
          <stop offset="0%" stopColor="#7C8FFF" />
          <stop offset="100%" stopColor="#D4B8FF" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function IllustrationCoins() {
  return (
    <svg viewBox="0 0 240 200" className="illustration" aria-hidden>
      <circle cx="120" cy="108" r="78" fill="#FFF6DE" />
      <rect x="70" y="92" width="100" height="62" rx="18" fill="#fff" stroke="#F3E2B0" strokeWidth="3" />
      <path d="M70 116h100" stroke="#F6E7C0" strokeWidth="3" />
      <rect x="86" y="128" width="28" height="8" rx="4" fill="#FFE08A" />
      <rect x="122" y="128" width="42" height="8" rx="4" fill="#F5F7FB" />
      <g>
        <ellipse cx="92" cy="78" rx="22" ry="22" fill="#FFC93C" />
        <ellipse cx="92" cy="78" rx="14" ry="14" fill="none" stroke="#FFF3C4" strokeWidth="2" />
        <circle cx="92" cy="78" r="6" fill="none" stroke="#C98912" strokeWidth="1.6" />
      </g>
      <g>
        <ellipse cx="126" cy="66" rx="26" ry="26" fill="#FFC93C" />
        <ellipse cx="126" cy="66" rx="16" ry="16" fill="none" stroke="#FFF3C4" strokeWidth="2.2" />
        <circle cx="126" cy="66" r="7" fill="none" stroke="#C98912" strokeWidth="1.8" />
      </g>
      <g>
        <ellipse cx="158" cy="84" rx="18" ry="18" fill="#FFD56A" />
        <ellipse cx="158" cy="84" rx="11" ry="11" fill="none" stroke="#FFF3C4" strokeWidth="1.8" />
      </g>
      <circle cx="58" cy="58" r="7" fill="#B08CFF" />
      <circle cx="184" cy="140" r="9" fill="#7C8FFF" opacity="0.85" />
    </svg>
  );
}

export function IllustrationHeart() {
  return (
    <svg viewBox="0 0 240 200" className="illustration" aria-hidden>
      <circle cx="120" cy="108" r="78" fill="#F3EEFF" />
      <path
        d="M120 148s-34-22-44-43c-8-16-1-31 14-33 10-1 18 5 22 13 4-8 12-14 22-13 15 2 22 17 14 33-10 21-44 43-44 43Z"
        fill="#B08CFF"
      />
      <path
        d="M120 148s-34-22-44-43c-8-16-1-31 14-33 10-1 18 5 22 13 4-8 12-14 22-13 15 2 22 17 14 33-10 21-44 43-44 43Z"
        fill="#7C8FFF"
        opacity="0.35"
      />
      <rect x="46" y="58" width="36" height="48" rx="10" fill="#fff" stroke="#E4D9FF" strokeWidth="2.5" />
      <rect x="52" y="64" width="24" height="28" rx="6" fill="#7C8FFF" />
      <rect x="158" y="62" width="36" height="48" rx="10" fill="#fff" stroke="#E4D9FF" strokeWidth="2.5" />
      <rect x="164" y="68" width="24" height="28" rx="6" fill="#FFC93C" />
      <circle cx="54" cy="142" r="8" fill="#FFC93C" />
      <circle cx="186" cy="128" r="7" fill="#7C8FFF" />
    </svg>
  );
}

export function IllustrationEmpty() {
  return (
    <svg viewBox="0 0 200 150" className="illustration illustration--empty" aria-hidden>
      <circle cx="100" cy="78" r="58" fill="#F5F7FB" />
      <rect x="70" y="42" width="60" height="78" rx="14" fill="#fff" stroke="#E4E8F6" strokeWidth="3" />
      <path d="M82 70h36M82 84h24" stroke="#D7DCF5" strokeWidth="4" strokeLinecap="round" />
      <circle cx="132" cy="108" r="18" fill="#EEF1FF" stroke="#7C8FFF" strokeWidth="3" />
      <path d="M132 100v10M127 108h10" stroke="#7C8FFF" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
