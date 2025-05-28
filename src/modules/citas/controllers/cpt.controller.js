// cpt.controller.js

import { Conexion } from "../../../config/database.js";
import { obtenerFechaHoraLima } from "../../../utils/fecha.js";
import sql from "mssql";

const pool = await Conexion();

// Buscar CPTs para autocompletado
export const buscarCPT = async (req, res) => {
  try {
    const {
      input = "",
      limit = 30,
      IdServicio,
      idTipoFinanciamiento = 16,
    } = req.query;
    const limitNum = parseInt(limit, 10) || 30;
    const IdPuntoCarga = parseInt(IdServicio, 10) + 500;

    const query = await pool
      .request()
      .input("searchTerm", sql.VarChar(sql.MAX), input)
      .input("idPuntoCarga", sql.Int, IdPuntoCarga)
      .input("idTipoFinanciamiento", sql.Int, idTipoFinanciamiento).query(`
        WITH CPTCombinados AS (
          SELECT DISTINCT
            fcs.IdProducto, 
            fcs.Codigo, 
            fcs.Nombre,
            RTRIM(LTRIM(fcs.Codigo)) + ' - ' + RTRIM(LTRIM(fcs.Nombre)) AS CodigoNombre,
            fcsh.PrecioUnitario, 
            fcsh.Activo, 
            fcsp.idPuntoCarga,
            fcsh.SeUsaSinPrecio
          FROM 
            dbo.FactCatalogoServicios AS fcs
          INNER JOIN 
            dbo.FactCatalogoServiciosPtos AS fcsp ON fcs.IdProducto = fcsp.idProducto
          INNER JOIN 
            dbo.FactCatalogoServiciosHosp AS fcsh ON fcs.IdProducto = fcsh.IdProducto
          WHERE 
            fcs.idEstado = 1 AND
            fcsp.idPuntoCarga = @idPuntoCarga AND
            fcsh.idTipoFinanciamiento = @idTipoFinanciamiento
        )
        SELECT TOP (${limitNum})
          IdProducto,
          CodigoNombre,
          PrecioUnitario,
          Activo,
          idPuntoCarga,
          SeUsaSinPrecio
        FROM CPTCombinados
        WHERE 
          @searchTerm = '' OR
          CodigoNombre LIKE '%' + @searchTerm + '%'
        ORDER BY CodigoNombre ASC;
      `);

    return res.json(query.recordset);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      mensaje: "Error al buscar CPT",
      error: error.message,
    });
  }
};

// 2. Función auxiliar: obtener detalle CPT por tipo de financiamiento
export const obtenerCPTPorIdFinanciamiento = async (
  idProducto,
  idTipoFinanciamiento = 16
) => {
  const resultado = await pool
    .request()
    .input("IdProducto", sql.Int, idProducto)
    .input("IdTipoFinanciamiento", sql.Int, idTipoFinanciamiento)
    .execute("FactCatalogoServiciosXidTipoFinanciamiento");

  return resultado.recordset[0]; // Puede ser undefined
};

