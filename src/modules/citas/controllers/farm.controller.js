// farm.controller.js

import { Conexion } from "../../../config/database.js";
import sql from "mssql";
import { obtenerFechaHoraLima } from "../../../utils/fecha.js";

const pool = await Conexion();

export const buscarFarmPrincipal = async (req, res) => {
  try {
    const { input = "", limit = 30 } = req.query;
    const limitNum = parseInt(limit, 10) || 30;
    const query = await pool.request().input("search", sql.VarChar(200), input)
      .query(`
        WITH ProductosFiltrados AS (
          SELECT IdProducto, 
          RTRIM(LTRIM(Codigo)) as Codigo, 
          RTRIM(LTRIM(Nombre)) as Nombre,
          RTRIM(LTRIM(Codigo)) + ' - ' + RTRIM(LTRIM(Nombre)) as CodigoNombre
          FROM dbo.FactCatalogoBienesInsumos
        ),
        SaldosPositivos AS (
          SELECT DISTINCT fs.idProducto
          FROM dbo.farmSaldo fs
          JOIN dbo.farmAlmacen fa ON fs.idAlmacen = fa.idAlmacen
          WHERE fs.cantidad > 0
          AND fa.idTipoLocales = 'F'
        )
        SELECT TOP ${limitNum}
          pf.IdProducto, 
          pf.CodigoNombre,
          pf.Codigo,
          pf.Nombre
        FROM ProductosFiltrados pf
        JOIN SaldosPositivos sp ON pf.IdProducto = sp.idProducto
        WHERE pf.CodigoNombre LIKE '%' + @search + '%'
        ORDER BY pf.Nombre; 
      `);

      return res.json(query.recordset);
  } catch (error) {
    console.error("Error al buscar medicamentos: ", error);
    res.status(500).json({
      success: false,
      mensaje: "Error al buscar los medicamentos",
      error: error.message,
    });
  }
};

// Función auxiliar para obtener saldo de farmacia
const obtenerSaldoFarmacia = async (idProducto) => {
  try {
    const resultado = await pool
      .request()
      .input("idProducto", sql.Int, idProducto)
      .execute("farmSaldoSoloFarmaciasSismed");

    // Buscar el almacén 4 (FARMACIA PRINCIPAL CE-SISMED)
    const saldoAlmacen4 = resultado.recordset.find(item => item.idAlmacen === 4);
    
    return saldoAlmacen4 ? saldoAlmacen4.cantidad : 0;
  } catch (error) {
    console.error("Error al obtener saldo de farmacia:", error);
    return 0;
  }
};

