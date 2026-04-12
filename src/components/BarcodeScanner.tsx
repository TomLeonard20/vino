'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { NotFoundException } from '@zxing/library'

interface Props {
  onDetected: (barcode: string) => void
  onNoBarcode: () => void   // called after NO_BARCODE_TIMEOUT ms if nothing detected
  active: boolean
}

// Give users enough time to find and frame the barcode
const NO_BARCODE_TIMEOUT = 15_000 // 15 seconds

export default function BarcodeScanner({ onDetected, onNoBarcode, active }: Props) {
  const videoRef    = useRef<HTMLVideoElement>(null)
  const readerRef   = useRef<BrowserMultiFormatReader | null>(null)
  const streamRef   = useRef<MediaStream | null>(null)
  const detectedRef = useRef(false)
  const [torchOn,     setTorchOn]     = useState(false)
  const [elapsed,     setElapsed]     = useState(0)   // seconds since scan started
  const [cameraError, setCameraError] = useState(false)

  const startScanning = useCallback(() => {
    detectedRef.current = false
    setElapsed(0)
    setCameraError(false)

    const reader = new BrowserMultiFormatReader()
    readerRef.current = reader

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => {
        streamRef.current = stream
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          video.play()
        }

        // Poll for barcodes every 300ms
        const canvas = document.createElement('canvas')
        const ctx    = canvas.getContext('2d')!
        const pollInterval = setInterval(async () => {
          const v = videoRef.current
          if (!v || v.readyState < 2) return
          canvas.width  = v.videoWidth
          canvas.height = v.videoHeight
          ctx.drawImage(v, 0, 0)
          try {
            const result = await reader.decodeFromCanvas(canvas)
            if (result && !detectedRef.current) {
              detectedRef.current = true
              clearInterval(pollInterval)
              clearInterval(elapsedInterval)
              onDetected(result.getText())
            }
          } catch (e) {
            if (!(e instanceof NotFoundException)) console.error(e)
          }
        }, 300)

        // Track elapsed seconds and fire onNoBarcode after timeout
        const elapsedInterval = setInterval(() => {
          setElapsed(prev => {
            const next = prev + 1
            if (next >= NO_BARCODE_TIMEOUT / 1000 && !detectedRef.current) {
              clearInterval(elapsedInterval)
              clearInterval(pollInterval)
              onNoBarcode()
            }
            return next
          })
        }, 1000)

        return () => {
          clearInterval(pollInterval)
          clearInterval(elapsedInterval)
        }
      })
      .catch(err => {
        console.error('Camera error:', err)
        setCameraError(true)
      })
  }, [onDetected, onNoBarcode])

  useEffect(() => {
    if (!active) return
    startScanning()
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [active, startScanning])

  function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    const newVal = !torchOn
    // @ts-expect-error – torch is not in TS types yet
    track.applyConstraints({ advanced: [{ torch: newVal }] }).catch(() => {})
    setTorchOn(newVal)
  }

  const remaining    = Math.max(0, NO_BARCODE_TIMEOUT / 1000 - elapsed)
  const timeoutPct   = (elapsed / (NO_BARCODE_TIMEOUT / 1000)) * 100

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {/* Camera feed */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        muted
        playsInline
      />

      {/* Dark vignette with clear centre window */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 rounded-sm"
             style={{ width: '72vw', maxWidth: 320, height: 160 }}>
          <TargetCorners />
          <ScanLine />
        </div>
      </div>

      {/* Camera error */}
      {cameraError && (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-6">
          <p className="text-white text-sm text-center px-4 py-3 rounded-xl"
             style={{ background: 'rgba(139,32,53,0.9)' }}>
            Camera access denied. Please allow camera permissions and try again.
          </p>
        </div>
      )}

      {/* Torch button */}
      <button
        onClick={toggleTorch}
        className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.5)' }}
        aria-label="Toggle torch"
      >
        {torchOn ? '🔦' : '💡'}
      </button>

      {/* Countdown ring — only shows in last 5 seconds */}
      {remaining <= 5 && remaining > 0 && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1">
          <p className="text-white/60 text-xs">Still looking…</p>
        </div>
      )}

      {/* Progress bar at bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-20 h-0.5"
           style={{ background: 'rgba(255,255,255,0.1)' }}>
        <div className="h-full transition-all"
             style={{
               width: `${timeoutPct}%`,
               background: remaining <= 5 ? '#f59e0b' : '#8b2035',
             }} />
      </div>
    </div>
  )
}

function TargetCorners() {
  const c = 'absolute border-white'
  const len = 22
  const w   = 2
  return (
    <>
      <span className={`${c} top-0 left-0 border-t border-l`}   style={{ width: len, height: len, borderWidth: w }} />
      <span className={`${c} top-0 right-0 border-t border-r`}  style={{ width: len, height: len, borderWidth: w }} />
      <span className={`${c} bottom-0 left-0 border-b border-l`}  style={{ width: len, height: len, borderWidth: w }} />
      <span className={`${c} bottom-0 right-0 border-b border-r`} style={{ width: len, height: len, borderWidth: w }} />
    </>
  )
}

function ScanLine() {
  return (
    <div className="absolute inset-x-1 overflow-hidden" style={{ top: 0, bottom: 0 }}>
      <div
        className="absolute left-0 right-0 h-0.5"
        style={{
          background: 'rgba(255,255,255,0.7)',
          animation: 'scanline 2s ease-in-out infinite alternate',
        }}
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
