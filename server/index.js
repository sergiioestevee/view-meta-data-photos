import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors'

dotenv.config({ path: '.env.local' })

const app = express()
const port = process.env.PORT || 8787
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,https://sergiioestevee.github.io')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const systemPrompt =
  'Eres un analizador experto de imágenes. Responde SIEMPRE en español y en formato JSON con esta estructura exacta, sin texto adicional, sin backticks: { "ubicacion": { "pais": string o null, "region": string o null, "confianza": número 0-100, "motivos": string }, "autenticidad": { "veredicto": "real" o "editada" o "generada_por_ia" o "incierto", "confianza": número 0-100, "motivos": string }, "resumen": string }'

app.use(express.json({ limit: '5mb' }))
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        callback(new Error('Origen no permitido por CORS'))
      }
    },
  }),
)

app.use((error, _request, response, next) => {
  if (error?.type === 'entity.too.large') {
    return response.status(400).json({
      error: 'El body supera el limite de 5MB.',
    })
  }
  return next(error)
})

app.get('/api/health', (_, response) => {
  response.json({ ok: true })
})

app.post('/api/analyze', async (request, response) => {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return response.status(500).json({
      error: 'Falta configurar GEMINI_API_KEY en el servidor.',
    })
  }

  const { imageBase64, mimeType } = request.body ?? {}
  if (typeof imageBase64 !== 'string' || imageBase64.length === 0) {
    return response.status(400).json({ error: 'imageBase64 es obligatorio.' })
  }
  if (typeof mimeType !== 'string' || !allowedMimeTypes.has(mimeType)) {
    return response.status(400).json({ error: 'mimeType no valido.' })
  }

  // Base64 size guard to avoid oversized requests despite body limit.
  const estimatedBytes = Math.floor((imageBase64.length * 3) / 4)
  if (estimatedBytes > 5 * 1024 * 1024) {
    return response.status(400).json({ error: 'La imagen supera el limite de 5MB.' })
  }

  try {
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemPrompt }],
          },
          contents: [
            {
              parts: [
                { text: 'Analiza esta imagen.' },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: imageBase64,
                  },
                },
              ],
            },
          ],
        }),
      },
    )

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text()
      return response.status(500).json({
        error: 'Gemini devolvio un error.',
        details: errorText,
      })
    }

    const payload = await geminiResponse.json()
    const rawText = payload?.candidates?.[0]?.content?.parts?.[0]?.text

    if (!rawText || typeof rawText !== 'string') {
      return response.status(500).json({
        error: 'Gemini no devolvio texto analizable.',
      })
    }

    const sanitized = rawText.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
    let analysis
    try {
      analysis = JSON.parse(sanitized)
    } catch {
      return response.status(500).json({
        error: 'Gemini no devolvio JSON valido.',
        raw: rawText,
      })
    }

    return response.json({ analysis })
  } catch (error) {
    return response.status(500).json({
      error: 'Error interno analizando la imagen.',
      details: error?.message ?? 'Unknown server error',
    })
  }
})

app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`)
})
