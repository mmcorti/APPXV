# Sistema de Límites por Suscripción

## Backend
- [x] Crear `server/planLimits.js` con constantes y helper
- [x] Modificar `POST /api/events` - validar maxEvents
- [x] Modificar `POST /api/guests` - validar maxGuestsPerEvent
- [x] Modificar `POST /api/subscribers` - verificar rol admin
- [x] Agregar endpoint `/api/usage-summary` para resumen de uso

## Base de Datos
- [x] Agregar propiedad Plan en `schema_manager.js`

## Frontend
- [x] Modificar `Dashboard.tsx` para mostrar indicadores de uso
- [x] Agregar propiedad `plan` a `User` en types.ts
- [x] Actualizar `handleAuthSuccess` en App.tsx para incluir plan

## Verificación
- [ ] Testear límites de eventos
- [ ] Testear límites de invitados
- [ ] Testear creación de subscribers
