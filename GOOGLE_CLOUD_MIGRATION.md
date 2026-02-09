# Guía de Migración a Google Cloud Run 🚀

Esta guía detalla los pasos para migrar APPXV de Render a Google Cloud Run para obtener mejor rendimiento y estabilidad.

## 1. Requisitos Previos
- Tener una cuenta en [Google Cloud Console](https://console.cloud.google.com/).
- Instalar el [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) en tu computadora.
- Haber creado un proyecto en Google Cloud (ej: `appxv-project`).

## 2. Preparación del Proyecto
He creado dos archivos Dockerfile específicos para separar responsabilidades:

1.  **`Dockerfile.backend`**: Empaqueta el servidor Node.js/Express.
2.  **`Dockerfile.frontend`**: Construye la App React y la sirve usando Nginx (más eficiente para contenido estático).

## 3. Despliegue a Cloud Run

### Paso 1: Desplegar el Backend
Primero necesitamos la URL del backend para que el frontend sepa a dónde conectarse.

```bash
# Desplegar backend
gcloud run deploy appxv-backend --source . --file Dockerfile.backend --env-vars-file .env.production
```
*Nota: Asegúrate de tener tus variables de Notion, Cloudinary, etc., listas.*

### Paso 2: Desplegar el Frontend
Una vez tengas la URL del backend (ej: `https://appxv-backend-xyz.a.run.app`), despliega el frontend inyectando esa URL:

```bash
# Desplegar frontend
gcloud run deploy appxv-frontend --source . --file Dockerfile.frontend --set-build-envs VITE_API_URL=https://TU-URL-BACKEND/api
```

Durante el despliegue, elige:
- **Region**: `us-central1` (recomendado por latencia/costo).
- **Allow unauthenticated invocations**: `y` (para que sea público).

## 4. Configuración de Variables de Entorno
Cloud Run necesita las mismas variables que tenías en Render. Puedes configurarlas en la consola de Google Cloud (Cloud Run > Tu Servicio > Edit & Deploy New Revision > Variables):

- `NOTION_API_KEY`
- `VITE_API_URL` (Deberá ser la URL que te de Cloud Run terminada en `/api`)
- `CLOUDINARY_URL` (y variables de cloudinary)
- `GOOGLE_CLIENT_ID` / `SECRET` (si usas Auth)

## 5. Ventajas de Cloud Run para esta App
- **Memoria Flexible**: Puedes asignar 1GB o 2GB de RAM para que las fotos nunca saturen el servidor.
- **Sin Cold Starts**: Si configuras "Minimum instances" a 1, la app nunca se dormirá (ideal para el momento del evento).
- **Mejor SSE**: Maneja mejor las conexiones persistentes del Bingo y la Pantalla Gigante.

---

¿Necesitas ayuda con algún paso específico del despliegue?
