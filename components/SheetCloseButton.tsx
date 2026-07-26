"use client";

export default function SheetCloseButton({
  onClick,
  className = "",
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label="閉じる"
      className={`sheet-close ${className}`}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  );
}
