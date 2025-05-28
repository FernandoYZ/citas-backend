import { Conexion, ConexionExterna } from "../../config/database.js";
import sql from "mssql";

const pool = await Conexion();

export async function obtenerCitasPorFecha(fecha) {
  // Primero obtener la conexión externa para verificar triajes
  const poolExterna = await ConexionExterna();

  // Consulta principal con la información de las citas
  const res = await pool.request()
  .input("fecha", sql.Date, fecha)
  .query(`
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
            pd.IdPaciente,        -- AÑADIDO: Incluir explícitamente IdPaciente en el SELECT
            pd.NroDocumento,
            a.IdAtencion,
            pd.ApellidosPaciente,
            pd.NombresPaciente,
            a.Edad,
            pd.NroHistoriaClinica,
            LOWER(s.Nombre) AS Servicio,
            s.IdServicio,
            LOWER(es.Nombre) AS Especialidad, 
            LOWER(d.Nombre) AS Departamento, 
            LOWER(e.Nombres) AS NombreDoctor, 
            LOWER(e.ApellidoPaterno + ' ' + e.ApellidoMaterno) AS ApellidoDoctor,  
            e.ApellidoPaterno + ' ' + e.ApellidoMaterno + ' ' + e.Nombres AS CitaMedico,
            CONVERT(varchar, p.Fecha, 23) AS FechaCita, 
            c.HoraInicio,
            c.HoraFin,
            FORMAT(c.FechaSolicitud, 'yyyy/MM/dd HH:mm') AS FechaSolicitud,
            e.Usuario,
            fu.Descripcion AS FuenteFinanciamiento,
            PDA.antecedentes,
            PDA.antecedAlergico,
            PDA.antecedObstetrico,
            PDA.antecedQuirurgico,
            PDA.antecedFamiliar,
            PDA.antecedPatologico,
			CASE 
				WHEN a.FyHFinal IS NULL THEN 'Pendiente'
				ELSE 'Atendido'
			END AS Estado
            -- t.Descripcion AS Estado
    FROM ProgramacionMedica p
    INNER JOIN Citas c 
        ON p.IdProgramacion = c.IdProgramacion
        AND c.Fecha >= @Fecha 
        AND c.Fecha < DATEADD(DAY, 1, @Fecha)
    INNER JOIN Servicios s ON p.IdServicio = s.IdServicio 
    INNER JOIN Atenciones a ON c.IdAtencion = a.IdAtencion
    INNER JOIN PacientesData pd ON c.IdPaciente = pd.IdPaciente
    LEFT JOIN PacientesDatosAdicionales PDA ON pd.IdPaciente = PDA.idPaciente
    INNER JOIN FuentesFinanciamiento fu ON a.idfuenteFinanciamiento = fu.IdFuenteFinanciamiento
    INNER JOIN TiposEstadosCita t ON c.IdEstadoCita = t.IdEstadoCita
    INNER JOIN Medicos me ON p.IdMedico = me.IdMedico
    INNER JOIN Empleados e ON me.IdEmpleado = e.IdEmpleado
    INNER JOIN Especialidades es ON s.IdEspecialidad = es.IdEspecialidad 
    INNER JOIN DepartamentosHospital d ON es.IdDepartamento = d.IdDepartamento
    WHERE s.IdServicio IN (145, 149, 230, 312, 346, 347, 358, 367, 407, 439)
    ORDER BY c.Fecha, c.HoraInicio;
  `);

  // Verificar si cada cita tiene triaje registrado
  const citasConEstadoTriaje = await Promise.all(
    res.recordset.map(async (cita) => {
      try {
        
        // 145 - 367 - 407 - 230 son los servicios que requieren triaje
        if (
          cita.IdServicio === 149 ||
          cita.IdServicio === 312 ||
          cita.IdServicio === 346 ||
          cita.IdServicio === 347 ||
          cita.IdServicio === 358
        ) {
          return {
            ...cita,
            Triaje: "No aplica",
          };
        }
          

        // Verificar si existe triaje para esta atención
        const triajeResult = await poolExterna
          .request()
          .input("idAtencion", sql.Int, cita.IdAtencion).query(`
                    SELECT TOP 1 1 AS Existe
                    FROM atencionesCE
                    WHERE idAtencion = @idAtencion 
                `);

        // Determinar estado de triaje
        const tieneTriaje = triajeResult.recordset.length > 0;

        return {
          ...cita,
          Triaje: tieneTriaje ? "Completado" : "Pendiente",
        };
      } catch (error) {
        console.error(
          `Error al verificar triaje para cita ${cita.IdAtencion}:`,
          error
        );
        return {
          ...cita,
          Triaje: "Pendiente",
        };
      }
    })
  );

  return citasConEstadoTriaje;
}