// Registrar recetas de farmacia después de registrar la atención
export const registrarRecetaFarmPostAtencion = async (req, res) => {
  try {
    console.log("=== INICIO registrarRecetaFarmPostAtencion ===");
    console.log("Headers recibidos:", req.headers);
    console.log("Body completo recibido:", JSON.stringify(req.body, null, 2));
    console.log("Query params:", req.query);
    console.log("Usuario desde middleware:", req.usuario);

    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      console.log("❌ Error: Token no proporcionado");
      return res.status(401).json({
        success: false,
        message: "Token no proporcionado",
      });
    }
    console.log("✅ Token encontrado:", token.substring(0, 20) + "...");

    const idUsuario = req.usuario?.id;
    console.log("✅ ID Usuario desde middleware:", idUsuario);

    const fechaHoraLima = obtenerFechaHoraLima();
    const fechaActual = new Date();
    fechaActual.setDate(fechaActual.getDate() + 30);

    const fechaSinHora = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), fechaActual.getDate());
    const fechaVigencia  = fechaSinHora.toISOString().split('T')[0];
    console.log("✅ Fechas calculadas - Actual:", fechaHoraLima, "Vigencia:", fechaVigencia);

    const {
      idAtencion,
      idCuentaAtencion,
      recetas, // Array de recetas con [{ idProducto, cantidadPedida, observaciones, idDosisRecetadas, idViaAdministracion, idDiagnostico }]
    } = req.body;

    console.log("📝 Datos extraídos del body:");
    console.log("  - idAtencion:", idAtencion, typeof idAtencion);
    console.log("  - idCuentaAtencion:", idCuentaAtencion, typeof idCuentaAtencion);
    console.log("  - recetas:", recetas);
    console.log("  - recetas.length:", recetas?.length);

    // Validaciones
    if (!idAtencion || !Array.isArray(recetas) || recetas.length === 0) {
      console.log("❌ Error en validaciones:");
      console.log("  - idAtencion existe:", !!idAtencion);
      console.log("  - recetas es array:", Array.isArray(recetas));
      console.log("  - recetas.length > 0:", recetas?.length > 0);
      
      return res.status(400).json({
        success: false,
        message: "Datos incompletos para registrar recetas",
        required: "idAtencion, recetas",
        received: {
          idAtencion: idAtencion,
          idCuentaAtencion: idCuentaAtencion,
          recetasLength: recetas?.length || 0
        }
      });
    }
    console.log("✅ Validaciones iniciales pasadas");

    // Obtener datos de la atención
    const pool = await Conexion();
    console.log("🔍 Consultando datos de la atención con idAtencion:", idAtencion);
    
    const datosAtencion = await pool
      .request()
      .input("idAtencion", sql.Int, idAtencion).query(`
        SELECT TOP 1 
          c.IdPaciente,
          c.IdServicio,
          a.IdServicioIngreso,
          a.IdMedicoIngreso,
          a.IdCuentaAtencion
        FROM Citas c
        INNER JOIN Atenciones a ON c.IdAtencion = a.IdAtencion
        WHERE c.IdAtencion = @idAtencion
      `);

    console.log("📊 Resultado de consulta de atención:");
    console.log("  - recordset:", datosAtencion.recordset);
    console.log("  - recordset.length:", datosAtencion.recordset?.length);

    if (!datosAtencion.recordset || datosAtencion.recordset.length === 0) {
      console.log("❌ No se encontró la atención especificada");
      console.log("  - Query ejecutada con idAtencion:", idAtencion);
      
      return res.status(404).json({
        success: false,
        message: "No se encontró la atención especificada",
        debug: {
          idAtencion: idAtencion,
          queryExecuted: true,
          resultCount: 0
        }
      });
    }

    const {
      IdPaciente,
      IdServicio,
      IdServicioIngreso,
      IdMedicoIngreso,
      IdCuentaAtencion,
    } = datosAtencion.recordset[0];

    console.log("✅ Datos de atención encontrados:");
    console.log("  - IdPaciente:", IdPaciente);
    console.log("  - IdServicio:", IdServicio);
    console.log("  - IdServicioIngreso:", IdServicioIngreso);
    console.log("  - IdMedicoIngreso:", IdMedicoIngreso);
    console.log("  - IdCuentaAtencion:", IdCuentaAtencion);

    // Usar el IdCuentaAtencion de la consulta si no se proporcionó
    const cuentaAtencionFinal = idCuentaAtencion || IdCuentaAtencion;
    console.log("✅ IdCuentaAtencion final a usar:", cuentaAtencionFinal);

    // Registrar recetas con los diagnósticos asociados - Cada conjunto de recetas con su propia cabecera
    const recetasRegistradas = [];
    const recetasNoRegistradas = [];

    // Crear una cabecera de receta
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      console.log("Creando cabecera de receta...");

      // Crear cabecera de receta
      const resultCabecera = await transaction
        .request()
        .output("idReceta", sql.Int)
        .input("IdPuntoCarga", sql.Int, 5)
        .input("FechaReceta", sql.DateTime, fechaHoraLima)
        .input("idCuentaAtencion", sql.Int, cuentaAtencionFinal)
        .input("idServicioReceta", sql.Int, IdServicioIngreso)
        .input("idEstado", sql.Int, 1)
        .input("idComprobantePago", sql.Int, null)
        .input("idMedicoReceta", sql.Int, IdMedicoIngreso)
        .input("FechaVigencia", sql.DateTime, fechaVigencia)
        .input("IdUsuarioAuditoria", sql.Int, idUsuario)
        .execute("RecetaCabeceraAgregar");

      const idReceta = resultCabecera.output.idReceta;

      if (!idReceta) {
        console.error("Error al crear la cabecera de receta");
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Error al crear la cabecera de receta",
        });
      }

      console.log(`Cabecera de receta creada con ID: ${idReceta}`);

      // Registrar cada medicamento en la receta
      for (const receta of recetas) {
        try {
          console.log(`Procesando medicamento: ${receta.idProducto}`);

          // Verificar que el diagnóstico existe en la atención
          const diagValido = await transaction
            .request()
            .input("idAtencion", sql.Int, idAtencion)
            .input("idDiagnostico", sql.Int, receta.idDiagnostico).query(`
              SELECT TOP 1 IdAtencionDiagnostico 
              FROM AtencionesDiagnosticos 
              WHERE IdAtencion = @idAtencion 
              AND IdDiagnostico = @idDiagnostico
            `);

          if (!diagValido.recordset || diagValido.recordset.length === 0) {
            console.warn(
              `Diagnóstico no válido para la atención: ${receta.idDiagnostico}`
            );
            recetasNoRegistradas.push({
              idProducto: receta.idProducto,
              razon: "Diagnóstico no válido",
            });
            continue;
          }

          // Obtener datos del producto
          const checkProducto = await transaction
            .request()
            .input("IdProducto", sql.Int, receta.idProducto).query(`
              SELECT 
                fbi.IdProducto,
                fbi.Codigo,
                fbi.Nombre,
                fs.Precio
              FROM FactCatalogoBienesInsumos fbi
              INNER JOIN farmSaldo fs ON fbi.IdProducto = fs.idProducto
              INNER JOIN farmAlmacen fa ON fs.idAlmacen = fa.idAlmacen
              WHERE fbi.IdProducto = @IdProducto 
              AND fa.idTipoLocales = 'F'
              AND fs.cantidad > 0
            `);

          if (!checkProducto.recordset || checkProducto.recordset.length === 0) {
            console.warn(
              `Producto no encontrado o sin stock: ${receta.idProducto}`
            );
            recetasNoRegistradas.push({
              idProducto: receta.idProducto,
              razon: "Producto no encontrado o sin stock disponible",
            });
            continue;
          }

          const detalle = checkProducto.recordset[0];
          const idEstrategia = 16;
          const detallePrecio = await transaction.request()
            .input('IdProducto', sql.Int, receta.idProducto)
            .query(`
              select * from FactCatalogoBienesInsumosHosp 
              where IdProducto=@IdProducto 
              and IdTipoFinanciamiento=${idEstrategia}
            `)
          const resultadoPrecio = detallePrecio.recordset[0];

          const precio = parseFloat(resultadoPrecio.PrecioUnitario || 0);
          const cantidadPedida = parseInt(receta.cantidadPedida || 1, 10);
          const total = Math.round((precio * cantidadPedida) * 100) / 100; // Redondear a 2 decimales

          // Obtener saldo en almacén 4
          const saldoEnRegistro = await obtenerSaldoFarmacia(receta.idProducto);

          // Insertar el detalle de la receta
          await transaction
            .request()
            .input("idReceta", sql.Int, idReceta)
            .input("idItem", sql.Int, receta.idProducto)
            .input("CantidadPedida", sql.Int, cantidadPedida)
            .input("Precio", sql.Money, precio)
            .input("Total", sql.Money, total)
            .input("SaldoEnRegistroReceta", sql.Int, saldoEnRegistro)
            .input("SaldoEnDespachoReceta", sql.Int, null)
            .input("CantidadDespachada", sql.Int, null)
            .input("idDosisRecetada", sql.Int, receta.idDosisRecetadas || 1)
            .input("idEstadoDetalle", sql.Int, 1)
            .input("MotivoAnulacionMedico", sql.VarChar(300), null)
            .input("observaciones", sql.VarChar(300), receta.observaciones || null)
            .input("IdViaAdministracion", sql.Int, receta.idViaAdministracion || null) // Permitir NULL
            .input("iddiagnostico", sql.Int, receta.idDiagnostico)
            .input("IdUsuarioAuditoria", sql.Int, idUsuario)
            .execute("RecetaDetalleAgregar");

          recetasRegistradas.push({
            idReceta,
            idProducto: receta.idProducto,
            codigo: detalle.Codigo,
            nombre: detalle.Nombre,
            cantidadPedida,
            precio,
            total,
            saldoEnRegistro,
            idDiagnostico: receta.idDiagnostico,
            idDosisRecetadas: receta.idDosisRecetadas || 1,
            idViaAdministracion: receta.idViaAdministracion || 1,
            observaciones: receta.observaciones || null,
          });

          console.log(
            `Medicamento registrado exitosamente: ${receta.idProducto} en receta ${idReceta}`
          );
        } catch (error) {
          console.error(`Error procesando medicamento ${receta.idProducto}:`, error);
          recetasNoRegistradas.push({
            idProducto: receta.idProducto,
            razon: error.message,
          });
        }
      }

      await transaction.commit();

      // Retornar resultado
      if (recetasRegistradas.length === 0) {
        return res.status(400).json({
          success: false,
          message:
            "No se pudo registrar ningún medicamento válido. Verifique los datos enviados.",
          detalles: recetasNoRegistradas,
        });
      }

      return res.json({
        success: true,
        message: `Se registraron ${recetasRegistradas.length} medicamentos correctamente`,
        idReceta,
        recetasRegistradas,
        recetasNoRegistradas,
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Error al registrar recetas post-atención:", error);
    res.status(500).json({
      success: false,
      message: "Error al registrar recetas",
      error: error.message,
    });
  }
};

