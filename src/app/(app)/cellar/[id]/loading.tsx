export default function WineDetailLoading() {
  return (
    <div className="animate-pulse">

      {/* Burgundy hero skeleton */}
      <div className="rounded-2xl p-5" style={{ background: '#8b2035', minHeight: 180 }}>
        <div className="flex gap-4">
          {/* Photo placeholder */}
          <div className="w-24 shrink-0 rounded-xl" style={{ background: 'rgba(255,255,255,0.12)', height: 140 }} />
          {/* Text placeholder */}
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-5 rounded" style={{ background: 'rgba(255,255,255,0.2)', width: '80%' }} />
            <div className="h-4 rounded" style={{ background: 'rgba(255,255,255,0.15)', width: '55%' }} />
            <div className="mt-3 space-y-2">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="flex justify-between">
                  <div className="h-3 rounded" style={{ background: 'rgba(255,255,255,0.15)', width: '35%' }} />
                  <div className="h-3 rounded" style={{ background: 'rgba(255,255,255,0.2)', width: '30%' }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content blocks */}
      <div className="space-y-3 mt-4">
        {[120, 80, 160].map((h, i) => (
          <div key={i} className="rounded-2xl" style={{ background: '#ecddd4', height: h }} />
        ))}
      </div>
    </div>
  )
}
