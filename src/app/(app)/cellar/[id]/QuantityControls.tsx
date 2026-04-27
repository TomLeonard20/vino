'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateBottle, deleteBottle } from '../actions'

interface Props {
  bottleId: string
  quantity: number
}

export default function QuantityControls({ bottleId, quantity }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [qty, setQty]     = useState(quantity)
  const [error, setError] = useState('')

  function change(delta: number) {
    setError('')
    const next = qty + delta
    if (next < 0) return

    startTransition(async () => {
      if (next === 0) {
        // Last bottle removed — confirm then delete
        if (!confirm('Remove this wine from your cellar?')) return
        try {
          await deleteBottle(bottleId)
          router.push('/cellar')
        } catch (e) {
          setError((e as Error).message)
        }
        return
      }

      const res = await updateBottle(bottleId, { quantity: next })
      if (res.error) { setError(res.error); return }
      setQty(next)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2 shrink-0">
        <button
          onClick={() => change(-1)}
          disabled={isPending || qty < 1}
          className="px-3 py-2 rounded-xl text-sm font-semibold border-2 active:opacity-60"
          style={{
            borderColor: '#3a1a20',
            color: '#3a1a20',
            opacity: isPending || qty < 1 ? 0.4 : 1,
          }}
        >
          − Remove
        </button>
        <button
          onClick={() => change(1)}
          disabled={isPending}
          className="px-3 py-2 rounded-xl text-sm font-semibold border-2 active:opacity-60"
          style={{
            borderColor: '#3a1a20',
            color: '#3a1a20',
            opacity: isPending ? 0.4 : 1,
          }}
        >
          + Add
        </button>
      </div>
      {error && (
        <p className="text-xs" style={{ color: '#8b2035' }}>{error}</p>
      )}
    </div>
  )
}
