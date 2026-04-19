import type { WineType } from '@/types/database'

interface Colors {
  glass:   string
  glassDim: string
  capsule: string
  bg:      string
}

const COLORS: Record<WineType, Colors> = {
  Red: {
    glass:    '#152414',
    glassDim: '#0c160c',
    capsule:  '#8b2035',
    bg:       'rgba(139,32,53,0.10)',
  },
  White: {
    glass:    '#2d4a22',
    glassDim: '#1c3014',
    capsule:  '#c9a84c',
    bg:       'rgba(201,168,76,0.10)',
  },
  Rosé: {
    glass:    '#b87a84',
    glassDim: '#8a5860',
    capsule:  '#d4748a',
    bg:       'rgba(212,116,138,0.10)',
  },
  Champagne: {
    glass:    '#1e3416',
    glassDim: '#121f0e',
    capsule:  '#c9b86c',
    bg:       'rgba(201,184,108,0.12)',
  },
}

// Single continuous bottle outline path (viewBox 0 0 32 82)
// Neck bottom at y=26, body top at y=42, body bottom at y=78
const BOTTLE_PATH =
  'M 13 10 L 19 10 L 19 26 C 19 35 27 37 27 43 L 27 76 Q 27 79 24 79 L 8 79 Q 5 79 5 76 L 5 43 C 5 37 13 35 13 26 Z'

export default function WineBottleImage({
  type,
  labelImageUrl,
  transparent,
  width = 28,
  height = 70,
}: {
  type:            WineType
  labelImageUrl?:  string | null
  transparent?:    boolean          // skip tinted background (for use on coloured hero)
  width?:          number
  height?:         number
}) {
  const c = COLORS[type]

  return (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{ background: transparent ? 'transparent' : c.bg }}
    >
      {labelImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={labelImageUrl}
          alt="Wine label"
          className="w-full h-full object-cover"
        />
      ) : (
        <svg
          viewBox="0 0 32 84"
          width={width}
          height={height}
          fill="none"
          aria-hidden="true"
        >
          {/* Glass body */}
          <path d={BOTTLE_PATH} fill={c.glass} />

          {/* Darker right-side shadow — gives cylindrical depth */}
          <path
            d="M 22 43 C 24 37 27 37 27 43 L 27 76 Q 27 79 24 79 L 20 79 L 20 43 C 20 40 21 40 22 43 Z"
            fill={c.glassDim}
            opacity="0.7"
          />

          {/* Label area */}
          <rect x="7" y="48" width="18" height="22" rx="2" fill="#f5ede6" opacity="0.93" />

          {/* Left specular highlight — glass shimmer */}
          <line
            x1="9.5" y1="12" x2="9.5" y2="75"
            stroke="rgba(255,255,255,0.13)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Capsule */}
          <rect x="10.5" y="2" width="11" height="10" rx="2.5" fill={c.capsule} />

          {/* Capsule shine */}
          <rect x="12" y="3.5" width="4" height="5" rx="1.5" fill="rgba(255,255,255,0.22)" />

          {/* Punt shadow at base */}
          <ellipse cx="16" cy="78" rx="5.5" ry="1.5" fill={c.glassDim} opacity="0.55" />
        </svg>
      )}
    </div>
  )
}
