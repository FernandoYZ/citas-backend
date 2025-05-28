// citasParticular.controller.js
import { Conexion } from "../../../config/database.js";
import { obtenerFechaHoraLima } from "../../../utils/fecha.js";
import sql from "mssql";

const fechaHoraLima = obtenerFechaHoraLima();

let resultadoVerificacion = null;

const tiempo = 10000 // 10 segundos

const limpiarRegistrosCita = async (idCita, idAtencion, idCuentaAtencion, idOrden, idOrdenPago) => {
  const transaction = new sql.Transaction(await Conexion());
  
  try {
    await transaction.begin();
        
    // 1. Eliminar de Citas
    await transaction
      .request()
      .input("IdCita", sql.Int, idCita)
      .query("DELETE FROM Citas WHERE IdCita = @IdCita");
    
    // 2. Eliminar de Atenciones
    await transaction
      .request()
      .input("IdAtencion", sql.Int, idAtencion)
      .query("DELETE FROM Atenciones WHERE IdAtencion = @IdAtencion");
    
    // 3. Eliminar de FacturacionServicioDespacho
    await transaction
      .request()
      .input("idOrden", sql.Int, idOrden)
      .query("DELETE FROM FacturacionServicioDespacho WHERE idOrden = @idOrden");
      
    // 4.5. Eliminar de FacturacionServicioPagos
    await transaction
      .request()
      .input('idOrdenPago', sql.Int, idOrdenPago)
      .query('DELETE FROM FacturacionServicioPagos WHERE idOrdenPago = @idOrdenPago');

    // 4. Eliminar de FactOrdenServicioPagos
    await transaction
      .request()
      .input("idOrden", sql.Int, idOrden)
      .query("DELETE FROM FactOrdenServicioPagos WHERE idOrden = @idOrden");

    
    // 5. Eliminar de FactOrdenServicio
    await transaction
      .request()
      .input("IdOrden", sql.Int, idOrden)
      .query("DELETE FROM FactOrdenServicio WHERE IdOrden = @IdOrden");
    
    // 6. Eliminar de FacturacionCuentasAtencion
    await transaction
      .request()
      .input("IdCuentaAtencion", sql.Int, idCuentaAtencion)
      .query("DELETE FROM FacturacionCuentasAtencion WHERE IdCuentaAtencion = @IdCuentaAtencion");
    
    await transaction.commit();
    
    return {
      success: true,
      message: "Registros eliminados correctamente debido a falta de pago"
    };
    
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      console.error("Error al hacer rollback en limpieza:", rollbackError);
    }
    
    throw error;
  }
};


// Función para verificar estado de pago
const verificarEstadoPago = async (idOrden) => {
  try {
    const connection = await Conexion();
    const result = await connection
      .request()
      .input("idOrden", sql.Int, idOrden)
      .query(`
        SELECT IdEstadoFacturacion 
        FROM FactOrdenServicioPagos 
        WHERE idOrden = @idOrden
      `);
    
    return result.recordset.length > 0 ? result.recordset[0].IdEstadoFacturacion : null;
  } catch (error) {
    console.error("Error al verificar estado de pago:", error);
    return null;
  }
};


