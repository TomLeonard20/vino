interface Props {
  stars: number
  size?: number
}

export default function StarRating({ stars, size = 14 }: Props) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${stars} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={i <= stars ? '#8b2035' : 'none'}
             stroke={i <= stars ? '#8b2035' : '#c4a090'} strokeWidth="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </span>
  )
}
