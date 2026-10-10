import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { getCroppedImg } from '../lib/cropImage.ts'
import { createPortal } from 'react-dom'

export function CropperModal({
  imageSrc,
  aspectRatio = 1,
  onCrop,
  onCancel,
}: {
  imageSrc: string
  aspectRatio?: number
  onCrop: (blob: Blob) => void
  onCancel: () => void
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)
  const [working, setWorking] = useState(false)

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const handleCrop = async () => {
    if (!croppedAreaPixels) return
    setWorking(true)
    try {
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels)
      onCrop(croppedImage)
    } catch (e) {
      console.error(e)
    } finally {
      setWorking(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-black p-4 pb-12 sm:pb-4 sm:p-8" role="dialog" aria-modal="true">
      <div className="relative flex-1 bg-neutral-900 rounded-3xl overflow-hidden shadow-2xl">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={aspectRatio}
          onCropChange={setCrop}
          onCropComplete={onCropComplete}
          onZoomChange={setZoom}
        />
      </div>
      <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex-1 w-full max-w-sm px-4 flex items-center gap-3">
          <span className="text-white text-xs">Zoom</span>
          <input
            type="range"
            value={zoom}
            min={1}
            max={3}
            step={0.1}
            aria-labelledby="Zoom"
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>
        <div className="flex gap-3 w-full sm:w-auto px-4 sm:px-0">
          <button
            type="button"
            onClick={onCancel}
            disabled={working}
            className="flex-1 sm:flex-none px-6 py-3 rounded-2xl bg-neutral-800 text-white font-semibold hover:bg-neutral-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleCrop()}
            disabled={working}
            className="flex-1 sm:flex-none px-6 py-3 rounded-2xl bg-emerald-500 text-black font-semibold hover:bg-emerald-400 disabled:opacity-50"
          >
            {working ? 'Recortando...' : 'Aplicar'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