// registrar CPT después de registrar la atención
export const registrarCPTsPostAtencion = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token no proporcionado",
      });
    }

    const idUsuario = req.usuario?.id;
    const fechaHoraLima = obtenerFechaHoraLima();

    const {
      idAtencion,
      idCuentaAtencion,
      cpts, // Array de CPTs con [{ idProducto, cantidad, idDiagnostico, PDR, labConfHIS, labConfHIS2, labConfHIS3 }]
    } = req.body;

    // Validaciones
    if (!idAtencion || !Array.isArray(cpts) || cpts.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Datos incompletos para registrar CPTs",
        required: "idAtencion, cpts",
      });
    }

    // Obtener datos de la atención y el paciente
    const pool = await Conexion();
    const datosAtencion = await pool
      .request()
      .input("idAtencion", sql.Int, idAtencion).query(`
        select top 1 c.IdPaciente, c.IdServicio, a.idFuenteFinanciamiento, fas.idTipoFinanciamiento
        from Citas c 
        inner join Atenciones a on c.IdAtencion=a.IdAtencion
        inner join FactOrdenServicio fas on a.IdCuentaAtencion = fas.IdCuentaAtencion
        where c.IdAtencion = @idAtencion
      `);

    if (!datosAtencion.recordset || datosAtencion.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No se encontró la atención especificada",
      });
    }

    const {
      IdPaciente,
      IdServicio,
      idFuenteFinanciamiento = 9, // Default ESTRATEGIA
      idTipoFinanciamiento = 16, // Default ESTRATEGIA
    } = datosAtencion.recordset[0];

    // IMPORTANTE: Calcular IdPuntoCarga igual que en buscarCPT
    const IdPuntoCarga = IdServicio + 500;

    // Registrar CPTs con los diagnósticos asociados - Cada uno con su propia orden
    const cptsRegistrados = [];
    const cptsNoRegistrados = [];

    for (const cpt of cpts) {
      // Iniciamos una transacción por cada CPT
      const transaction = new sql.Transaction(pool);
      await transaction.begin();

      try {
        console.log(`Procesando CPT: ${cpt.idProducto}`);

        // Verificar que el diagnóstico existe en la atención
        const diagValido = await transaction
          .request()
          .input("idAtencion", sql.Int, idAtencion)
          .input("idDiagnostico", sql.Int, cpt.idDiagnostico).query(`
            SELECT TOP 1 IdAtencionDiagnostico 
            FROM AtencionesDiagnosticos 
            WHERE IdAtencion = @idAtencion 
            AND IdDiagnostico = @idDiagnostico
          `);

        if (!diagValido.recordset || diagValido.recordset.length === 0) {
          console.warn(
            `Diagnóstico no válido para la atención: ${cpt.idDiagnostico}`
          );
          cptsNoRegistrados.push({
            idProducto: cpt.idProducto,
            razon: "Diagnóstico no válido",
          });
          await transaction.rollback();
          continue;
        }

        // Verificar el producto usando la misma lógica que buscarCPT
        const checkProducto = await transaction
          .request()
          .input("IdProducto", sql.Int, cpt.idProducto)
          .input("idPuntoCarga", sql.Int, IdPuntoCarga)
          .input("idTipoFinanciamiento", sql.Int, idTipoFinanciamiento).query(`
            SELECT DISTINCT
              fcs.IdProducto,
              fcs.Codigo,
              fcs.Nombre,
              fcsh.PrecioUnitario,
              fcsh.Activo,
              fcsp.idPuntoCarga,
              fcsh.SeUsaSinPrecio
            FROM FactCatalogoServicios AS fcs
            INNER JOIN FactCatalogoServiciosPtos AS fcsp ON fcs.IdProducto = fcsp.idProducto
            INNER JOIN FactCatalogoServiciosHosp AS fcsh ON fcs.IdProducto = fcsh.IdProducto
            WHERE 
              fcs.IdProducto = @IdProducto AND
              fcs.idEstado = 1 AND
              fcsp.idPuntoCarga = @idPuntoCarga AND
              fcsh.idTipoFinanciamiento = @idTipoFinanciamiento
          `);

        if (!checkProducto.recordset || checkProducto.recordset.length === 0) {
          console.warn(
            `Producto no encontrado: ${cpt.idProducto} para punto de carga ${IdPuntoCarga}`
          );
          cptsNoRegistrados.push({
            idProducto: cpt.idProducto,
            razon:
              "Producto no encontrado o no disponible para este punto de carga",
          });
          await transaction.rollback();
          continue;
        }

        const detalle = checkProducto.recordset[0];
        const precio = parseFloat(detalle.PrecioUnitario || 0);
        const cantidad = parseInt(cpt.cantidad || 1, 10);
        const total = precio * cantidad;

        // Crear una orden de servicio independiente para este CPT
        const resultOrden = await transaction
          .request()
          .output("IdOrden", sql.Int)
          .input("IdPuntoCarga", sql.Int, 1)
          .input("IdPaciente", sql.Int, IdPaciente)
          .input("IdCuentaAtencion", sql.Int, idAtencion)
          .input("IdServicioPaciente", sql.Int, IdServicio)
          .input("idTipoFinanciamiento", sql.Int, idTipoFinanciamiento)
          .input("idFuenteFinanciamiento", sql.Int, idFuenteFinanciamiento)
          .input("FechaCreacion", sql.DateTime, fechaHoraLima)
          .input("IdUsuario", sql.Int, idUsuario)
          .input("FechaDespacho", sql.DateTime, fechaHoraLima)
          .input("IdUsuarioDespacho", sql.Int, idUsuario)
          .input("IdEstadoFacturacion", sql.Int, 1)
          .input("FechaHoraRealizaCpt", sql.DateTime, fechaHoraLima)
          .input("IdUsuarioAuditoria", sql.Int, idUsuario)
          .execute("FactOrdenServicioAgregar");

        const idOrden = resultOrden.output.IdOrden;

        if (!idOrden) {
          console.error(
            `Error al crear la orden de servicio para CPT ${cpt.idProducto}`
          );
          cptsNoRegistrados.push({
            idProducto: cpt.idProducto,
            razon: "Error al crear la orden de servicio",
          });
          await transaction.rollback();
          continue;
        }

        // Insertar el CPT en esta orden específica
        await transaction
          .request()
          .input("idOrden", sql.Int, idOrden)
          .input("IdProducto", sql.Int, cpt.idProducto)
          .input("Cantidad", sql.Int, cantidad)
          .input("Precio", sql.Money, precio)
          .input("Total", sql.Money, total)
          .input("labConfHIS", sql.VarChar(3), cpt.labConfHIS || null)
          .input("grupoHIS", sql.Int, 0)
          .input("subGrupoHIS", sql.Int, 0)
          .input("IdUsuarioAuditoria", sql.Int, idUsuario)
          .input("idReceta", sql.Int, null)
          .input("idDiagnostico", sql.Int, cpt.idDiagnostico)
          .input("labConfHIS2", sql.VarChar(3), cpt.labConfHIS2 || null)
          .input("labConfHIS3", sql.VarChar(3), cpt.labConfHIS3 || null)
          .input("PDR", sql.VarChar(3), cpt.PDR || "D").query(`
            INSERT INTO FacturacionServicioDespacho (      
              idOrden, IdProducto, Cantidad, Precio, Total, 
              labConfHIS, grupoHIS, subgrupoHIS, idReceta, idDiagnostico,
              labConfHIS2, labConfHIS3, PDR
            ) VALUES (      
              @idOrden, @IdProducto, @Cantidad, @Precio, @Total, 
              @labConfHIS, @grupoHIS, @subgrupoHIS, @idReceta, @idDiagnostico,
              @labConfHIS2, @labConfHIS3, @PDR
            )   
          `);

        // Auditoría
        await transaction
          .request()
          .input("IdEmpleado", sql.Int, idUsuario)
          .input("Accion", sql.Char(1), "A")
          .input("IdRegistro", sql.Int, idOrden)
          .input("Tabla", sql.VarChar(50), "FactOrdenServicio")
          .input("idListItem", sql.Int, 0)
          .input("nombrePC", sql.Char(30), "API")
          .input(
            "observaciones",
            sql.VarChar(100),
            `CPT ${detalle.Codigo} registrado`
          )
          .execute("AuditoriaAgregarV");

        await transaction.commit();

        cptsRegistrados.push({
          idOrden,
          idProducto: cpt.idProducto,
          codigo: detalle.Codigo,
          nombre: detalle.Nombre,
          cantidad,
          precio,
          total,
          idDiagnostico: cpt.idDiagnostico,
          PDR: cpt.PDR || "D",
          labConfHIS: cpt.labConfHIS || null,
          labConfHIS2: cpt.labConfHIS2 || null,
          labConfHIS3: cpt.labConfHIS3 || null,
        });

        console.log(
          `CPT registrado exitosamente: ${cpt.idProducto} con orden ${idOrden}`
        );
      } catch (error) {
        await transaction.rollback();
        console.error(`Error procesando CPT ${cpt.idProducto}:`, error);
        cptsNoRegistrados.push({
          idProducto: cpt.idProducto,
          razon: error.message,
        });
      }
    }

    // Retornar resultado
    if (cptsRegistrados.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "No se pudo registrar ningún CPT válido. Verifique los datos enviados.",
        detalles: cptsNoRegistrados,
      });
    }

    return res.json({
      success: true,
      message: `Se registraron ${cptsRegistrados.length} CPTs correctamente`,
      cptsRegistrados,
      cptsNoRegistrados,
    });
  } catch (error) {
    console.error("Error al registrar CPTs post-atención:", error);
    res.status(500).json({
      success: false,
      message: "Error al registrar CPTs",
      error: error.message,
    });
  }
};

