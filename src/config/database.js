// config/database.js
import sql from 'mssql';
import 'dotenv/config';

// Configuración para la base de datos principal
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: false,
    trustServerCertificate: false,
  },
};

// Configuración para la base de datos externa (SIGH_EXTERNA)
const dbConfigExterna = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE2, // Nombre específico para la base externa
  options: {
    encrypt: false,
    trustServerCertificate: false,

  },
};

// Pools de conexión globales
let poolPrincipal = null;
let poolExterno = null;

// Inicializar pool principal
export const Conexion = async () => {
  try {
    if (!poolPrincipal) {
      poolPrincipal = await new sql.ConnectionPool(dbConfig).connect();
      console.log('Pool de conexión principal inicializado');
    }
    return poolPrincipal;
  } catch (error) {
    console.error('Error al inicializar pool principal:', error);
    throw error;
  }
};

// Inicializar pool externo
export const ConexionExterna = async () => {
  try {
    if (!poolExterno) {
      poolExterno = await new sql.ConnectionPool(dbConfigExterna).connect();
      console.log('Pool de conexión externa inicializado');
    }
    return poolExterno;
  } catch (error) {
    console.error('Error al inicializar pool externo:', error);
    throw error;
  }
};

// Función para cerrar todas las conexiones cuando se cierra la aplicación
export const cerrarConexiones = async () => {
  try {
    if (poolPrincipal) {
      await poolPrincipal.close();
      poolPrincipal = null;
      console.log('Pool de conexión principal cerrado');
    }
    
    if (poolExterno) {
      await poolExterno.close();
      poolExterno = null;
      console.log('Pool de conexión externa cerrado');
    }
  } catch (error) {
    console.error('Error al cerrar pools de conexión:', error);
  }
};