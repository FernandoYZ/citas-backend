import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import apiRoutes from "./routes/api.routes.js";

const app = express();


// Habilitar CORS para comunicación con el frontend con configuración ampliada
app.use(cors({
    origin: '*', // O pon el dominio específico si no quieres permitir todos
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));


// Logging de solicitudes HTTP
app.use(morgan('dev'));

// Parseo de JSON en el cuerpo de las solicitudes
app.use(express.json());

// Rutas de la API
app.use(apiRoutes);

// Middleware para manejo de errores
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        message: 'Ha ocurrido un error interno',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Error interno'
    });
});

// Middleware para rutas no encontradas
app.use((req, res) => {
    res.status(404).json({ message: 'Recurso no encontrado' });
});

export default app;