// Actualizar recetas después de registrar la atención
export const actualizarRecetaFarmPostAtencion = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token no proporcionado",
      });
    }

    const idUsuario = req.usuario?.id;

    const {
      idAtencion,
      idReceta,
      recetas, // Array de recetas con [{ idProducto, cantidadPedida, observaciones, idDosisRecetadas, idViaAdministracion, idDiagnostico }]
    } = req.body;

    // Validaciones
    if (!idAtencion || !idReceta || !Array.isArray(recetas) || recetas.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Datos incompletos para actualizar recetas",
        required: "idAtencion, idReceta, recetas",
      });
    }

    const pool = await Conexion();
    const recetasActualizadas = [];
    const recetasNoActualizadas = [];

    for (const receta of recetas) {
      const transaction = new sql.Transaction(pool);
      await transaction.begin();

      try {
        console.log(`Actualizando medicamento: ${receta.idProducto}`);

        // Verificar que el diagnóstico existe en la atención
        const diagValido = await transaction
          .request()
          .input("idAtencion", sql.Int, idAtencion)
          .input("idDiagnostico", sql.Int, receta.idDiagnostico).query(`
            SELECT TOP 1 IdAtencionDiagnostico 
            FROM AtencionesDiagnosticos 
            WHERE IdAtencion = @idAtencion 
            AND IdDiagnostico = @idDiagnostico
          `);

        if (!diagValido.recordset || diagValido.recordset.length === 0) {
          console.warn(
            `Diagnóstico no válido para la atención: ${receta.idDiagnostico}`
          );
          recetasNoActualizadas.push({
            idProducto: receta.idProducto,
            razon: "Diagnóstico no válido",
          });
          await transaction.rollback();
          continue;
        }

        // Obtener datos del producto
        const checkProducto = await transaction
          .request()
          .input("IdProducto", sql.Int, receta.idProducto).query(`
            SELECT 
              fbi.IdProducto,
              fbi.Codigo,
              fbi.Nombre,
              fs.Precio
            FROM FactCatalogoBienesInsumos fbi
            INNER JOIN farmSaldo fs ON fbi.IdProducto = fs.idProducto
            INNER JOIN farmAlmacen fa ON fs.idAlmacen = fa.idAlmacen
            WHERE fbi.IdProducto = @IdProducto 
            AND fa.idTipoLocales = 'F'
            AND fs.cantidad > 0
          `);

        if (!checkProducto.recordset || checkProducto.recordset.length === 0) {
          console.warn(
            `Producto no encontrado o sin stock: ${receta.idProducto}`
          );
          recetasNoActualizadas.push({
            idProducto: receta.idProducto,
            razon: "Producto no encontrado o sin stock disponible",
          });
          await transaction.rollback();
          continue;
        }

        const detalle = checkProducto.recordset[0];
        const precio = parseFloat(detalle.Precio || 0);
        const cantidadPedida = parseInt(receta.cantidadPedida || 1, 10);
        const total = Math.round((precio * cantidadPedida) * 100) / 100; // Redondear a 2 decimales

        // Obtener saldo en almacén 4
        const saldoEnRegistro = await obtenerSaldoFarmacia(receta.idProducto);

        // Actualizar el detalle de la receta
        await transaction
          .request()
          .input("idReceta", sql.Int, idReceta)
          .input("idItem", sql.Int, receta.idProducto)
          .input("CantidadPedida", sql.Int, cantidadPedida)
          .input("Precio", sql.Money, precio)
          .input("Total", sql.Money, total)
          .input("SaldoEnRegistroReceta", sql.Int, saldoEnRegistro)
          .input("idDosisRecetada", sql.Int, receta.idDosisRecetadas || 1)
          .input("observaciones", sql.VarChar(300), receta.observaciones || null)
          .input("IdViaAdministracion", sql.Int, receta.idViaAdministracion || null) // Permitir NULL
          .input("iddiagnostico", sql.Int, receta.idDiagnostico).query(`
            UPDATE RecetaDetalle 
            SET CantidadPedida = @CantidadPedida,
                Precio = @Precio,
                Total = @Total,
                SaldoEnRegistroReceta = @SaldoEnRegistroReceta,
                idDosisRecetada = @idDosisRecetada,
                observaciones = @observaciones,
                IdViaAdministracion = @IdViaAdministracion,
                iddiagnostico = @iddiagnostico
            WHERE idReceta = @idReceta 
            AND idItem = @idItem
          `);

        await transaction.commit();

        recetasActualizadas.push({
          idProducto: receta.idProducto,
          codigo: detalle.Codigo,
          nombre: detalle.Nombre,
          cantidadPedida,
          precio,
          total,
          saldoEnRegistro,
          idDiagnostico: receta.idDiagnostico,
          idDosisRecetadas: receta.idDosisRecetadas || 1,
          idViaAdministracion: receta.idViaAdministracion || 1,
          observaciones: receta.observaciones || null,
        });

        console.log(`Medicamento actualizado exitosamente: ${receta.idProducto}`);
      } catch (error) {
        await transaction.rollback();
        console.error(`Error procesando medicamento ${receta.idProducto}:`, error);
        recetasNoActualizadas.push({
          idProducto: receta.idProducto,
          razon: error.message,
        });
      }
    }

    // Retornar resultado
    if (recetasActualizadas.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "No se pudo actualizar ningún medicamento válido. Verifique los datos enviados.",
        detalles: recetasNoActualizadas,
      });
    }

    return res.json({
      success: true,
      message: `Se actualizaron ${recetasActualizadas.length} medicamentos correctamente`,
      recetasActualizadas,
      recetasNoActualizadas,
    });
  } catch (error) {
    console.error("Error al actualizar recetas post-atención:", error);
    res.status(500).json({
      success: false,
      message: "Error al actualizar recetas",
      error: error.message,
    });
  }
};

