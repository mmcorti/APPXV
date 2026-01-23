---
name: Notion Backend Sync
description: Estrategia para usar Notion como base de datos dinámica y escalable.
---

# Notion Backend Sync Skill

Esta skill optimiza la comunicación entre el servidor Node.js y la API de Notion.

## Estándares de Integración

### 1. Esquema Dinámico
- Usar el `SchemaManager` (si existe) para validar propiedades antes de consultarlas.
- Manejar fallbacks cuando una propiedad no existe en la base de datos de Notion.

### 2. Conversión de Datos (Transformers)
- Crear funciones puras para transformar `Notion Page Objects` a `App JSON Objects`.
- Mantener los modelos de TypeScript actualizados en `/types`.

### 3. Manejo de Errores & Throttling
- Implementar reintentos (exponential backoff) para errores 429 (Rate Limit).
- Logging claro: Indicar exactamente qué base de datos o página falló.

## Flujo de Trabajo
Al añadir una nueva tabla o campo:
1. Definir el modelo en `types/`.
2. Actualizar el adapter de Notion en `server/`.
3. Probar la consulta con el `Notion SDK`.
