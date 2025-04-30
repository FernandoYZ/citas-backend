import { Router } from "express";
import citasRoutes from "../modules/citas/citas.routes.js";
import authRoutes from "../modules/auth/auth.routes.js";
import { verificarAutenticacion } from "../middlewares/auth.middleware.js";

const router = Router();

// Ruta base para verificar que la API está activa
router.get("/api", (req, res) => {
  res.send("API activa");
});

// Incluir las rutas a usar
router.use("/api/citas", verificarAutenticacion, citasRoutes);

router.use('/api/login', authRoutes)

export default router;