// Registrar una nueva cita PARTICULAR
export const registrarCitaParticular = async (req, res) => {
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
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0); // resetear a 00:00 hora local

    // Parsear fechaIngreso como fecha local (sin zona horaria UTC)
    const [año, mesStr, day] = fechaIngreso.split("-").map(Number);
    const fechaCita = new Date(año, mesStr - 1, day);

    if (isNaN(fechaCita.getTime())) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Formato de fecha inválido",
      });
    }

    if (fechaCita < hoy) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `No se puede registrar una cita en una fecha pasada (${fechaIngreso}). Solo se permiten citas para hoy o fechas futuras.`,
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

    // 2. Verificar el servicio y obtener su especialidad (VALIDAR QUE NO SEA ESTRATEGIA)
    const servicioInfo = await transaction
      .request()
      .input("idServicio", sql.Int, idServicio).query(`
        SELECT s.IdServicio, s.Nombre, s.IdEspecialidad, e.IdDepartamento
        FROM Servicios s
        INNER JOIN Especialidades e ON s.IdEspecialidad = e.IdEspecialidad
        WHERE s.IdServicio = @idServicio
        AND s.IdServicio NOT IN (145,149,230,312,346,347,358,367,407)
      `);

    if (servicioInfo.recordset.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "El servicio seleccionado no está disponible para citas particulares o es un servicio de estrategia",
      });
    }

    const idEspecialidad = servicioInfo.recordset[0].IdEspecialidad;

    // 3. Obtener el IdProducto y precio para la especialidad
    const especialidadCEInfo = await transaction
      .request()
      .input("idEspecialidad", sql.Int, idEspecialidad)
      .query(`
        SELECT IdProductoConsulta
        FROM EspecialidadCE 
        WHERE IdEspecialidad = @idEspecialidad
      `);

    if (especialidadCEInfo.recordset.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "No se encontró configuración de productos para esta especialidad",
      });
    }

    const idProductoConsulta = especialidadCEInfo.recordset[0].IdProductoConsulta;

    // 4. Obtener el precio del producto para tipo de financiamiento PARTICULAR (1)
    const precioInfo = await transaction
      .request()
      .input("idProducto", sql.Int, idProductoConsulta)
      .input("idTipoFinanciamiento", sql.Int, 1) // PARTICULAR
      .query(`
        SELECT PrecioUnitario
        FROM FactCatalogoServiciosHosp 
        WHERE IdProducto = @idProducto 
        AND IdTipoFinanciamiento = @idTipoFinanciamiento
        AND Activo = 1
      `);

    if (precioInfo.recordset.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "No se encontró precio configurado para esta especialidad en modalidad particular",
      });
    }

    const precioUnitario = precioInfo.recordset[0].PrecioUnitario;
    const totalPagar = precioUnitario * 1; // Cantidad por defecto es 1

    // 5. Determinar el turno basado en la hora
    let idTurno, horarioInicio, horarioFin;

    if (horaIni >= 7 && horaIni < 13) {
      // Turno de mañana
      idTurno = 36;
      horarioInicio = "07:00";
      horarioFin = "13:00";
    } else if (horaIni >= 14 && horaIni < 19) {
      // Turno de tarde
      idTurno = 38;
      horarioInicio = "14:00";
      horarioFin = "19:00";
    } else {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message:
          "La hora seleccionada no está dentro de los horarios disponibles (7:00 - 13:00 o 14:00 - 19:00)",
      });
    }

    // 6. Verificar si el paciente ya tiene una cita para el mismo día y servicio
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

    // 7. Verificar si existe programación para el médico, servicio y fecha
    const programacionExistente = await transaction
      .request()
      .input("idMedico", sql.Int, idMedico)
      .input("fecha", sql.Date, new Date(fechaIngreso))
      .input("idServicio", sql.Int, idServicio)
      .input("horaIngreso", sql.Char(5), horaIngreso) 
      .query(`
        SELECT IdProgramacion, TiempoPromedioAtencion, HoraInicio, HoraFin
        FROM ProgramacionMedica
        WHERE IdMedico = @idMedico
          AND CONVERT(date, Fecha) = CONVERT(date, @fecha)
          AND IdServicio = @idServicio
          AND @horaIngreso >= HoraInicio
          AND @horaIngreso <= HoraFin
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

    // 8. Verificar si la hora específica ya está ocupada para este y otro servicio
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

    // 9. Verificar si el paciente tiene otra cita en la misma hora
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

    // 10. Calcular hora de fin sumando el tiempo de atención
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

    // 11. Calcular edad automáticamente según tipo
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
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      await transaction.rollback();
      return res.status(401).json({
        success: false,
        message: "Token de autenticación no proporcionado",
      });
    }

    const idUsuarioValido = req.usuario.id || 738;
    if (!idUsuarioValido) {
      await transaction.rollback();
      return res.status(401).json({
        success: false,
        message: "No se pudo obtener el ID del usuario autenticado",
      });
    }

    // 12. Crear cuenta de atención usando el SP FacturacionCuentasAtencionAgregar
    const cuentaResult = await transaction
      .request()
      .input("TotalPorPagar", sql.Money, null) // totalPagar - null
      .input("IdEstado", sql.Int, 1)
      .input("TotalPagado", null)
      .input("TotalAsegurado", null)
      .input("TotalExonerado", null)
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

    // 13. Crear orden de servicio usando el SP FactOrdenServicioAgregar (TIPO PARTICULAR)
    const ordenResult = await transaction
      .request()
      .input("IdPuntoCarga", sql.Int, 6)
      .input("IdPaciente", sql.Int, idPaciente)
      .input("IdCuentaAtencion", sql.Int, idCuentaAtencion)
      .input("IdServicioPaciente", sql.Int, idServicio)
      .input("idTipoFinanciamiento", sql.Int, 1) // PARTICULAR (en lugar de 16)
      .input("idFuenteFinanciamiento", sql.Int, 5) // PARTICULAR (en lugar de 9)
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

    // 14. NUEVA TABLA: Crear registro en FactOrdenServicioPagos
    await transaction
      .request()
      .input("idComprobantePago", sql.Int, null)
      .input("idOrden", sql.Int, idOrden)
      .input("ImporteExonerado", sql.Money, 0.0)
      .input("FechaCreacion", sql.DateTime, fechaHoraLima)
      .input("IdUsuario", sql.Int, idUsuarioValido)
      .input("IdEstadoFacturacion", sql.Int, 1)
      .input("idUsuarioExonera", sql.Int, 0)
      .query(`
        INSERT INTO FactOrdenServicioPagos (
          idComprobantePago,
          idOrden,
          ImporteExonerado,
          FechaCreacion,
          IdUsuario,
          IdEstadoFacturacion,
          idUsuarioExonera
        )
        VALUES (
          @idComprobantePago,
          @idOrden,
          @ImporteExonerado,
          @FechaCreacion,
          @IdUsuario,
          @IdEstadoFacturacion,
          @idUsuarioExonera
        )
      `);

    // 15. Crear facturación de servicio (CON PRECIO PARA PARTICULAR)
    await transaction
      .request()
      .input("idOrden", sql.Int, idOrden)
      .input("IdProducto", sql.Int, idProductoConsulta) // Producto específico de la especialidad
      .input("Cantidad", sql.Int, 1)
      .input("Precio", sql.Money, precioUnitario) // Precio real (no 0.0)
      .input("Total", sql.Money, totalPagar) // Total calculado (no 0.0)
      .input("labConfHIS", sql.VarChar(3), "")
      .input("grupoHIS", sql.Int, 0)
      .input("subGrupoHIS", sql.Int, 0)
      .input("IdUsuarioAuditoria", sql.Int, idUsuarioValido)
      .input("idReceta", sql.Int, null)
      .input("idDiagnostico", sql.Int, null)
      .execute("FacturacionServicioDespachoAgregar");

    // 16. Obtener idSunasaPacienteHistorico si existe
    const sunasaResult = await transaction
      .request()
      .input("idPaciente", sql.Int, idPaciente)
      .execute("SunasaPacientesHistoricosSeleccionarPorIdPaciente");

    const idSunasaPacienteHistorico =
      sunasaResult.recordset.length > 0
        ? sunasaResult.recordset[0].idSunasaPacienteHistorico
        : null;

    // 17. Asignar los Id para el Establecimiento y el Servicio
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

    // 18. Registrar la atención usando el SP AtencionesAgregar
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
      .input("IdCuentaAtencion", sql.Int, idCuentaAtencion)
      .input("idFormaPago", sql.Int, 1) // PARTICULAR (en lugar de 16)
      .input("IdUsuarioAuditoria", sql.Int, idUsuarioValido)
      .input("idFuenteFinanciamiento", sql.Int, 5) // PARTICULAR (en lugar de 9)
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

    // 19. Registrar la cita usando el SP CitasAgregar
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
    

    // 20. Obtener información detallada para la respuesta
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

    // 21. Devolver respuesta con los datos relevantes
    res.status(201).json({
      success: true,
      message: "Cita PARTICULAR registrada exitosamente",
      tipoCita: "PARTICULAR",
      idCita,
      idAtencion,
      idCuentaAtencion,
      idOrden,
      precioConsulta: precioUnitario,
      totalPagar: totalPagar,
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
      facturacion: {
        tipoFinanciamiento: "PARTICULAR",
        fuenteFinanciamiento: 5,
        idProducto: idProductoConsulta,
        precio: precioUnitario,
        total: totalPagar,
        estadoPago: "PENDIENTE"
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

    console.error("Error al registrar cita particular:", error);
    res.status(500).json({
      success: false,
      message: "Error al registrar la cita particular",
      error: error.message,
    });
  }
};

// Registrar una nueva cita PARTICULAR
export const registrarCitaParticularConVerificacion  = async (req, res) => {
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
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0); // resetear a 00:00 hora local

    // Parsear fechaIngreso como fecha local (sin zona horaria UTC)
    const [año, mesStr, day] = fechaIngreso.split("-").map(Number);
    const fechaCita = new Date(año, mesStr - 1, day);

    if (isNaN(fechaCita.getTime())) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Formato de fecha inválido",
      });
    }

    if (fechaCita < hoy) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `No se puede registrar una cita en una fecha pasada (${fechaIngreso}). Solo se permiten citas para hoy o fechas futuras.`,
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

    // 2. Verificar el servicio y obtener su especialidad (VALIDAR QUE NO SEA ESTRATEGIA)
    const servicioInfo = await transaction
      .request()
      .input("idServicio", sql.Int, idServicio).query(`
        SELECT s.IdServicio, s.Nombre, s.IdEspecialidad, e.IdDepartamento
        FROM Servicios s
        INNER JOIN Especialidades e ON s.IdEspecialidad = e.IdEspecialidad
        WHERE s.IdServicio = @idServicio
        AND s.IdServicio NOT IN (145,149,230,312,346,347,358,367,407)
      `);

    if (servicioInfo.recordset.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "El servicio seleccionado no está disponible para citas particulares o es un servicio de estrategia",
      });
    }

    const idEspecialidad = servicioInfo.recordset[0].IdEspecialidad;

    // 3. Obtener el IdProducto y precio para la especialidad
    const especialidadCEInfo = await transaction
      .request()
      .input("idEspecialidad", sql.Int, idEspecialidad)
      .query(`
        SELECT IdProductoConsulta
        FROM EspecialidadCE 
        WHERE IdEspecialidad = @idEspecialidad
      `);

    if (especialidadCEInfo.recordset.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "No se encontró configuración de productos para esta especialidad",
      });
    }

    const idProductoConsulta = especialidadCEInfo.recordset[0].IdProductoConsulta;

    // 4. Obtener el precio del producto para tipo de financiamiento PARTICULAR (1)
    const precioInfo = await transaction
      .request()
      .input("idProducto", sql.Int, idProductoConsulta)
      .input("idTipoFinanciamiento", sql.Int, 1) // PARTICULAR
      .query(`
        SELECT PrecioUnitario
        FROM FactCatalogoServiciosHosp 
        WHERE IdProducto = @idProducto 
        AND IdTipoFinanciamiento = @idTipoFinanciamiento
        AND Activo = 1
      `);

    if (precioInfo.recordset.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "No se encontró precio configurado para esta especialidad en modalidad particular",
      });
    }

    const precioUnitario = precioInfo.recordset[0].PrecioUnitario;
    const totalPagar = precioUnitario * 1; // Cantidad por defecto es 1

    // 5. Determinar el turno basado en la hora
    let idTurno, horarioInicio, horarioFin;

    if (horaIni >= 7 && horaIni < 13) {
      // Turno de mañana
      idTurno = 36;
      horarioInicio = "07:00";
      horarioFin = "13:00";
    } else if (horaIni >= 14 && horaIni < 19) {
      // Turno de tarde
      idTurno = 38;
      horarioInicio = "14:00";
      horarioFin = "19:00";
    } else {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message:
          "La hora seleccionada no está dentro de los horarios disponibles (7:00 - 13:00 o 14:00 - 19:00)",
      });
    }

    // 6. Verificar si el paciente ya tiene una cita para el mismo día y servicio
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

    // 7. Verificar si existe programación para el médico, servicio y fecha
    const programacionExistente = await transaction
      .request()
      .input("idMedico", sql.Int, idMedico)
      .input("fecha", sql.Date, new Date(fechaIngreso))
      .input("idServicio", sql.Int, idServicio)
      .input("horaIngreso", sql.Char(5), horaIngreso) 
      .query(`
        SELECT IdProgramacion, TiempoPromedioAtencion, HoraInicio, HoraFin
        FROM ProgramacionMedica
        WHERE IdMedico = @idMedico
          AND CONVERT(date, Fecha) = CONVERT(date, @fecha)
          AND IdServicio = @idServicio
          AND @horaIngreso >= HoraInicio
          AND @horaIngreso <= HoraFin
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

    // 8. Verificar si la hora específica ya está ocupada para este y otro servicio
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

    // 9. Verificar si el paciente tiene otra cita en la misma hora
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

    // 10. Calcular hora de fin sumando el tiempo de atención
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

    // 11. Calcular edad automáticamente según tipo
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
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      await transaction.rollback();
      return res.status(401).json({
        success: false,
        message: "Token de autenticación no proporcionado",
      });
    }

    const idUsuarioValido = req.usuario.id || 738;
    if (!idUsuarioValido) {
      await transaction.rollback();
      return res.status(401).json({
        success: false,
        message: "No se pudo obtener el ID del usuario autenticado",
      });
    }

    // 12. Crear cuenta de atención usando el SP FacturacionCuentasAtencionAgregar
    const cuentaResult = await transaction
      .request()
      .input("TotalPorPagar", sql.Money, null) // totalPagar - null
      .input("IdEstado", sql.Int, 1)
      .input("TotalPagado", null)
      .input("TotalAsegurado", null)
      .input("TotalExonerado", null)
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

    // 13. Crear orden de servicio usando el SP FactOrdenServicioAgregar (TIPO PARTICULAR)
    const ordenResult = await transaction
      .request()
      .input("IdPuntoCarga", sql.Int, 6)
      .input("IdPaciente", sql.Int, idPaciente)
      .input("IdCuentaAtencion", sql.Int, idCuentaAtencion)
      .input("IdServicioPaciente", sql.Int, idServicio)
      .input("idTipoFinanciamiento", sql.Int, 1)
      .input("idFuenteFinanciamiento", sql.Int, 5) 
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

    // 14. NUEVA TABLA: Crear registro en FactOrdenServicioPagos
    const factOrdenServicioPagosResult = await transaction
      .request()
      .input("idComprobantePago", sql.Int, null)
      .input("idOrden", sql.Int, idOrden)
      .input("ImporteExonerado", sql.Money, 0.0)
      .input("FechaCreacion", sql.DateTime, fechaHoraLima)
      .input("IdUsuario", sql.Int, idUsuarioValido)
      .input("IdEstadoFacturacion", sql.Int, 1)
      .input("idUsuarioExonera", sql.Int, 0)
      .output("idOrdenPago", sql.Int) 
      .query(`
        INSERT INTO FactOrdenServicioPagos (
          idComprobantePago,
          idOrden,
          ImporteExonerado,
          FechaCreacion,
          IdUsuario,
          IdEstadoFacturacion,
          idUsuarioExonera
        )
        OUTPUT INSERTED.idOrdenPago
        VALUES (
          @idComprobantePago,
          @idOrden,
          @ImporteExonerado,
          @FechaCreacion,
          @IdUsuario,
          @IdEstadoFacturacion,
          @idUsuarioExonera
        )
      `);
    
    const idOrdenPago = factOrdenServicioPagosResult.recordset[0].idOrdenPago;

    // 14.5. Crear registro en FacturacionServicioPagos
    await transaction 
      .request()
      .input('idOrdenPago', sql.Int, idOrdenPago)
      .input('idProducto', sql.Int, idProductoConsulta)
      .input('Cantidad', sql.Int, 1)
      .input('Precio', sql.Money, precioUnitario)
      .input('Total', sql.Money, totalPagar)
      .query(`
        INSERT INTO FacturacionServicioPagos (
          idOrdenPago,
          idProducto,
          Cantidad,
          Precio,
          Total
        ) VALUES (
          @idOrdenPago,
          @idProducto,
          @Cantidad,
          @Precio,
          @Total
        )  
      `);

    // 15. Crear facturación de servicio (CON PRECIO PARA PARTICULAR)
    await transaction
      .request()
      .input("idOrden", sql.Int, idOrden)
      .input("IdProducto", sql.Int, idProductoConsulta) // Producto específico de la especialidad
      .input("Cantidad", sql.Int, 1)
      .input("Precio", sql.Money, precioUnitario) // Precio real (no 0.0)
      .input("Total", sql.Money, totalPagar) // Total calculado (no 0.0)
      .input("labConfHIS", sql.VarChar(3), "")
      .input("grupoHIS", sql.Int, 0)
      .input("subGrupoHIS", sql.Int, 0)
      .input("IdUsuarioAuditoria", sql.Int, idUsuarioValido)
      .input("idReceta", sql.Int, null)
      .input("idDiagnostico", sql.Int, null)
      .execute("FacturacionServicioDespachoAgregar");

    // 16. Obtener idSunasaPacienteHistorico si existe
    const sunasaResult = await transaction
      .request()
      .input("idPaciente", sql.Int, idPaciente)
      .execute("SunasaPacientesHistoricosSeleccionarPorIdPaciente");

    const idSunasaPacienteHistorico =
      sunasaResult.recordset.length > 0
        ? sunasaResult.recordset[0].idSunasaPacienteHistorico
        : null;

    // 17. Asignar los Id para el Establecimiento y el Servicio
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

    // 18. Registrar la atención usando el SP AtencionesAgregar
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
      .input("IdCuentaAtencion", sql.Int, idCuentaAtencion)
      .input("idFormaPago", sql.Int, 1) // PARTICULAR (en lugar de 16)
      .input("IdUsuarioAuditoria", sql.Int, idUsuarioValido)
      .input("idFuenteFinanciamiento", sql.Int, 5) // PARTICULAR (en lugar de 9)
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

    // 19. Registrar la cita usando el SP CitasAgregar
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

    setTimeout(async () => {
      try {
        const estadoActual = await verificarEstadoPago(idOrden);
        
        resultadoVerificacion = {
          timestamp: new Date().toISOString(),
          idOrden: idOrden,
          estadoEncontrado: estadoActual,
          accionTomada: null
        };
        
        // Si el estado no es 4 (PAGADO), eliminar registros
        if (estadoActual !== 4) {
          const resultadoLimpieza = await limpiarRegistrosCita(
            idCita, 
            idAtencion, 
            idCuentaAtencion, 
            idOrden,
            idOrdenPago 
          );
          
          resultadoVerificacion.accionTomada = "ELIMINADO";
          resultadoVerificacion.detalles = resultadoLimpieza;
          
          console.log(`Cita ${idCita} eliminada por falta de pago. Estado encontrado: ${estadoActual}`);
        } else {
          resultadoVerificacion.accionTomada = "CONSERVADO";
          resultadoVerificacion.detalles = "Pago completado correctamente";
          
          console.log(`Cita ${idCita} conservada. Pago completado.`);
        }
        
      } catch (error) {
        resultadoVerificacion = {
          timestamp: new Date().toISOString(),
          idOrden: idOrden,
          error: error.message,
          accionTomada: "ERROR"
        };
        
        console.error("Error en verificación automática:", error);
      }
    }, tiempo); // tiempo para verificar el pago
    

    // 20. Obtener información detallada para la respuesta
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

    // 21. Devolver respuesta con los datos relevantes
    res.status(201).json({
      success: true,
      message: "Cita PARTICULAR registrada exitosamente. Verificación de pago programada.",
      tipoCita: "PARTICULAR",
      idCita,
      idAtencion,
      idCuentaAtencion,
      idOrden,
      idOrdenPago,
      advertencia: `La cita será eliminada automáticamente si no se completa el pago en 1 hora.`,
      precioConsulta: precioUnitario,
      totalPagar: totalPagar,
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
      facturacion: {
        tipoFinanciamiento: "PARTICULAR",
        fuenteFinanciamiento: 5,
        idProducto: idProductoConsulta,
        precio: precioUnitario,
        total: totalPagar,
        estadoPago: "PENDIENTE"
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

    console.error("Error al registrar cita particular:", error);
    res.status(500).json({
      success: false,
      message: "Error al registrar la cita particular",
      error: error.message,
    });
  }
};

// Para mostrar en el select las Especialidades disponibles
export const selectEspecialidad = async (req, res) => {
  try {
    const { fecha } = req.query;
    if (!fecha) {
      return res.status(400).json({
        message: "Se requiere la fecha",
        required: ["Fecha"]
      });
    }

    const pool = await Conexion();

    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token de autenticación no proporcionado",
      });
    }

    const { id: idUsuarioValido, isMedico, idMedico, roles } = req.usuario || {};

    // Roles específicos
    const ROLES = {
      ADMIN: 1,
      RECEPCION: 195,
      MEDICO_CE: 149,
      PROGRAMAS: 154
    };

    const esAdmin = Array.isArray(roles) && roles.includes(ROLES.ADMIN);
    const esRecepcion = Array.isArray(roles) && roles.includes(ROLES.RECEPCION);
    const esMedicoCE = Array.isArray(roles) && roles.includes(ROLES.MEDICO_CE);
    const esProgramas = Array.isArray(roles) && roles.includes(ROLES.PROGRAMAS);
    
    const especialidadesPermitidas = [145, 149, 230, 312, 346, 347, 358, 367, 407];

    // Comienza la consulta base
    let queryBase = `
      SELECT DISTINCT 
        PM.IdServicio, 
        LOWER(S.Nombre) AS Nombre
      FROM ProgramacionMedica PM
      INNER JOIN Servicios S ON PM.IdServicio = S.IdServicio
      INNER JOIN Medicos M ON PM.IdMedico = M.IdMedico
      INNER JOIN Empleados E ON M.IdEmpleado = E.IdEmpleado
      WHERE PM.Fecha = @fecha
        AND PM.IdServicio NOT IN (${especialidadesPermitidas.join(',')})
    `;

    // Filtros según el tipo de usuario
    
    // Los médicos CE, admins y recepcionistas pueden ver todas las especialidades
    if (esAdmin || esRecepcion || esMedicoCE) {
      // No añadir filtros adicionales, pueden ver todo
      console.log("Usuario con acceso total a especialidades");
    } 
    // Los médicos de programas solo ven sus propias especialidades y atenciones
    else if (esProgramas && idMedico) {
      console.log("Médico de programas: filtrando por idMedico", idMedico);
      queryBase += ` AND M.IdMedico = @idMedico`;
    }
    // Cualquier otro tipo de médico ve sus especialidades pero no necesariamente solo sus atenciones
    else if (isMedico && idUsuarioValido) {
      console.log("Médico: filtrando por especialidades asociadas al empleado", idUsuarioValido);
      queryBase += ` AND E.IdEmpleado = @idUsuarioValido`;
    } 
    // Usuarios sin permisos especiales
    else if (!isMedico && !esAdmin && !esRecepcion) {
      return res.status(403).json({
        success: false,
        message: "No tienes permisos para ver estas especialidades",
      });
    }

    // Filtro adicional si se especifican especialidades en el middleware
    if (req.filtroEspecialidades && Array.isArray(req.filtroEspecialidades) && req.filtroEspecialidades.length > 0) {
      const idsFiltrados = req.filtroEspecialidades.filter(id => !isNaN(id)).join(',');
      queryBase += ` AND PM.IdServicio IN (${idsFiltrados})`;
    }

    queryBase += ` ORDER BY Nombre`;

    // Crear request y añadir parámetros
    const request = pool.request()
      .input('fecha', sql.Date, fecha)
      .input('idUsuarioValido', sql.Int, idUsuarioValido);
      
    // Añadir idMedico solo si se está usando en la consulta
    if (esProgramas && idMedico) {
      request.input('idMedico', sql.Int, idMedico);
    }
      
    const result = await request.query(queryBase);

    // Verificar resultados
    if (result.recordset.length === 0) {
      console.log("No se encontraron especialidades para los criterios de filtro");
    }

    res.status(200).json(result.recordset);
    
  } catch (error) {
    console.error("Error al verificar disponibilidad:", error);
    res.status(500).json({
      message: "Error al mostrar la relación de Especialidades",
      error: error.message
    });
  }
};


// Función para consultar el resultado de la verificación (para testing)
export const consultarResultadoVerificacion = async (req, res) => {
  res.json({
    success: true,
    resultado: resultadoVerificacion
  });
};

// Función para resetear la variable de verificación (para testing)
export const resetearVerificacion = async (req, res) => {
  resultadoVerificacion = null;
  res.json({
    success: true,
    message: "Variable de verificación reseteada"
  });
};