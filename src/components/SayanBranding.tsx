import React from 'react';
import { Check } from 'lucide-react';

interface SayanCrownProps {
  className?: string;
  onClick?: () => void;
}

export const SayanCrown: React.FC<SayanCrownProps> = ({ className = 'w-16 h-11', onClick }) => (
  <svg
    viewBox="0 0 120 74"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} select-none drop-shadow-[0_0_12px_rgba(217,0,255,0.9)]`}
    onClick={onClick}
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="sayanCrownGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="45%" stopColor="#f0abfc" />
        <stop offset="100%" stopColor="#c026d3" />
      </linearGradient>
    </defs>
    <path
      d="M18 54 L10 22 L36 39 L60 12 L84 39 L110 22 L102 54 Z"
      stroke="url(#sayanCrownGrad)"
      strokeWidth="3.5"
      strokeLinejoin="round"
      fill="rgba(192, 38, 211, 0.14)"
    />
    <path
      d="M21 63 Q60 57 99 63"
      stroke="url(#sayanCrownGrad)"
      strokeWidth="3.2"
      strokeLinecap="round"
    />
    <circle cx="9" cy="18" r="3.6" fill="#ffffff" />
    <circle cx="35" cy="36" r="2.8" fill="#f5d0fe" />
    <circle cx="60" cy="9" r="4.5" fill="#ffffff" />
    <circle cx="85" cy="36" r="2.8" fill="#f5d0fe" />
    <circle cx="111" cy="18" r="3.6" fill="#ffffff" />
  </svg>
);

interface SayanWordmarkProps {
  size?: 'lg' | 'md';
}

export const SayanWordmark: React.FC<SayanWordmarkProps> = ({ size = 'lg' }) => {
  const heightClass = size === 'lg' ? 'h-14 sm:h-20 md:h-24' : 'h-10 sm:h-12';
  return (
    <div className="relative flex items-center justify-center select-none">
      <svg
        viewBox="0 0 380 96"
        className={`${heightClass} w-auto drop-shadow-[0_0_16px_rgba(217,0,255,0.95)]`}
        role="img"
        aria-label="SAYAN"
      >
        <defs>
          <linearGradient id="sayanTextGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f5d0fe" />
            <stop offset="35%" stopColor="#e879f9" />
            <stop offset="70%" stopColor="#c026d3" />
            <stop offset="100%" stopColor="#7e22ce" />
          </linearGradient>
        </defs>
        <text
          x="190"
          y="74"
          textAnchor="middle"
          fill="url(#sayanTextGrad)"
          stroke="#ffffff"
          strokeWidth="1.8"
          fontFamily="'Chakra Petch', sans-serif"
          fontWeight="800"
          fontStyle="italic"
          fontSize="74"
          letterSpacing="6"
        >
          SAYAN
        </text>
      </svg>
    </div>
  );
};

export const FlameEmblem: React.FC<{ className?: string }> = ({ className = 'w-12 h-14' }) => (
  <svg
    viewBox="0 0 64 78"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} drop-shadow-[0_0_14px_rgba(217,0,255,0.85)]`}
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="flameOuter" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#f5d0fe" />
        <stop offset="50%" stopColor="#d946ef" />
        <stop offset="100%" stopColor="#7e22ce" />
      </linearGradient>
    </defs>
    <path
      d="M34 4 C34 4 54 22 54 44 C54 60 44 72 32 72 C20 72 10 60 10 44 C10 31 18 22 22 17 C22 26 27 29 27 29 C27 29 24 14 34 4 Z"
      fill="url(#flameOuter)"
      stroke="#ffffff"
      strokeWidth="1.5"
    />
    <path
      d="M33 27 C39 36 42 45 40 54 C38 61 34 64 32 64 C28 64 23 59 23 49 C23 41 28 34 33 27 Z"
      fill="#090212"
    />
  </svg>
);

interface PurpleCheckboxProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}

export const PurpleCheckbox: React.FC<PurpleCheckboxProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
}) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`group flex w-full items-center gap-3.5 rounded-md py-1.5 px-1 text-left transition-opacity focus-visible:outline-2 focus-visible:outline-fuchsia-400 min-h-[42px] ${
      disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-fuchsia-500/10'
    }`}
  >
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[5px] transition-all duration-150 ${
        checked ? 'sayan-checkbox-checked' : 'sayan-checkbox bg-[#090212]'
      }`}
    >
      {checked && <Check className="h-5 w-5 stroke-[3.2] text-white" />}
    </span>
    <span className="font-display text-base sm:text-lg font-medium tracking-wide text-white group-hover:text-fuchsia-100">
      {label}
    </span>
  </button>
);
