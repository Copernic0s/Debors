# Debors Harness — AI Agent Entry Point

Eres un agente de IA trabajando en **Debors**, un panel de seguimiento de deudas por agente para el equipo de ventas.

## Stack

- **Frontend:** React 19 + Vite 7 + styled-components + Recharts
- **Backend:** Node.js (Express 5, server/)
- **DB:** Supabase (Postgres)
- **Auth:** Supabase Auth (anon key en frontend, service role en server)
- **Testing:** Vitest
- **Linting:** ESLint 9
- **Python:** Scripts de automation/ (CMP scraper)

## Estructura del proyecto

```
Debors/
├── harness.md              # <-- Este archivo (entrada del agente)
├── harness-init.ps1        # Script de validación pre-tarea
├── tasks.json              # Roadmap de tareas y estados
├── progress/               # Bitácora de avances y decisiones
├── .agents/                # Configuración multi-agente
├── src/                    # Frontend React
│   ├── components/         # Componentes por función
│   ├── services/           # Llamadas a APIs y lógica externa
│   ├── hooks/              # Custom hooks
│   ├── utils/              # Funciones puras (normalizers, money, dates)
│   ├── constants/          # Constantes y config
│   ├── data/               # Mock data y fallbacks
│   ├── lib/                # Clientes (Supabase)
│   └── templates/          # Templates de emails
├── server/                 # Backend Express (CMP ingest)
├── automation/             # Python scraper CMP
├── supabase/               # Migraciones SQL
└── api/                    # Endpoints serverless (Vercel)
```

## Reglas del agente

1. **LEE harness.md primero** antes de cualquier acción
2. **LEE tasks.json** para entender el estado actual
3. **REVISA progress/** para contexto de sesiones anteriores
4. **EJECUTA harness-init.ps1** antes de empezar a trabajar
5. **DOCUMENTA** en progress/ cada decisión y avance significativo
6. **NO edites** archivos sin antes leer su contenido completo
7. **NO confíes** en que una tarea está completa sin verificación
8. **AVISA** si encuentras errores o bloqueos en el código

## Convenciones de código

- **JS/JSX** sin TypeScript (excepto types de librerías)
- **ES modules** en src/ (type: module en package.json)
- **CommonJS** en server/ (type: commonjs)
- **Nombres** en camelCase para funciones/vars, PascalCase para componentes
- **Tests** junto al archivo: `utils/normalizers.test.js`
- **Errores** capturados con try/catch y mostrados con react-hot-toast

## Comandos útiles

```bash
npm run dev       # Frontend en local
npm run build     # Build producción
npm run lint      # ESLint
npm run test:run  # Tests Vitest
cd server && npm start  # Backend local
```

## Roles multi-agente

| Rol | Responsabilidad | Modelo sugerido |
|-----|----------------|-----------------|
| Líder (Orquestador) | Planifica, delega, revisa progreso | Avanzado |
| Implementador | Lee/escribe código nuevo | Económico |
| Revisor (Auditor) | Verifica cambios, ejecuta tests | Avanzado |

Para tareas complejas: el líder debe delegar a sub-agentes implementador + revisor.
