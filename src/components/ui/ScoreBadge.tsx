import { scoreTier } from '@/types/database'

interface Props {
  score: number | null
  size?: 'sm' | 'md' | 'lg'
}

const styles = {
  gold:   { background: '#f5e6b0', color: '#7a5c00' },
  silver: { background: '#e8e4e0', color: '#4a4440' },
  bronze: { background: '#f0ddd0', color: '#6a3a20' },
  none:   { background: '#ecddd4', color: '#a07060' },
}

const sizes = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
  lg: 'text-base px-3 py-1.5',
}

export default function ScoreBadge({ score, size = 'md' }: Props) {
  if (!score) return null
  const tier = scoreTier(score)
  return (
    <span
      className={`inline-block font-bold rounded-full tabular-nums ${sizes[size]}`}
      style={styles[tier]}
    >
      {score}
    </span>
  )
}
