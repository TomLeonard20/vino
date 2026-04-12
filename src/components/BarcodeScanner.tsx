'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { NotFoundException } from '@zxing/library'

interface Props {
  onDetected: (barcode: string) => void
  onNoBarcode: () => void   // called after 3s if nothing detected
  active: boolean
}

export default function BarcodeScanner({ onDetected, onNoBarcode, active }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const noBarcodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [torchOn, setTorchOn] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)
  const detectedRef = useRef(false)

  const startTimer = useCallback(() => {
    noBarcodeTimer.current = setTimeout(() => {
      if (!detectedRef.current) onNoBarcode()
    }, 3000)
  }, [onNoBarcode])

  useEffect(() => {
    if (!active) return

    detectedRef.current = false
    const reader = new BrowserMultiFormatReader()
    readerRef.current = reader

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => {
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
        }

        startTimer()

        // Poll for barcodes
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')!
        const interval = setInterval(async () => {
          const video = videoRef.current
          if (!video || video.readyState < 2) return
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          ctx.drawImage(video, 0, 0)
          try {
            const result = await reader.decodeFromCanvas(canvas)
            if (result && !detectedRef.current) {
              detectedRef.current = true
              clearInterval(interval)
              if (noBarcodeTimer.current) clearTimeout(noBarcodeTimer.current)
              onDetected(result.getText())
            }
          } catch (e) {
            if (!(e instanceof NotFoundException)) console.error(e)
          }
        }, 300)

        return () => clearInterval(interval)
      })
      .catch(err => console.error('Camera error:', err))

    return () => {
      if (noBarcodeTimer.current) clearTimeout(noBarcodeTimer.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [active, onDetected, startTimer])

  function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    const newVal = !torchOn
    // @ts-expect-error – torch is not in TS types yet
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

      {/* Dark vignette overlay with clear centre window */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50" />
        <div
          className="relative z-10 rounded-sm"
          style={{ width: '72vw', maxWidth: 320, height: 160 }}
        >
          {/* Clear window — cut out of the dark overlay */}
          <div className="absolute inset-0 bg-transparent mix-blend-normal" />
          <TargetCorners />
          <ScanLine />
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
    </div>
  )
}

function TargetCorners() {
  const c = 'absolute border-red-500'
  const len = 20
  const w = 3
  return (
    <>
      {/* Top-left */}
      <span className={`${c} top-0 left-0 border-t border-l`}
            style={{ width: len, height: len, borderWidth: w }} />
      {/* Top-right */}
      <span className={`${c} top-0 right-0 border-t border-r`}
            style={{ width: len, height: len, borderWidth: w }} />
      {/* Bottom-left */}
      <span className={`${c} bottom-0 left-0 border-b border-l`}
            style={{ width: len, height: len, borderWidth: w }} />
      {/* Bottom-right */}
      <span className={`${c} bottom-0 right-0 border-b border-r`}
            style={{ width: len, height: len, borderWidth: w }} />
    </>
  )
}

function ScanLine() {
  return (
    <div className="absolute inset-x-1 overflow-hidden" style={{ top: 0, bottom: 0 }}>
      <div
        className="absolute left-0 right-0 h-0.5 bg-red-500/70"
        style={{ animation: 'scanline 2s ease-in-out infinite alternate' }}
      />
      <style>{`
        @keyframes scanline {
          from { top: 10%; }
          to   { top: 90%; }
        }
      `}</style>
    </div>
  )
}
