'use client'

import { useState, useRef, useTransition } from 'react'
import type { CellarBottle } from '@/types/database'
import CellarBottleCard from './CellarBottleCard'
import { deleteBottle } from '@/app/(app)/cellar/actions'

const DELETE_ZONE = 80  // px

export default function SwipeToDeleteCard({
  bottle,
  currentUserId,
}: {
  bottle:         CellarBottle
  currentUserId?: string
}) {
  const [translateX, setTranslateX] = useState(0)
  const [swiped,     setSwiped]     = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [removed,    setRemoved]    = useState(false)
  const [dragging,   setDragging]   = useState(false)
  const [isPending,  startTransition] = useTransition()

  const startX = useRef(0)

  if (removed) return null

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX
    setDragging(true)
  }

  function onTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - startX.current
    if (dx < 0) {
      setTranslateX(Math.max(dx, -DELETE_ZONE))
    } else if (swiped) {
      setTranslateX(Math.min(dx - DELETE_ZONE, 0))
    }
  }

  function onTouchEnd() {
    setDragging(false)
    if (translateX < -(DELETE_ZONE / 2)) {
      setTranslateX(-DELETE_ZONE)
      setSwiped(true)
    } else {
      setTranslateX(0)
      setSwiped(false)
    }
  }

  function reset() {
    setTranslateX(0)
    setSwiped(false)
    setConfirming(false)
  }

  function handleDelete() {
    setRemoved(true)   // optimistic: card disappears immediately
    startTransition(async () => {
      try {
        await deleteBottle(bottle.id)
      } catch {
        setRemoved(false)  // revert on error
        reset()
      }
    })
  }

  return (
    <div className="relative rounded-xl overflow-hidden">

      {/* ── Delete zone (revealed on swipe) ── */}
      <div
        className="absolute right-0 top-0 bottom-0 flex items-center justify-center"
        style={{ width: DELETE_ZONE, background: '#c0392b' }}
      >
        {confirming ? (
          <div className="flex flex-col items-center gap-2 px-2">
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="text-xs font-bold text-white active:opacity-60"
            >
              {isPending ? '…' : 'Confirm'}
            </button>
            <button
              onClick={reset}
              className="text-xs active:opacity-60"
              style={{ color: 'rgba(255,255,255,0.65)' }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="flex flex-col items-center gap-1.5 active:opacity-60"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                 stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
            <span className="text-xs font-semibold text-white">Delete</span>
          </button>
        )}
      </div>

      {/* ── Card (slides left on swipe) ── */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform:  `translateX(${translateX}px)`,
          transition: dragging ? 'none' : 'transform 0.2s ease',
          position:   'relative',
          zIndex:     1,
        }}
      >
        <CellarBottleCard bottle={bottle} currentUserId={currentUserId} />
      </div>

      {/* Tap backdrop to dismiss swipe */}
      {swiped && (
        <div
          className="absolute inset-0"
          style={{ right: DELETE_ZONE, zIndex: 2 }}
          onClick={reset}
        />
      )}
    </div>
  )
}
