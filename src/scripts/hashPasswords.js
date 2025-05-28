// src/scripts/hashPasswords.js
// rehash-passwords.js
import { Conexion } from "../config/database.js";
import bcrypt from "bcrypt";
import sql from "mssql";

const rehashPasswords = async () => {
  try {
    const saltRounds = 12;
    const pool = await Conexion();
    
    // Obtener todos los empleados
    const empleados = await pool.request().query(`
      SELECT IdEmpleado, Usuario, DNI 
      FROM Empleados 
      WHERE DNI IS NOT NULL AND DNI <> ''
    `);
    
    console.log(`Procesando ${empleados.recordset.length} empleados...`);
    
    // Procesar cada empleado
    for (const empleado of empleados.recordset) {
      const { IdEmpleado, Usuario, DNI } = empleado;
      
      // Eliminar TODOS los espacios y caracteres no numéricos
      const dniLimpio = DNI.replace(/\D/g, '');
      
      if (!dniLimpio) {
        console.log(`Saltando ${Usuario}, DNI no válido`);
        continue;
      }
      
      // Generar nuevo hash con la contraseña limpia
      const hash = await bcrypt.hash(dniLimpio, saltRounds);
      
      // Actualizar en la base de datos
      await pool.request()
        .input('hash', sql.NVarChar, hash)
        .input('idEmpleado', sql.Int, IdEmpleado)
        .query(`
          UPDATE Empleados
          SET Password = @hash
          WHERE IdEmpleado = @idEmpleado
        `);
      
      console.log(`✅ Actualizado ${Usuario} (ID: ${IdEmpleado}), DNI limpio: ${dniLimpio}`);
    }
    
    console.log("Proceso completado con éxito");
  } catch (error) {
    console.error("Error:", error);
  }
};

rehashPasswords();

// node src/scripts/hashPasswords.js
