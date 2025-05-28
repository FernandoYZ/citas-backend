// src/modules/auth/auth.routes.js
import { Router } from 'express';
import { iniciarSesion, verificarToken } from './auth.controller.js';

const router = Router()

router.post('/login', iniciarSesion)
router.get('/verify-token', verificarToken);

export default router