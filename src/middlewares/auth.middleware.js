// src/middlewares/auth.middleware.js

import jwt from "jsonwebtoken";
import sql from 'mssql';
import { Conexion } from "../config/database.js";

// Constantes para IDs comunes
const ROLES = {
  ADMIN: 1,               // Administrador: ver y modificar o eliminar cualquier registro
  SUPERVISOR: 79,         // SupervisorSistema: ver y modificar cualquier registro
  INFORMATICA: 195,       // INFORMATICA: ver y modificar cualquier registro
  VER_PACIENTE: 94,       // VerPaciente: ver cualquier registro
  TRIAJE: 101,            // CE Triaje HRC: ver, registrar y modificar solo triaje
  MEDICO_CE: 149,         // CE Medicos HRC: ver y modificar registros de sus pacientes
  PROGRAMAS: 154,         // CE Programas HRC: agendar cita y manejar sus pacientes
  RECEPCION: 52,          // CEadmision HRC: sacar cita, agregar, modificar, no eliminar
};

const ITEMS = {
  PACIENTE: 101,
  CITAS: 102,
  ATENCION_MEDICA: 103,
  TRIAJE: 1303,
};

export const verificarAutenticacion = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ mensaje: "No se proporcionó token" });
  }

  jwt.verify(token, "secreto", (err, decoded) => {
    if (err) {
      return res.status(401).json({ mensaje: "Token inválido o expirado" });
    }
    
    // Establecer información de usuario en req
    req.usuario = decoded; 
    
    // Inicializar array de especialidades (vacío por defecto)
    req.filtroEspecialidades = []; 
    
    next();
  });
};

// Middleware para cargar las especialidades permitidas según el perfil del usuario
export const cargarFiltroEspecialidades = async (req, res, next) => {
  try {
    // Si no hay usuario autenticado, salir
    if (!req.usuario) {
      return res.status(401).json({ mensaje: "No autenticado" });
    }
    
    // Roles con acceso total (sin filtros)
    if (req.usuario.roles && (
        req.usuario.roles.includes(ROLES.ADMIN) || 
        req.usuario.roles.includes(ROLES.SUPERVISOR) || 
        req.usuario.roles.includes(ROLES.INFORMATICA) || 
        req.usuario.roles.includes(ROLES.VER_PACIENTE) || 
        req.usuario.roles.includes(ROLES.RECEPCION) ||
        req.usuario.roles.includes(ROLES.MEDICO_CE))) {
      req.filtroEspecialidades = null; // Estos roles ven todo
      return next();
    }
    
    // Si es médico de programas (rol 154), filtrar por su especialidad y médico
    if (req.usuario.isMedico && req.usuario.roles && req.usuario.roles.includes(ROLES.PROGRAMAS)) {
      const pool = await Conexion();
      
      // Obtener especialidades asociadas al médico
      const espResult = await pool
        .request()
        .input("IdMedico", sql.Int, req.usuario.idMedico)
        .query(`
          SELECT DISTINCT s.IdServicio
          FROM ProgramacionMedica pm
          INNER JOIN Servicios s ON pm.IdServicio = s.IdServicio
          WHERE pm.IdMedico = @IdMedico
          AND s.IdServicio IN (145, 149, 230, 312, 346, 347, 358, 367, 407, 439)
        `);
            
      // Si hay resultados, establecer filtro de especialidades
      if (espResult.recordset && espResult.recordset.length > 0) {
        req.filtroEspecialidades = espResult.recordset.map(r => r.IdServicio);
        
        // Construir la parte WHERE con los IDs de especialidad
        req.filtroEspecialidadesSQL = ` AND s.IdServicio IN (${req.filtroEspecialidades.join(',')})`;
        
        // Médicos de programas solo ven sus propias citas
        if (req.usuario.idMedico) {
          req.filtroEspecialidadesSQL += ` AND me.IdMedico = ${req.usuario.idMedico}`;
        }
      }
    } else if (req.usuario.isMedico && req.usuario.idMedico) {
      // Para triaje, limitar a especialidades asociadas, pero no a pacientes
      const pool = await Conexion();
      const espResult = await pool
        .request()
        .input("IdMedico", sql.Int, req.usuario.idMedico)
        .query(`
          SELECT DISTINCT s.IdServicio
          FROM ProgramacionMedica pm
          INNER JOIN Servicios s ON pm.IdServicio = s.IdServicio
          WHERE pm.IdMedico = @IdMedico
          AND s.IdServicio IN (145, 149, 230, 312, 346, 347, 358, 367, 407, 439)
        `);
            
      if (espResult.recordset && espResult.recordset.length > 0) {
        req.filtroEspecialidades = espResult.recordset.map(r => r.IdServicio);
        req.filtroEspecialidadesSQL = ` AND s.IdServicio IN (${req.filtroEspecialidades.join(',')})`;
      }
    }
    
    next();
  } catch (error) {
    console.error("Error al cargar filtro de especialidades:", error);
    next(); // Continuar sin filtro en caso de error
  }
};

