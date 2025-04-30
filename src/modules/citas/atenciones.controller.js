// atenciones.controller.js
import { Conexion, ConexionExterna } from "../../config/database.js";
import sql from "mssql";

const pol = await Conexion();

export const obtenerDiagnosticos = async (req, res) => {
  try {
    const { IdAtencion } = req.query;
    const result = await pol.request().input("IdAtencion", sql.Int, IdAtencion)
      .query(`
                select * from AtencionesDiagnosticos where IdAtencion=@IdAtencion
            `);
    return res.json(result.recordset);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      mensaje: "Error al obtener los datos",
      error: error.mensaje,
    });
  }
};

export const registrarAtencionesDiagnosticos = async (req, res) => {
  try {
    const {
      IdSubclasificacionDx,
      IdClasificacionDx,
      IdDiagnostico,
      IdAtencion,
      labConfHIS = null,
      grupoHIS = 0,
      subGrupoHIS = 0,
      IdUsuarioAuditoria,
      labConfHIS2 = null,
      labConfHIS3 = null,
      idordenDx = null,
      NroEvaluacion = null,
    } = req.body;

    const result = await pol
      .request()
      .input("IdSubclasificacionDx", sql.Int, IdSubclasificacionDx)
      .input("IdClasificacionDx", sql.Int, IdClasificacionDx)
      .input("IdDiagnostico", sql.Int, IdDiagnostico)
      .input("IdAtencion", sql.Int, IdAtencion)
      .input("labConfHIS", sql.VarChar(3), labConfHIS)
      .input("grupoHIS", sql.Int, grupoHIS)
      .input("subGrupoHIS", sql.Int, subGrupoHIS)
      .input("labConfHIS2", sql.VarChar(3), labConfHIS2)
      .input("labConfHIS3", sql.VarChar(3), labConfHIS3)
      .input("idordenDx", sql.Int, idordenDx)
      .input("IdUsuarioAuditoria", sql.Int, IdUsuarioAuditoria)
      .input("NroEvaluacion", sql.Int, NroEvaluacion).query(`
                INSERT INTO AtencionesDiagnosticos (
                    IdSubclasificacionDx,
                    IdClasificacionDx,
                    IdDiagnostico,
                    IdAtencion,
                    labConfHIS,
                    grupoHIS,
                    subGrupoHIS,
                    labConfHIS2,
                    labConfHIS3,
                    idordenDx,
                    IdUsuarioAuditoria
                    ,NroEvaluacion
                )
                VALUES (
                    @IdSubclasificacionDx,
                    @IdClasificacionDx,
                    @IdDiagnostico,
                    @IdAtencion,
                    @labConfHIS,
                    @grupoHIS,
                    @subGrupoHIS,
                    @labConfHIS2,
                    @labConfHIS3,
                    @idordenDx,
                    @IdUsuarioAuditoria
                    ,@NroEvaluacion
                );

                SELECT SCOPE_IDENTITY() AS IdAtencionDiagnostico;
            `);

    res.json({
      success: true,
      mensaje: "Diagnóstico registrado correctamente",
      IdAtencionDiagnostico: result.recordset[0].IdAtencionDiagnostico,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      mensaje: "Error al registrar AtencionesDiagnosticos",
      error: error.message,
    });
  }
};