// Actualizar CPT después de registrar la atención
export const actualizarCPTsPostAtencion = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token no proporcionado",
      });
    }

    const idUsuario = req.usuario?.id;
    const fechaHoraLima = obtenerFechaHoraLima();

    const {
      idAtencion,
      cpts, // Array de CPTs con [{ idProducto, idOrden, cantidad, idDiagnostico, PDR, labConfHIS, labConfHIS2, labConfHIS3 }]
    } = req.body;

    // Validaciones
    if (!idAtencion || !Array.isArray(cpts) || cpts.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Datos incompletos para actualizar CPTs",
        required: "idAtencion, cpts",
      });
    }

    // Obtener datos de la atención y el paciente
    const pool = await Conexion();
    const datosAtencion = await pool
      .request()
      .input("idAtencion", sql.Int, idAtencion).query(`
        select top 1 c.IdPaciente, c.IdServicio, fas.idTipoFinanciamiento
        from Citas c 
        inner join Atenciones a on c.IdAtencion=a.IdAtencion
        inner join FactOrdenServicio fas on a.IdCuentaAtencion = fas.IdCuentaAtencion
        where c.IdAtencion = @idAtencion
      `);

    if (!datosAtencion.recordset || datosAtencion.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No se encontró la atención especificada",
      });
    }

    const {
      IdPaciente,
      IdServicio,
      idTipoFinanciamiento = 16, // Default ESTRATEGIA
    } = datosAtencion.recordset[0];

    // IMPORTANTE: Calcular IdPuntoCarga igual que en buscarCPT
    const IdPuntoCarga = IdServicio + 500;

    // Actualizar CPTs con los diagnósticos asociados
    const cptsActualizados = [];
    const cptsNoActualizados = [];

    for (const cpt of cpts) {
      // Iniciamos una transacción por cada CPT
      const transaction = new sql.Transaction(pool);
      await transaction.begin();

      try {
        console.log(`Actualizando CPT: ${cpt.idProducto}`);

        // Verificar que el diagnóstico existe en la atención
        const diagValido = await transaction
          .request()
          .input("idAtencion", sql.Int, idAtencion)
          .input("idDiagnostico", sql.Int, cpt.idDiagnostico).query(`
            SELECT TOP 1 IdAtencionDiagnostico 
            FROM AtencionesDiagnosticos 
            WHERE IdAtencion = @idAtencion 
            AND IdDiagnostico = @idDiagnostico
          `);

        if (!diagValido.recordset || diagValido.recordset.length === 0) {
          console.warn(
            `Diagnóstico no válido para la atención: ${cpt.idDiagnostico}`
          );
          cptsNoActualizados.push({
            idProducto: cpt.idProducto,
            razon: "Diagnóstico no válido",
          });
          await transaction.rollback();
          continue;
        }

        // Verificar el producto usando la misma lógica que buscarCPT
        const checkProducto = await transaction
          .request()
          .input("IdProducto", sql.Int, cpt.idProducto)
          .input("idPuntoCarga", sql.Int, IdPuntoCarga)
          .input("idTipoFinanciamiento", sql.Int, idTipoFinanciamiento).query(`
            SELECT DISTINCT
              fcs.IdProducto,
              fcs.Codigo,
              fcs.Nombre,
              fcsh.PrecioUnitario,
              fcsh.Activo,
              fcsp.idPuntoCarga,
              fcsh.SeUsaSinPrecio
            FROM FactCatalogoServicios AS fcs
            INNER JOIN FactCatalogoServiciosPtos AS fcsp ON fcs.IdProducto = fcsp.idProducto
            INNER JOIN FactCatalogoServiciosHosp AS fcsh ON fcs.IdProducto = fcsh.IdProducto
            WHERE 
              fcs.IdProducto = @IdProducto AND
              fcs.idEstado = 1 AND
              fcsp.idPuntoCarga = @idPuntoCarga AND
              fcsh.idTipoFinanciamiento = @idTipoFinanciamiento
          `);

        if (!checkProducto.recordset || checkProducto.recordset.length === 0) {
          console.warn(
            `Producto no encontrado: ${cpt.idProducto} para punto de carga ${IdPuntoCarga}`
          );
          cptsNoActualizados.push({
            idProducto: cpt.idProducto,
            razon:
              "Producto no encontrado o no disponible para este punto de carga",
          });
          await transaction.rollback();
          continue;
        }

        const detalle = checkProducto.recordset[0];
        const precio = parseFloat(detalle.PrecioUnitario || 0);
        const cantidad = parseInt(cpt.cantidad || 1, 10);
        const total = precio * cantidad;

        // Actualizar el CPT en la tabla FacturacionServicioDespacho
        // IMPORTANTE: Aquí añadimos el input idOrden que faltaba
        await transaction
          .request()
          .input("idOrden", sql.Int, cpt.idOrden)
          .input("IdProducto", sql.Int, cpt.idProducto)
          .input("Cantidad", sql.Int, cantidad)
          .input("Precio", sql.Money, precio)
          .input("Total", sql.Money, total)
          .input("labConfHIS", sql.VarChar(3), cpt.labConfHIS || null)
          .input("grupoHIS", sql.Int, 0)
          .input("subGrupoHIS", sql.Int, 0)
          .input("IdUsuarioAuditoria", sql.Int, idUsuario)
          .input("idReceta", sql.Int, null)
          .input("idDiagnostico", sql.Int, cpt.idDiagnostico)
          .input("labConfHIS2", sql.VarChar(3), cpt.labConfHIS2 || null)
          .input("labConfHIS3", sql.VarChar(3), cpt.labConfHIS3 || null)
          .input("PDR", sql.VarChar(3), cpt.PDR || "D").query(`
            UPDATE FacturacionServicioDespacho 
            SET Cantidad = @Cantidad, 
                Precio = @Precio, 
                Total = @Total,
                IdProducto = @IdProducto,
                labConfHIS = @labConfHIS,
                grupoHIS = @grupoHIS,
                subgrupoHIS = @subGrupoHIS,
                idReceta = @idReceta,
                idDiagnostico = @idDiagnostico,
                labConfHIS2 = @labConfHIS2,
                labConfHIS3 = @labConfHIS3,
                PDR = @PDR
            WHERE idOrden = @idOrden 
          `);

        // Auditoría
        await transaction
          .request()
          .input("IdEmpleado", sql.Int, idUsuario)
          .input("Accion", sql.Char(1), "M")
          .input("IdRegistro", sql.Int, cpt.idProducto)
          .input("Tabla", sql.VarChar(50), "FacturacionServicioDespacho")
          .input("idListItem", sql.Int, 0)
          .input("nombrePC", sql.VarChar(30), "API")
          .input(
            "observaciones",
            sql.VarChar(100),
            `CPT ${detalle.Codigo} actualizado`
          )
          .execute("AuditoriaAgregarV");

        await transaction.commit();

        cptsActualizados.push({
          idProducto: cpt.idProducto,
          idOrden: cpt.idOrden,
          codigo: detalle.Codigo,
          nombre: detalle.Nombre,
          cantidad,
          precio,
          total,
          idDiagnostico: cpt.idDiagnostico,
          PDR: cpt.PDR || "D",
          labConfHIS: cpt.labConfHIS || null,
          labConfHIS2: cpt.labConfHIS2 || null,
          labConfHIS3: cpt.labConfHIS3 || null,
        });

        console.log(`CPT actualizado exitosamente: ${cpt.idProducto}`);
      } catch (error) {
        await transaction.rollback();
        console.error(`Error procesando CPT ${cpt.idProducto}:`, error);
        cptsNoActualizados.push({
          idProducto: cpt.idProducto,
          razon: error.message,
        });
      }
    }

    // Retornar resultado
    if (cptsActualizados.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "No se pudo actualizar ningún CPT válido. Verifique los datos enviados.",
        detalles: cptsNoActualizados,
      });
    }

    return res.json({
      success: true,
      message: `Se actualizaron ${cptsActualizados.length} CPTs correctamente`,
      cptsActualizados,
      cptsNoActualizados,
    });
  } catch (error) {
    console.error("Error al actualizar CPTs post-atención:", error);
    res.status(500).json({
      success: false,
      message: "Error al actualizar CPTs",
      error: error.message,
    });
  }
};

