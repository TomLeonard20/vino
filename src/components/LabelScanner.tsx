'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  onCapture: (base64Jpeg: string) => void
  active: boolean
}

type CameraState = 'starting' | 'ready' | 'error'

export default function LabelScanner({ onCapture, active }: Props) {
  const videoRef  = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [camState, setCamState] = useState<CameraState>('starting')
  const [torchOn,  setTorchOn]  = useState(false)

  useEffect(() => {
    if (!active) return
    setCamState('starting')

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => {
        streamRef.current = stream
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        // Use oncanplay — fires reliably on iOS/Android/desktop once video data is available
        video.oncanplay = () => setCamState('ready')
        // Also handle cases where oncanplay already fired
        video.play().then(() => {
          if (video.readyState >= 3) setCamState('ready')
        }).catch(() => setCamState('error'))
      })
      .catch(err => {
        console.error('Camera error:', err)
        setCamState('error')
      })

    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
      setCamState('starting')
    }
  }, [active])

  function capture() {
    const video = videoRef.current
    if (!video) return

    // Take frame even if readyState is just 2 (enough data to render)
    if (video.readyState < 2) {
      console.warn('Video not ready, readyState:', video.readyState)
      return
    }

    // 800px is plenty for reading label text; smaller = faster upload + faster API
    const MAX   = 800
    const scale = video.videoWidth > MAX ? MAX / video.videoWidth : 1
    const w     = Math.round((video.videoWidth  || 800) * scale)
    const h     = Math.round((video.videoHeight || 600) * scale)

    const canvas = document.createElement('canvas')
    canvas.width  = w
    canvas.height = h
    canvas.getContext('2d')!.drawImage(video, 0, 0, w, h)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.75)   // 0.75 quality — still crisp for text
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
        autoPlay
      />

      {/* Camera starting overlay */}
      {camState === 'starting' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <p className="text-white/60 text-sm">Starting camera…</p>
        </div>
      )}

      {/* Camera error overlay */}
      {camState === 'error' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center px-6">
          <div className="rounded-xl p-4 text-center space-y-2"
               style={{ background: 'rgba(139,32,53,0.9)' }}>
            <p className="text-white font-semibold text-sm">Camera unavailable</p>
            <p className="text-white/70 text-xs">
              Allow camera access in your browser settings, then reload the page.
            </p>
          </div>
        </div>
      )}

      {/* Label framing guide (only when camera is ready) */}
      {camState === 'ready' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="relative rounded-lg"
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
      )}

      {/* Torch button */}
      {camState === 'ready' && (
        <button
          onClick={toggleTorch}
          className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          aria-label="Toggle torch"
        >
          {torchOn ? '🔦' : '💡'}
        </button>
      )}

      {/* Capture button */}
      <button
        onClick={capture}
        disabled={camState !== 'ready'}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 rounded-full transition-all active:scale-90"
        aria-label="Capture label"
        style={{
          width:      72,
          height:     72,
          background: camState === 'ready' ? 'white' : 'rgba(255,255,255,0.2)',
          boxShadow:  camState === 'ready' ? '0 0 0 5px rgba(255,255,255,0.25)' : 'none',
          cursor:     camState === 'ready' ? 'pointer' : 'default',
        }}
      >
        {camState === 'starting' && (
          <div className="w-5 h-5 border-2 border-white/40 border-t-white/80 rounded-full animate-spin mx-auto" />
        )}
      </button>

      {/* Hint text */}
      <p
        className="absolute bottom-[6.5rem] left-1/2 -translate-x-1/2 text-xs whitespace-nowrap"
        style={{
          color:      camState === 'ready' ? 'rgba(255,255,255,0.6)' : 'transparent',
          textShadow: '0 1px 3px rgba(0,0,0,0.8)',
        }}
      >
        Frame the front label, then tap the button
      </p>
    </div>
  )
}
