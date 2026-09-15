export function Icon({ name, size = 24, className = "" }) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    className,
    "aria-hidden": true,
  };

  switch (name) {
    case "bookmark":
      return (
        <svg {...props}>
          <path
            d="M7 4.5h10A1.5 1.5 0 0 1 18.5 6v13.2a.8.8 0 0 1-1.25.66L12 16.2l-5.25 3.66A.8.8 0 0 1 5.5 19.2V6A1.5 1.5 0 0 1 7 4.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "bookmark-filled":
      return (
        <svg {...props}>
          <path
            d="M7 4.5h10A1.5 1.5 0 0 1 18.5 6v13.2a.8.8 0 0 1-1.25.66L12 16.2l-5.25 3.66A.8.8 0 0 1 5.5 19.2V6A1.5 1.5 0 0 1 7 4.5Z"
            fill="currentColor"
          />
        </svg>
      );
    case "heart-filled":
      return (
        <svg {...props}>
          <path
            d="M12 19.5s-6.5-4.1-8.4-8.1C2 8.4 3.4 5.5 6.4 5.2c1.8-.2 3.4.7 4.1 2.1.7-1.4 2.3-2.3 4.1-2.1 3 .3 4.4 3.2 2.8 6.2-1.9 4-8.4 8.1-8.4 8.1Z"
            fill="currentColor"
          />
        </svg>
      );
    case "heart":
      return (
        <svg {...props}>
          <path
            d="M12 19.5s-6.5-4.1-8.4-8.1C2 8.4 3.4 5.5 6.4 5.2c1.8-.2 3.4.7 4.1 2.1.7-1.4 2.3-2.3 4.1-2.1 3 .3 4.4 3.2 2.8 6.2-1.9 4-8.4 8.1-8.4 8.1Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "home":
      return (
        <svg {...props}>
          <path
            d="M3.8 11.2 12 4.2l8.2 7"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M6 10.6V18a1.6 1.6 0 0 0 1.6 1.6h8.8A1.6 1.6 0 0 0 18 18v-7.4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M10 19.6v-5h4v5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "home-filled":
      return (
        <svg {...props}>
          <path
            d="M11.4 3.6a1 1 0 0 1 1.2 0l8.1 6.8c.4.3.1.9-.4.9H19V18a2 2 0 0 1-2 2h-2.2v-5.4a1.8 1.8 0 0 0-1.8-1.8h-2a1.8 1.8 0 0 0-1.8 1.8V20H7a2 2 0 0 1-2-2v-6.7H3.7c-.5 0-.8-.6-.4-.9l8.1-6.8Z"
            fill="currentColor"
          />
        </svg>
      );
    case "user-filled":
      return (
        <svg {...props}>
          <circle cx="12" cy="8" r="3.6" fill="currentColor" />
          <path d="M5 19.2c.7-3.4 3.4-5.2 7-5.2s6.3 1.8 7 5.2" fill="currentColor" />
        </svg>
      );
    case "user":
      return (
        <svg {...props}>
          <circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M5.2 18.6c.8-3 3.4-4.8 6.8-4.8s6 1.8 6.8 4.8"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    case "plus":
      return (
        <svg {...props}>
          <path d="M12 6v12M6 12h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
    case "check":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8.5" fill="currentColor" />
          <path d="M8.4 12.2 10.8 14.6 15.6 9.6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "download":
      return (
        <svg {...props}>
          <path d="M12 5v10M8 11.5 12 15.5 16 11.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6 18.5h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "coin":
      return (
        <svg {...props} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" fill="#FFC93C" />
          <circle cx="12" cy="12" r="9" fill="none" stroke="#E6B02E" strokeWidth="1.4" />
          <circle cx="12" cy="12" r="6.2" fill="none" stroke="#FFF3C4" strokeWidth="1.4" />
          <path d="M12 8.2v7.6M10.2 9.6c.5-.6 1.1-.9 1.8-.9 1.4 0 2.2.8 2.2 1.8s-.8 1.6-2.2 1.8c1.4.1 2.3.8 2.3 1.9 0 1.1-1 2-2.4 2-.8 0-1.5-.3-2-.9" stroke="#C98912" strokeWidth="1.35" strokeLinecap="round" />
        </svg>
      );
    case "google":
      return (
        <svg {...props} viewBox="0 0 24 24">
          <path fill="#4285F4" d="M21.6 12.23c0-.74-.06-1.45-.18-2.13H12v4.03h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.23c1.89-1.74 2.99-4.31 2.99-7.42Z" />
          <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.35l-3.23-2.5c-.9.6-2.05.96-3.39.96-2.6 0-4.81-1.76-5.6-4.12H3.06v2.58A10 10 0 0 0 12 22Z" />
          <path fill="#FBBC05" d="M6.4 13.99A6 6 0 0 1 6.08 12c0-.69.12-1.36.32-1.99V7.43H3.06A10 10 0 0 0 2 12c0 1.61.38 3.14 1.06 4.57l3.34-2.58Z" />
          <path fill="#EA4335" d="M12 5.88c1.47 0 2.78.5 3.82 1.5l2.86-2.86C16.95 2.9 14.7 2 12 2A10 10 0 0 0 3.06 7.43l3.34 2.58C7.19 7.64 9.4 5.88 12 5.88Z" />
        </svg>
      );
    case "globe":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8.2" stroke="currentColor" strokeWidth="1.8" />
          <path d="M3.8 12h16.4M12 3.8c2.2 2.4 3.3 5.2 3.3 8.2S14.2 17.8 12 20.2C9.8 17.8 8.7 15 8.7 12S9.8 6.2 12 3.8Z" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case "sun":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 3.5v1.8M12 18.7v1.8M4.6 4.6l1.3 1.3M18.1 18.1l1.3 1.3M3.5 12h1.8M18.7 12h1.8M4.6 19.4l1.3-1.3M18.1 5.9l1.3-1.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "logout":
      return (
        <svg {...props}>
          <path d="M10 16.5 6.5 13 10 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6.8 13H16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M14 6.5h2.5A1.5 1.5 0 0 1 18 8v10a1.5 1.5 0 0 1-1.5 1.5H14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "chevron":
      return (
        <svg {...props}>
          <path d="M9 6.5 14.5 12 9 17.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "close":
      return (
        <svg {...props}>
          <path d="M7 7l10 10M17 7 7 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "card":
      return (
        <svg {...props}>
          <rect x="3.5" y="6" width="17" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M3.5 10h17" stroke="currentColor" strokeWidth="1.8" />
          <path d="M7 14.5h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}

export function Logo({ size = 72 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" aria-hidden>
      <defs>
        <linearGradient id="logoG" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7C8FFF" />
          <stop offset="100%" stopColor="#B08CFF" />
        </linearGradient>
      </defs>
      <rect width="72" height="72" rx="20" fill="url(#logoG)" />
      <rect x="16" y="20" width="40" height="32" rx="8" fill="#fff" />
      <path d="M16 42.5 27 33l9 7 9-11 11 13.5" fill="none" stroke="#8B7CFF" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="27" cy="29" r="3.4" fill="#FFC93C" />
    </svg>
  );
}
