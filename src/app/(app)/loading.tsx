/**
 * Home page skeleton — shown instantly on navigation while the server
 * component fetches user + bottle data.
 */
export default function HomeLoading() {
  return (
    <div className="space-y-5 pb-4 animate-pulse">

      {/* Greeting */}
      <div className="h-7 w-48 rounded-lg" style={{ background: '#ecddd4' }} />

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map(i => (
          <div key={i} className="text-center py-4 px-2 rounded-xl" style={{ background: '#ecddd4' }}>
            <div className="h-7 w-10 rounded mx-auto" style={{ background: '#d4b8aa' }} />
            <div className="h-2.5 w-14 rounded mx-auto mt-1.5" style={{ background: '#d4b8aa' }} />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#1c0a10' }}>
        <div className="px-4 pt-4 pb-3 flex items-center justify-between">
          <div className="h-3 w-28 rounded" style={{ background: 'rgba(122,74,84,0.4)' }} />
          <div className="h-3 w-6 rounded" style={{ background: 'rgba(122,74,84,0.3)' }} />
        </div>
        <div className="px-4 pb-4">
          <div className="h-2 w-48 rounded" style={{ background: 'rgba(122,74,84,0.25)' }} />
        </div>
      </div>

      {/* Add a bottle card */}
      <div className="rounded-xl p-4" style={{ background: '#ecddd4' }}>
        <div className="h-4 w-28 rounded mb-3" style={{ background: '#d4b8aa' }} />
        <div className="flex gap-2">
          <div className="flex-1 h-10 rounded-lg" style={{ background: '#d4b8aa' }} />
          <div className="flex-1 h-10 rounded-lg" style={{ background: '#d4b8aa' }} />
        </div>
      </div>

      {/* AI assistant card */}
      <div className="rounded-xl overflow-hidden" style={{ background: '#ecddd4' }}>
        <div className="flex" style={{ borderBottom: '1px solid #d4b8aa' }}>
          <div className="flex-1 h-10" style={{ background: '#ecddd4' }} />
          <div className="flex-1 h-10" style={{ background: '#ecddd4' }} />
        </div>
        <div className="p-3 flex gap-2">
          <div className="flex-1 h-9 rounded-lg" style={{ background: '#d4b8aa' }} />
          <div className="w-16 h-9 rounded-lg" style={{ background: '#d4b8aa' }} />
        </div>
      </div>

      {/* Recent notes heading */}
      <div className="h-5 w-28 rounded" style={{ background: '#ecddd4' }} />

      {/* Note cards */}
      {[0, 1].map(i => (
        <div key={i} className="rounded-xl p-3 flex gap-3" style={{ background: '#ecddd4' }}>
          <div className="w-1 rounded-sm" style={{ background: '#d4b8aa' }} />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 rounded" style={{ background: '#d4b8aa' }} />
            <div className="h-3 w-1/2 rounded" style={{ background: '#d4b8aa' }} />
          </div>
        </div>
      ))}
    </div>
  )
}
