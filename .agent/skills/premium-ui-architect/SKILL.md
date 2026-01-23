---
name: Premium UI Architect
description: Guía de diseño para asegurar una estética de ultra-lujo, moderna y dinámica en todas las pantallas de la aplicación.
---

# Premium UI Architect Skill

Esta skill define los estándares visuales para transformar componentes funcionales en interfaces de "clase mundial".

## Principios de Diseño

### 1. Glassmorphism & Depth
- Usa fondos con `backdrop-filter: blur(12px)`.
- Aplica bordes sutiles semi-transparentes (`rgba(255, 255, 255, 0.1)`).
- Sombras suaves y profundas (`shadow-xl`) para separar capas.

### 2. Tipografía Moderna
- Prioriza Google Fonts: **Inter**, **Outfit** o **Lexend**.
- Jerarquía clara: Títulos en `font-black`, párrafos en `font-medium`.
- Espaciado generoso (`tracking-tight` para títulos).

### 3. Paletas Cromáticas
- No usar colores básicos (rojo puro, azul puro).
- Usar gradientes sutiles: `indigo-600` a `purple-700` o `slate-900` a `slate-800`.
- Accentos en colores neón sutiles o dorados para elementos críticos.

### 4. Micro-animaciones (Framer Motion)
- Cada botón debe tener `whileHover={{ scale: 1.05 }}` y `whileTap={{ scale: 0.95 }}`.
- Las listas deben aparecer con un *stagger effect*.
- Transiciones de página suaves con `opacity` y `y` displacement.

## Aplicación
Cuando se me pida crear una nueva pantalla o refactorizar una existente, debo:
1. Analizar si el diseño actual es "estándar".
2. Aplicar los principios anteriores para elevar la calidad visual.
3. Proponer gradientes y efectos de profundidad antes de escribir el código final.
