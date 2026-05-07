import { useEffect, useMemo, useState } from 'react'
import * as exifr from 'exifr'
import './App.css'

const emptyLabel = 'No disponible'
const maxUploadSize = 4 * 1024 * 1024
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || ''

function toDms(coordinate, positiveLabel, negativeLabel) {
  if (typeof coordinate !== 'number') {
    return null
  }

  const absolute = Math.abs(coordinate)
  const degrees = Math.floor(absolute)
  const minutesFloat = (absolute - degrees) * 60
  const minutes = Math.floor(minutesFloat)
  const seconds = ((minutesFloat - minutes) * 60).toFixed(2)
  const direction = coordinate >= 0 ? positiveLabel : negativeLabel

  return `${degrees}deg ${minutes}' ${seconds}" ${direction}`
}

function formatDate(dateValue) {
  if (!dateValue) {
    return emptyLabel
  }

  try {
    return new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'full',
      timeStyle: 'medium',
    }).format(new Date(dateValue))
  } catch {
    return emptyLabel
  }
}

function formatBytes(bytes) {
  if (typeof bytes !== 'number') {
    return emptyLabel
  }

  if (bytes < 1024) {
    return `${bytes} B`
  }

  const units = ['KB', 'MB', 'GB']
  let size = bytes / 1024
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }
  return `${size.toFixed(2)} ${units[unitIndex]}`
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const image = new Image()
      image.onload = () => {
        const scale = Math.min(1, 1024 / image.width)
        const width = Math.round(image.width * scale)
        const height = Math.round(image.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')
        if (!context) {
          reject(new Error('No se pudo preparar el compresor de imagen.'))
          return
        }

        context.drawImage(image, 0, 0, width, height)
        const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
        const compressedDataUrl = canvas.toDataURL(mimeType, 0.8)
        const imageBase64 = compressedDataUrl.split(',')[1]

        if (!imageBase64) {
          reject(new Error('No se pudo convertir la imagen comprimida.'))
          return
        }

        resolve({ imageBase64, mimeType, width, height })
      }
      image.onerror = () => reject(new Error('No se pudo cargar la imagen para comprimir.'))
      image.src = reader.result
    }
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'))
    reader.readAsDataURL(file)
  })
}

