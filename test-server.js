// test-server.js - Servidor mínimo para pruebas
import express from "express";
import cors from "cors"

const app = express();
const PORT = 3055;
const HOST = 'localhost';

// Middleware básico
app.use(cors());
app.use(express.json());

// Ruta de health check
app.get('/api', (req, res) => {
  console.log('📡 Health check recibido');
  res.json({ 
    message: 'API activa',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Mock del endpoint de login
app.post('/api/login/login', (req, res) => {
  console.log('🔐 Login request recibido:', req.body);
  
  const { usuario, contraseña } = req.body;
  
  // Simulación simple de autenticación
  if (usuario && contraseña) {
    // Mock token (en producción sería JWT real)
    const mockToken = `mock-jwt-token-${Date.now()}`;
    
    res.json({
      mensaje: 'Login exitoso (MOCK)',
      token: mockToken,
      nombre: 'Usuario',
      apellido: 'Prueba',
      isMedico: false,
      roles: [{ id: 1, nombre: 'Test' }]
    });
  } else {
    res.status(400).json({
      mensaje: 'Usuario y contraseña son requeridos'
    });
  }
});

// Mock del endpoint de verificación de token
app.get('/api/login/verify-token', (req, res) => {
  console.log('🔍 Token verification recibido');
  
  const token = req.headers.authorization?.split(' ')[1];
  
  if (token && token.startsWith('mock-jwt-token')) {
    res.json({
      valid: true,
      usuario: {
        id: 1,
        nombre: 'Usuario',
        apellido: 'Prueba'
      }
    });
  } else {
    res.status(401).json({
      valid: false,
      mensaje: 'Token inválido'
    });
  }
});

// Middleware para rutas no encontradas
app.use((req, res) => {
  console.log(`❓ Ruta no encontrada: ${req.method} ${req.path}`);
  res.status(404).json({ 
    message: 'Recurso no encontrado',
    path: req.path
  });
});

// Middleware de manejo de errores
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(500).json({
    message: 'Error interno del servidor',
    error: err.message
  });
});

// Iniciar servidor
const server = app.listen(PORT, HOST, () => {
  console.log('🚀 ========================================');
  console.log('🏥 SERVIDOR DE PRUEBA INICIADO');
  console.log('🚀 ========================================');
  console.log(`🌐 API disponible en: http://${HOST}:${PORT}/api`);
  console.log(`🔐 Login endpoint: http://${HOST}:${PORT}/api/login/login`);
  console.log(`🔍 Verify endpoint: http://${HOST}:${PORT}/api/login/verify-token`);
  console.log('✅ Servidor listo para recibir peticiones');
  console.log('🚀 ========================================');
});

// Manejo de cierre graceful
const shutdown = () => {
  console.log('\n🛑 Cerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);