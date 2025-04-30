import { Router } from 'express';
import * as citasController from './citas.controller.js'
import * as Atenciones from './atenciones.controller.js'

const router = Router();


// Rutas para gestión de citas
router.get('/citas-separadas', citasController.obtenerCitasSeparadas)
router.post('/citas', citasController.registrarCita);

// Endpoints para el formulario de citas
router.get('/paciente', citasController.validarPaciente);
router.get('/servicios-fecha', citasController.selectEspecialidad)
router.get('/medicos-select', citasController.selectMedicos)
router.get('/horarios-select', citasController.selectHorasDisponibles)

// triaje
// router.get('/datos-cuenta/:idAtencion', citasController.obtenerDatosDeCuenta)
router.post('/triaje', citasController.registrarTriaje)
router.get('/verificar-triaje/:idAtencion', citasController.verificarEstadoTriaje)

router.get('/atender', Atenciones.obtenerDiagnosticos)
router.post('/atencion-ce', Atenciones.registrarAtencionCE)
router.post('/atenciones-diagnosticos-agregar', Atenciones.registrarAtencionesDiagnosticos)
router.put('/atenciones-diagnosticos-actualizar', Atenciones.actualizarAtencionesDiagnosticos)
router.delete('/atenciones-diagnosticos-eliminar/:id', Atenciones.eliminarAtencionesDiagnostico)
router.get('/buscar-diagnosticos', Atenciones.buscarDiagnosticos)
router.get('/clasificaciones-dx', Atenciones.obtenerClasificacionesDx)
router.get('/datos-consulta', Atenciones.obtenerDatosConsulta)


export default router;