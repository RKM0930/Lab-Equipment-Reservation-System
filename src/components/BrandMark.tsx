interface BrandMarkProps {
  className?: string;
}

export function BrandMark({ className = 'h-8 w-8' }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="32" height="32" rx="9" fill="currentColor" />
      <rect
        x="9.5"
        y="11.5"
        width="13"
        height="12.5"
        rx="2.5"
        fill="none"
        stroke="white"
        strokeWidth="1.8"
      />
      <path d="M9.5 15.5h13" stroke="white" strokeWidth="1.8" />
      <path
        d="M13 8.75v3.75M19 8.75v3.75"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="m13.2 19.8 1.9 1.9 4-4.2"
        fill="none"
        stroke="#a7f3d0"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
