# CORRECCIONES IMPLEMENTADAS - MESAS

## Problema 1: No se pueden crear mesas
### Causa
La propiedad `Assignments` no existía en la base de datos de Notion.

### Solución
✅ Se ejecutó el script `diagnose_tables.js` que agregó automáticamente la propiedad `Assignments` a la base de datos.

## Problema 2: Los invitados desaparecen al agregarlos
### Causa
1. Falta de logging para diagnosticar el problema
2. El modal no se cerraba después de asignar
3. Posibles errores silenciosos en la asignación

### Solución
✅ Agregado logging extensivo en:
   - `POST /api/tables` - para creación de mesas
   - `PATCH /api/tables/:id/guests` - para asignación de invitados
   
✅ El modal ahora se cierra automáticamente después de asignar un invitado

✅ Conversión explícita de `guestId` a string en las relaciones

## Cambios en el Código

### `server/index.js`
- **POST /api/tables**: 
  - Logging del payload recibido
  - Validación de campos requeridos
  - Logging de propiedades mapeadas
  - Errores detallados con stack trace

- **PATCH /api/tables/:id/guests**:
  - Logging de assignments recibidos
  - Logging de cada propiedad mapeada
  - Conversión de guestId a string: `gId.toString()`
  - Errores detallados con stack trace

### `screens/Tables.tsx`
- **assignToTable**:
  - Logging de la asignación
  - Cierre automático del modal: `setShowAssignModal(null)`

## Cómo Probar

1. **Reiniciar el servidor**:
   ```bash
   cd server
   npm run dev
   ```

2. **Crear una mesa**:
   - Ir a "Armado de Mesas"
   - Click en "+ MESA"
   - Ingresar nombre y capacidad
   - Verificar en la consola del servidor los logs:
     ```
     === POST /api/tables ===
     Request body: { eventId: "...", name: "...", capacity: 10 }
     Set property Name (Name)
     Set property Capacity (Capacity)
     Set property Event (Event)
     Set property Assignments (Assignments)
     ✅ Table created successfully: ...
     ```

3. **Asignar invitados**:
   - Click en el ícono de "person_add" en una mesa
   - Seleccionar un invitado
   - **EL MODAL DEBE CERRARSE AUTOMÁTICAMENTE**
   - Verificar en la consola del servidor:
     ```
     === PATCH /api/tables/.../guests ===
     Assignments received: [...]
     Set property Assignments (Assignments)
     Set property Guests (Guests)
     ✅ Table updated successfully
     ```
   - Verificar en la consola del navegador:
     ```
     Assigning guest to table: { tableId: "...", guestName: "...", ... }
     ```

4. **Refrescar la página**:
   - Los invitados asignados deben permanecer en la mesa

## Si Aún No Funciona

Revisar:
1. **Consola del servidor** - buscar errores con ❌
2. **Consola del navegador** (F12) - Network tab, buscar errores en llamadas a `/api/tables`
3. **Verificar que `Assignments` existe en Notion**: Ejecutar `node diagnose_tables.js`

## Orden de la Lista de Invitados

✅ **ARREGLADO**: Los invitados ahora se agrupan por familia:
- Primero aparece el invitado principal (ej: "Juan")
- Luego sus acompañantes (ej: "Adulto 1 - Juan", "Niño 1 - Juan")
- Luego la siguiente familia

Ordenamiento implementado en `Tables.tsx`:
```typescript
return pool.sort((a, b) => {
    if (a.guestId !== b.guestId) return a.guestId.toString().localeCompare(b.guestId.toString());
    return (a.companionIndex || -1) - (b.companionIndex || -1);
});
```
