import React from 'react';

interface BrandLogoProps {
  variant?: 'hero' | 'navbar' | 'icon';
  className?: string;
  subtitle?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'navbar',
  className = '',
  subtitle,
}) => {
  // Pure SVG Emblem matching the Bond Partners BP Scales of Justice logo
  const EmblemSvg = ({ size = 48 }: { size?: number }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 drop-shadow-[0_2px_8px_rgba(197,160,89,0.25)]"
    >
      <defs>
        <linearGradient id="bpGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F5E4B7" />
          <stop offset="35%" stopColor="#D4AF37" />
          <stop offset="70%" stopColor="#B38B38" />
          <stop offset="100%" stopColor="#87631E" />
        </linearGradient>
        <linearGradient id="bpGoldGradLight" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFF2D1" />
          <stop offset="100%" stopColor="#C5A059" />
        </linearGradient>
      </defs>

      {/* Central Spire / Pillar Top */}
      <polygon points="80,18 73,34 87,34" fill="url(#bpGoldGrad)" />
      <rect x="74" y="34" width="12" height="4" rx="1" fill="url(#bpGoldGrad)" />
      <rect x="72" y="38" width="16" height="3" rx="0.5" fill="url(#bpGoldGrad)" />

      {/* Scales Horizontal Crossbeam */}
      <rect x="42" y="56" width="76" height="4" rx="2" fill="url(#bpGoldGrad)" />
      {/* Left Pivot & Right Pivot */}
      <circle cx="48" cy="58" r="3" fill="url(#bpGoldGrad)" />
      <circle cx="112" cy="58" r="3" fill="url(#bpGoldGrad)" />

      {/* Left Scale Strings & Pan */}
      <line x1="48" y1="58" x2="36" y2="78" stroke="url(#bpGoldGrad)" strokeWidth="1.75" />
      <line x1="48" y1="58" x2="60" y2="78" stroke="url(#bpGoldGrad)" strokeWidth="1.75" />
      <line x1="48" y1="58" x2="48" y2="78" stroke="url(#bpGoldGrad)" strokeWidth="1.25" opacity="0.6" />
      {/* Left Scale Bowl/Pan */}
      <path
        d="M 33 78 Q 48 94 63 78 Z"
        fill="url(#bpGoldGrad)"
      />

      {/* Right Scale Strings & Pan */}
      <line x1="112" y1="58" x2="100" y2="78" stroke="url(#bpGoldGrad)" strokeWidth="1.75" />
      <line x1="112" y1="58" x2="124" y2="78" stroke="url(#bpGoldGrad)" strokeWidth="1.75" />
      <line x1="112" y1="58" x2="112" y2="78" stroke="url(#bpGoldGrad)" strokeWidth="1.25" opacity="0.6" />
      {/* Right Scale Bowl/Pan */}
      <path
        d="M 97 78 Q 112 94 127 78 Z"
        fill="url(#bpGoldGrad)"
      />

      {/* Intertwined 'B' and 'P' Roman Monogram */}
      {/* Letter 'B' Upper Loop & Lower Loop */}
      <path
        d="M 68 45 L 88 45 C 99 45 106 51 106 60 C 106 68 100 73 91 75 C 102 77 109 84 109 95 C 109 108 97 116 82 116 L 68 116 Z"
        fill="none"
        stroke="url(#bpGoldGrad)"
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Letter 'B' Mid Divider */}
      <line x1="68" y1="75" x2="90" y2="75" stroke="url(#bpGoldGrad)" strokeWidth="5.5" />

      {/* Letter 'P' Main Stem (forms classical Column with base) */}
      <rect x="58" y="44" width="13" height="74" rx="2" fill="url(#bpGoldGrad)" />
      {/* Classical Column Base Pedestal */}
      <rect x="52" y="117" width="25" height="5" rx="1.5" fill="url(#bpGoldGrad)" />
      <rect x="50" y="122" width="29" height="4" rx="1" fill="url(#bpGoldGrad)" />

      {/* Top Serif accent for P */}
      <path
        d="M 50 47 Q 56 47 62 44"
        stroke="url(#bpGoldGrad)"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );

  if (variant === 'icon') {
    return <EmblemSvg size={44} />;
  }

  if (variant === 'hero') {
    return (
      <div className={`flex flex-col items-center text-center ${className}`}>
        <div className="relative mb-5 p-3 rounded-2xl bg-gradient-to-b from-[#1b1e27] to-[#12141c] border border-[#c5a059]/25 shadow-xl">
          <EmblemSvg size={108} />
          <div className="absolute inset-0 rounded-2xl bg-[#c5a059]/5 pointer-events-none blur-sm" />
        </div>
        <h1
          className="text-3xl sm:text-4xl font-extrabold tracking-[0.16em] uppercase text-transparent bg-clip-text bg-gradient-to-r from-[#faebd0] via-[#c5a059] to-[#faebd0]"
          style={{ fontFamily: "'Cinzel', Georgia, serif" }}
        >
          Bond Partners
        </h1>
        <div className="flex items-center gap-3 mt-2.5">
          <div className="h-[1px] w-8 sm:w-12 bg-gradient-to-r from-transparent to-[#c5a059]/70" />
          <span
            className="text-[10px] sm:text-xs tracking-[0.25em] font-semibold text-[#c5a059] uppercase"
            style={{ fontFamily: "'Cinzel', Georgia, serif" }}
          >
            {subtitle || 'Legal Practitioners'}
          </span>
          <div className="h-[1px] w-8 sm:w-12 bg-gradient-to-l from-transparent to-[#c5a059]/70" />
        </div>
      </div>
    );
  }

  // Navbar default
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="p-1 rounded-lg bg-[#1a1d26] border border-[#c5a059]/30 shadow-sm flex items-center justify-center">
        <EmblemSvg size={36} />
      </div>
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span
            className="text-base sm:text-lg font-bold tracking-[0.14em] uppercase text-transparent bg-clip-text bg-gradient-to-r from-[#faebd0] via-[#e2c78f] to-[#faebd0]"
            style={{ fontFamily: "'Cinzel', Georgia, serif" }}
          >
            Bond Partners
          </span>
          <span className="hidden md:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#c5a059]/15 text-[#e5c378] border border-[#c5a059]/30">
            Case Manager
          </span>
        </div>
        <span
          className="text-[9px] tracking-[0.2em] font-medium text-[#c5a059]/90 uppercase"
          style={{ fontFamily: "'Cinzel', Georgia, serif" }}
        >
          Legal Practitioners
        </span>
      </div>
    </div>
  );
};
