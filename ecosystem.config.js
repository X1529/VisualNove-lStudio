// PM2 production config — รันหลาย instance ได้ถ้ามี Redis session store
module.exports = {
  apps: [{
    name: 'vn-studio',
    script: 'server.js',
    instances: 1, // ถ้ามี Redis ให้เปลี่ยนเป็น 'max' หรือ 2
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production',
      HOST: '0.0.0.0',
      PORT: 3000
    },
    max_memory_restart: '500M',
    error_file: 'logs/err.log',
    out_file: 'logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    kill_timeout: 5000,
    wait_ready: false,
    autorestart: true
  }]
};
