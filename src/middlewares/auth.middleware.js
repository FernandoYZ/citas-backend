// middleware/auth.middleware.js
import jwt from "jsonwebtoken";

export const verificarAutenticacion = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
        return res.status(401).json({ mensaje: "No se proporcionó token" });
    }

    jwt.verify(token, "secreto", (err, decoded) => {
        if (err) {
            return res.status(401).json({ mensaje: "Token inválido o expirado" });
        }
        req.usuario = decoded; // Opcional: Almacena la información del usuario decodificado en req.usuario para usarla en las rutas
        next(); // Permite que la solicitud continúe al siguiente middleware o ruta
    });
};