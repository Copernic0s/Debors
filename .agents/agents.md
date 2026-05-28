# Debors Multi-Agent Configuration

Este archivo define la jerarquía de agentes para el proyecto Debors.

## Roles

### 1. Líder / Orquestador
- **Propósito:** Entiende la tarea grande, planea y delega
- **Lee:** `harness.md`, `tasks.json`, `progress/`
- **Delega a:** Implementador + Revisor
- **Modelo sugerido:** Avanzado (claude-sonnet-4, gpt-4o, etc.)
- **Skill:** `.agents/skills/orchestrator/SKILL.md`

### 2. Implementador
- **Propósito:** Leer y escribir código exclusivamente
- **No necesita:** Contexto completo del proyecto, solo la tarea específica
- **Modelo sugerido:** Económico (claude-haiku, gpt-4o-mini, etc.)
- **Skill:** `.agents/skills/implementer/SKILL.md`

### 3. Revisor / Auditor
- **Propósito:** Verificar cambios de forma independiente
- **Ejecuta:** Tests, linters, type-checking
- **Modelo sugerido:** Avanzado (claude-sonnet-4, gpt-4o, etc.)
- **Skill:** `.agents/skills/reviewer/SKILL.md`
- **Self-improving:** Puede proponer cambios a `harness.md`

## Flujo de trabajo

```
1. Líder lee harness.md → entiende proyecto
2. Líder consulta tasks.json → identifica tarea
3. Líder revisa progress/ → obtiene contexto previo
4. Líder delega tarea específica a Implementador
5. Implementador escribe código
6. Líder pasa cambios a Revisor
7. Revisor ejecuta: tests → lint → verificación
8. Si hay fallos → Revisor reporta, Implementador corrige
9. Si pasa → Revisor actualiza tasks.json y escribe en progress/
10. Self-improve: si Revisor detecta fallos recurrentes, actualiza harness.md
```

## Skills disponibles
- `improve-codebase-architecture` — Refactorización y deepening de módulos
- `find-skills` — Descubrimiento de nuevas skills
- `nextjs-supabase-auth` — Integración Supabase Auth (referencia)
