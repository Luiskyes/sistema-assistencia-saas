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
      aria-label="LSAssist — Assistência Técnica"
    >
      {compact ? <img className="lsassist-symbol" src="/brand/lsassist-icone.svg?v=20260925" alt="" /> : <>
        <img className="lsassist-wordmark-image lsassist-wordmark-light" src="/brand/lsassist-logo-claro.svg?v=20260925" alt="" />
        <img className="lsassist-wordmark-image lsassist-wordmark-dark" src="/brand/lsassist-logo-escuro.svg?v=20260925" alt="" />
      </>}
    </span>
  );
}
