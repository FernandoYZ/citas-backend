import { Conexion, ConexionExterna } from "../../config/database.js";
import * as CitasService from "./citas.service.js";
import { manejarError, ERRORES } from "../../utils/errorHandler.js";
import { obtenerFechaHoraLima } from "../../utils/fecha.js"
import sql from "mssql";

const fechaHoraLima = obtenerFechaHoraLima()
// Datos para la tabla
export const obtenerCitasSeparadas = async (req, res) => {
  try {
    const { fecha } = req.query;
    const citas = await CitasService.obtenerCitasSeparadas(fecha);

    res.status(200).json(citas);
  } catch (error) {
    console.error(error);
    manejarError(error, res);
  }
};

// Para mostrar en el select las Especialidades disponibles
export const selectEspecialidad = async (req, res) => {
  try {
    const { fecha } = req.query;
    const especialidades = await CitasService.selectEspecialidad(fecha);
    res.status(200).json(especialidades);
  } catch (error) {
    console.error("Error al verificar disponibilidad:", error);
    manejarError(error, res);
  }
};

// Para mostrar en el select los Médicos disponibles
export const selectMedicos = async (req, res) => {
  try {
    const { fecha, idServicio } = req.query;
    const medicos = await CitasService.selectMedicos(fecha, idServicio);
    return res.status(200).json(medicos);
  } catch (error) {
    console.error("Error al mostrar los médicos:", error);
    manejarError(error, res);
  }
};

// función para mostrar las horas disponibles en un select
export const selectHorasDisponibles = async (req, res) => {
  try {
    const { fecha, idServicio, idMedico } = req.query;

    if (!fecha || !idServicio || !idMedico) {
      return res.status(400).json({
        mensaje: "Se requiere la fecha, el idServicio y el idMedico",
        required: ["fecha", "idServicio", "idMedico"],
      });
    }

    const pool = await Conexion();

    // Ejecutamos la consulta con los parámetros correctamente declarados.
    const resultado = await pool
      .request()
      .input("fecha", sql.Date, fecha) // Parámetro fecha
      .input("idServicio", sql.Int, idServicio) // Parámetro idServicio
      .input("idMedico", sql.Int, idMedico) // Aseguramos que el parámetro idMedico esté presente
      .query(`
DECLARE @HoraActual TIME = CONVERT(TIME, DATEADD(HOUR, -5, GETUTCDATE()));

WITH HorasProgramadas AS (
    SELECT 
        IdProgramacion,
        HoraInicio,
        HoraFin,
        TiempoPromedioAtencion
    FROM 
        ProgramacionMedica
    WHERE 
        IdMedico = @idMedico
        AND CONVERT(DATE, Fecha) = CONVERT(DATE, @fecha)
        AND IdServicio = @idServicio
),
HorasOcupadas AS (
    SELECT 
        HoraInicio
    FROM 
        Citas
    WHERE 
        Fecha = @fecha
        AND IdServicio = @idServicio
),
Numeros AS (
    SELECT TOP (100) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS N
    FROM sys.all_objects
)
SELECT 
    FORMAT(DATEADD(MINUTE, (N.N - 1) * HP.TiempoPromedioAtencion, HP.HoraInicio), 'HH:mm') AS HoraInicioDisponible,
    FORMAT(DATEADD(MINUTE, N.N * HP.TiempoPromedioAtencion, HP.HoraInicio), 'HH:mm') AS HoraFinDisponible
FROM 
    HorasProgramadas HP
JOIN 
    Numeros N ON DATEADD(MINUTE, (N.N - 1) * HP.TiempoPromedioAtencion, HP.HoraInicio) < HP.HoraFin
WHERE 
    NOT EXISTS (
        SELECT 1
        FROM HorasOcupadas HO
        WHERE HO.HoraInicio = DATEADD(MINUTE, (N.N - 1) * HP.TiempoPromedioAtencion, HP.HoraInicio)
    )
    AND (
        @fecha > CONVERT(DATE, DATEADD(HOUR, -5, GETUTCDATE())) -- si la fecha es futura, mostrar todo
        OR CONVERT(TIME, DATEADD(MINUTE, (N.N - 1) * HP.TiempoPromedioAtencion, HP.HoraInicio)) >= @HoraActual
    )
ORDER BY 
    HoraInicioDisponible;
            `);

    return res.json(resultado.recordset);
  } catch (error) {
    console.error("Error al mostrar los médicos:", error);
    res.status(500).json({
      message: "Error al mostrar los médicos",
      error: error.message,
    });
  }
};

