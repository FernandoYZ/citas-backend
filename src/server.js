// server.js
import app from './app.js';
import { Conexion, ConexionExterna, cerrarConexiones } from './config/database.js';
import 'dotenv/config';

const HOST = 'localhost'
const PORT = process.env.PORT || 3055;

const startServer = async () => {
  try {
    // Inicializar ambas conexiones a las bases de datos
    const poolPrincipal = await Conexion();
    const poolExterno = await ConexionExterna();
    
    if (poolPrincipal && poolExterno) {
      console.log('Conexiones a bases de datos establecidas correctamente');
      
      // Iniciar el servidor
      const server = app.listen(PORT, HOST,() => {
        console.log(`API disponible en http://${HOST}:${PORT}/api`);
      });
      
      // Manejar cierre ordenado de conexiones cuando la aplicación se detiene
      const handleShutdown = async () => {
        console.log('Cerrando servidor y conexiones a bases de datos...');
        server.close(async () => {
          await cerrarConexiones();
          console.log('Servidor cerrado correctamente');
          process.exit(0);
        });
        
        // Si el servidor no cierra después de 5 segundos, forzar cierre
        setTimeout(() => {
          console.error('Forzando cierre después de timeout');
          process.exit(1);
        }, 5000);
      };
      
      // Registrar manejadores para señales de terminación
      process.on('SIGTERM', handleShutdown);
      process.on('SIGINT', handleShutdown);
      
    } else {
      console.error('No se pudieron establecer las conexiones a las bases de datos. Servidor no iniciado.');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error al iniciar el servidor:', error);
    process.exit(1);
  }
};

startServer();