export const obtenerCPTsPorAtencion = async (req, res) => {
  try {
    const { idAtencion } = req.query;

    if (!idAtencion) {
      return res.status(400).json({
        success: false,
        message: "Se requiere el ID de atención",
      });
    }

    const pool = await Conexion();

    const result = await pool.request().input("idAtencion", sql.Int, idAtencion)
      .query(`
        SELECT 
          fsd.IdProducto,
          fsd.idOrden,
          fsd.Cantidad,
          fsd.Precio,
          fsd.Total,
          fsd.idDiagnostico,
          fcs.Codigo,
          fcs.Nombre,
		  RTRIM(LTRIM(fsd.PDR)) as PDR,
		  fsd.labConfHIS,
		  fsd.labConfHIS2,
		  fsd.labConfHIS3,
          ad.IdDiagnostico as IdDiagnosticoAtenciones,
          d.CodigoCIE2004 as CodigoDiagnostico,
          d.Descripcion as DescripcionDiagnostico
        FROM Atenciones a
        INNER JOIN FactOrdenServicio fos ON a.IdCuentaAtencion = fos.IdCuentaAtencion
        INNER JOIN FacturacionServicioDespacho fsd ON fos.IdOrden = fsd.idOrden
        INNER JOIN FactCatalogoServicios fcs ON fsd.IdProducto = fcs.IdProducto
        LEFT JOIN AtencionesDiagnosticos ad ON fsd.idDiagnostico = ad.IdDiagnostico 
          AND ad.IdAtencion = a.IdAtencion
        LEFT JOIN Diagnosticos d ON ad.IdDiagnostico = d.IdDiagnostico
        WHERE a.IdAtencion = @idAtencion and fsd.idDiagnostico is not null
        ORDER BY fsd.IdProducto
      `);

    return res.json({
      success: true,
      cpts: result.recordset,
    });
  } catch (error) {
    console.error("Error al obtener CPTs de la atención:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener CPTs",
      error: error.message,
    });
  }
};

