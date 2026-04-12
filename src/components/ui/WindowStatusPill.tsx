import type { DrinkingStatus } from '@/types/database'

const styles: Record<DrinkingStatus, { background: string; color: string }> = {
  'Drink now':  { background: '#c8e6c9', color: '#2e5c30' },
  'At peak':    { background: '#fce4ec', color: '#8b0000' },
  'Open soon':  { background: '#fff3e0', color: '#7a4e00' },
  'Too young':  { background: '#ecddd4', color: '#c4a090' },
  'Past peak':  { background: '#ecddd4', color: '#c4a090' },
}

export default function WindowStatusPill({
  status,
  compact = false,
}: {
  status: DrinkingStatus
  compact?: boolean
}) {
  const s = styles[status]
  return (
    <span
      className={`inline-block font-medium rounded-full ${compact ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'}`}
      style={s}
    >
      {status}
    </span>
  )
}