// Registrar una nueva cita
export const registrarCita = async (req, res) => {
  // Iniciar la transacción
  const transaction = new sql.Transaction(await Conexion());

  try {
    const { NroDocumento, idServicio, idMedico, fechaIngreso, horaIngreso } =
      req.body;

    // Validaciones básicas
    if (
      !NroDocumento ||
      !idServicio ||
      !idMedico ||
      !fechaIngreso ||
      !horaIngreso
    ) {
      return res.status(400).json({
        success: false,
        message: "Datos incompletos para registrar la cita",
        required:
          "NroDocumento, idServicio, idMedico, fechaIngreso, horaIngreso",
      });
    }

    await transaction.begin();

    // 1. Obtener datos del paciente utilizando el SP PacienteXNroDocumento
    const pacienteResult = await transaction
      .request()
      .input("NroDocumento", sql.VarChar(12), NroDocumento)
      .query(`
        select 
          pa.IdPaciente,
          TDI.Descripcion as TipoDocumento,
          pa.NroDocumento,
          pa.ApellidoPaterno + ' ' + pa.ApellidoPaterno AS ApellidosPaciente,
          RTRIM(pa.PrimerNombre + ' ' + ISNULL(PA.SegundoNombre, '') + ' ' + ISNULL(PA.TercerNombre,'')) AS NombrePaciente,
          pa.NroHistoriaClinica,
          PA.FechaNacimiento
        from Pacientes PA 
        INNER JOIN TiposDocIdentidad TDI on PA.IdDocIdentidad=TDI.IdDocIdentidad
        where NroDocumento=@NroDocumento
      `);

    if (!pacienteResult.recordset || pacienteResult.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "No se encontró paciente con el documento proporcionado",
      });
    }

    const idPaciente = pacienteResult.recordset[0].IdPaciente;
    const fechaNacimiento = pacienteResult.recordset[0].FechaNacimiento;

    if (!fechaNacimiento) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message:
          "El paciente no tiene fecha de nacimiento registrada, no se puede calcular la edad",
      });
    }

    // Validar formato de fecha y que no sea una fecha pasada
    const fechaCita = new Date(fechaIngreso);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0); // Resetear a inicio del día para comparar solo fechas

    if (isNaN(fechaCita.getTime())) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Formato de fecha inválido",
      });
    }

    // Validar la hora en formato 24h
    const horaRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
    if (!horaRegex.test(horaIngreso)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Formato de hora inválido. Use formato HH:MM en 24 horas",
      });
    }

    // Extraer hora y minutos
    const [horaIni, minIni] = horaIngreso.split(":").map(Number);

    // 2. Verificar los servicios que se usarán para este módulo
    const servicioInfo = await transaction
      .request()
      .input("idServicio", sql.Int, idServicio).query(`
                SELECT s.IdServicio, s.Nombre, s.IdEspecialidad, e.IdDepartamento
                FROM Servicios s
                INNER JOIN Especialidades e ON s.IdEspecialidad = e.IdEspecialidad
                WHERE s.IdServicio = @idServicio
                AND s.IdServicio IN (145,149,230,312,346,347,358,367,407)
            `);

    if (servicioInfo.recordset.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "El servicio seleccionado no está disponible para citas",
      });
    }

    const idEspecialidad = servicioInfo.recordset[0].IdEspecialidad;

    // 3. Determinar el turno basado en la hora
    let idTurno, horarioInicio, horarioFin;

    if (horaIni >= 8 && horaIni < 12) {
      // Turno de mañana
      idTurno = 36;
      horarioInicio = "08:00";
      horarioFin = "12:00";
    } else if (horaIni >= 14 && horaIni < 18) {
      // Turno de tarde
      idTurno = 38;
      horarioInicio = "14:00";
      horarioFin = "18:00";
    } else {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message:
          "La hora seleccionada no está dentro de los horarios disponibles (8:00-12:00 o 14:00-18:00)",
      });
    }

    // 4. Verificar si el paciente ya tiene una cita para el mismo día y servicio
    const pacienteConCita = await transaction
      .request()
      .input("idPaciente", sql.Int, idPaciente)
      .input("idServicio", sql.Int, idServicio)
      .input("fecha", sql.Date, new Date(fechaIngreso)).query(`
                SELECT COUNT(*) as citasExistentes
                FROM Atenciones a
                WHERE a.IdPaciente = @idPaciente
                AND a.IdServicioIngreso = @idServicio
                AND CONVERT(date, a.FechaIngreso) = CONVERT(date, @fecha)
            `);

    if (pacienteConCita.recordset[0].citasExistentes > 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message:
          "El paciente ya tiene una cita programada para este servicio en la fecha seleccionada",
      });
    }

    // 5. Verificar si existe programación para el médico, servicio y fecha
    const programacionExistente = await transaction
      .request()
      .input("idMedico", sql.Int, idMedico)
      .input("fecha", sql.Date, new Date(fechaIngreso))
      .input("idServicio", sql.Int, idServicio)
      .input("idTurno", sql.Int, idTurno).query(`
                SELECT IdProgramacion, TiempoPromedioAtencion, HoraInicio, HoraFin
                FROM ProgramacionMedica
                WHERE IdMedico = @idMedico
                AND CONVERT(date, Fecha) = CONVERT(date, @fecha)
                AND IdServicio = @idServicio
                AND IdTurno = @idTurno
            `);

    if (programacionExistente.recordset.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message:
          "No existe programación médica para el médico, servicio y fecha seleccionados",
      });
    }

    const idProgramacion = programacionExistente.recordset[0].IdProgramacion;
    const tiempoAtencion =
      programacionExistente.recordset[0].TiempoPromedioAtencion || 15;

    // Verificar si la hora está dentro del rango de la programación
    const programacion = programacionExistente.recordset[0];
    if (
      horaIngreso < programacion.HoraInicio.trim() ||
      horaIngreso > programacion.HoraFin.trim()
    ) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `La hora seleccionada (${horaIngreso}) está fuera del horario de atención del médico (${programacion.HoraInicio.trim()}-${programacion.HoraFin.trim()})`,
      });
    }

    // 6. Verificar si la hora específica ya está ocupada para este y otro servicio
    const citasExistentes = await transaction
      .request()
      .input("IdMedico", sql.Int, idMedico)
      .input("Fecha", sql.Date, new Date(fechaIngreso))
      .execute("CitasSeleccionarXfechaMedico");

    const horaOcupada = citasExistentes.recordset.some(
      (cita) => cita.HoraInicio?.trim() === horaIngreso
    );

    if (horaOcupada) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `La hora ${horaIngreso} ya está reservada. Por favor seleccione otra hora.`,
      });
    }

    // 6.2 Verificar si el paciente tiene otra cita en la misma hora
    const citasPacienteMismaHora = await transaction
      .request()
      .input("HoraInicio", sql.Char(5), horaIngreso)
      .input("IdPaciente", sql.Int, idPaciente)
      .input("Fecha", sql.Date, new Date(fechaIngreso))
      .query(`
        SELECT COUNT(*) as Total
        FROM Citas 
        WHERE HoraInicio = @HoraInicio 
          AND IdPaciente = @IdPaciente 
          AND CONVERT(date, Fecha) = CONVERT(date, @Fecha)
      `);

    if (citasPacienteMismaHora.recordset[0].Total > 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `El paciente ya tiene una cita registrada a las ${horaIngreso} en otro servicio.`,
      });
    }

    // 7. Calcular hora de fin sumando el tiempo de atención
    const fechaHoraInicio = new Date();
    fechaHoraInicio.setHours(horaIni, minIni, 0);

    const fechaHoraFin = new Date(fechaHoraInicio);
    fechaHoraFin.setMinutes(fechaHoraFin.getMinutes() + tiempoAtencion);

    const horaFin = `${fechaHoraFin
      .getHours()
      .toString()
      .padStart(2, "0")}:${fechaHoraFin
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;

    // 8. Calcular edad automáticamente según tipo
    const fechaHoraCita = new Date(fechaIngreso);
    const nacimiento = new Date(fechaNacimiento);

    let years = fechaHoraCita.getFullYear() - nacimiento.getFullYear();
    const mes = fechaHoraCita.getMonth() - nacimiento.getMonth();
    const dia = fechaHoraCita.getDate() - nacimiento.getDate();

    // Si aún no ha cumplido años este año, restamos uno
    if (mes < 0 || (mes === 0 && dia < 0)) {
      years--;
    }

    // Calcular diferencia en meses
    let meses =
      (fechaHoraCita.getFullYear() - nacimiento.getFullYear()) * 12 +
      (fechaHoraCita.getMonth() - nacimiento.getMonth());
    if (fechaHoraCita.getDate() < nacimiento.getDate()) {
      meses--;
    }

    // Calcular diferencia en días
    const diffTime = fechaHoraCita.getTime() - nacimiento.getTime();
    const dias = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    // Determinar tipo de edad y valor automáticamente
    let edad, tipoEdadCalculado;

    if (years > 0) {
      edad = years;
      tipoEdadCalculado = 1; // Años
    } else if (meses > 0) {
      edad = meses;
      tipoEdadCalculado = 2; // Meses
    } else {
      edad = dias;
      tipoEdadCalculado = 3; // Días
    }

    // ID de usuario para registros de auditoria
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
    if (!idUsuarioValido) {
      await transaction.rollback();
      return res.status(401).json({
        success: false,
        message: "No se pudo obtener el ID del usuario autenticado",
      });
    }

    // ID de usuario para registros de auditoria
    // const idUsuarioValido = 738; // ID por defecto para el administrador

    // 9. Crear cuenta de atención usando el SP FacturacionCuentasAtencionAgregar
    const cuentaResult = await transaction
      .request()
      .input("TotalPorPagar", sql.Money, 0.0)
      .input("IdEstado", sql.Int, 1)
      .input("TotalPagado", sql.Money, 0.0)
      .input("TotalAsegurado", sql.Money, 0.0)
      .input("TotalExonerado", sql.Money, 0.0)
      .input("HoraCierre", sql.Char(5), null)
      .input("FechaCierre", sql.DateTime, null)
      .input("HoraApertura", sql.Char(5), horaIngreso)
      .input("FechaApertura", sql.DateTime, fechaHoraLima)
      .input("IdPaciente", sql.Int, idPaciente)
      .input("FechaCreacion", sql.DateTime, fechaHoraLima)
      .input("IdUsuarioAuditoria", sql.Int, idUsuarioValido)
      .output("IdCuentaAtencion", sql.Int)
      .execute("FacturacionCuentasAtencionAgregar");

    const idCuentaAtencion = cuentaResult.output.IdCuentaAtencion;

    // 10. Crear orden de servicio usando el SP FactOrdenServicioAgregar
    const ordenResult = await transaction
      .request()
      .input("IdPuntoCarga", sql.Int, 6)
      .input("IdPaciente", sql.Int, idPaciente)
      .input("IdCuentaAtencion", sql.Int, idCuentaAtencion)
      .input("IdServicioPaciente", sql.Int, idServicio)
      .input("idTipoFinanciamiento", sql.Int, 16)
      .input("idFuenteFinanciamiento", sql.Int, 9)
      .input("FechaCreacion", sql.DateTime, fechaHoraLima)
      .input("IdUsuario", sql.Int, idUsuarioValido)
      .input("FechaDespacho", sql.DateTime, fechaHoraLima)
      .input("IdUsuarioDespacho", sql.Int, idUsuarioValido)
      .input("IdEstadoFacturacion", sql.Int, 1)
      .input("FechaHoraRealizaCpt", sql.DateTime, null)
      .input("IdUsuarioAuditoria", sql.Int, idUsuarioValido)
      .output("IdOrden", sql.Int)
      .execute("FactOrdenServicioAgregar");

    const idOrden = ordenResult.output.IdOrden;

    // 11. Crear facturación de servicio
    await transaction
      .request()
      .input("idOrden", sql.Int, idOrden)
      .input("IdProducto", sql.Int, 4584) // Por defecto para consulta
      .input("Cantidad", sql.Int, 1)
      .input("Precio", sql.Money, 0.0)
      .input("Total", sql.Money, 0.0)
      .input("labConfHIS", sql.VarChar(3), "")
      .input("grupoHIS", sql.Int, 0)
      .input("subGrupoHIS", sql.Int, 0)
      .input("IdUsuarioAuditoria", sql.Int, idUsuarioValido)
      .input("idReceta", sql.Int, null)
      .input("idDiagnostico", sql.Int, null)
      .execute("FacturacionServicioDespachoAgregar");


    // 12. Obtener idSunasaPacienteHistorico si existe (verificar) query
    const sunasaResult = await transaction
      .request()
      .input("idPaciente", sql.Int, idPaciente)
      .execute("SunasaPacientesHistoricosSeleccionarPorIdPaciente");

    const idSunasaPacienteHistorico =
      sunasaResult.recordset.length > 0
        ? sunasaResult.recordset[0].idSunasaPacienteHistorico
        : null;

    // 13. Asignar los Id para el Establecimiento y el Servicio
    // Consultar historial de atenciones del paciente
    const historialAtenciones = await transaction
    .request()
    .input("IdPaciente", sql.Int, idPaciente)
    .query(`
      SELECT FechaIngreso, IdEspecialidadMedico
      FROM Atenciones
      WHERE IdPaciente = @IdPaciente
    `);

    const atenciones = historialAtenciones.recordset;

    const anioCita = fechaHoraCita.getFullYear();

    // Filtrar por atenciones previas en el establecimiento
    const atencionesEstab = atenciones.filter((a) => !!a.FechaIngreso);
    const atendidoEsteAnioEstab = atencionesEstab.some(
      (a) => new Date(a.FechaIngreso).getFullYear() === anioCita
    );

    let IdTipoCondicionALEstab = 1; // Nuevo
    if (atencionesEstab.length > 0) {
      if (atendidoEsteAnioEstab) {
        IdTipoCondicionALEstab = 3; // Continuador
      } else {
        IdTipoCondicionALEstab = 2; // Reingreso
      }
    }

    // Filtrar por atenciones en el mismo servicio (especialidad médica)
    const atencionesServicio = atencionesEstab.filter(
      (a) => a.IdEspecialidadMedico === idEspecialidad
    );
    const atendidoEsteAnioServ = atencionesServicio.some(
      (a) => new Date(a.FechaIngreso).getFullYear() === anioCita
    );

    let IdTipoCondicionAlServicio = 1; // Nuevo
    if (atencionesServicio.length > 0) {
      if (atendidoEsteAnioServ) {
        IdTipoCondicionAlServicio = 3; // Continuador
      } else {
        IdTipoCondicionAlServicio = 2; // Reingreso
      }
    }

    // 13. Registrar la atención usando el SP AtencionesAgregar
    // IMPORTANTE: IdAtencion debe ser igual a IdCuentaAtencion
    const atencionResult = await transaction
      .request()
      .input("HoraIngreso", sql.Char(5), horaIngreso)
      .input("FechaIngreso", sql.DateTime, fechaHoraCita)
      .input("IdTipoServicio", sql.Int, 1) // Consulta externa
      .input("IdPaciente", sql.Int, idPaciente)
      .input("IdTipoCondicionALEstab", sql.Int, IdTipoCondicionALEstab)
      .input("FechaEgresoAdministrativo", sql.DateTime, null)
      .input("IdCamaEgreso", sql.Int, null)
      .input("IdCamaIngreso", sql.Int, null)
      .input("IdServicioEgreso", sql.Int, null)
      .input("IdTipoAlta", sql.Int, null)
      .input("IdCondicionAlta", sql.Int, null)
      .input("IdTipoEdad", sql.Int, tipoEdadCalculado)
      .input("IdOrigenAtencion", sql.Int, 10) // Default DOMICILIO
      .input("IdDestinoAtencion", sql.Int, null)
      .input("HoraEgresoAdministrativo", sql.Char(5), null)
      .input("IdTipoCondicionAlServicio", sql.Int, IdTipoCondicionAlServicio)
      .input("HoraEgreso", sql.Char(5), null)
      .input("FechaEgreso", sql.DateTime, null)
      .input("IdMedicoEgreso", sql.Int, null)
      .input("Edad", sql.Int, edad)
      .input("IdEspecialidadMedico", sql.Int, idEspecialidad)
      .input("IdMedicoIngreso", sql.Int, idMedico)
      .input("IdServicioIngreso", sql.Int, idServicio)
      .input("IdTipoGravedad", sql.Int, null)
      .input("IdCuentaAtencion", sql.Int, idCuentaAtencion) // Debe ser igual al idAtencion
      .input("idFormaPago", sql.Int, 16) // Default ESTRATEGIA
      .input("IdUsuarioAuditoria", sql.Int, idUsuarioValido)
      .input("idFuenteFinanciamiento", sql.Int, 9) // Default ESTRATEGIA
      .input("idEstadoAtencion", sql.Int, 1) // Separada
      .input("EsPacienteExterno", sql.Bit, 0)
      .input("idSunasaPacienteHistorico", sql.Int, idSunasaPacienteHistorico)
      .input("idcondicionMaterna", sql.Int, null)
      .output("IdAtencion", sql.Int)
      .execute("AtencionesAgregar");

    const idAtencion = atencionResult.output.IdAtencion;

    // Verificar que IdAtencion sea igual a IdCuentaAtencion
    if (idAtencion !== idCuentaAtencion) {
      console.warn(
        `Advertencia: IdAtencion (${idAtencion}) no es igual a IdCuentaAtencion (${idCuentaAtencion})`
      );
    }

    // 14. Obtener el IdProducto para la consulta usando el procedimiento almacenado
    let idProductoConsulta = 4584; // Valor por defecto
    try {
      const productoResult = await transaction
        .request()
        .input("IdEspecialidad", sql.Int, idEspecialidad)
        .execute("FactCatalogoServiciosSeleccionarTipoConsulta");

      if (productoResult.recordset.length > 0) {
        idProductoConsulta = productoResult.recordset[0].IdProducto;
      }
    } catch (error) {
      console.warn("Error al obtener IdProducto para consulta:", error.message);
      // Continuamos con el valor por defecto
    }

    // 15. Registrar la cita usando el SP CitasAgregar
    const citaResult = await transaction
      .request()
      .input(
        "HoraSolicitud",
        sql.Char(5),
        new Date().toTimeString().substring(0, 5)
      )
      .input("FechaSolicitud", sql.DateTime, fechaHoraLima)
      .input("IdProducto", sql.Int, idProductoConsulta)
      .input("IdProgramacion", sql.Int, idProgramacion)
      .input("IdServicio", sql.Int, idServicio)
      .input("HoraFin", sql.Char(5), horaFin)
      .input("HoraInicio", sql.Char(5), horaIngreso)
      .input("Fecha", sql.DateTime, fechaHoraCita)
      .input("IdEstadoCita", sql.Int, 1) // Separada
      .input("IdMedico", sql.Int, idMedico)
      .input("IdEspecialidad", sql.Int, idEspecialidad)
      .input("IdAtencion", sql.Int, idAtencion)
      .input("IdPaciente", sql.Int, idPaciente)
      .input("EsCitaAdicional", sql.Bit, 0)
      .input("IdUsuarioAuditoria", sql.Int, idUsuarioValido)
      .output("IdCita", sql.Int)
      .execute("CitasAgregar");

    const idCita = citaResult.output.IdCita;

    // 16. Obtener información detallada para la respuesta
    const infoResult = await transaction
      .request()
      .input("idServicio", sql.Int, idServicio)
      .input("idMedicoAsignado", sql.Int, idMedico).query(`
                SELECT 
                    s.Nombre as NombreServicio,
                    CASE 
                        WHEN m.IdMedico IS NULL THEN NULL
                        ELSE e.ApellidoPaterno + ' ' + e.ApellidoMaterno + ' ' + e.Nombres 
                    END as NombreMedico,
                    t.Codigo as CodigoTurno,
                    t.Descripcion as DescripcionTurno
                FROM Servicios s
                LEFT JOIN Medicos m ON m.IdMedico = @idMedicoAsignado
                LEFT JOIN Empleados e ON m.IdEmpleado = e.IdEmpleado
                LEFT JOIN Turnos t ON t.IdTurno = ${idTurno}
                WHERE s.IdServicio = @idServicio
            `);

    await transaction.commit();

    // 17. Devolver respuesta con los datos relevantes
    res.status(201).json({
      success: true,
      message: "Cita registrada exitosamente",
      idCita,
      idAtencion,
      idCuentaAtencion,
      idOrden,
      paciente: {
        idPaciente,
        nombre: `${pacienteResult.recordset[0].NombrePaciente || ""}`,
        documento: NroDocumento,
      },
      cita: {
        fecha: fechaIngreso,
        horaInicio: horaIngreso,
        horaFin: horaFin,
        tiempoAtencion,
        edad,
        tipoEdad: tipoEdadCalculado,
        servicio: infoResult.recordset[0].NombreServicio,
        medico: infoResult.recordset[0].NombreMedico,
        turno: {
          id: idTurno,
          codigo: infoResult.recordset[0].CodigoTurno,
          descripcion: infoResult.recordset[0].DescripcionTurno,
          horaInicio: horarioInicio,
          horaFin: horarioFin,
        },
      },
      estado: "En espera",
    });
  } catch (error) {
    // Si hay algún error, hacemos rollback de la transacción
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      console.error("Error al hacer rollback:", rollbackError);
    }

    // Errores específicos de SQL Server
    if (error.number === 2627) {
      // Violación de clave única
      return res.status(409).json({
        success: false,
        message: "Conflicto: Ya existe un registro con los mismos datos",
        error: error.message,
      });
    } else if (error.number === 547) {
      // Violación de restricción de clave externa
      return res.status(400).json({
        success: false,
        message:
          "Error de integridad referencial. Alguno de los ID proporcionados no existe",
        error: error.message,
      });
    }

    console.error("Error al registrar cita:", error);
    res.status(500).json({
      success: false,
      message: "Error al registrar la cita",
      error: error.message,
    });
  }
};

// Validar paciente por número de documento
export const validarPaciente = async (req, res) => {
  try {
    const { NroDocumento } = req.query;

    if (!NroDocumento) {
      return res.status(400).json({
        success: false,
        message: "El número de documento es requerido",
      });
    }

    const pool = await Conexion();

    // Ejecutar el SP para obtener los datos del paciente
    const pacienteResult = await pool
      .request()
      .input("NroDocumento", sql.VarChar(50), NroDocumento)
      .query(`
        SELECT 
          pa.IdPaciente,
          TDI.Descripcion as TipoDocumento,
          pa.NroDocumento,
          pa.ApellidoPaterno + ' ' + pa.ApellidoMaterno AS ApellidosPaciente,
          RTRIM(pa.PrimerNombre + ' ' + ISNULL(PA.SegundoNombre, '') + ' ' + ISNULL(PA.TercerNombre,'')) AS NombrePaciente,
          pa.NroHistoriaClinica,
          PA.FechaNacimiento
        FROM Pacientes PA 
        INNER JOIN TiposDocIdentidad TDI on PA.IdDocIdentidad=TDI.IdDocIdentidad
        WHERE NroDocumento=@NroDocumento
      `)

    if (!pacienteResult.recordset || pacienteResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No se encontró al paciente",
        existePaciente: false,
      });
    }

    // Verificar si tiene historia clínica
    if (!pacienteResult.recordset[0].NroHistoriaClinica) {
      return res.json({
        success: true,
        message: "Paciente encontrado pero no tiene Historia Clínica asignada",
        existePaciente: true,
        tieneSHC: false,
        paciente: {
          idPaciente: pacienteResult.recordset[0].IdPaciente,
          tipoDocumento: pacienteResult.recordset[0].TipoDocumento || "DNI",
          nroDocumento: NroDocumento,
          nombre: pacienteResult.recordset[0].NombrePaciente || "",
          apellidos: pacienteResult.recordset[0].ApellidosPaciente || "",
          fechaNacimiento: pacienteResult.recordset[0].FechaNacimiento,
        },
      });
    }

    res.json({
      success: true,
      message: "Paciente encontrado",
      existePaciente: true,
      tieneSHC: true,
      paciente: {
        idPaciente: pacienteResult.recordset[0].IdPaciente,
        tipoDocumento: pacienteResult.recordset[0].TipoDocumento || "DNI",
        nroDocumento: NroDocumento,
        nombre: pacienteResult.recordset[0].NombrePaciente || "",
        apellidos: pacienteResult.recordset[0].ApellidosPaciente || "",
        fechaNacimiento: pacienteResult.recordset[0].FechaNacimiento,
        nroHistoriaClinica: pacienteResult.recordset[0].NroHistoriaClinica,
      },
    });
  } catch (error) {
    console.error("Error al validar paciente:", error);
    res.status(500).json({
      success: false,
      message: "Error al validar paciente",
      error: error.message,
    });
  }
};

// Combinar verificación y obtención de datos de triaje
export const verificarEstadoTriaje = async (req, res) => {
  try {
    const { idAtencion } = req.params;
    
    if (!idAtencion) {
      return res.status(400).json({ success: false, message: "ID de atención requerido" });
    }
    
    // Verificar si hay triaje para esta atención y obtener sus datos
    const poolExterna = await ConexionExterna();
    const triajeResult = await poolExterna.request()
      .input('idAtencion', sql.Int, idAtencion)
      .query(`
        SELECT 
          idAtencion,
          TriajeEdad AS edad,
          TriajePresion AS presion,
          SUBSTRING(TriajePresion, 1, CHARINDEX('/', TriajePresion) - 1) AS presionSistolica,
          SUBSTRING(TriajePresion, CHARINDEX('/', TriajePresion) + 1, LEN(TriajePresion)) AS presionDiastolica,
          TriajeTalla AS talla,
          TriajeTemperatura AS temperatura,
          TriajePeso AS peso,
          TriajePulso AS pulso,
          TriajeFrecRespiratoria AS frecuenciaRespiratoria,
          TriajeFrecCardiaca AS frecuenciaCardiaca,
          TriajeSaturacion AS saturacionOxigeno,
          TriajePerimAbdominal AS perimetroAbdominal
        FROM atencionesCE
        WHERE idAtencion = @idAtencion 
        OR IdAtencion = @idAtencion
      `);
    
    const tieneTriaje = triajeResult.recordset.length > 0;
    const dataTriaje = tieneTriaje ? triajeResult.recordset[0] : null;
    
    // Responder con el estado y los datos (si existen)
    return res.status(200).json({
      success: true,
      tieneTriaje,
      data: dataTriaje
    });
  } catch (error) {
    console.error("Error al verificar estado de triaje:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Error al verificar estado de triaje", 
      error: error.message 
    });
  }
};

//--- TRIAJE ---//

// Registrar o actualizar triaje
export const registrarTriaje = async (req, res) => {
  try {
    const { 
      idAtencion, 
      paciente,
      edad,
      presionSistolica, 
      presionDiastolica, 
      talla, 
      temperatura, 
      peso, 
      pulso, 
      frecuenciaRespiratoria, 
      frecuenciaCardiaca, 
      saturacionOxigeno, 
      perimetroAbdominal,
      editMode
    } = req.body;
    
    // Validar datos mínimos
    if (!idAtencion) {
      return res.status(400).json({ success: false, message: "ID de atención es requerido" });
    }
    
    // Formatear valores - Construir presión si ambos valores están presentes
    const presion = presionSistolica && presionDiastolica ? `${presionSistolica}/${presionDiastolica}` : null;
    
    // Obtener el ID del usuario desde el token (ajustar según tu implementación de auth)
    const idUsuario = req.usuario?.id || 1; // Valor por defecto si no hay autenticación

    const poolExterna = await ConexionExterna();
    
    // PASO 1: Verificar si existe registro en atencionesCE para esta atención
    const existeRegistro = await poolExterna.request()
      .input('idAtencion', sql.Int, idAtencion)
      .query(`
        SELECT TOP 1 idAtencion 
        FROM atencionesCE 
        WHERE idAtencion = @idAtencion
      `);
      
    // Obtener también datos de la cita original para referencias
    const pool = await Conexion();
    const dataCita = await pool.request()
      .input('idAtencion', sql.Int, idAtencion)
      .query(`
        SELECT 
          a.IdAtencion,
          a.Edad,
          pa.NroHistoriaClinica,
          e.ApellidoPaterno + ' ' + e.ApellidoMaterno + ' ' + e.Nombres AS CitaMedico,
          s.IdServicio AS CitaIdServicio,
          s.Nombre AS CitaServicio
        FROM Atenciones a
        INNER JOIN Citas c ON a.IdAtencion = c.IdAtencion
        INNER JOIN Pacientes pa ON c.IdPaciente = pa.IdPaciente
        INNER JOIN ProgramacionMedica p ON c.IdProgramacion = p.IdProgramacion
        INNER JOIN Servicios s ON p.IdServicio = s.IdServicio
        INNER JOIN Medicos m ON p.IdMedico = m.IdMedico
        INNER JOIN Empleados e ON m.IdEmpleado = e.IdEmpleado
        WHERE a.IdAtencion = @idAtencion
      `);
      
    const datosCita = dataCita.recordset.length > 0 ? dataCita.recordset[0] : {};
    
    // Formatear fecha actual para registro
    const fechaActual = new Date();
    
    if (existeRegistro.recordset.length === 0) {
      // INSERTAR: No existe registro, crear uno nuevo
      await poolExterna.request()
        .input('idAtencion', sql.Int, idAtencion)
        .input('nroHistoriaClinica', sql.Int, datosCita.NroHistoriaClinica || null)
        // .input('citaMedico', sql.Int, datosCita.CitaMedico || null)
        // .input('citaServicio', sql.Int, datosCita.CitaServicio || null)
        // .input('citaIdServicio', sql.Int, datosCita.CitaIdServicio || null)
        .input('triajeEdad', sql.Int, edad || datosCita.Edad || null)
        .input('triajePresion', sql.VarChar, presion)
        .input('triajeTalla', sql.Int, talla || null)
        .input('triajeTemperatura', sql.Int, temperatura || null)
        .input('triajePeso', sql.Int, peso || null)
        .input('triajeFecha', sql.Date, fechaActual)
        .input('triajeIdUsuario', sql.Int, idUsuario)
        .input('triajePulso', sql.Int, pulso || null)
        .input('triajeFrecRespiratoria', sql.Int, frecuenciaRespiratoria || null)
        .input('triajeFrecCardiaca', sql.Int, frecuenciaCardiaca || null)
        .input('TriajeOrigen', sql.Int, 1)
        .input('triajeSaturacion', sql.Int, saturacionOxigeno || null)
        .input('triajePerimAbdominal', sql.Int, perimetroAbdominal || null)
        .query(`
          INSERT INTO atencionesCE (
            idAtencion, 
            NroHistoriaClinica,
            TriajeEdad, 
            TriajePresion, 
            TriajeTalla, 
            TriajeTemperatura, 
            TriajePeso, 
            TriajeFecha, 
            TriajeIdUsuario,
            TriajePulso,
            TriajeFrecRespiratoria,
            TriajeFrecCardiaca,
            TriajeOrigen,
            TriajeSaturacion,
            TriajePerimAbdominal
          )
          VALUES (
            @idAtencion,
            @nroHistoriaClinica,
            @triajeEdad,
            @triajePresion,
            @triajeTalla,
            @triajeTemperatura,
            @triajePeso,
            @triajeFecha,
            @triajeIdUsuario,
            @triajePulso,
            @triajeFrecRespiratoria,
            @triajeFrecCardiaca,
            @TriajeOrigen,
            @triajeSaturacion,
            @triajePerimAbdominal
          )
        `);
        
      return res.status(201).json({
        success: true,
        message: "El triaje ha sido registrado correctamente y la lista ha sido actualizada"
      });
      
    } else {
      // ACTUALIZAR: Ya existe un registro, actualizar los campos de triaje
      await poolExterna.request()
        .input('idAtencion', sql.Int, idAtencion)
        .input('triajeEdad', sql.Int, edad || null)
        .input('triajePresion', sql.VarChar, presion)
        .input('triajeTalla', sql.Int, talla || null)
        .input('triajeTemperatura', sql.Int, temperatura || null)
        .input('triajePeso', sql.Int, peso || null)
        .input('triajeFecha', sql.Date, fechaActual)
        .input('triajeIdUsuario', sql.Int, idUsuario)
        .input('triajePulso', sql.Int, pulso || null)
        .input('triajeFrecRespiratoria', sql.Int, frecuenciaRespiratoria || null)
        .input('triajeFrecCardiaca', sql.Int, frecuenciaCardiaca || null)
        .input('triajeSaturacion', sql.Int, saturacionOxigeno || null)
        .input('triajePerimAbdominal', sql.Int, perimetroAbdominal || null)
        .query(`
          UPDATE atencionesCE
          SET 
            TriajeEdad = @triajeEdad,
            TriajePresion = @triajePresion,
            TriajeTalla = @triajeTalla,
            TriajeTemperatura = @triajeTemperatura,
            TriajePeso = @triajePeso,
            TriajeFecha = @triajeFecha,
            TriajeIdUsuario = @triajeIdUsuario,
            TriajePulso = @triajePulso,
            TriajeFrecRespiratoria = @triajeFrecRespiratoria,
            TriajeFrecCardiaca = @triajeFrecCardiaca,
            TriajeSaturacion = @triajeSaturacion,
            TriajePerimAbdominal = @triajePerimAbdominal
          WHERE idAtencion = @idAtencion
        `);
        
      return res.status(200).json({
        success: true,
        message: "Triaje actualizado correctamente"
      });
    }
  } catch (error) {
    console.error("Error al registrar triaje:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Error al registrar triaje", 
      error: error.message 
    });
  }
};

