# View Meta Data Photos

Web app estilo "hacking" (negro y verde) para subir una imagen y visualizar sus metadatos EXIF, como fecha de captura, camara, ISO y ubicacion GPS (si la foto los incluye).

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

## Ejecutar en desarrollo

Arranca el servidor local:

```bash
npm run dev
```

Vite te mostrara en terminal la URL local (normalmente `http://localhost:5173`).

## Uso de la aplicacion

1. Abre la web en el navegador.
2. Pulsa en "Insertar foto" y selecciona una imagen (`.jpg`, `.jpeg`, `.png`, `.webp`).
3. La app mostrara:
   - Vista previa de la imagen.
   - Fecha de captura (EXIF).
   - Marca y modelo de camara.
   - Resolucion.
   - ISO, apertura, velocidad de obturacion, distancia focal.
   - Coordenadas GPS (decimal y DMS) si existen.
   - Enlace de Google Maps si hay datos de ubicacion.

> Nota: no todas las fotos tienen metadatos EXIF o GPS. Si no existen, se mostrara "No disponible".

## Build de produccion

Genera los archivos optimizados:

```bash
npm run build
```

El resultado se crea en la carpeta `dist/`.

Para previsualizar la build:

```bash
npm run preview
```

## Scripts disponibles

- `npm run dev`: servidor de desarrollo con recarga en caliente.
- `npm run build`: compila para produccion.
- `npm run preview`: sirve la build localmente.
- `npm run lint`: ejecuta ESLint.

## Stack tecnico

- React
- Vite
- exifr (lectura de metadatos EXIF)
- CSS custom con tema responsive estilo terminal/hacker