// Middleware para verificar permisos de atención médica
export const verificarPermisosAtencionMedica = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ mensaje: "No se proporcionó token" });
    }

    const decoded = jwt.verify(token, "secreto");
    req.usuario = decoded;

    // Permisos administrativos
    if (decoded.roles && (
        decoded.roles.includes(ROLES.ADMIN) || 
        decoded.roles.includes(ROLES.SUPERVISOR) || 
        decoded.roles.includes(ROLES.INFORMATICA))) {
      return next();
    }
    
    // Médicos CE tienen acceso a todas las atenciones
    if (decoded.roles && decoded.roles.includes(ROLES.MEDICO_CE)) {
      return next();
    }
    
    // Médicos de programas solo pueden ver sus propias atenciones
    if (decoded.isMedico && decoded.roles && decoded.roles.includes(ROLES.PROGRAMAS)) {
      // En el controlador se debe validar que la atención corresponda al médico
      req.soloPropiasAtenciones = true;
      return next();
    }
    
    // Verificar acción específica para el módulo de atención médica
    const tieneAccion = decoded.accionesItems && 
                       decoded.accionesItems.some(item => 
                         item.id === ITEMS.ATENCION_MEDICA && (item.a === 1 || item.m === 1 || item.c === 1)
                       );
    
    if (tieneAccion) {
      return next();
    }

    return res.status(403).json({ 
      mensaje: "No tiene permisos para realizar esta acción" 
    });
  } catch (error) {
    return res.status(401).json({ mensaje: "Token inválido o expirado" });
  }
};

// Middleware para verificar permisos de eliminación
export const verificarPermisoEliminacion = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ mensaje: "No se proporcionó token" });
    }

    const decoded = jwt.verify(token, "secreto");
    req.usuario = decoded;

    // Solo administrador puede eliminar
    if (decoded.roles && decoded.roles.includes(ROLES.ADMIN)) {
      return next();
    }
    
    // Verificar acción específica de eliminación para el item
    const tieneAccionEliminar = decoded.accionesItems && 
                              decoded.accionesItems.some(item => 
                                item.id === ITEMS.ATENCION_MEDICA && item.e === 1
                              );
    
    if (tieneAccionEliminar) {
      return next();
    }

    return res.status(403).json({ 
      mensaje: "No tiene permisos para eliminar registros" 
    });
  } catch (error) {
    return res.status(401).json({ mensaje: "Token inválido o expirado" });
  }
};