// En cpt.controller.js - Agregar esta función
export const eliminarCPT = async (req, res) => {
  const transaction = new sql.Transaction(await Conexion());

  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token de autenticación no proporcionado",
      });
    }

    const idUsuario = req.usuario?.id;
    const { idOrden, idProducto } = req.params;

    if (!idOrden || !idProducto) {
      return res.status(400).json({
        success: false,
        message: "Se requiere ID de orden y ID de producto",
      });
    }

    await transaction.begin();

    // Eliminar el CPT de FacturacionServicioDespacho
    await transaction
      .request()
      .input("idOrden", sql.Int, idOrden)
      .input("IdProducto", sql.Int, idProducto).query(`
        DELETE FROM FacturacionServicioDespacho 
        WHERE idOrden = @idOrden AND IdProducto = @IdProducto
      `);

    // Verificar si quedan más productos en la orden
    const checkOrden = await transaction
      .request()
      .input("idOrden", sql.Int, idOrden).query(`
        SELECT COUNT(*) as Total 
        FROM FacturacionServicioDespacho 
        WHERE idOrden = @idOrden
      `);

    // Si no quedan más productos, eliminar la orden completa
    if (checkOrden.recordset[0].Total === 0) {
      await transaction.request().input("idOrden", sql.Int, idOrden).query(`
          DELETE FROM FactOrdenServicio 
          WHERE IdOrden = @idOrden
        `);
    }

    // Auditoría
    await transaction
      .request()
      .input("IdEmpleado", sql.Int, idUsuario)
      .input("Accion", sql.Char(1), "E")
      .input("IdRegistro", sql.Int, idProducto)
      .input("Tabla", sql.VarChar(50), "FacturacionServicioDespacho")
      .input("idListItem", sql.Int, 0)
      .input("nombrePC", sql.VarChar(30), "API")
      .input("observaciones", sql.VarChar(100), "Eliminación de CPT")
      .execute("AuditoriaAgregarV");

    await transaction.commit();

    res.json({
      success: true,
      message: "CPT eliminado correctamente",
    });
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      console.error("Error al hacer rollback:", rollbackError);
    }

    console.error("Error al eliminar CPT:", error);
    res.status(500).json({
      success: false,
      message: "Error al eliminar CPT",
      error: error.message,
    });
  }
};
