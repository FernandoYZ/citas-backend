// repositories/citas.repository.js
import sql from "mssql";
import NodeCache from "node-cache";
import { Conexion, ConexionExterna } from "../../../config/database.js";

// Crear un caché con tiempo de vida de 2 minutos
const citasCache = new NodeCache({ stdTTL: 120 });

// Mantener registro de fechas con actualizaciones pendientes
const modificacionesPendientes = new Set();

class CitasRepository {
  // Método para obtener citas básicas por fecha
  async obtenerCitasPorRangoFecha(fechaInicio, fechaFin, filtroEspecialidades = '', forzarActualizacion = true) {
    const cacheKey = `citas_${fechaInicio}_${fechaFin}_${filtroEspecialidades}`;
    
    // Verificar si hay modificaciones pendientes para este rango
    const actualizacionPendiente = modificacionesPendientes.has(cacheKey);
    
    // Verificar si los datos están en caché y si no hay actualizaciones pendientes
    if (!forzarActualizacion && !actualizacionPendiente && citasCache.has(cacheKey)) {
      console.log("Obteniendo citas de caché para rango:", fechaInicio, "a", fechaFin);
      return citasCache.get(cacheKey);
    }
    
    // Si había una actualización pendiente, eliminar la marca
    if (actualizacionPendiente) {
      modificacionesPendientes.delete(cacheKey);
      console.log(`Aplicando actualizaciones pendientes para rango: ${fechaInicio} a ${fechaFin}`);
    }
    
    console.log(`Consultando citas para rango: ${fechaInicio} a ${fechaFin} con filtro: ${filtroEspecialidades || 'ninguno'}`);
    const pool = await Conexion();
    
    // Consulta optimizada con filtro de especialidades
    const query = `
      WITH PacientesData AS (
        SELECT 
          pa.IdPaciente,
          pa.NroDocumento,
          LOWER(pa.ApellidoPaterno + ' ' + pa.ApellidoMaterno) AS ApellidosPaciente,
          LOWER(RTRIM(pa.PrimerNombre + ' ' + ISNULL(pa.SegundoNombre, '') + ' ' + ISNULL(pa.TercerNombre, ''))) AS NombresPaciente,
          pa.NroHistoriaClinica
        FROM Pacientes pa
        WHERE pa.NroDocumento IS NOT NULL
      )

      SELECT
        pd.IdPaciente,
        pd.NroDocumento,
        a.IdAtencion,
        pd.ApellidosPaciente,
        pd.NombresPaciente,
        a.Edad,
        pd.NroHistoriaClinica,
        LOWER(s.Nombre) AS Servicio,
        s.IdServicio,
        LOWER(e.Nombres) AS NombreDoctor, 
        LOWER(e.ApellidoPaterno + ' ' + e.ApellidoMaterno) AS ApellidoDoctor,
        CONVERT(varchar, p.Fecha, 23) AS FechaCita, 
        c.HoraInicio,
        c.HoraFin,
        CASE 
          WHEN a.FyHFinal IS NULL THEN 'Pendiente'
          ELSE 'Atendido'
        END AS Estado
      FROM ProgramacionMedica p
      INNER JOIN Citas c 
        ON p.IdProgramacion = c.IdProgramacion
        AND c.Fecha >= @fechaInicio 
        AND c.Fecha <= @fechaFin
      INNER JOIN Servicios s ON p.IdServicio = s.IdServicio 
      INNER JOIN Atenciones a ON c.IdAtencion = a.IdAtencion
      INNER JOIN PacientesData pd ON c.IdPaciente = pd.IdPaciente
      INNER JOIN Medicos me ON p.IdMedico = me.IdMedico
      INNER JOIN Empleados e ON me.IdEmpleado = e.IdEmpleado
      WHERE s.IdServicio IN (145, 149, 230, 312, 346, 347, 358, 367, 407, 439)
      ${filtroEspecialidades}
      ORDER BY c.Fecha, c.HoraInicio;
    `;
     const res = await pool.request()
      .input("fechaInicio", sql.Date, fechaInicio)
      .input("fechaFin", sql.Date, fechaFin)
      .query(query);

    const citas = res.recordset;
    
    // Guardar en caché
    citasCache.set(cacheKey, citas);
    
    return citas;
  }
  
  // Obtener estado de triaje para una lista de citas en batch
  async obtenerEstadosTriaje(citas) {
    if (!citas || citas.length === 0) return [];
    
    // Extraer todos los IDs de atención
    const idsAtencion = citas.map(cita => cita.IdAtencion);
    
    // Consulta en batch para todos los IDs
    const poolExterna = await ConexionExterna();
    
    // Crear parámetros para la consulta IN
    const idList = idsAtencion.join(',');
    
    const triajeResult = await poolExterna.request()
      .query(`
        SELECT idAtencion, 1 AS Existe
        FROM atencionesCE
        WHERE idAtencion IN (${idList})
      `);  
    
    // Crear un mapa para búsqueda rápida
    const triajeMap = {};
    triajeResult.recordset.forEach(item => {
      triajeMap[item.idAtencion] = true;
    });
    
    // Asignar estado de triaje a cada cita
    return citas.map(cita => {
      // Modificación: Verificar si está en la lista de servicios especiales Y si existe en triajeMap
      if ([149, 367, 312, 346, 347, 358].includes(cita.IdServicio)) {
        // Si existe en triajeMap, marcar como "Completado", de lo contrario mantener como "No aplica"
        return {
          ...cita,
          Triaje: triajeMap[cita.IdAtencion] ? "Completado" : "No aplica"
        };
      }
      
      // Para el resto de servicios, comportamiento normal
      return {
        ...cita,
        Triaje: triajeMap[cita.IdAtencion] ? "Completado" : "Pendiente"
      };
    });
  }
  
  // NUEVO - Marcar una fecha para invalidación inmediata
  marcarParaActualizacion(fecha) {
    modificacionesPendientes.add(fecha);
    console.log(`Fecha ${fecha} marcada para actualización inmediata en próxima consulta`);
  }
  
  // Invalidar caché para una fecha específica
  invalidarCache(fecha) {
    const cacheKey = `citas_${fecha}`;
    citasCache.del(cacheKey);
    console.log(`Caché invalidado para fecha: ${fecha}`);
  }
  
  // Método para obtener datos adicionales del paciente (antecedentes, etc.)
  async obtenerDatosPaciente(idPaciente) {
    const cacheKey = `paciente_${idPaciente}`;
    
    // Verificar caché
    const cachedData = citasCache.get(cacheKey);
    if (cachedData) {
      return cachedData;
    }
    
    const pool = await Conexion();
    const result = await pool.request()
      .input('idPaciente', sql.Int, idPaciente)
      .query(`
        SELECT 
          antecedentes,
          antecedAlergico,
          antecedObstetrico,
          antecedQuirurgico,
          antecedFamiliar,
          antecedPatologico
        FROM PacientesDatosAdicionales 
        WHERE idPaciente = @idPaciente
      `);
    
    const datosPaciente = result.recordset[0] || {};
    
    // Guardar en caché con TTL más largo (30 minutos) ya que estos datos cambian con menos frecuencia
    citasCache.set(cacheKey, datosPaciente, 1800);
    
    return datosPaciente;
  }
  
  // Método para invalidar caché del paciente
  invalidarCachePaciente(idPaciente) {
    const cacheKey = `paciente_${idPaciente}`;
    citasCache.del(cacheKey);
    console.log(`Caché de paciente invalidado: ${idPaciente}`);
  }
}

export const citasRepository = new CitasRepository();