export const actualizarAtencionesDiagnosticos = async (req, res) => {
  try {
    const {
      IdAtencionDiagnostico,
      IdSubclasificacionDx,
      IdClasificacionDx,
      IdDiagnostico,
      IdAtencion,
      grupoHIS = 0,
      subGrupoHIS = 0,
      IdUsuarioAuditoria,
      idordenDx = null,
      labConfHIS = null,
      labConfHIS2 = null,
      labConfHIS3 = null,
      NroEvaluacion = null,
    } = req.body;

    // Ejecuta la actualización
    await pol
      .request()
      .input("IdAtencionDiagnostico", sql.Int, IdAtencionDiagnostico)
      .input("IdSubclasificacionDx", sql.Int, IdSubclasificacionDx)
      .input("IdClasificacionDx", sql.Int, IdClasificacionDx)
      .input("IdDiagnostico", sql.Int, IdDiagnostico)
      .input("IdAtencion", sql.Int, IdAtencion)
      .input("grupoHIS", sql.Int, grupoHIS)
      .input("subGrupoHIS", sql.Int, subGrupoHIS)
      .input("idordenDx", sql.Int, idordenDx)
      .input("labConfHIS", sql.VarChar(3), labConfHIS)
      .input("labConfHIS2", sql.VarChar(3), labConfHIS2)
      .input("labConfHIS3", sql.VarChar(3), labConfHIS3)
      .input("NroEvaluacion", sql.Int, NroEvaluacion)
      .input("IdUsuarioAuditoria", sql.Int, IdUsuarioAuditoria).query(`
                UPDATE AtencionesDiagnosticos
                SET
                    IdSubclasificacionDx = @IdSubclasificacionDx,
                    IdClasificacionDx = @IdClasificacionDx,
                    IdDiagnostico = @IdDiagnostico,
                    IdAtencion = @IdAtencion,
                    grupoHIS = @grupoHIS,
                    subGrupoHIS = @subGrupoHIS,
                    idordenDx = @idordenDx,
                    labConfHIS = @labConfHIS,
                    labConfHIS2 = @labConfHIS2,
                    labConfHIS3 = @labConfHIS3,
                    NroEvaluacion = @NroEvaluacion
                WHERE IdAtencionDiagnostico = @IdAtencionDiagnostico;

                EXEC AuditoriaAgregar @IdUsuarioAuditoria, 'M', @IdAtencionDiagnostico, 'AtencionesDiagnosticos';
            `);

    res.json({
      success: true,
      mensaje: "Diagnóstico actualizado correctamente",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      mensaje: "Error al actualizar AtencionesDiagnosticos",
      error: error.message,
    });
  }
};

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
    const Empleado = await pol.request()
      .input('IdUsuario', sql.Int, idUsuario)
      .query(`
        SELECT 
        UPPER(LTRIM(RTRIM(Nombres+' '+ApellidoPaterno+ ' '+ISNULL(ApellidoMaterno,'')))) AS Usuario
        FROM Empleados WHERE IdEmpleado = 3752
      `);
    const Usuario = Empleado.recordset[0]?.Usuario || 'API';

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
      .input("Usuario", sql.VarChar(50), Usuario)
      .query(`
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
    const { codigo = "", descripcion = "" } = req.query;

    const result = await pol
      .request()
      .input("Codigo", sql.VarChar, codigo)
      .input("Descripcion", sql.VarChar, descripcion).query(`
                SELECT TOP 50 
    IdDiagnostico,
    LTRIM(RTRIM(REPLACE(REPLACE(CodigoCIE2004, CHAR(9), ''), CHAR(160), ''))) AS Codigo,
    LTRIM(RTRIM(REPLACE(REPLACE(Descripcion, CHAR(9), ''), CHAR(160), ''))) AS Descripcion
FROM Diagnosticos
WHERE 
    (@Codigo = '' OR CodigoCIE2004 LIKE '%' + @Codigo + '%')
    AND (@Descripcion = '' OR Descripcion LIKE '%' + @Descripcion + '%')
ORDER BY 
    CASE 
        WHEN CodigoCIE2004 LIKE @Codigo + '%' THEN 0
        ELSE 1
    END,
    CodigoCIE2004;
            `);

    return res.json(result.recordset);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      mensaje: "Error al buscar diagnósticos",
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

    const result = await pol.request()
      .input('IdPaciente', sql.Int, IdPaciente)
      .query(`SELECT IdTipoSexo FROM Pacientes WHERE IdPaciente = @IdPaciente`);

    const sexoPaciente = result.recordset[0]?.IdTipoSexo;

    let opciones = [];

    if (sexoPaciente === 2) { // Mujer
      opciones = [
        { id: 1, label: 'Gestante' },
        { id: 2, label: 'Puerpera' },
        { id: 3, label: 'Ninguna' }
      ];
    } else {
      opciones = [
        { id: 3, label: 'Ninguna' }
      ];
    }

    res.status(200).json({
      success: true,
      data: opciones
    });

  } catch (error) {
    console.error(error)
    res.status(500).json({
      success: false,
      message: "Error al obtener condición materna",
      error: error.message
    })    
  }
}

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

    // Consultar diagnósticos
    const resultDiagnosticos = await pol
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

    return res.json({
      success: true,
      consulta: datosConsulta,
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
    const Empleado = await pol.request()
      .input('IdUsuario', sql.Int, idUsuario)
      .query(`
        SELECT 
        UPPER(LTRIM(RTRIM(Nombres+' '+ApellidoPaterno+ ' '+ISNULL(ApellidoMaterno,'')))) AS Usuario
        FROM Empleados WHERE IdEmpleado = 3752
      `);
    const Usuario = Empleado.recordset[0]?.Usuario || 'API';

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
    
    let idCondicionMaterna = 3

    const idSexoPacienteResult = await transaction
      .request()
      .input('IdPaciente', sql.Int, idPaciente)
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
      .input("idEstadoAtencion", sql.Int, 2) // Atendido
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
      .input("IdEstadoCita", sql.Int, 2) // Atendido
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
            antecedQuirurgico = ISNULL(@antecedQuirurgico, antecedQuirurgico),
            antecedPatologico = ISNULL(@antecedPatologico, antecedPatologico),
            antecedObstetrico = ISNULL(@antecedObstetrico, antecedObstetrico),
            antecedAlergico = ISNULL(@antecedAlergico, antecedAlergico),
            antecedFamiliar = ISNULL(@antecedFamiliar, antecedFamiliar),
            antecedentes = ISNULL(@antecedentes, antecedentes)
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
        .input(
          "TriajeEdad",
          sql.VarChar(6),
          datosPaciente.TriajeEdad?.toString() || null
        )
        .input("TriajePresion", sql.VarChar(13), null)
        .input("TriajeTalla", sql.VarChar(7), null)
        .input("TriajeTemperatura", sql.VarChar(6), null)
        .input("TriajePeso", sql.VarChar(7), null)
        .input("TriajeFecha", sql.DateTime, null)
        .input("TriajeIdUsuario", sql.Int, null)
        .input("TriajePulso", sql.Int, null)
        .input("TriajeFrecRespiratoria", sql.Int, null)
        .input("CitaAntecedente", sql.VarChar(1000), antecedentes || null)
        .input("TriajePerimCefalico", sql.Money, null)
        .input("TriajeFrecCardiaca", sql.Int, null)
        .input("TriajeOrigen", sql.Int, 1)
        .input("TriajeSaturacion", sql.Int, null)
        .input("TriajePerimAbdominal", sql.Money, null)
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
        .input(
          "TriajeEdad",
          sql.VarChar(6),
          datosPaciente.TriajeEdad?.toString() || null
        )
        .input("TriajePresion", sql.VarChar(13), null)
        .input("TriajeTalla", sql.VarChar(7), null)
        .input("TriajeTemperatura", sql.VarChar(6), null)
        .input("TriajePeso", sql.VarChar(7), null)
        .input("TriajeFecha", sql.DateTime, null)
        .input("TriajeIdUsuario", sql.Int, null)
        .input("TriajePulso", sql.Int, null)
        .input("TriajeFrecRespiratoria", sql.Int, null)
        .input("CitaAntecedente", sql.VarChar(1000), antecedentes || null)
        .input("TriajePerimCefalico", sql.Money, null)
        .input("TriajeFrecCardiaca", sql.Int, null)
        .input("TriajeOrigen", sql.Int, 1)
        .input("TriajeSaturacion", sql.Int, null)
        .input("TriajePerimAbdominal", sql.Money, null)
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
