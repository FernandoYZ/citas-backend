// src/modules/atenciones/atenciones.controller.js
import { Conexion, ConexionExterna } from "../../../config/database.js";
import sql from "mssql";

const pol = await Conexion();

// Eliminar diagnóstico
export const eliminarAtencionesDiagnostico = async (req, res) => {
  try {
    // Validar autenticación
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token de autenticación no proporcionado",
      });
    }

    const idUsuario = req.usuario?.id;

    // Obtener datos de Trabajor
    const Empleado = await pol.request().input("IdUsuario", sql.Int, idUsuario)
      .query(`
        SELECT 
        UPPER(LTRIM(RTRIM(Nombres+' '+ApellidoPaterno+ ' '+ISNULL(ApellidoMaterno,'')))) AS Usuario
        FROM Empleados WHERE IdEmpleado = 3752
      `);
    const Usuario = Empleado.recordset[0]?.Usuario || "API";

    const IdAtencionDiagnostico = parseInt(req.params.id);

    if (!IdAtencionDiagnostico) {
      return res.status(400).json({
        success: false,
        mensaje: "Se requiere el ID del diagnóstico",
      });
    }

    await pol
      .request()
      .input("IdAtencionDiagnostico", sql.Int, IdAtencionDiagnostico)
      .input("IdUsuarioAuditoria", sql.Int, idUsuario || 357)
      .input("Usuario", sql.VarChar(50), Usuario).query(`
        DELETE FROM AtencionesDiagnosticos 
        WHERE IdAtencionDiagnostico = @IdAtencionDiagnostico;

        EXEC AuditoriaAgregarV @IdUsuarioAuditoria, 'E', @IdAtencionDiagnostico, 'AtencionesDiagnosticos', @IdAtencionDiagnostico, @Usuario, 'Eliminación de diagnóstico';
      `);

    res.json({
      success: true,
      mensaje: "Diagnóstico eliminado correctamente",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      mensaje: "Error al eliminar diagnóstico",
      error: error.message,
    });
  }
};

// Buscar diagnósticos por código CIE
export const buscarDiagnosticos = async (req, res) => {
  try {
    const { input = "", limit = 30 } = req.query;
    const limitNum = parseInt(limit, 10) || 30;

    const request = await pol
      .request()
      .input("searchTerm", sql.VarChar(sql.MAX), input).query(`
      WITH DiagnosticosCombinados AS (
    SELECT
        IdDiagnostico,
        LTRIM(RTRIM(CodigoCIE2004)) + ' - ' + LTRIM(RTRIM(Descripcion)) AS CodigoDescripcion,
        CodigoCIE2004 AS Codigo,
        Descripcion
    FROM Diagnosticos
)
SELECT TOP ${limitNum}
    IdDiagnostico,
    CodigoDescripcion AS Diagnostico
FROM DiagnosticosCombinados
WHERE
    @searchTerm = '' OR
    CodigoDescripcion LIKE '%' + @searchTerm + '%'
ORDER BY
    CodigoDescripcion ASC;
    `);

    return res.json(request.recordset);
  } catch (error) {
    console.error("getDiagnosticosList: Error al buscar:", error);
    res.status(500).json({
      success: false,
      mensaje: "getDiagnosticosList: Error al buscar diagnósticos",
      error: error.message,
    });
  }
};

// Obtener clasificaciones de diagnósticos
export const obtenerClasificacionesDx = async (req, res) => {
  try {
    const result = await pol.request().query(`
                SELECT IdSubclasificacionDx, Codigo, Descripcion, IdClasificacionDx, IdTipoServicio
                FROM SubclasificacionDiagnosticos
                WHERE IdTipoServicio = 1
                ORDER BY Descripcion
            `);

    return res.json(result.recordset);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      mensaje: "Error al obtener clasificaciones de diagnósticos",
      error: error.message,
    });
  }
};

// Retornar idCondicionMaterna
export const selectCondicionMaterna = async (req, res) => {
  try {
    const { IdPaciente } = req.query;

    const result = await pol
      .request()
      .input("IdPaciente", sql.Int, IdPaciente)
      .query(`SELECT IdTipoSexo FROM Pacientes WHERE IdPaciente = @IdPaciente`);

    const sexoPaciente = result.recordset[0]?.IdTipoSexo;

    let opciones = [];

    if (sexoPaciente === 2) {
      // Mujer
      opciones = [
        { id: 1, label: "Gestante" },
        { id: 2, label: "Puerpera" },
        { id: 3, label: "Ninguna" },
      ];
    } else {
      opciones = [{ id: 3, label: "Ninguna" }];
    }

    res.status(200).json({
      success: true,
      data: opciones,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Error al obtener condición materna",
      error: error.message,
    });
  }
};

