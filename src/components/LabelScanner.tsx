'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  onCapture: (base64Jpeg: string) => void
  active: boolean
}

export default function LabelScanner({ onCapture, active }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [torchOn, setTorchOn] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!active) return
    setReady(false)

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => {
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
          videoRef.current.onloadedmetadata = () => setReady(true)
        }
      })
      .catch(err => console.error('Camera error:', err))

    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
      setReady(false)
    }
  }, [active])

  function capture() {
    const video = videoRef.current
    if (!video || video.readyState < 2) return

    // Resize to max 1024px wide to keep payload reasonable
    const MAX = 1024
    const scale = video.videoWidth > MAX ? MAX / video.videoWidth : 1
    const w = Math.round(video.videoWidth * scale)
    const h = Math.round(video.videoHeight * scale)

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d')!.drawImage(video, 0, 0, w, h)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    onCapture(dataUrl)
  }

  function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    const newVal = !torchOn
    // @ts-expect-error – torch not in TS types
    track.applyConstraints({ advanced: [{ torch: newVal }] }).catch(() => {})
    setTorchOn(newVal)
  }

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {/* Camera feed */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        muted
        playsInline
      />

      {/* Subtle label framing guide */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="border border-white/30 rounded-lg"
          style={{ width: '70vw', maxWidth: 300, height: '50vw', maxHeight: 220 }}
        >
          {/* Corner accents */}
          {(['tl','tr','bl','br'] as const).map(pos => (
            <span
              key={pos}
              className="absolute w-5 h-5 border-white"
              style={{
                top:    pos.startsWith('t') ? -1 : undefined,
                bottom: pos.startsWith('b') ? -1 : undefined,
                left:   pos.endsWith('l')   ? -1 : undefined,
                right:  pos.endsWith('r')   ? -1 : undefined,
                borderTopWidth:    pos.startsWith('t') ? 2 : 0,
                borderBottomWidth: pos.startsWith('b') ? 2 : 0,
                borderLeftWidth:   pos.endsWith('l')   ? 2 : 0,
                borderRightWidth:  pos.endsWith('r')   ? 2 : 0,
              }}
            />
          ))}
        </div>
      </div>

      {/* Torch button */}
      <button
        onClick={toggleTorch}
        className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.5)' }}
        aria-label="Toggle torch"
      >
        {torchOn ? '🔦' : '💡'}
      </button>

      {/* Capture button */}
      <button
        onClick={capture}
        disabled={!ready}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 rounded-full transition-transform active:scale-95"
        style={{
          width: 72,
          height: 72,
          background: ready ? 'white' : 'rgba(255,255,255,0.3)',
          boxShadow: ready ? '0 0 0 4px rgba(255,255,255,0.3)' : 'none',
        }}
        aria-label="Capture label"
      >
        <span className="sr-only">Capture</span>
      </button>

      {/* Hint */}
      <p
        className="absolute bottom-24 left-1/2 -translate-x-1/2 text-xs text-white/60 whitespace-nowrap"
        style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
      >
        Frame the label, then tap the button
      </p>
    </div>
  )
}
