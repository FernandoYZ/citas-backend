import sql from "mssql";
import env from '../../config/env.js'

class DatabaseService {
  constructor() {
    this.poolPrincipal = null;
    this.poolSecundaria = null;
    this.iniciandoConexionPrincipal = null;

    this.dbPrincipalConfig = {
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      server: env.DB_SERVER,
      database: env.DB_DATABASE_PRINCIPAL,
      options: {
        encrypt: false,
        trustServerCertificate: true,
      },
      pool: {
        min: 20,
        max: 100,
        idleTimeoutMillis: 60000,
        acquireTimeoutMillis: 30000,
        createTimeoutMillis: 30000,
      },
    };

    this.dbSecundariaConfig = {
      ...this.dbPrincipalConfig,
      database: env.DB_DATABASE_SECUNDARIA,
      pool: {
        min: 0,
        max: 30,
        idleTimeoutMillis: 30000,
        acquireTimeoutMillis: 15000,
        createTimeoutMillis: 15000,
      },
    };
  }

  async iniciarConexionPrincipal() {
    if (this.poolPrincipal && this.poolPrincipal.connected) {
      return this.poolPrincipal;
    }

    if (this.iniciandoConexionPrincipal) {
      return this.iniciandoConexionPrincipal;
    }

    this.iniciandoConexionPrincipal = new sql.ConnectionPool(this.dbPrincipalConfig)
      .connect()
      .then((pool) => {
        if (env.NODE_ENV !== "production") {
          console.log(`✅ Conexión principal establecida: ${this.dbPrincipalConfig.database}`);
        }

        pool.on("error", (err) => {
          console.error("⚠️ Error en la conexión principal:", err);
          this.poolPrincipal = null;
        });

        this.poolPrincipal = pool;
        this.iniciandoConexionPrincipal = null;
        return pool;
      })
      .catch((err) => {
        this.iniciandoConexionPrincipal = null;
        console.error("❌ Error al iniciar la conexión principal:", err);
        throw err;
      });

    return this.iniciandoConexionPrincipal;
  }

  obtenerConexionPrincipal() {
    if (!this.poolPrincipal) {
      throw new Error("⚠️ La conexión principal no ha sido inicializada.");
    }
    return this.poolPrincipal;
  }

  isConectadoPrincipal() {
    return !!(this.poolPrincipal && this.poolPrincipal.connected);
  }

  async obtenerConexionSecundaria() {
    if (!this.poolSecundaria || !this.poolSecundaria.connected) {
      try {
        this.poolSecundaria = await new sql.ConnectionPool(this.dbSecundariaConfig).connect();

        if (env.NODE_ENV !== "production") {
          console.log(`✅ Conexión secundaria establecida: ${this.dbSecundariaConfig.database}`);
        }

        this.poolSecundaria.on("error", (err) => {
          console.error("⚠️ Error en la conexión secundaria:", err);
          this.poolSecundaria = null;
        });
      } catch (error) {
        console.error("❌ Error al conectar con la base secundaria:", error);
        throw error;
      }
    }
    return this.poolSecundaria;
  }

  async cerrarConexiones() {
    try {
      if (this.poolPrincipal) {
        await this.poolPrincipal.close();
        this.poolPrincipal = null;
        if (env.NODE_ENV !== "production") {
          console.log("🔒 Conexión principal cerrada");
        }
      }
      if (this.poolSecundaria) {
        await this.poolSecundaria.close();
        this.poolSecundaria = null;
        if (env.NODE_ENV !== "production") {
          console.log("🔒 Conexión secundaria cerrada");
        }
      }
    } catch (error) {
      console.error("❌ Error al cerrar conexiones:", error);
    }
  }
}

export const databaseService = new DatabaseService();
