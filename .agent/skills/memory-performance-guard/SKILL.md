---
name: Memory & Performance Guard
description: Reglas críticas para optimizar el uso de recursos en entornos con memoria limitada (como el Tier gratuito de Render).
---

# Memory & Performance Guard Skill

Esta skill asegura que la aplicación se mantenga estable bajo carga, especialmente manejando fotos y tiempo real.

## Reglas de Optimización

### 1. Manejo de Imágenes (Frontend)
- **NUNCA** subir fotos originales. Siempre comprimir en el cliente.
- Dimensiones máximas: 800px a 1000px.
- Formato: `image/jpeg` con calidad entre 0.6 y 0.8.
- Reducción esperada: >90% del tamaño original.

### 2. SSE & State (Backend)
- Los broadcasts deben ser "lightweight".
- **PROHIBIDO** enviar strings Base64 masivos en broadcasts generales.
- Usar flags (`hasPhoto: true`) para indicar presencia de datos pesados.
- Permitir que los clientes cacheen datos localmente para reducir tráfico.

### 3. Memoria en Render (Node.js)
- Monitorear `process.memoryUsage()`.
- Limpiar caches inactivos regularmente.
- Si el heap se acerca a 450MB, realizar acciones agresivas de limpieza o denegar subidas temporales.

## Procedimiento de Verificación
Antes de finalizar cualquier tarea que involucre datos, debo:
1. Calcular el peso estimado del JSON de broadcast.
2. Verificar que no haya fugas de memoria en los listeners de SSE.
3. Asegurar que las imágenes nuevas implementen la función de compresión.