function App() {
  const [previewUrl, setPreviewUrl] = useState('')
  const [metadata, setMetadata] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [aiResult, setAiResult] = useState(null)
  const [aiError, setAiError] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  const metadataRows = useMemo(() => {
    if (!metadata || !selectedFile) {
      return []
    }

    const latitude = metadata.latitude ?? metadata.lat ?? null
    const longitude = metadata.longitude ?? metadata.lon ?? null
    const dmsLatitude = toDms(latitude, 'N', 'S')
    const dmsLongitude = toDms(longitude, 'E', 'W')
    const gpsMapsLink =
      typeof latitude === 'number' && typeof longitude === 'number'
        ? `https://www.google.com/maps?q=${latitude},${longitude}`
        : null

    return [
      { label: 'Archivo', value: fileName || emptyLabel },
      { label: 'Peso', value: formatBytes(selectedFile.size) },
      { label: 'Tipo', value: selectedFile.type || emptyLabel },
      { label: 'Ultima modificacion', value: formatDate(selectedFile.lastModified) },
      { label: 'Fecha de captura', value: formatDate(metadata.DateTimeOriginal) },
      { label: 'Marca', value: metadata.Make || emptyLabel },
      { label: 'Modelo', value: metadata.Model || emptyLabel },
      {
        label: 'Resolucion',
        value:
          metadata.ExifImageWidth && metadata.ExifImageHeight
            ? `${metadata.ExifImageWidth} x ${metadata.ExifImageHeight}px`
            : emptyLabel,
      },
      {
        label: 'Distancia focal',
        value: metadata.FocalLength ? `${metadata.FocalLength} mm` : emptyLabel,
      },
      {
        label: 'ISO',
        value: metadata.ISO || metadata.ISOSpeedRatings || emptyLabel,
      },
      {
        label: 'Apertura',
        value: metadata.FNumber ? `f/${metadata.FNumber}` : emptyLabel,
      },
      {
        label: 'Velocidad obturacion',
        value: metadata.ExposureTime ? `${metadata.ExposureTime}s` : emptyLabel,
      },
      {
        label: 'Ubicacion (decimal)',
        value:
          typeof latitude === 'number' && typeof longitude === 'number'
            ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
            : emptyLabel,
      },
      {
        label: 'Ubicacion (DMS)',
        value:
          dmsLatitude && dmsLongitude
            ? `${dmsLatitude}, ${dmsLongitude}`
            : emptyLabel,
      },
      {
        label: 'Google Maps',
        value: gpsMapsLink ? (
          <a href={gpsMapsLink} target="_blank" rel="noreferrer">
            Abrir ubicacion
          </a>
        ) : (
          emptyLabel
        ),
      },
    ]
  }, [fileName, metadata, selectedFile])

  const diagnostic = useMemo(() => {
    if (!selectedFile || !metadata) {
      return null
    }

    const hasExifData = Object.keys(metadata).length > 0
    const hasGpsData =
      typeof (metadata.latitude ?? metadata.lat) === 'number' &&
      typeof (metadata.longitude ?? metadata.lon) === 'number'
    const suspiciousName = /wa\d{4,}|img-\d{8}-wa|whatsapp/i.test(fileName)
    const isCompressedForChat = selectedFile.size < 900_000
    const likelyForwarded = !hasExifData || (!hasGpsData && suspiciousName && isCompressedForChat)

    const reasons = []
    if (!hasExifData) reasons.push('No hay EXIF en el archivo.')
    if (!hasGpsData) reasons.push('No hay coordenadas GPS.')
    if (suspiciousName) reasons.push('Nombre de archivo compatible con reenvio de mensajeria.')
    if (isCompressedForChat) reasons.push('Tamano bajo, posible compresion de app de chat.')

    return {
      status: likelyForwarded
        ? 'Posible foto reenviada o comprimida'
        : 'La imagen parece conservar metadatos originales',
      confidence: likelyForwarded ? 'Media' : 'Baja',
      reasons,
    }
  }, [fileName, metadata, selectedFile])

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const validateFile = (file) => {
    if (!file) {
      return 'No se encontro archivo.'
    }
    if (!allowedMimeTypes.has(file.type)) {
      return 'Solo se permiten JPG, PNG o WEBP.'
    }
    if (file.size > maxUploadSize) {
      return 'El archivo supera 4MB.'
    }
    return ''
  }

  const processFile = async (file) => {
    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      return
    }

    setError('')
    setAiError('')
    setAiResult(null)
    setIsLoading(true)
    setMetadata(null)
    setSelectedFile(file)
    setFileName(file.name)
    setPreviewUrl((previousUrl) => {
      if (previousUrl) {
        URL.revokeObjectURL(previousUrl)
      }
      return URL.createObjectURL(file)
    })

    try {
      const parsed = await exifr.parse(file, { gps: true })
      setMetadata(parsed ?? {})
    } catch {
      setError('No se pudieron leer los metadatos EXIF de esta imagen.')
      setMetadata({})
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0]
    await processFile(file)
  }

  const handleDrop = async (event) => {
    event.preventDefault()
    setIsDragOver(false)
    const file = event.dataTransfer.files?.[0]
    await processFile(file)
  }

  const handleExportReport = () => {
    if (!selectedFile) {
      setError('Primero sube una imagen para exportar un informe.')
      return
    }

    const report = {
      generatedAt: new Date().toISOString(),
      app: 'Analizador de Imagenes (Metadatos)',
      file: {
        name: selectedFile.name,
        type: selectedFile.type,
        sizeBytes: selectedFile.size,
        lastModified: selectedFile.lastModified,
      },
      metadata: metadata ?? {},
      diagnostic,
      aiEstimate: aiResult ?? null,
    }

    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${selectedFile.name.replace(/\.[^.]+$/, '')}-informe.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const handleAiLocationEstimate = async () => {
    if (!selectedFile) {
      setAiError('Sube primero una imagen.')
      return
    }

    try {
      setAiError('')
      setAiLoading(true)
      const { imageBase64, mimeType } = await compressImage(selectedFile)

      const response = await fetch(`${apiBaseUrl}/api/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64,
          mimeType,
        }),
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody.error || 'Error de API al estimar ubicacion.')
      }

      const responseJson = await response.json()
      setAiResult(responseJson.analysis)
    } catch (aiRequestError) {
      setAiError(aiRequestError.message || 'No se pudo ejecutar la inferencia IA.')
      setAiResult(null)
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <main className="app-shell">
      <div className="scanline" />
      <section className="panel">
        <header>
          <p className="terminal-label">META HACK TERMINAL</p>
          <h1>Analizador de Imagenes (Metadatos)</h1>
          <p className="subtitle">
            Sube una foto para revisar metadatos, detectar posibles reenvios y estimar ubicacion con IA.
          </p>
        </header>

        <label
          htmlFor="photo"
          className={`upload-zone ${isDragOver ? 'dragging' : ''}`}
          onDragOver={(event) => {
            event.preventDefault()
            setIsDragOver(true)
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
        >
          <span className="upload-title">Insertar foto</span>
          <span className="upload-note">Arrastra aqui o pulsa para seleccionar (JPG, PNG, WEBP, max 4MB)</span>
          <input
            id="photo"
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={handleFileChange}
          />
        </label>

        {error && <p className="error">{error}</p>}
        {isLoading && <p className="loading">Analizando metadatos...</p>}
        <div className="actions">
          <button type="button" onClick={handleExportReport} className="action-btn">
            Exportar informe JSON
          </button>
        </div>

        <div className="content-grid">
          <article className="preview-card">
            <h2>Vista previa</h2>
            {previewUrl ? (
              <img src={previewUrl} alt="Imagen subida para analizar metadatos" />
            ) : (
              <p className="placeholder">Esperando una imagen...</p>
            )}
          </article>

          <article className="data-card">
            <h2>Datos encontrados</h2>
            {metadataRows.length > 0 ? (
              <dl>
                {metadataRows.map((row) => (
                  <div key={row.label} className="row">
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="placeholder">Sube una imagen para mostrar metadatos.</p>
            )}

            {diagnostic && (
              <section className="diagnostic">
                <h3>Diagnostico rapido</h3>
                <p>{diagnostic.status}</p>
                <p>Confianza: {diagnostic.confidence}</p>
                {diagnostic.reasons.length > 0 && (
                  <ul>
                    {diagnostic.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </article>

          <article className="data-card">
            <h2>Inferencia IA (opcional)</h2>
            <p className="ai-note">
              La clave de Gemini se usa solo en el servidor. Si no hay GPS EXIF, puedes pedir una estimacion por pistas visuales.
            </p>
            <button
              type="button"
              onClick={handleAiLocationEstimate}
              className="action-btn"
              disabled={aiLoading}
            >
              {aiLoading ? 'Analizando con IA...' : 'Inferir ubicacion con IA'}
            </button>

            {aiError && <p className="error">{aiError}</p>}

            {aiResult && (
              <div className="ai-result">
                <p>Pais probable: {aiResult.ubicacion?.pais || emptyLabel}</p>
                <p>Region probable: {aiResult.ubicacion?.region || emptyLabel}</p>
                <p>Confianza ubicacion: {aiResult.ubicacion?.confianza ?? emptyLabel}</p>
                <p>Autenticidad: {aiResult.autenticidad?.veredicto || emptyLabel}</p>
                <p>Confianza autenticidad: {aiResult.autenticidad?.confianza ?? emptyLabel}</p>
                {aiResult.ubicacion?.motivos && <p>Motivos ubicacion: {aiResult.ubicacion.motivos}</p>}
                {aiResult.autenticidad?.motivos && (
                  <p>Motivos autenticidad: {aiResult.autenticidad.motivos}</p>
                )}
                {aiResult.resumen && <p>Resumen: {aiResult.resumen}</p>}
                {Array.isArray(aiResult.clues) && aiResult.clues.length > 0 && (
                  <ul>
                    {aiResult.clues.map((clue) => (
                      <li key={clue}>{clue}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </article>
        </div>
      </section>
    </main>
  )
}

export default App
