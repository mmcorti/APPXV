# Guía de Migración a Google Cloud Run 🚀

Esta guía detalla los pasos para migrar APPXV de Render a Google Cloud Run para obtener mejor rendimiento y estabilidad.

## 1. Requisitos Previos
- Tener una cuenta en [Google Cloud Console](https://console.cloud.google.com/).
- Instalar el [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) en tu computadora.
- Haber creado un proyecto en Google Cloud (ej: `appxv-project`).

## 2. Preparación del Proyecto
He creado un archivo `Dockerfile` en la raíz del proyecto. Este archivo le dice a Google Cloud cómo empaquetar tu aplicación:
- Construye el frontend (Vite).
- Configura el servidor Node.js.
- Expone el puerto `8080` (estándar de Cloud Run).

## 3. Despliegue (Línea de Comandos)
Abre una terminal en la carpeta raíz del proyecto y ejecuta:

```bash
# 1. Login en Google Cloud
gcloud auth login

# 2. Configurar el proyecto
gcloud config set project TU_ID_DE_PROYECTO

# 3. Desplegar
gcloud run deploy appxv --source .
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