// Obtener recetas por atención
export const obtenerRecetasPorAtencion = async (req, res) => {
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
          rd.idItem as IdProducto,
          rd.idReceta,
          rd.CantidadPedida,
          rd.Precio,
          rd.Total,
          rd.SaldoEnRegistroReceta,
          rd.idDosisRecetada,
          rd.IdViaAdministracion,
          rd.observaciones,
          rd.iddiagnostico,
          fbi.Codigo,
          fbi.Nombre,
          ad.IdDiagnostico as IdDiagnosticoAtenciones,
          d.CodigoCIE10 as CodigoDiagnostico,
          d.Descripcion as DescripcionDiagnostico
        FROM Atenciones a
        INNER JOIN RecetaCabecera rc ON a.IdCuentaAtencion = rc.idCuentaAtencion
        INNER JOIN RecetaDetalle rd ON rc.idReceta = rd.idReceta
        INNER JOIN FactCatalogoBienesInsumos fbi ON rd.idItem = fbi.IdProducto
        LEFT JOIN AtencionesDiagnosticos ad ON rd.iddiagnostico = ad.IdDiagnostico 
          AND ad.IdAtencion = a.IdAtencion
        LEFT JOIN Diagnosticos d ON ad.IdDiagnostico = d.IdDiagnostico
        WHERE a.IdAtencion = @idAtencion AND rd.iddiagnostico IS NOT NULL
        ORDER BY rd.idItem
      `);

    return res.json({
      success: true,
      recetas: result.recordset,
    });
  } catch (error) {
    console.error("Error al obtener recetas de la atención:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener recetas",
      error: error.message,
    });
  }
};

// Eliminar medicamento de receta
export const eliminarMedicamentoReceta = async (req, res) => {
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
    const { idReceta, idProducto } = req.params;

    if (!idReceta || !idProducto) {
      return res.status(400).json({
        success: false,
        message: "Se requiere ID de receta y ID de producto",
      });
    }

    await transaction.begin();

    // Eliminar el medicamento de RecetaDetalle
    await transaction
      .request()
      .input("idReceta", sql.Int, idReceta)
      .input("idItem", sql.Int, idProducto).query(`
        DELETE FROM RecetaDetalle 
        WHERE idReceta = @idReceta AND idItem = @idItem
      `);

    // Verificar si quedan más medicamentos en la receta
    const checkReceta = await transaction
      .request()
      .input("idReceta", sql.Int, idReceta).query(`
        SELECT COUNT(*) as Total 
        FROM RecetaDetalle 
        WHERE idReceta = @idReceta
      `);

    // Si no quedan más medicamentos, eliminar la cabecera de receta
    if (checkReceta.recordset[0].Total === 0) {
      await transaction.request().input("idReceta", sql.Int, idReceta).query(`
          DELETE FROM RecetaCabecera 
          WHERE idReceta = @idReceta
        `);
    }

    await transaction.commit();

    res.json({
      success: true,
      message: "Medicamento eliminado correctamente",
    });
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      console.error("Error al hacer rollback:", rollbackError);
    }

    console.error("Error al eliminar medicamento:", error);
    res.status(500).json({
      success: false,
      message: "Error al eliminar medicamento",
      error: error.message,
    });
  }
};