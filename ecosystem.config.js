module.exports = {
  apps: [{
    name: 'telegram-task-agent',
    script: 'src/bot.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000,
    
    // Configuración específica para el bot
    min_uptime: '5s',
    max_restarts: 10,
    restart_delay: 1000,
    
    // Variables de entorno adicionales
    env_production: {
      NODE_ENV: 'production',
      LOG_LEVEL: 'info'
    }
  }]
};