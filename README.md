# View Meta Data Photos

Web app estilo "hacking" (negro y verde) para:

- Ver metadatos EXIF de una foto.
- Detectar señales de reenvio/compresion.
- Analizar ubicacion/autenticidad con Gemini desde backend seguro (sin exponer API key).

## Requisitos

- Node.js 18 o superior (recomendado Node.js 20+)
- npm (incluido con Node.js)

## Instalacion

1. Clona o descarga este proyecto.
2. Entra en la carpeta del proyecto:

```bash
cd view-meta-data-photos
```

3. Instala dependencias:

```bash
npm install
```

4. Configura variables de entorno del servidor:

```bash
cp .env.example .env.local
```

Edita `.env.local` y pon tu key:

```env
GEMINI_API_KEY=tu_api_key_de_gemini
PORT=8787
ALLOWED_ORIGINS=http://localhost:5173,https://sergiioestevee.github.io
```

## Ejecutar en desarrollo

Arranca cliente + API server:

```bash
npm run dev
```

Vite mostrara la URL local (normalmente `http://localhost:5173`) y Express levantara la API en `http://localhost:8787`.

## Uso de la aplicacion

1. Abre la web en el navegador.
2. Sube imagen por boton o drag & drop (`.jpg`, `.png`, `.webp`, max 4MB).
3. La app mostrara:
   - Vista previa de la imagen.
   - Fecha de captura (EXIF).
   - Marca y modelo de camara.
   - Resolucion.
   - ISO, apertura, velocidad de obturacion, distancia focal.
   - Coordenadas GPS (decimal y DMS) si existen.
   - Enlace de Google Maps si hay datos de ubicacion.
   - Diagnostico rapido de posible foto reenviada/comprimida.
4. Si pulsas "Inferir ubicacion con IA", el frontend:
   - comprime la imagen (max 1024px ancho, calidad 0.8),
   - envia `{ imageBase64, mimeType }` a `/api/analyze`,
   - muestra ubicacion y autenticidad con confianza.

> Nota: no todas las fotos tienen metadatos EXIF o GPS. Si no existen, se mostrara "No disponible".
> Seguridad: la API key se usa solo en `server/index.js` a traves de `process.env.GEMINI_API_KEY`.

## Build de produccion

Genera los archivos optimizados:

```bash
npm run build
```

Antes de compilar para GitHub Pages, crea `.env.production` en raiz para que el frontend sepa donde esta la API:

```env
VITE_API_BASE_URL=https://TU-BACKEND.onrender.com
```

El resultado se crea en la carpeta `dist/`.

Para previsualizar la build:

```bash
npm run preview
```

## Scripts disponibles

- `npm run dev`: ejecuta frontend (Vite) + backend (Express).
- `npm run dev:client`: frontend Vite.
- `npm run dev:server`: backend Express.
- `npm run build`: compila para produccion.
- `npm run preview`: sirve la build localmente.
- `npm run lint`: ejecuta ESLint.

## Deploy backend (Render)

El repo incluye `render.yaml` para facilitar el despliegue del backend Express.

1. En Render, crea un servicio Web desde este repositorio.
2. Render detectara `render.yaml`.
3. Define en Render la variable:
   - `GEMINI_API_KEY=tu_key`
4. Tras desplegar, copia la URL del backend (por ejemplo `https://view-meta-data-photos-api.onrender.com`).
5. En local, crea/edita `.env.production` con:

```env
VITE_API_BASE_URL=https://view-meta-data-photos-api.onrender.com
```

6. Publica frontend en GitHub Pages:

```bash
npm run build
npm run deploy
```

## Stack tecnico

- React
- Vite
- Express
- Gemini API (modelo `gemini-2.5-flash-lite`)
- exifr (lectura de metadatos EXIF)
- CSS custom con tema responsive estilo terminal/hacker
