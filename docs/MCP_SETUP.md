# MCP Servers Configuration for Telegram Task Agent

## Servers Instalados

### 1. GitHub Server ✅
- **Función**: Gestión de repositorios, issues, PRs y workflows
- **Token requerido**: GitHub Personal Access Token
- **Configuración**: `GITHUB_PERSONAL_ACCESS_TOKEN`

### 2. Docker Server ✅
- **Función**: Manejo de contenedores y compose stacks
- **Acceso**: Socket Docker (`/var/run/docker.sock`)
- **Capacidades**: Crear, listar, detener contenedores

### 3. Filesystem Server ✅
- **Función**: Operaciones seguras de archivos
- **Path**: `/Users/frxn/Documents/telegram-task-agent`
- **Capacidades**: Leer, escribir, listar archivos del proyecto

### 4. Sentry Server ✅
- **Función**: Error tracking y monitoreo
- **Configuración**: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`
- **Capacidades**: Análisis de errores y performance

### 5. AWS Costs Server ✅
- **Función**: Análisis de costos y servicios AWS
- **Configuración**: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- **Región**: `us-east-1`

## Configuración de Tokens

Para activar completamente los servidores, configura estos tokens en el archivo:
`/Users/frxn/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_xxxxxxxxxxxx",
  "SENTRY_AUTH_TOKEN": "your_sentry_token",
  "SENTRY_ORG": "your_org",
  "SENTRY_PROJECT": "telegram-task-agent",
  "AWS_ACCESS_KEY_ID": "AKIA...",
  "AWS_SECRET_ACCESS_KEY": "xxxx..."
}
```

## Reiniciar Claude Desktop

Después de configurar los tokens, reinicia Claude Desktop para que los cambios tomen efecto.

## Beneficios para el Proyecto

- **Atomización inteligente**: GitHub API para análizar repos y crear tareas
- **Ejecución aislada**: Docker para contenedores por tarea
- **Monitoreo**: Sentry para tracking de errores en agentes
- **Control de costos**: AWS costs para análisis financiero
- **Gestión de archivos**: Filesystem para operaciones seguras

## Uso en el Bot Telegram

Los MCP servers estarán disponibles automáticamente para:
- Analizar código y crear tareas atómicas
- Ejecutar contenedores Docker por tarea
- Monitorear errores y performance
- Calcular costos operativos
- Gestionar archivos del proyecto