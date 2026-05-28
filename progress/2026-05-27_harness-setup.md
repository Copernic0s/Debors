# Sesión: Setup del Harness Engineering

**Fecha:** 2026-05-27
**Agente:** Sistema (setup inicial)

## Objetivo
Implementar la estructura de Harness Engineering para Debors basada en los principios del video:
- Contexto externo (harness.md, tasks.json, progress/)
- Script de iniciación (harness-init.ps1)
- Separación de roles multi-agente (.agents/)
- Verificación automatizada

## Archivos creados

| Archivo | Propósito |
|---------|-----------|
| `harness.md` | Punto de entrada estandarizado para agentes (< 200 líneas) |
| `harness-init.ps1` | Script PowerShell de validación pre-tarea |
| `tasks.json` | Roadmap de tareas con estados |
| `progress/` | Bitácora de avances y decisiones |
| `.agents/agents.md` | Configuración multi-agente (orquestador, implementador, revisor) |
| `.agents/skills/orchestrator/SKILL.md` | Skill del agente líder |
| `.agents/skills/implementer/SKILL.md` | Skill del agente implementador |
| `.agents/skills/reviewer/SKILL.md` | Skill del agente revisor |

## Decisiones

1. **PowerShell en vez de Bash**: El proyecto corre en Windows, usamos `.ps1` en lugar de `init.sh`
2. **Estructura plana**: Los archivos del harness (`harness.md`, `tasks.json`, `harness-init.ps1`) están en la raíz para fácil acceso
3. **Tasks en JSON**: Formato estructurado para que sea legible tanto por humanos como por agentes
4. **Self-improving**: El agente revisor puede proponer cambios a `harness.md` si detecta fallos recurrentes

## Próximos pasos
Ver `tasks.json` — TASK-001 está en progreso.