// Middleware para verificar permisos de triaje
export const verificarPermisosTriaje = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ mensaje: "No se proporcionó token" });
    }

    const decoded = jwt.verify(token, "secreto");
    req.usuario = decoded;

    // Permisos administrativos
    if (decoded.roles && (
        decoded.roles.includes(ROLES.ADMIN) || 
        decoded.roles.includes(ROLES.SUPERVISOR) || 
        decoded.roles.includes(ROLES.INFORMATICA))) {
      return next();
    }
    
    // Si tiene rol de triaje, tiene acceso
    if (decoded.roles && decoded.roles.includes(ROLES.TRIAJE)) {
      return next();
    }
    
    // Verificar acción específica para triaje
    const tieneAccion = decoded.accionesItems && 
                       decoded.accionesItems.some(item => 
                         item.id === ITEMS.TRIAJE && (item.a === 1 || item.m === 1)
                       );
    
    if (tieneAccion) {
      return next();
    }

    return res.status(403).json({ 
      mensaje: "No tiene permisos para realizar esta acción de triaje" 
    });
  } catch (error) {
    return res.status(401).json({ mensaje: "Token inválido o expirado" });
  }
};

// Middleware para verificar permisos de registro de citas
export const verificarPermisoCitas = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ mensaje: "No se proporcionó token" });
    }

    const decoded = jwt.verify(token, "secreto");
    req.usuario = decoded;

    // Permisos administrativos y recepción
    if (decoded.roles && (
        decoded.roles.includes(ROLES.ADMIN) || 
        decoded.roles.includes(ROLES.SUPERVISOR) || 
        decoded.roles.includes(ROLES.INFORMATICA) || 
        decoded.roles.includes(ROLES.RECEPCION))) {
      return next();
    }
    
    // Médicos de programas pueden agendar citas
    if (decoded.roles && decoded.roles.includes(ROLES.PROGRAMAS)) {
      return next();
    }
    
    // Verificar acción específica para agregar citas
    const tieneAccion = decoded.accionesItems && 
                       decoded.accionesItems.some(item => 
                         item.id === ITEMS.CITAS && item.a === 1
                       );
    
    if (tieneAccion) {
      return next();
    }

    return res.status(403).json({ 
      mensaje: "No tiene permisos para registrar citas" 
    });
  } catch (error) {
    return res.status(401).json({ mensaje: "Token inválido o expirado" });
  }
};

// Middleware para verificar permisos de consulta de citas
export const verificarPermisoConsultaCitas = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ mensaje: "No se proporcionó token" });
    }

    const decoded = jwt.verify(token, "secreto");
    req.usuario = decoded;

    // Roles con acceso total a citas
    if (decoded.roles && (
        decoded.roles.includes(ROLES.ADMIN) || 
        decoded.roles.includes(ROLES.SUPERVISOR) || 
        decoded.roles.includes(ROLES.INFORMATICA) || 
        decoded.roles.includes(ROLES.VER_PACIENTE) || 
        decoded.roles.includes(ROLES.RECEPCION) ||
        decoded.roles.includes(ROLES.MEDICO_CE))) {
      req.filtrarPorMedico = false;
      return next();
    }
    
    // Médicos de programas solo ven sus propias citas
    if (decoded.isMedico && 
        decoded.roles && 
        decoded.roles.includes(ROLES.PROGRAMAS) && 
        decoded.idMedico) {
      req.filtrarPorMedico = true;
      req.idMedicoFiltro = decoded.idMedico;
      return next();
    }
    
    // Triaje ve citas para hacer triaje
    if (decoded.roles && decoded.roles.includes(ROLES.TRIAJE)) {
      req.filtrarPorMedico = false;
      return next();
    }
    
    // Verificar acción específica para consultar citas
    const tieneAccionConsulta = decoded.accionesItems && 
                               decoded.accionesItems.some(item => 
                                 item.id === ITEMS.CITAS && item.c === 1
                               );
    
    if (tieneAccionConsulta) {
      req.filtrarPorMedico = false;
      return next();
    }

    return res.status(403).json({ 
      mensaje: "No tiene permisos para consultar citas" 
    });
  } catch (error) {
    return res.status(401).json({ mensaje: "Token inválido o expirado" });
  }
};