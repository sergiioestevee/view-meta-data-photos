import { useEffect, useMemo, useState } from 'react'
import * as exifr from 'exifr'
import './App.css'

const emptyLabel = 'No disponible'

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

function App() {
  const [previewUrl, setPreviewUrl] = useState('')
  const [metadata, setMetadata] = useState(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const metadataRows = useMemo(() => {
    if (!metadata) {
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
  }, [fileName, metadata])

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const handleFileChange = async (event) => {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) {
      return
    }

    setError('')
    setIsLoading(true)
    setMetadata(null)
    setFileName(selectedFile.name)
    setPreviewUrl((previousUrl) => {
      if (previousUrl) {
        URL.revokeObjectURL(previousUrl)
      }
      return URL.createObjectURL(selectedFile)
    })

    try {
      const parsed = await exifr.parse(selectedFile, { gps: true })
      setMetadata(parsed ?? {})
    } catch {
      setError('No se pudieron leer los metadatos EXIF de esta imagen.')
      setMetadata({})
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="app-shell">
      <div className="scanline" />
      <section className="panel">
        <header>
          <p className="terminal-label">META HACK TERMINAL</p>
          <h1>Inspector de metadatos EXIF</h1>
          <p className="subtitle">
            Sube una foto para ver fecha, camara y ubicacion (si la imagen incluye GPS).
          </p>
        </header>

        <label htmlFor="photo" className="upload-zone">
          <span className="upload-title">Insertar foto</span>
          <span className="upload-note">JPG, JPEG, PNG, WEBP</span>
          <input
            id="photo"
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={handleFileChange}
          />
        </label>

        {error && <p className="error">{error}</p>}
        {isLoading && <p className="loading">Analizando metadatos...</p>}

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
          </article>
        </div>
      </section>
    </main>
  )
}

export default App
