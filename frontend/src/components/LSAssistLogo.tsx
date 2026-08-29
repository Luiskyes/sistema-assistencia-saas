type LSAssistLogoProps = {
  compact?: boolean;
  inverse?: boolean;
  className?: string;
};

export function LSAssistLogo({
  compact = false,
  inverse = false,
  className = "",
}: LSAssistLogoProps) {
  return (
    <span
      className={`lsassist-logo ${inverse ? "lsassist-logo-inverse" : ""} ${className}`.trim()}
    >
      <svg
        className="lsassist-symbol"
        viewBox="0 0 72 72"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="lsassist-gradient" x1="8" y1="8" x2="64" y2="64">
            <stop offset="0" stopColor="#22c55e" />
            <stop offset=".52" stopColor="#2563eb" />
            <stop offset="1" stopColor="#38bdf8" />
          </linearGradient>
        </defs>

        <path
          className="lsassist-shield"
          d="M36 5 60 18v24c0 13-9 21-24 26C21 63 12 55 12 42V18L36 5Z"
        />
        <path
          className="lsassist-l"
          d="M23 21h7v25h10v7H23V21Z"
        />
        <path
          className="lsassist-s"
          d="M51 23H39c-5 0-9 3-9 8s4 8 9 8h5c2 0 3 1 3 3s-1 3-3 3H32v7h13c6 0 10-4 10-10s-4-10-10-10h-5c-2 0-3-1-3-2.5S38 27 40 27h11v-4Z"
        />
        <path
          className="lsassist-wrench"
          d="m50.5 50.5 7.7 7.7M56.6 47.4a6 6 0 0 0 7.1 7.1l-3-3 1.5-3.8 3.8-1.5 3 3a6 6 0 0 0-7.1-7.1l-5.3 5.3Z"
        />
      </svg>

      {!compact ? (
        <span className="lsassist-wordmark" aria-label="LSAssist">
          <strong>LS</strong>
          <b>Assist</b>
        </span>
      ) : null}
    </span>
  );
}
