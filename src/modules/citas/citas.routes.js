import { Router } from "express";
import * as citasController from "./controllers/citas.controller.js";
import * as citasParticular from "./controllers/citasParticular.controller.js";
import * as Atenciones from "./controllers/atenciones.controller.js";
import * as CPTController from "./controllers/cpt.controller.js";
import * as FarmController from "./controllers/farm.controller.js"; // Agregar esta importación
import {
  verificarAutenticacion,
  cargarFiltroEspecialidades,
  verificarPermisosAtencionMedica,
  verificarPermisoEliminacion,
  verificarPermisosTriaje,
  verificarPermisoCitas,
  verificarPermisoConsultaCitas
} from "../../middlewares/auth.middleware.js";

const router = Router();

// ==================== RUTAS DE CONSULTA DE CITAS ====================
router.get(
  "/citas-separadas",
  verificarAutenticacion,
  // verificarPermisoConsultaCitas,
  cargarFiltroEspecialidades,
  citasController.obtenerCitasSeparadas
);

router.get(
  "/cita/:idCita/:idPaciente", 
  verificarAutenticacion,
  verificarPermisoConsultaCitas,
  citasController.obtenerCitaDetallada
);

// ==================== RUTAS DE REGISTRO DE CITAS ====================
router.post(
  "/citas",
  verificarAutenticacion,
  // verificarPermisoCitas,
  citasController.registrarCita
);

// ==================== RUTAS DE PACIENTES ====================
router.get(
  "/paciente", 
  verificarAutenticacion,
  citasController.validarPaciente
);

// ==================== RUTAS DE CONSULTA DE SERVICIOS Y MÉDICOS ====================
router.get(
  "/servicios-fecha",
  verificarAutenticacion,
  cargarFiltroEspecialidades,
  citasController.selectEspecialidad
);

router.get(
  "/medicos-select", 
  verificarAutenticacion,
  citasController.selectMedicos
);

router.get(
  "/horarios-select", 
  verificarAutenticacion,
  citasController.selectHorasDisponibles
);

// ==================== RUTAS DE TRIAJE ====================
router.post(
  "/triaje",
  verificarAutenticacion,
  verificarPermisosTriaje,
  citasController.registrarTriaje
);

router.get(
  "/verificar-triaje/:idAtencion",
  verificarAutenticacion,
  citasController.verificarEstadoTriaje
);

router.get(
  "/resumen-triaje", 
  verificarAutenticacion,
  cargarFiltroEspecialidades,
  Atenciones.resumenCitasTriajeDelDia
);

// ==================== RUTAS DE ATENCIÓN MÉDICA ====================
router.post(
  "/atencion-ce",
  verificarAutenticacion,
  verificarPermisosAtencionMedica,
  Atenciones.registrarAtencionCE
);

router.delete(
  "/atenciones-diagnosticos-eliminar/:id",
  verificarAutenticacion,
  verificarPermisoEliminacion,
  Atenciones.eliminarAtencionesDiagnostico
);

router.get(
  "/buscar-diagnosticos", 
  verificarAutenticacion,
  Atenciones.buscarDiagnosticos
);

router.get(
  "/clasificaciones-dx", 
  verificarAutenticacion,
  Atenciones.obtenerClasificacionesDx
);

router.get(
  "/datos-consulta", 
  verificarAutenticacion,
  verificarPermisosAtencionMedica,
  Atenciones.obtenerDatosConsulta
);

// ==================== RUTAS DE CPTs (PROCEDIMIENTOS) ====================
router.post(
  "/cpts/post-atencion",
  verificarAutenticacion,
  verificarPermisosAtencionMedica,
  CPTController.registrarCPTsPostAtencion
);

router.put(
  "/cpts/post-atencion",
  verificarAutenticacion,
  verificarPermisosAtencionMedica,
  CPTController.actualizarCPTsPostAtencion
);

router.get(
  "/buscar-cpt", 
  verificarAutenticacion,
  CPTController.buscarCPT
);

router.get(
  "/cpts/por-atencion",
  verificarAutenticacion,
  verificarPermisosAtencionMedica,
  CPTController.obtenerCPTsPorAtencion
);

router.delete(
  "/cpts/:idOrden/:idProducto",
  verificarAutenticacion,
  verificarPermisoEliminacion,
  CPTController.eliminarCPT
);

// ==================== RUTAS DE FARMACIA (RECETAS) ====================
router.post(
  "/recetas/post-atencion",
  verificarAutenticacion,
  verificarPermisosAtencionMedica,
  FarmController.registrarRecetaFarmPostAtencion
);

router.put(
  "/recetas/post-atencion",
  verificarAutenticacion,
  verificarPermisosAtencionMedica,
  FarmController.actualizarRecetaFarmPostAtencion
);

router.get(
  "/buscar-medicamentos", 
  verificarAutenticacion,
  FarmController.buscarFarmPrincipal
);

router.get(
  "/recetas/por-atencion",
  verificarAutenticacion,
  verificarPermisosAtencionMedica,
  FarmController.obtenerRecetasPorAtencion
);

router.delete(
  "/recetas/:idReceta/:idProducto",
  verificarAutenticacion,
  verificarPermisoEliminacion,
  FarmController.eliminarMedicamentoReceta
);

// ==================== CITA PARTICULAR ====================
router.post(
  "/cita-particular",
  verificarAutenticacion,
  // verificarPermisoCitas,
  citasParticular.registrarCitaParticularConVerificacion
);

router.get("/select-especialidades", verificarAutenticacion, cargarFiltroEspecialidades, citasParticular.selectEspecialidad);


// router.post(
//   "/cita-particular-verificacion",
//   citasParticular.registrarCitaParticularConVerificacion
// );

// Rutas para testing de la verificación
router.get(
  "/verificacion-resultado",
  citasParticular.consultarResultadoVerificacion
);

router.post(
  "/verificacion-reset",
  citasParticular.resetearVerificacion
);


export default router;