// Obtener datos de consulta
export const obtenerDatosConsulta = async (req, res) => {
  try {
    const { IdAtencion } = req.query;

    if (!IdAtencion) {
      return res.status(400).json({
        success: false,
        mensaje: "Se requiere el ID de atención",
      });
    }

    // Obtener la conexión a la BD externa
    const poolExterna = await ConexionExterna();
    const pool = await Conexion();

    // Consultar datos de la consulta
    const resultConsulta = await poolExterna
      .request()
      .input("idAtencion", sql.Int, IdAtencion).query(`
                SELECT 
                    idAtencion,
                    CitaMotivo,
                    CitaExamenClinico,
                    CitaTratamiento,
                    CitaObservaciones,
                    CitaAntecedente
                FROM atencionesCE
                WHERE idAtencion = @idAtencion
            `);

    // Obtener el idPaciente desde la tabla Citas
    const pacienteResult = await pool
      .request()
      .input("IdAtencion", sql.Int, IdAtencion).query(`
        SELECT IdPaciente
        FROM Citas 
        WHERE IdAtencion = @IdAtencion
      `);

    let idPaciente = null;
    if (pacienteResult.recordset.length > 0) {
      idPaciente = pacienteResult.recordset[0].IdPaciente;
    }

    // Consultar antecedentes adicionales del paciente si tenemos idPaciente
    let antecedentesAdicionales = {};
    if (idPaciente) {
      const resultAntecedentes = await pool
        .request()
        .input("idPaciente", sql.Int, idPaciente).query(`
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

      if (resultAntecedentes.recordset.length > 0) {
        antecedentesAdicionales = resultAntecedentes.recordset[0];
      }
    }

    // Consultar diagnósticos
    const resultDiagnosticos = await pool
      .request()
      .input("IdAtencion", sql.Int, IdAtencion).query(`
                SELECT 
                    ad.IdAtencionDiagnostico,
                    ad.IdDiagnostico,
                    ad.IdSubclasificacionDx,
                    ad.IdClasificacionDx,
                    ad.labConfHIS,
                    ad.labConfHIS2,
                    ad.labConfHIS3,
                    d.CodigoCIE2004 as Codigo,
                    d.Descripcion,
                    sd.Codigo as TipoCodigo
                FROM AtencionesDiagnosticos ad
                LEFT JOIN Diagnosticos d ON ad.IdDiagnostico = d.IdDiagnostico
                LEFT JOIN SubclasificacionDiagnosticos sd ON ad.IdSubclasificacionDx = sd.IdSubclasificacionDx
                WHERE ad.IdAtencion = @IdAtencion
            `);

    const datosConsulta =
      resultConsulta.recordset.length > 0
        ? resultConsulta.recordset[0]
        : { idAtencion: IdAtencion };

    // IMPORTANTE: Combinar los datos de antecedentes
    return res.json({
      success: true,
      consulta: datosConsulta,
      antecedentes: antecedentesAdicionales, // Añadimos los antecedentes adicionales como un objeto separado
      diagnosticos: resultDiagnosticos.recordset,
    });
  } catch (error) {
    console.error("Error al obtener datos de consulta:", error);
    res.status(500).json({
      success: false,
      mensaje: "Error al obtener datos de consulta",
      error: error.message,
    });
  }
};

export const registrarAtencionCE = async (req, res) => {
  // Inicializar transacciones para ambas bases de datos
  const transaction = new sql.Transaction(await Conexion());

  try {
    // Validar autenticación
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token de autenticación no proporcionado",
      });
    }

    const idUsuario = req.usuario?.id;

    // Obtener datos de Trabajor
    const Empleado = await pol.request().input("IdUsuario", sql.Int, idUsuario)
      .query(`
        SELECT 
        UPPER(LTRIM(RTRIM(Nombres+' '+ApellidoPaterno+ ' '+ISNULL(ApellidoMaterno,'')))) AS Usuario
        FROM Empleados WHERE IdEmpleado = 3752
      `);
    const Usuario = Empleado.recordset[0]?.Usuario || "API";

    const {
      idAtencion,
      idPaciente,
      // Datos para Atenciones
      fechaEgreso,
      horaEgreso,
      idDestinoAtencion = 10, // Valor por defecto
      idTipoCondicionALEstab = 3, // Valor por defecto
      // Datos para atencionesCE
      motivoConsulta,
      examenClinico,
      tratamiento,
      observaciones,
      antecedentes,
      // Diagnósticos (simplificados)
      diagnosticos = [],
      // Datos para PacientesDatosAdicionales
      antecedQuirurgico,
      antecedPatologico,
      antecedObstetrico,
      antecedAlergico,
      antecedFamiliar,
    } = req.body;

    if (!idAtencion || !idPaciente) {
      return res.status(400).json({
        success: false,
        message: "Datos incompletos para registrar la atención",
        required: "idAtencion, idPaciente",
      });
    }

    // Obtener fecha y hora actual en la zona horaria de Lima-Perú
    const now = new Date();
    // Ajustar a la zona horaria de Lima (UTC-5)
    const fechaActual = new Date(now.getTime() - 5 * 60 * 60 * 1000);
    const horaActual = fechaActual.toTimeString().substring(0, 5);

    // Iniciar transacción principal
    await transaction.begin();

    // 1. Obtener datos de la atención actual
    const atencionResult = await transaction
      .request()
      .input("IdAtencion", sql.Int, idAtencion).query(`
        SELECT a.*, c.IdEstadoCita, c.IdCita 
        FROM Atenciones a
        INNER JOIN Citas c ON a.IdAtencion = c.IdAtencion
        WHERE a.IdAtencion = @IdAtencion
      `);

    if (!atencionResult.recordset || atencionResult.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "No se encontró la atención especificada",
      });
    }

    const atencionActual = atencionResult.recordset[0];
    const idCita = atencionActual.IdCita;

    // 1.5. Validar el sexo del paciente - mejor usar un select/checkbox

    let idCondicionMaterna = 3;

    const idSexoPacienteResult = await transaction
      .request()
      .input("IdPaciente", sql.Int, idPaciente)
      .query(`SELECT IdTipoSexo FROM Pacientes WHERE IdPaciente = @IdPaciente`);

    const sexoPaciente = idSexoPacienteResult.recordset[0]?.IdTipoSexo;

    if (sexoPaciente === 2) {
      idCondicionMaterna = 3;
    }

    // 2. Actualizar tabla Atenciones
    await transaction
      .request()
      .input("IdAtencion", sql.Int, idAtencion)
      .input("IdDestinoAtencion", sql.Int, idDestinoAtencion)
      .input("IdTipoCondicionALEstab", sql.Int, idTipoCondicionALEstab)
      .input("FechaEgreso", sql.DateTime, fechaEgreso || fechaActual)
      .input("HoraEgreso", sql.Char(5), horaEgreso || horaActual)
      .input("FyHInicioI", sql.DateTime, fechaActual)
      .input("FyHFinal", sql.DateTime, fechaActual)
      .input("idCondicionMaterna", sql.Int, idCondicionMaterna)
      .input("idEstadoAtencion", sql.Int, 1) // Atendido
      .query(`
        UPDATE Atenciones SET
          IdDestinoAtencion = @IdDestinoAtencion,
          IdTipoCondicionALEstab = @IdTipoCondicionALEstab,
          FechaEgreso = @FechaEgreso,
          HoraEgreso = @HoraEgreso,
          FyHInicioI = @FyHInicioI,
          FyHFinal = @FyHFinal,
          idCondicionMaterna = @idCondicionMaterna,
          idEstadoAtencion = @idEstadoAtencion
        WHERE IdAtencion = @IdAtencion
      `);

    // 3. Actualizar tabla Citas
    await transaction
      .request()
      .input("IdCita", sql.Int, idCita)
      .input("IdEstadoCita", sql.Int, 1)
      .input("IdEmpleado", sql.Int, idUsuario)
      .input("Accion", sql.Char(1), "M")
      .input("IdRegistro", sql.Int, idCita)
      .input("Tabla", sql.VarChar(50), "Citas")
      .input("idListItem", sql.Int, 0)
      .input("nombrePC", sql.VarChar(30), Usuario)
      .input("observaciones", sql.VarChar(100), "Atención registrada").query(`
        UPDATE Citas
        SET IdEstadoCita = @IdEstadoCita
        WHERE IdCita = @IdCita;
                
        EXEC AuditoriaAgregarV @IdEmpleado, @Accion, @IdRegistro, @Tabla, @idListItem, @nombrePC, @observaciones;
      `);

    // 4. Manejar episodios
    // 4.1 Verificar si existe un episodio activo para este paciente
    const episodioResult = await transaction
      .request()
      .input("idPaciente", sql.Int, idPaciente).query(`
        SELECT TOP 1 idEpisodio 
        FROM AtencionesEpisodiosCabecera 
        WHERE idPaciente = @idPaciente 
        ORDER BY idEpisodio DESC
      `);

    let idEpisodio = 1; // Valor por defecto

    if (episodioResult.recordset && episodioResult.recordset.length > 0) {
      // Si ya existe un episodio, usar el último + 1
      idEpisodio = episodioResult.recordset[0].idEpisodio + 1;
    }

    // 4.2 Registrar cabecera de episodio
    await transaction
      .request()
      .input("idPaciente", sql.Int, idPaciente)
      .input("idEpisodio", sql.Int, idEpisodio)
      .input("FechaApertura", sql.DateTime, fechaActual)
      .input("FechaCierre", sql.DateTime, fechaActual)
      .input("IdUsuarioAuditoria", sql.Int, idUsuario)
      .execute("AtencionesEpisodiosCabeceraAgregar");

    // 4.3 Registrar detalle de episodio
    await transaction
      .request()
      .input("idPaciente", sql.Int, idPaciente)
      .input("idEpisodio", sql.Int, idEpisodio)
      .input("idAtencion", sql.Int, idAtencion)
      .input("IdUsuarioAuditoria", sql.Int, idUsuario)
      .execute("AtencionesEpisodiosDetalleAgregar");

    // 5. Manejar datos adicionales del paciente
    // 5.1 Verificar si ya existen datos adicionales
    const datosAdicionalesResult = await transaction
      .request()
      .input("idPaciente", sql.Int, idPaciente).query(`
        SELECT idPaciente 
        FROM PacientesDatosAdicionales 
        WHERE idPaciente = @idPaciente
      `);

    // 5.2 Actualizar o insertar datos adicionales
    const datosAdicionalesExisten =
      datosAdicionalesResult.recordset &&
      datosAdicionalesResult.recordset.length > 0;

    if (datosAdicionalesExisten) {
      // Actualizar
      await transaction
        .request()
        .input("idPaciente", sql.Int, idPaciente)
        .input("antecedQuirurgico", sql.VarChar(500), antecedQuirurgico || null)
        .input("antecedPatologico", sql.VarChar(500), antecedPatologico || null)
        .input("antecedObstetrico", sql.VarChar(500), antecedObstetrico || null)
        .input("antecedAlergico", sql.VarChar(500), antecedAlergico || null)
        .input("antecedFamiliar", sql.VarChar(500), antecedFamiliar || null)
        .input("antecedentes", sql.VarChar(500), antecedentes || null).query(`
          UPDATE PacientesDatosAdicionales
          SET 
            antecedQuirurgico = @antecedQuirurgico,
            antecedPatologico = @antecedPatologico,
            antecedObstetrico = @antecedObstetrico,
            antecedAlergico = @antecedAlergico,
            antecedFamiliar = @antecedFamiliar,
            antecedentes = @antecedentes
          WHERE idPaciente = @idPaciente
        `);
    } else {
      // Insertar
      await transaction
        .request()
        .input("idPaciente", sql.Int, idPaciente)
        .input("antecedQuirurgico", sql.VarChar(500), antecedQuirurgico || null)
        .input("antecedPatologico", sql.VarChar(500), antecedPatologico || null)
        .input("antecedObstetrico", sql.VarChar(500), antecedObstetrico || null)
        .input("antecedAlergico", sql.VarChar(500), antecedAlergico || null)
        .input("antecedFamiliar", sql.VarChar(500), antecedFamiliar || null)
        .input("antecedentes", sql.VarChar(500), antecedentes || null).query(`
          INSERT INTO PacientesDatosAdicionales (
            idPaciente, antecedQuirurgico, antecedPatologico, 
            antecedObstetrico, antecedAlergico, antecedFamiliar, antecedentes
          ) VALUES (
            @idPaciente, @antecedQuirurgico, @antecedPatologico,
            @antecedObstetrico, @antecedAlergico, @antecedFamiliar, @antecedentes
          )
        `);
    }

    // 7. Procesar los diagnósticos primero para obtener la información para CitaDiagMed
    let diagsInfo = [];
    if (diagnosticos && diagnosticos.length > 0) {
      // Obtener información de cada diagnóstico
      for (const diag of diagnosticos) {
        if (!diag.IdDiagnostico) continue; // Saltar diagnósticos sin ID

        // Obtener código y descripción del diagnóstico
        const diagResult = await transaction
          .request()
          .input("IdDiagnostico", sql.Int, diag.IdDiagnostico).query(`
            SELECT 
              d.IdDiagnostico,
              d.CodigoCIE2004 as Codigo,
              d.Descripcion,
              s.Codigo as TipoCodigoPrefix
            FROM Diagnosticos d
            LEFT JOIN SubclasificacionDiagnosticos s ON s.IdSubclasificacionDx = ${
              diag.IdSubclasificacionDx || 102
            }
            WHERE d.IdDiagnostico = @IdDiagnostico
          `);

        if (diagResult.recordset && diagResult.recordset.length > 0) {
          const diagInfo = diagResult.recordset[0];

          // Determinar el prefijo según el IdSubclasificacionDx
          let prefijo = "D"; // Por defecto es D (Definitivo)
          if (diag.IdSubclasificacionDx === 101) {
            prefijo = "P"; // Presuntivo
          } else if (diag.IdSubclasificacionDx === 103) {
            prefijo = "R"; // Repetido
          }

          // Agregar al array de diagnósticos
          diagsInfo.push({
            ...diag,
            codigo: diagInfo.Codigo,
            descripcion: diagInfo.Descripcion,
            prefijo,
            formatoCie: `(${diagInfo.Codigo}-${prefijo} -${diagInfo.Descripcion})`,
          });
        }
      }
    }

    // Crear el texto de diagnósticos para CitaDiagMed
    const citaDiagMedText = diagsInfo.map((d) => d.formatoCie).join(" \n");

    // 6. Verificar datos en la base de datos externa
    const poolExterna = await ConexionExterna();

    // 6.1 Obtener datos de triaje y paciente
    const datosAtencionResult = await transaction
      .request()
      .input("IdAtencion", sql.Int, idAtencion).query(`
        SELECT 
          p.NroHistoriaClinica,
          a.IdServicioIngreso as CitaIdServicio,
          s.Nombre as CitaServicio,
          e.ApellidoPaterno + ' ' + e.ApellidoMaterno + ' ' + e.Nombres as CitaMedico,
          a.Edad as TriajeEdad
        FROM Atenciones a
        INNER JOIN Pacientes p ON a.IdPaciente = p.IdPaciente
        INNER JOIN Servicios s ON a.IdServicioIngreso = s.IdServicio
        INNER JOIN Medicos m ON a.IdMedicoIngreso = m.IdMedico
        INNER JOIN Empleados e ON m.IdEmpleado = e.IdEmpleado
        WHERE a.IdAtencion = @IdAtencion
      `);

    const datosPaciente = datosAtencionResult.recordset[0] || {};

    // 6.2 Verificar si ya existe registro en atencionesCE
    const existeRegistroCE = await poolExterna
      .request()
      .input("idAtencion", sql.Int, idAtencion).query(`
        SELECT TOP 1 idAtencion 
        FROM atencionesCE 
        WHERE idAtencion = @idAtencion
      `);

    // 6.2.1 Verificar los datos del triaje:
    const triajeResult = await poolExterna
      .request()
      .input("idAtencion", sql.Int, idAtencion).query(`
        SELECT 
          TriajeEdad,
          TriajePresion,
          TriajeTalla,
          TriajeTemperatura,
          TriajePeso,
          TriajeFecha,
          TriajeIdUsuario,
          TriajePulso,
          TriajeFrecRespiratoria,
          TriajePerimCefalico,
          TriajeFrecCardiaca,
          TriajeOrigen,
          Triajelatido,
          TriajeObservacion,
          TriajeCanal,
          TriajeSaturacion,
          TriajePerimAbdominal
          FROM atencionesCE where idAtencion=@idAtencion  
      `);
    const datosTriaje = triajeResult.recordset[0] || {};

    // 6.3 Actualizar o insertar en atencionesCE
    const registroCEExiste =
      existeRegistroCE.recordset && existeRegistroCE.recordset.length > 0;

    if (registroCEExiste) {
      // Actualizar
      await poolExterna
        .request()
        .input("idAtencion", sql.Int, idAtencion)
        .input(
          "NroHistoriaClinica",
          sql.Int,
          datosPaciente.NroHistoriaClinica || null
        )
        .input("CitaDniMedicoJamo", sql.VarChar(8), null)
        .input("CitaFecha", sql.DateTime, fechaActual)
        .input("CitaMedico", sql.VarChar(100), datosPaciente.CitaMedico || null)
        .input(
          "CitaServicioJamo",
          sql.VarChar(100),
          datosPaciente.CitaServicio || null
        )
        .input("CitaIdServicio", sql.Int, datosPaciente.CitaIdServicio || null)
        .input("CitaMotivo", sql.VarChar(1000), motivoConsulta || null)
        .input("CitaExamenClinico", sql.VarChar(1000), examenClinico || null)
        .input("CitaDiagMed", sql.VarChar(1000), citaDiagMedText || null) // Formato requerido
        .input("CitaExClinicos", sql.VarChar(3000), null)
        .input("CitaTratamiento", sql.VarChar(1000), tratamiento || null)
        .input("CitaObservaciones", sql.VarChar(1000), observaciones || null)
        .input("CitaFechaAtencion", sql.DateTime, fechaActual)
        .input("CitaIdUsuario", sql.Int, idUsuario)
        .input("TriajeEdad", sql.VarChar(6), datosTriaje.TriajeEdad || null)
        .input(
          "TriajePresion",
          sql.VarChar(13),
          datosTriaje.TriajePresion || null
        )
        .input("TriajeTalla", sql.VarChar(7), datosTriaje.TriajeTalla || null)
        .input(
          "TriajeTemperatura",
          sql.VarChar(6),
          datosTriaje.TriajeTemperatura || null
        )
        .input("TriajePeso", sql.VarChar(7), datosTriaje.TriajePeso || null)
        .input("TriajeFecha", sql.DateTime, datosTriaje.TriajeFecha || null)
        .input("TriajeIdUsuario", sql.Int, datosTriaje.TriajeIdUsuario || null)
        .input("TriajePulso", sql.Int, datosTriaje.TriajePulso || null)
        .input(
          "TriajeFrecRespiratoria",
          sql.Int,
          datosTriaje.TriajeFrecRespiratoria || null
        )
        .input("CitaAntecedente", sql.VarChar(1000), antecedentes || null)
        .input(
          "TriajePerimCefalico",
          sql.Money,
          datosTriaje.TriajePerimCefalico || null
        )
        .input(
          "TriajeFrecCardiaca",
          sql.Int,
          datosTriaje.TriajeFrecCardiaca || null
        )
        .input("TriajeOrigen", sql.Int, 1)
        .input(
          "TriajeSaturacion",
          sql.Int,
          datosTriaje.TriajeSaturacion || null
        )
        .input(
          "TriajePerimAbdominal",
          sql.Money,
          datosTriaje.TriajePerimAbdominal || null
        )
        .input("IdUsuarioAuditoria", sql.Int, idUsuario)
        .execute("usp_update_atencionesCEModificar_20230926");
    } else {
      // Insertar
      await poolExterna
        .request()
        .input("idAtencion", sql.Int, idAtencion)
        .input(
          "NroHistoriaClinica",
          sql.Int,
          datosPaciente.NroHistoriaClinica || null
        )
        .input("CitaDniMedicoJamo", sql.VarChar(8), null)
        .input("CitaFecha", sql.DateTime, fechaActual)
        .input("CitaMedico", sql.VarChar(100), datosPaciente.CitaMedico || null)
        .input(
          "CitaServicioJamo",
          sql.VarChar(100),
          datosPaciente.CitaServicio || null
        )
        .input("CitaIdServicio", sql.Int, datosPaciente.CitaIdServicio || null)
        .input("CitaMotivo", sql.VarChar(1000), motivoConsulta || null)
        .input("CitaExamenClinico", sql.VarChar(1000), examenClinico || null)
        .input("CitaDiagMed", sql.VarChar(1000), citaDiagMedText || null) // Formato requerido
        .input("CitaExClinicos", sql.VarChar(3000), null)
        .input("CitaTratamiento", sql.VarChar(1000), tratamiento || null)
        .input("CitaObservaciones", sql.VarChar(1000), observaciones || null)
        .input("CitaFechaAtencion", sql.DateTime, fechaActual)
        .input("CitaIdUsuario", sql.Int, idUsuario)
        .input("TriajeEdad", sql.VarChar(6), datosTriaje.TriajeEdad || null)
        .input(
          "TriajePresion",
          sql.VarChar(13),
          datosTriaje.TriajePresion || null
        )
        .input("TriajeTalla", sql.VarChar(7), datosTriaje.TriajeTalla || null)
        .input(
          "TriajeTemperatura",
          sql.VarChar(6),
          datosTriaje.TriajeTemperatura || null
        )
        .input("TriajePeso", sql.VarChar(7), datosTriaje.TriajePeso || null)
        .input("TriajeFecha", sql.DateTime, datosTriaje.TriajeFecha || null)
        .input("TriajeIdUsuario", sql.Int, datosTriaje.TriajeIdUsuario || null)
        .input("TriajePulso", sql.Int, datosTriaje.TriajePulso || null)
        .input(
          "TriajeFrecRespiratoria",
          sql.Int,
          datosTriaje.TriajeFrecRespiratoria || null
        )
        .input("CitaAntecedente", sql.VarChar(1000), antecedentes || null)
        .input(
          "TriajePerimCefalico",
          sql.Money,
          datosTriaje.TriajePerimCefalico || null
        )
        .input(
          "TriajeFrecCardiaca",
          sql.Int,
          datosTriaje.TriajeFrecCardiaca || null
        )
        .input("TriajeOrigen", sql.Int, 1)
        .input(
          "TriajeSaturacion",
          sql.Int,
          datosTriaje.TriajeSaturacion || null
        )
        .input(
          "TriajePerimAbdominal",
          sql.Money,
          datosTriaje.TriajePerimAbdominal || null
        )
        .input("IdUsuarioAuditoria", sql.Int, idUsuario)
        .execute("usp_insert_atencionesCEAgregar_20230926");
    }

    // 8. Ahora registrar o actualizar los diagnósticos con la información obtenida
    if (diagsInfo.length > 0) {
      for (const diag of diagsInfo) {
        // Definir los valores por defecto
        const diagnosticoData = {
          IdDiagnostico: diag.IdDiagnostico,
          IdAtencion: idAtencion,
          IdClasificacionDx: diag.IdClasificacionDx || 1, // Valor por defecto
          IdSubclasificacionDx: diag.IdSubclasificacionDx || 102, // Valor por defecto (Definitivo)
          labConfHIS: diag.labConfHIS || null,
          labConfHIS2: diag.labConfHIS2 || null,
          labConfHIS3: diag.labConfHIS3 || null,
          grupoHIS: 0, // Valor por defecto
          subGrupoHIS: 0, // Valor por defecto
          idordenDx: diag.idordenDx || null,
        };

        if (diag.IdAtencionDiagnostico) {
          // Actualizar diagnóstico existente
          await transaction
            .request()
            .input("IdAtencionDiagnostico", sql.Int, diag.IdAtencionDiagnostico)
            .input("IdAtencion", sql.Int, diagnosticoData.IdAtencion)
            .input("IdDiagnostico", sql.Int, diagnosticoData.IdDiagnostico)
            .input(
              "IdClasificacionDx",
              sql.Int,
              diagnosticoData.IdClasificacionDx
            )
            .input(
              "IdSubclasificacionDx",
              sql.Int,
              diagnosticoData.IdSubclasificacionDx
            )
            .input("labConfHIS", sql.VarChar(3), diagnosticoData.labConfHIS)
            .input("labConfHIS2", sql.VarChar(3), diagnosticoData.labConfHIS2)
            .input("labConfHIS3", sql.VarChar(3), diagnosticoData.labConfHIS3)
            .input("grupoHIS", sql.Int, diagnosticoData.grupoHIS)
            .input("subGrupoHIS", sql.Int, diagnosticoData.subGrupoHIS)
            .input("idordenDx", sql.Int, diagnosticoData.idordenDx)
            .input("IdEmpleado", sql.Int, idUsuario)
            .input("Accion", sql.Char(1), "M")
            .input("IdRegistro", sql.Int, diag.IdAtencionDiagnostico)
            .input("Tabla", sql.VarChar(50), "AtencionesDiagnosticos")
            .input("idListItem", sql.Int, 0)
            .input("nombrePC", sql.VarChar(30), Usuario)
            .input("observaciones", sql.VarChar(100), "Diagnóstico actualizado")
            .query(`
              UPDATE AtencionesDiagnosticos
              SET
                IdDiagnostico = @IdDiagnostico,
                IdAtencion = @IdAtencion,
                IdClasificacionDx = @IdClasificacionDx,
                IdSubclasificacionDx = @IdSubclasificacionDx,
                labConfHIS = @labConfHIS,
                labConfHIS2 = @labConfHIS2,
                labConfHIS3 = @labConfHIS3,
                GrupoHIS = @grupoHIS,
                subGrupoHIS = @subGrupoHIS,
                idordenDx = @idordenDx
              WHERE IdAtencionDiagnostico = @IdAtencionDiagnostico;

              EXEC AuditoriaAgregarV @IdEmpleado, @Accion, @IdRegistro, @Tabla, @idListItem, @nombrePC, @observaciones;
            `);
        } else {
          // Crear nuevo diagnóstico
          const insertResult = await transaction
            .request()
            .input("IdDiagnostico", sql.Int, diagnosticoData.IdDiagnostico)
            .input("IdAtencion", sql.Int, diagnosticoData.IdAtencion)
            .input(
              "IdClasificacionDx",
              sql.Int,
              diagnosticoData.IdClasificacionDx
            )
            .input(
              "IdSubclasificacionDx",
              sql.Int,
              diagnosticoData.IdSubclasificacionDx
            )
            .input("labConfHIS", sql.VarChar(3), diagnosticoData.labConfHIS)
            .input("labConfHIS2", sql.VarChar(3), diagnosticoData.labConfHIS2)
            .input("labConfHIS3", sql.VarChar(3), diagnosticoData.labConfHIS3)
            .input("grupoHIS", sql.Int, diagnosticoData.grupoHIS)
            .input("subGrupoHIS", sql.Int, diagnosticoData.subGrupoHIS)
            .input("idordenDx", sql.Int, diagnosticoData.idordenDx).query(`
              INSERT INTO AtencionesDiagnosticos (
                IdDiagnostico,
                IdAtencion,
                IdClasificacionDx,
                IdSubclasificacionDx,
                labConfHIS,
                labConfHIS2,
                labConfHIS3,
                GrupoHIS,
                subGrupoHIS,
                idordenDx
              )
              VALUES (
                @IdDiagnostico,
                @IdAtencion,
                @IdClasificacionDx,
                @IdSubclasificacionDx,
                @labConfHIS,
                @labConfHIS2,
                @labConfHIS3,
                @grupoHIS,
                @subGrupoHIS,
                @idordenDx
              );

              SELECT SCOPE_IDENTITY() AS IdAtencionDiagnostico;
            `);

          // Registrar auditoría para el nuevo diagnóstico
          if (insertResult.recordset && insertResult.recordset.length > 0) {
            const newDiagnosticoId =
              insertResult.recordset[0].IdAtencionDiagnostico;
            await transaction
              .request()
              .input("IdEmpleado", sql.Int, idUsuario)
              .input("Accion", sql.Char(1), "A")
              .input("IdRegistro", sql.Int, newDiagnosticoId)
              .input("Tabla", sql.VarChar(50), "AtencionesDiagnosticos")
              .input("idListItem", sql.Int, 0)
              .input("nombrePC", sql.VarChar(30), Usuario)
              .input("observaciones", sql.VarChar(100), "Diagnóstico creado")
              .execute("AuditoriaAgregarV");
          }
        }
      }
    }

    // 9. Registrar auditoria para la atención
    await transaction
      .request()
      .input("IdEmpleado", sql.Int, idUsuario)
      .input("Accion", sql.Char(1), "M")
      .input("IdRegistro", sql.Int, idAtencion)
      .input("Tabla", sql.VarChar(50), "Atenciones")
      .input("idListItem", sql.Int, 0)
      .input("nombrePC", sql.VarChar(30), Usuario)
      .input("observaciones", sql.VarChar(100), "Atención actualizada")
      .execute("AuditoriaAgregarV");

    // Confirmar la transacción
    await transaction.commit();

    res.status(200).json({
      success: true,
      message: "Atención registrada exitosamente",
      idAtencion,
      idEpisodio,
    });
  } catch (error) {
    // Si hay algún error, hacer rollback de la transacción
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      console.error("Error al hacer rollback:", rollbackError);
    }

    console.error("Error al registrar la atención:", error);
    res.status(500).json({
      success: false,
      message: "Error al registrar la atención",
      error: error.message || error,
    });
  }
};

export const postDatosAdicionalesPAciente = async (req, res) => {
  try {
  } catch (error) {
    console.error(`Error al registrar `);
  }
};

export const resumenCitasTriajeDelDia = async (req, res) => {
  try {
    const pool = await Conexion();

    let filtroEspecialidades = '';

    // Filtro dinámico por especialidades y médico
    if (req.filtroEspecialidades && Array.isArray(req.filtroEspecialidades) && req.filtroEspecialidades.length > 0) {
      filtroEspecialidades += ` AND s.IdServicio IN (${req.filtroEspecialidades.join(',')})`;

      if (req.usuario?.isMedico && req.usuario?.idMedico) {
        filtroEspecialidades += ` AND me.IdMedico = ${req.usuario.idMedico}`;
      }
    }

    // Servicios que NO requieren triaje
    const serviciosNoAplicaTriaje = [149, 367, 312, 346, 347, 358].join(',');

    const resumenQuery = await pool.request().query(`
      WITH CitasFiltradas AS (
        SELECT 
            c.IdCita,
            c.IdAtencion,
            s.IdServicio,
            a.FyHFinal
        FROM ProgramacionMedica p
        INNER JOIN Citas c 
            ON p.IdProgramacion = c.IdProgramacion
            AND c.Fecha >= CAST(GETDATE() AS DATE)
            AND c.Fecha < DATEADD(DAY, 1, CAST(GETDATE() AS DATE))
        INNER JOIN Servicios s ON p.IdServicio = s.IdServicio
        INNER JOIN sigh..Atenciones a ON c.IdAtencion = a.IdAtencion
        INNER JOIN Medicos me ON p.IdMedico = me.IdMedico
        WHERE s.IdServicio IN (145, 149, 230, 312, 346, 347, 358, 367, 407, 439)
        ${filtroEspecialidades}
      ),
      TriajesExistentes AS (
        SELECT DISTINCT idAtencion
        FROM SIGH_EXTERNA..atencionesCE
      )

      SELECT 
        COUNT(*) AS TotalCitas,
        COUNT(CASE WHEN FyHFinal IS NULL THEN 1 END) AS CitasPendientes,
        COUNT(CASE WHEN FyHFinal IS NOT NULL THEN 1 END) AS CitasAtendidas,

        -- Triajes completados: TODOS los triajes registrados, independientemente del servicio
        COUNT(CASE 
            WHEN te.idAtencion IS NOT NULL THEN 1
            ELSE NULL
        END) AS TriajesCompletados,

        -- Triajes pendientes: solo en servicios que requieren triaje y no tienen triaje
        COUNT(CASE 
            WHEN cf.IdServicio NOT IN (${serviciosNoAplicaTriaje}) AND te.idAtencion IS NULL THEN 1
            ELSE NULL
        END) AS TriajesPendientes,

        -- Triajes registrados en servicios que NO requieren triaje (para auditoría)
        COUNT(CASE 
            WHEN cf.IdServicio IN (${serviciosNoAplicaTriaje}) AND te.idAtencion IS NOT NULL THEN 1
            ELSE NULL
        END) AS TriajesRegistradosNoAplica,

        -- Triajes no aplica: servicios que no requieren triaje y no tienen triaje registrado
        COUNT(CASE 
            WHEN cf.IdServicio IN (${serviciosNoAplicaTriaje}) AND te.idAtencion IS NULL THEN 1
            ELSE NULL
        END) AS TriajesNoAplica
      FROM CitasFiltradas cf
      LEFT JOIN TriajesExistentes te ON cf.IdAtencion = te.idAtencion;
    `);

    const resumen = resumenQuery.recordset[0];

    return res.status(200).json({
      success: true,
      data: {
        totalCitas: resumen.TotalCitas,
        citasPendientes: resumen.CitasPendientes,
        citasAtendidas: resumen.CitasAtendidas,
        triajesCompletados: resumen.TriajesCompletados,
        triajesPendientes: resumen.TriajesPendientes,
        triajesNoAplica: resumen.TriajesNoAplica,
        triajesRegistradosNoAplica: resumen.TriajesRegistradosNoAplica // Auditoría
      },
    });
  } catch (error) {
    console.error("Error en resumenCitasTriajeDelDia:", error);
    return res.status(500).json({
      success: false,
      message: "Error al obtener el resumen de citas y triaje del día",
      error: error.message,
    });
  }
};
