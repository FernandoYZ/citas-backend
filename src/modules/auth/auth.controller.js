import { Conexion } from "../../config/database.js";
import jwt from "jsonwebtoken";
import sql from "mssql";

export async function iniciarSesion(req, res) {
  const { usuario, contraseña } = req.body;

  try {
    const pool = await Conexion();
    const result = await pool
      .request()
      .input("Usuario", sql.NVarChar, usuario)
      .query(`
        -- Tabla Medicos
        /*
        SELECT
          m.IdEmpleado,
          e.Usuario,
          LTRIM(RTRIM(e.DNI)) AS DNI,
          e.Nombres,
          e.ApellidoPaterno 
        FROM Medicos m 
        INNER JOIN Empleados e on m.IdEmpleado = e.IdEmpleado
        */
        -- Tabla Empleados
        
        SELECT 
          IdEmpleado, 
          Usuario,
          LTRIM(RTRIM(DNI)) AS DNI,
          Nombres,
          ApellidoPaterno 
        FROM Empleados 
        
        WHERE Usuario = @Usuario
      `);

    const user = result.recordset[0];
    if (!user) {
      return res.status(401).json({ mensaje: "Usuario no encontrado" });
    }

    // Comparar contraseña ingresada con el DNI del usuario
    if (contraseña !== user.DNI) {
      return res.status(401).json({ mensaje: "Contraseña incorrecta" });
    }

    // Generar token JWT - Asegurarse de que las propiedades coincidan con lo que espera el frontend
    const token = jwt.sign(
      {
        id: user.IdEmpleado,
        nombre: user.Nombres,       // Usar nombre (no Nombres)
        apellido: user.ApellidoPaterno, // Usar apellido (no ApellidoPaterno)
      },
      "secreto", 
      { expiresIn: "1h" }
    );

    res.json({ 
      mensaje: "Login exitoso", 
      token, 
      nombre: user.Nombres,
      apellido: user.ApellidoPaterno
    });

  } catch (error) {
    console.error("Error en login:", error);
    res.status(500).json({ mensaje: "Error en el servidor" });
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