export async function obtenerCitasMedicoEstrategia(fecha, IdMedico) {
  // Primero obtener la conexión externa para verificar triajes
  const poolExterna = await ConexionExterna();

  // Consulta principal con la información de las citas
  const res = await pool.request()
  .input("fecha", sql.Date, fecha)
  .input('IdMedico', sql.Int, IdMedico)
  .query(`
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
            pd.IdPaciente,        -- AÑADIDO: Incluir explícitamente IdPaciente en el SELECT
            pd.NroDocumento,
            a.IdAtencion,
            pd.ApellidosPaciente,
            pd.NombresPaciente,
            a.Edad,
            pd.NroHistoriaClinica,
            LOWER(s.Nombre) AS Servicio,
            s.IdServicio,
            LOWER(es.Nombre) AS Especialidad, 
            LOWER(d.Nombre) AS Departamento, 
            LOWER(e.Nombres) AS NombreDoctor, 
            LOWER(e.ApellidoPaterno + ' ' + e.ApellidoMaterno) AS ApellidoDoctor,  
            e.ApellidoPaterno + ' ' + e.ApellidoMaterno + ' ' + e.Nombres AS CitaMedico,
            CONVERT(varchar, p.Fecha, 23) AS FechaCita, 
            c.HoraInicio,
            c.HoraFin,
            FORMAT(c.FechaSolicitud, 'yyyy/MM/dd HH:mm') AS FechaSolicitud,
            e.Usuario,
            fu.Descripcion AS FuenteFinanciamiento,
            PDA.antecedentes,
            PDA.antecedAlergico,
            PDA.antecedObstetrico,
            PDA.antecedQuirurgico,
            PDA.antecedFamiliar,
            PDA.antecedPatologico,
            t.Descripcion AS Estado
    FROM ProgramacionMedica p
    INNER JOIN Citas c 
        ON p.IdProgramacion = c.IdProgramacion
        AND c.Fecha >= @Fecha 
        AND c.Fecha < DATEADD(DAY, 1, @Fecha)
    INNER JOIN Servicios s ON p.IdServicio = s.IdServicio 
    INNER JOIN Atenciones a ON c.IdAtencion = a.IdAtencion
    INNER JOIN PacientesData pd ON c.IdPaciente = pd.IdPaciente
    LEFT JOIN PacientesDatosAdicionales PDA ON pd.IdPaciente = PDA.idPaciente
    INNER JOIN FuentesFinanciamiento fu ON a.idfuenteFinanciamiento = fu.IdFuenteFinanciamiento
    INNER JOIN TiposEstadosCita t ON c.IdEstadoCita = t.IdEstadoCita
    INNER JOIN Medicos me ON p.IdMedico = me.IdMedico
    INNER JOIN Empleados e ON me.IdEmpleado = e.IdEmpleado
    INNER JOIN Especialidades es ON s.IdEspecialidad = es.IdEspecialidad 
    INNER JOIN DepartamentosHospital d ON es.IdDepartamento = d.IdDepartamento
    WHERE s.IdServicio IN (145, 149, 230, 312, 346, 347, 358, 367, 407, 439)
    AND p.IdMedico = @IdMedico
    ORDER BY c.Fecha, c.HoraInicio;
  `);

  // Verificar si cada cita tiene triaje registrado
  const citasConEstadoTriaje = await Promise.all(
    res.recordset.map(async (cita) => {
      try {
        /*
        // 145 - 367 - 407 - 230 son los servicios que requieren triaje
        if (
          cita.IdServicio === 149 ||
          cita.IdServicio === 312 ||
          cita.IdServicio === 346 ||
          cita.IdServicio === 347 ||
          cita.IdServicio === 358
        ) {
          return {
            ...cita,
            Triaje: "No aplica",
          };
        }
          */

        // Verificar si existe triaje para esta atención
        const triajeResult = await poolExterna
          .request()
          .input("idAtencion", sql.Int, cita.IdAtencion).query(`
                    SELECT TOP 1 1 AS Existe
                    FROM atencionesCE
                    WHERE idAtencion = @idAtencion 
                `);

        // Determinar estado de triaje
        const tieneTriaje = triajeResult.recordset.length > 0;

        return {
          ...cita,
          Triaje: tieneTriaje ? "Completado" : "Pendiente",
        };
      } catch (error) {
        console.error(
          `Error al verificar triaje para cita ${cita.IdAtencion}:`,
          error
        );
        return {
          ...cita,
          Triaje: "Pendiente",
        };
      }
    })
  );

  return citasConEstadoTriaje;
}


export async function selectEspecialidad(fecha) {
  // Obtener el token del encabezado de la solicitud
  const token = req.headers.authorization?.split(" ")[1];

  // Verificar si el token existe
  if (!token) {
    await transaction.rollback();
    return res.status(401).json({
      success: false,
      message: "Token de autenticación no proporcionado",
    });
  }

  const idUsuarioValido = req.usuario.id;
  
  const res = await pool.request()
  .input("fecha", sql.Date, fecha)
  .input("idUsuarioValido", sql.Int, idUsuarioValido)
  .query(`
            SELECT DISTINCT 
                pm.IdServicio, 
                LOWER(S.Nombre) AS Nombre
            FROM ProgramacionMedica PM
            INNER JOIN Servicios S ON PM.IdServicio = S.IdServicio
            WHERE Fecha = @Fecha AND 
            PM.IdServicio IN (145, 149, 230, 312, 346, 347, 358, 367, 407, 439)
            AND E.IdEmpleado=@idUsuarioValido;
        `);
  return res.recordset;
}

export async function selectMedicos(fecha, idServicio) {
  const res = await pool
      .request()
      .input("fecha", sql.Date, fecha)
      .input("idServicio", sql.Int, idServicio)
      .query(`
        SELECT DISTINCT 
                  PM.IdMedico,
                  LOWER(E.Nombres + ' ' + E.ApellidoPaterno) AS Doctor
                  
        FROM ProgramacionMedica PM
        INNER JOIN Medicos M ON PM.IdMedico = M.IdMedico
        INNER JOIN Empleados E ON M.IdEmpleado = E.IdEmpleado
        WHERE PM.Fecha = @fecha 
          AND PM.IdServicio = @idServicio;
      `);
    
    return res.recordset;
}