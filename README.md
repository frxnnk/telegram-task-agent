# 🤖 Telegram Task Agent - Direct Chat

Bot de Telegram que permite chatear directamente con Claude CLI y acceder a herramientas de desarrollo (Linear, GitHub) desde tu móvil.

## ✨ Características

- **💬 Chat Directo con Claude CLI**: Envía cualquier mensaje y obtén respuestas de Claude en tiempo real
- **📋 Integración Linear**: Consulta equipos, proyectos y tareas
- **🐙 Integración GitHub**: Ve repositorios y información del perfil
- **⚡ Simple y Rápido**: Sin complejidad, solo chat directo
- **📱 Móvil First**: Diseñado para uso desde Telegram móvil

## 🚀 Quick Start

### 1. Configuración
```bash
# Clonar proyecto
git clone https://github.com/frxnnk/telegram-task-agent.git
cd telegram-task-agent

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus tokens
```

### 2. Variables de Entorno (.env)
```env
# Bot de Telegram (obligatorio)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# Linear API (opcional)
LINEAR_API_KEY=your_linear_api_key

# GitHub Token (opcional)
GITHUB_TOKEN=your_github_token
```

### 3. Ejecutar
```bash
# Desarrollo
npm run dev

# Producción
npm start
```

## 📱 Uso

### Chat Directo
Simplemente envía cualquier mensaje al bot:

```
"¿Cómo implementar autenticación JWT en Node.js?"
"Revisa este código y sugiere mejoras: [tu código]"
"Explícame los hooks de React con ejemplos"
```

### Comandos Disponibles
- `/start` - Mensaje de bienvenida
- `/help` - Ayuda completa
- `/status` - Estado del sistema
- `/linear` - Resumen de Linear
- `/linear_teams` - Equipos de Linear
- `/linear_projects` - Proyectos de Linear
- `/github` - Resumen de GitHub
- `/github_repos` - Repositorios de GitHub

## 🏗️ Arquitectura

```
telegram-task-agent/
├── src/
│   ├── bot.js                 # Bot principal con chat directo
│   ├── integrations/
│   │   ├── LinearManager.js   # API de Linear
│   │   └── GitHubManager.js   # API de GitHub
│   └── database/              # (legacy, no usado)
├── .env                       # Variables de entorno
├── package.json              # Dependencias
└── README.md                  # Esta documentación
```

## 🔧 Tecnologías

- **Node.js** - Runtime
- **Telegraf** - Framework de Telegram
- **Claude CLI** - IA conversacional
- **Linear API** - Gestión de proyectos
- **GitHub API** - Repositorios

## 📋 Requisitos

- Node.js >= 18.0.0
- Claude CLI instalado y autenticado
- Bot de Telegram creado (@BotFather)
- Tokens de Linear y GitHub (opcionales)

## 🚀 Deploy

### Local
```bash
npm start
```

### VPS/Servidor
```bash
# Con PM2
npm install -g pm2
pm2 start src/bot.js --name telegram-task-agent
pm2 save
pm2 startup
```

## 🔒 Seguridad

- Las conversaciones son directas entre tú y Claude CLI
- No se almacenan mensajes ni datos sensibles
- Los tokens se manejan vía variables de entorno
- Acceso limitado a APIs mediante tokens personales

## 📝 Ejemplos de Uso

### Desarrollo
```
"¿Cómo estructurar una API REST en Express?"
"Optimiza esta función JavaScript para mejor performance"
"Explica la diferencia entre Promise y async/await"
```

### Linear/GitHub
```
/linear_teams
/github_repos
/status
```

### Análisis de Código
```
"Revisa este componente React:
[pegar código]

¿Qué mejoras sugieres?"
```

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una branch (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -m 'Agrega nueva funcionalidad'`)
4. Push a la branch (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

## 📄 Licencia

MIT - Ve [LICENSE](LICENSE) para más detalles.

## 🆘 Soporte

- 📧 Email: frxnco@protonmail.com
- 🐛 Issues: [GitHub Issues](https://github.com/frxnnk/telegram-task-agent/issues)
- 📖 Docs: [README.md](README.md)