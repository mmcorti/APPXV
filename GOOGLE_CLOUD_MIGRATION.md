# Guía de Migración a Google Cloud Run 🚀

Esta guía detalla los pasos para migrar APPXV de Render a Google Cloud Run para obtener mejor rendimiento y estabilidad.

## 1. Requisitos Previos
- Tener una cuenta en [Google Cloud Console](https://console.cloud.google.com/).
- Instalar el [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) en tu computadora.
- Haber creado un proyecto en Google Cloud (ej: `appxv-project`).

## 2. Preparación del Proyecto
He creado dos archivos Dockerfile específicos para separar responsabilidades:

1.  **`Dockerfile`**: (Ya configurado) Empaqueta el servidor Node.js/Express y sirve el Frontend.
2.  **`package.json`**: Se agregó `"start": "node server/index.js"` para que Cloud Run sepa cómo arrancar.
3.  **`server/index.js`**: Se configuró el puerto para usar `process.env.PORT || 8080`.

## 3. Despliegue a Cloud Run

### Paso 1: Despliegue Unificado (Backend + Frontend)

He descubierto que tu proyecto ya tiene un `Dockerfile` inteligente que construye el Frontend y el Backend juntos en un solo servicio. Esto es mucho más fácil de desplegar.

#### 1. Abre PowerShell en la carpeta del proyecto:
```powershell
cd "c:\Users\Mariano\Documents\GitHub\APPXV"
```

#### 2. Ejecuta el comando de despliegue:
Solo necesitas este comando. He incluido todas tus llaves excepto las de Cloudinary (rellénalas donde dice `xxx`).

```powershell
gcloud run deploy appxv `
  --source . `
  --region us-central1 `
  --allow-unauthenticated `
  --set-env-vars "SUPABASE_URL=YOUR_SUPABASE_URL,SUPABASE_SERVICE_KEY=YOUR_SUPABASE_KEY,CLOUDINARY_CLOUD_NAME=xxx,CLOUDINARY_API_KEY=xxx,CLOUDINARY_API_SECRET=xxx,GOOGLE_CLIENT_ID=xxx,GOOGLE_CLIENT_SECRET=xxx,GEMINI_API_KEY=xxx,OPENAI_API_KEY=xxx,GOOGLE_REDIRECT_URI=xxx"
```

#### 3. Notas importantes:
- **ID de Proyecto**: Si `gcloud` te pregunta por el proyecto, selecciona `gen-lang-client-0613585534`.
- **URL Final**: Al terminar, gcloud te dará una URL. **Esa será tu URL de la web completa**.
- **Google Redirect**: Deberás copiar esa URL y actualizarla en tu Consola de Google Cloud (OAuth) agregando `/api/auth/google/callback`.

---
## 4. Configuración de Variables de Entorno
Cloud Run necesita estas variables de Runtime (todas están incluidas en el comando de arriba):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GEMINI_API_KEY`
- `OPENAI_API_KEY`
- `GOOGLE_REDIRECT_URI`

### Frontend (Variables de Build):
- `VITE_API_URL` (La URL del backend + `/api`)

## 5. Ventajas de Cloud Run para esta App
- **Memoria Flexible**: Puedes asignar 1GB o 2GB de RAM para que las fotos nunca saturen el servidor.
- **Sin Cold Starts**: Si configuras "Minimum instances" a 1, la app nunca se dormirá (ideal para el momento del evento).
- **Mejor SSE**: Maneja mejor las conexiones persistentes del Bingo y la Pantalla Gigante.

---

¿Necesitas ayuda con algún paso específico del despliegue?
