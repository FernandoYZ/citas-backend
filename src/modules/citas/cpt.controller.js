import { Conexion } from "../../config/database.js"
import { obtenerFechaHoraLima } from "../../utils/fecha.js"
import sql from "mssql";

const pool = await Conexion();

export const buscarCPT = async (req, res) => {
  try {
    const { codigo = '', descripcion = '', IdServicio, idTipoFinanciamiento=16 } = req.query
    const IdPuntoCarga = IdServicio + 500
    const query = await pool.request()
      .input('Codigo', sql.VarChar, codigo)
      .input('Nombre', sql.VarChar, descripcion)
      .input('idPuntoCarga', sql.Int, IdPuntoCarga)
      .input('idTipoFinanciamiento', sql.Int, idTipoFinanciamiento)
      .query(`
      SELECT DISTINCT
    fcs.IdProducto, 
    fcs.Codigo, 
    fcs.Nombre, 
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
    fcsh.idTipoFinanciamiento = @idTipoFinanciamiento AND
    (
        (@Codigo IS NULL OR @Codigo = '') OR 
        fcs.Codigo LIKE @Codigo + '%'
    ) AND
    (
        (@Nombre IS NULL OR @Nombre = '') OR 
        fcs.Nombre LIKE @Nombre + '%'
    )
ORDER BY 
    fcs.Nombre ASC;  
      `)
    return res.json(query.recordset)
    
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      mensaje: "Error al buscar CPT",
      error: error.message,
    });
  }
}

export const agregarOrderServicio = async (req, res) => {
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
    if (!idUsuario) {
      return res.status(401).json({
        success: false,
        message: "No se pudo obtener el ID del usuario autenticado",
      });
    }

    const fechaHoraLima = obtenerFechaHoraLima()

    const {
      idCuentaAtencion,
      productos,
      idPaciente,
      idTipoFinanciamiento,
      idFuenteFinanciamiento,
      idServicioPaciente,
    } = req.body;

    if (!Array.isArray(productos) || productos.length === 0) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Se requieren productos para agregar la orden.",
        });
    }
    console.log(
      "Ejecutando FactOrdenServicioAgregar con los siguientes datos:",
      {
        IdPuntoCarga: 1,
        IdPaciente: idPaciente,
        IdCuentaAtencion: idCuentaAtencion,
        IdServicioPaciente: idServicioPaciente,
        idTipoFinanciamiento: idTipoFinanciamiento,
        idFuenteFinanciamiento: idFuenteFinanciamiento,
        FechaCreacion: fechaHoraLima,
        IdUsuario: idUsuario,
        FechaDespacho: fechaHoraLima,
        IdUsuarioDespacho: idUsuario,
        IdEstadoFacturacion: 1,
        FechaHoraRealizaCpt: fechaHoraLima,
        IdUsuarioAuditoria: idUsuario,
      }
    );

    const resultOrden = await pool
      .request()
      .output("IdOrden", sql.Int)
      .input("IdPuntoCarga", sql.Int, 1)
      .input("IdPaciente", sql.Int, idPaciente)
      .input("IdCuentaAtencion", sql.Int, idCuentaAtencion)
      .input("IdServicioPaciente", sql.Int, idServicioPaciente)
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
    console.log("Orden de servicio agregada con ID:", idOrden);

    console.log("Ejecutando AuditoriaAgregar con los siguientes datos:", {
      IdEmpleado: idUsuario,
      Accion: "A",
      IdRegistro: idOrden,
      Tabla: "FactOrdenServicio",
    });

    await pool
      .request()
      .input("IdEmpleado", sql.Int, idUsuario)
      .input("Accion", sql.Char(1), "A")
      .input("IdRegistro", sql.Int, idOrden)
      .input("Tabla", sql.VarChar(50), "FactOrdenServicio")
      .execute("AuditoriaAgregar");

    for (const producto of productos) {
      console.log(
        "Ejecutando FacturacionServicioDespachoAgregar con los siguientes datos:",
        {
          idOrden: idOrden,
          IdProducto: producto.idProducto,
          Cantidad: producto.cantidad,
          Precio: producto.precio,
          Total: producto.total,
          labConfHIS: "",
          grupoHIS: null,
          subGrupoHIS: null,
          IdUsuarioAuditoria: idUsuario,
          idReceta: null,
          idDiagnostico: producto.idDiagnostico,
        }
      );

      await pool
        .request()
        .input("idOrden", sql.Int, idOrden)
        .input("IdProducto", sql.Int, producto.idProducto)
        .input("Cantidad", sql.Int, producto.cantidad)
        .input("Precio", sql.Money, producto.precio)
        .input("Total", sql.Money, producto.total)
        .input("labConfHIS", sql.VarChar(3), "")
        .input("grupoHIS", sql.Int, null)
        .input("subGrupoHIS", sql.Int, null)
        .input("IdUsuarioAuditoria", sql.Int, idUsuario)
        .input("idReceta", sql.Int, null)
        .input("idDiagnostico", sql.Int, producto.idDiagnostico)
        .input("labConfHIS2", sql.VarChar(3), "")
        .input("labConfHIS3", sql.VarChar(3), "")
        .query(`
            insert into FacturacionServicioDespacho (      
                idOrden,IdProducto,Cantidad,Precio,Total, labConfHIS,grupoHIS,subgrupoHIS,idReceta,idDiagnostico) values (      
                @idOrden,@IdProducto,@Cantidad,@Precio,@Total, @labConfHIS,@grupoHIS,@subgrupoHIS,@idReceta,@idDiagnostico, @labConfHIS2, @labConfHIS3
            )`
        );
    }

    return res.json({
      success: true,
      message: "Orden de servicio agregada correctamente",
      idOrden,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: false,
      message: "Error al agregar el servicio",
      error: error.message,
    });
  }
};
