export default function CellarLoading() {
  return (
    <div className="space-y-4 pb-28 animate-pulse">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="h-6 w-16 rounded-md" style={{ background: '#d4b8aa' }} />
        <div className="h-8 w-32 rounded-full" style={{ background: '#d4b8aa' }} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map(i => (
          <div key={i} className="py-4 px-2 rounded-xl flex flex-col items-center gap-1"
               style={{ background: '#ecddd4' }}>
            <div className="h-7 w-10 rounded" style={{ background: '#d4b8aa' }} />
            <div className="h-3 w-14 rounded" style={{ background: '#d4b8aa' }} />
          </div>
        ))}
      </div>

      {/* Type tabs */}
      <div className="flex gap-2 overflow-x-hidden">
        {[40, 28, 32, 28, 48].map((w, i) => (
          <div key={i} className="h-8 rounded-full shrink-0" style={{ background: '#d4b8aa', width: w * 2 }} />
        ))}
      </div>

      {/* Filter/sort bar */}
      <div className="flex gap-2">
        <div className="h-9 flex-1 rounded-xl" style={{ background: '#ecddd4' }} />
        <div className="h-9 flex-1 rounded-xl" style={{ background: '#ecddd4' }} />
      </div>

      {/* Bottle cards */}
      <div className="space-y-2 pt-1">
        <div className="h-4 w-20 rounded mb-1" style={{ background: '#d4b8aa' }} />
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="rounded-xl overflow-hidden flex" style={{ background: '#ecddd4', height: 80 }}>
            <div className="w-14 shrink-0" style={{ background: '#d4b8aa' }} />
            <div className="flex-1 p-3 space-y-2">
              <div className="h-4 rounded" style={{ background: '#d4b8aa', width: '60%' }} />
              <div className="h-3 rounded" style={{ background: '#d4b8aa', width: '40%' }} />
              <div className="h-3 rounded" style={{ background: '#d4b8aa', width: '50%' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
