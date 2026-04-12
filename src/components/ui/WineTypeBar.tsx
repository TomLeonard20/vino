import { WINE_TYPE_COLOURS } from '@/types/database'
import type { WineType } from '@/types/database'

export default function WineTypeBar({ type }: { type: WineType }) {
  return (
    <div
      className="w-1 self-stretch rounded-sm shrink-0"
      style={{ background: WINE_TYPE_COLOURS[type] }}
      aria-hidden
    />
  )
}
