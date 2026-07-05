const PATHS = {
  overview: (
    <>
      <path d="M3 10.8 12 3l9 7.8" />
      <path d="M5.5 9.5V21h13V9.5M9 21v-7h6v7" />
    </>
  ),
  plan: (
    <>
      <path d="M4 4h16v16H4zM9 4v7h11M4 14h9v6M13 11v9" />
      <path d="M6.5 7.5h.01M16 14h.01" />
    </>
  ),
  facilities: (
    <>
      <path d="M3 10h18M5 10v9M9 10v9M15 10v9M19 10v9M3 19h18" />
      <path d="m4 8 8-4 8 4z" />
    </>
  ),
  downtime: (
    <>
      <path d="M7 3h10M7 21h10M8 3c0 4 1.3 6.2 4 8-2.7 1.8-4 4-4 8M16 3c0 4-1.3 6.2-4 8 2.7 1.8 4 4 4 8" />
    </>
  ),
  roster: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20v-1.2A4.8 4.8 0 0 1 8.3 14h1.4a4.8 4.8 0 0 1 4.8 4.8V20M16 5.5a3 3 0 0 1 0 5.8M17 14a4.5 4.5 0 0 1 4 4.5V20" />
    </>
  ),
  rules: (
    <>
      <path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H12v18H7.5A3.5 3.5 0 0 0 4 23z" />
      <path d="M20 5.5A3.5 3.5 0 0 0 16.5 2H12v18h4.5A3.5 3.5 0 0 1 20 23z" />
    </>
  ),
  select: <path d="m5 3 13 8-6 2-2 6zM13 13l5 6" />,
  add: <path d="M12 5v14M5 12h14" />,
  wall: <path d="M4 18h4V6h12v12h-4V10h-4v8H8" />,
  door: <path d="M6 21V4h12v17M9 20V7h6v13M12.5 14h.01" />,
  text: <path d="M5 5h14M12 5v14M8 19h8" />,
  undo: <path d="m9 7-5 5 5 5M5 12h8a6 6 0 0 1 6 6" />,
  redo: <path d="m15 7 5 5-5 5M19 12h-8a6 6 0 0 0-6 6" />,
  minus: <path d="M5 12h14" />,
  plus: <path d="M12 5v14M5 12h14" />,
  invite: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20v-1.3A4.7 4.7 0 0 1 8.2 14h1.6a4.7 4.7 0 0 1 4.7 4.7V20M18 8v6M15 11h6" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M7 3v4M17 3v4M3 10h18" />
    </>
  ),
  edit: <path d="m4 20 4.2-1 10-10-3.2-3.2-10 10zM13.8 7l3.2 3.2" />,
  upgrade: <path d="m6 15 6-6 6 6M12 9v12M4 4h16" />,
  eye: (
    <>
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  trash: <path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  check: <path d="m5 12 4 4L19 6" />,
  copy: <path d="M9 9h11v11H9zM4 15H3V4h11v1" />,
  menu: <path d="M5 7h14M5 12h14M5 17h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m16 16 4 4" />
    </>
  ),
  chevron: <path d="m9 6 6 6-6 6" />,
  coin: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5c-.7-.7-1.8-1-3-1-1.8 0-3 .9-3 2.2 0 3.4 6.5 1.5 6.5 5 0 1.4-1.3 2.5-3.4 2.5-1.3 0-2.6-.4-3.5-1.2M12.5 5v14" />
    </>
  ),
  users: (
    <>
      <circle cx="8.5" cy="8" r="3" />
      <path d="M3 20v-1a5.5 5.5 0 0 1 11 0v1M16 5.5a3 3 0 0 1 0 5.8M17 14a4.5 4.5 0 0 1 4 4.5V20" />
    </>
  ),
  cloud: <path d="M7 18a5 5 0 0 1-.8-9.9A6.5 6.5 0 0 1 18.8 10 4 4 0 0 1 18 18H7Z" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7h.01" />
    </>
  ),
};

export function Icon({ name, size = 20, strokeWidth = 1.75, className = "" }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
    >
      {PATHS[name] ?? PATHS.info}
    </svg>
  );
}

