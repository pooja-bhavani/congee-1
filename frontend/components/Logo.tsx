"use client";

/** Engram mark — a small constellation of connected memory nodes (a synapse/graph). */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Engram"
    >
      <defs>
        <linearGradient id="engGrad" x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7C5CFF" />
          <stop offset="1" stopColor="#38E8D0" />
        </linearGradient>
        <radialGradient id="engGlow" cx="24" cy="24" r="8" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E8E9F2" />
          <stop offset="1" stopColor="#7C5CFF" />
        </radialGradient>
      </defs>
      {/* synapse edges */}
      <g stroke="url(#engGrad)" strokeWidth="2" strokeLinecap="round" opacity="0.9">
        <path d="M24 24 L10 12" />
        <path d="M24 24 L39 13" />
        <path d="M24 24 L12 37" />
        <path d="M24 24 L37 36" />
        <path d="M10 12 L39 13" opacity="0.4" />
      </g>
      {/* outer memory nodes */}
      <g fill="#38E8D0">
        <circle cx="10" cy="12" r="3.4" />
        <circle cx="39" cy="13" r="3" />
        <circle cx="12" cy="37" r="3" />
        <circle cx="37" cy="36" r="3.4" />
      </g>
      {/* central engram */}
      <circle cx="24" cy="24" r="6.5" fill="url(#engGlow)" />
    </svg>
  );
}
