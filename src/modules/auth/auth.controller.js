// modules/auth/auth.controller.js
import { Conexion } from "../../config/database.js";
import jwt from "jsonwebtoken";
import sql from "mssql";
import bcrypt from 'bcrypt'

export async function iniciarSesion(req, res) {
  const { usuario, contraseña } = req.body;

  try {
    const pool = await Conexion();
    
    if (!usuario || !contraseña) {
      return res.status(400).json({ mensaje: "Usuario y contraseña son requeridos" });
    }

    // 1. Obtener datos de usuario
    const result = await pool.request()
      .input("Usuario", sql.VarChar(20), usuario)
      .query(`       
        SELECT 
        e.IdEmpleado, 
        Usuario,
        RTRIM(LTRIM(DNI)) as DNI,
        Nombres,
        ApellidoPaterno,
        ISNULL(m.IdMedico, 0) AS IdMedico,
        Password
        FROM Empleados e
        LEFT JOIN Medicos m ON e.IdEmpleado = m.IdEmpleado
        WHERE Usuario = @Usuario
      `);

    const user = result.recordset[0];
    if (!user) {
      return res.status(401).json({ mensaje: "Usuario no encontrado" });
    }

    const IdMedico = user.IdMedico;
    let medicoId = true;
    if (IdMedico === 0) {
      medicoId = false;
    }   

    // Verificar contraseña
    const contraHash = await bcrypt.compare(contraseña, user.Password);
    if (!contraHash) {
      return res.status(401).json({ mensaje: "Contraseña incorrecta" });
    }

    // 2. Obtener roles del usuario
    const rolesResult = await pool.request()
      .input("IdEmpleado", sql.Int, user.IdEmpleado)
      .query(`
        SELECT r.IdRol, r.Nombre AS NombreRol
        FROM UsuariosRoles ur
        INNER JOIN Roles r ON ur.IdRol = r.IdRol
        WHERE ur.IdEmpleado = @IdEmpleado
      `);

    const roles = rolesResult.recordset.map(r => ({
      id: r.IdRol,
      nombre: r.NombreRol
    }));

    // 3.1. Obtener permisos del usuario basado en sus roles
    const permisosResult = await pool.request()
      .input("IdEmpleado", sql.Int, user.IdEmpleado)
      .query(`
        SELECT DISTINCT rp.IdPermiso, p.Descripcion, p.Modulo
        FROM RolesPermisos rp
        INNER JOIN Permisos p ON rp.IdPermiso = p.IdPermiso
        INNER JOIN UsuariosRoles ur ON rp.IdRol = ur.IdRol
        WHERE ur.IdEmpleado = @IdEmpleado
      `);

    const permisos = permisosResult.recordset.map(p => ({
      id: p.IdPermiso,
      descripcion: p.Descripcion,
      modulo: p.Modulo
    }));

    // 4. Obtener acciones permitidas desde RolesItems
    const accionesResult = await pool.request()
      .input("IdEmpleado", sql.Int, user.IdEmpleado)
      .query(`
        SELECT DISTINCT ri.IdListItem, ri.Agregar, ri.Modificar, ri.Eliminar, ri.Consultar
        FROM RolesItems ri
        INNER JOIN UsuariosRoles ur ON ri.IdRol = ur.IdRol
        WHERE ur.IdEmpleado = @IdEmpleado
      `);

    const acciones = accionesResult.recordset.map(a => ({
      idItem: a.IdListItem,
      agregar: !!a.Agregar,
      modificar: !!a.Modificar,
      eliminar: !!a.Eliminar,
      consultar: !!a.Consultar
    }));

    // 5. Si es médico, obtener especialidades asignadas
    let especialidades = [];
    let idMedico = null;
    
    if (user.IdMedico > 0) {
      idMedico = user.IdMedico;
      
      const espResult = await pool.request()
        .input("IdMedico", sql.Int, idMedico)
        .query(`
          SELECT DISTINCT s.IdServicio, s.Nombre
          FROM ProgramacionMedica pm
          INNER JOIN Servicios s ON pm.IdServicio = s.IdServicio
          WHERE pm.IdMedico = @IdMedico
          AND s.IdServicio IN (145, 149, 230, 312, 346, 347, 358, 367, 407, 439)
        `);

      especialidades = espResult.recordset.map(e => ({
        id: e.IdServicio,
        nombre: e.Nombre
      }));
    }

    // 6. Generar token JWT con información completa
    const token = jwt.sign(
      {
        id: user.IdEmpleado,
        idMedico: idMedico,
        nombre: user.Nombres,       
        apellido: user.ApellidoPaterno,
        isMedico: user.IdMedico > 0,
        roles: roles.map(r => r.id),
        rolesNombre: roles.map(s => s.nombre),
        permisos: permisos.map(p => p.id),
        accionesItems: acciones.map(a => ({ 
          id: a.idItem, 
          a: a.agregar ? 1 : 0, 
          m: a.modificar ? 1 : 0, 
          e: a.eliminar ? 1 : 0, 
          c: a.consultar ? 1 : 0 
        })),
        especialidades: especialidades.map(e => e.id)
      },
      "secreto", 
      { expiresIn: "8h" }
    );

    res.json({ 
      mensaje: "Login exitoso", 
      token, 
      nombre: user.Nombres,
      apellido: user.ApellidoPaterno,
      isMedico: user.IdMedico > 0,
      idMedico: idMedico,
      roles: roles,
      permisos: permisos,
      acciones: acciones,
      especialidades: especialidades
    });

  } catch (error) {
    console.error("Error en login:", error);
    res.status(500).json({ mensaje: "Error al Iniciar Sesión" });
  }
}

export async function verificarToken(req, res) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ valid: false, mensaje: "No se proporcionó token" });
  }
  
  try {
    const decoded = jwt.verify(token, "secreto");
    return res.json({ valid: true, usuario: decoded });
  } catch (error) {
    return res.status(401).json({ valid: false, mensaje: "Token inválido o expirado" });
  }
}

