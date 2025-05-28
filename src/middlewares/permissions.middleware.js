// src/middlewares/permissions.middleware.js
import jwt from "jsonwebtoken";

export const verificarAccionItem = (idItem, accion) => {
  return (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ mensaje: "No se proporcionó token" });
    }

    try {
      const decoded = jwt.verify(token, "secreto");
      req.usuario = decoded;

      // Si es admin (rol 1), permitir todo
      if (decoded.roles && decoded.roles.includes(1)) {
        return next();
      }

      // Verificar si tiene permiso para la acción específica en el ítem
      const tieneAccion = decoded.accionesItems && decoded.accionesItems.some(item => {
        if (item.id !== idItem) return false;
        
        // Verificar la acción específica
        switch(accion) {
          case 'agregar': return item.a === 1;
          case 'modificar': return item.m === 1;
          case 'eliminar': return item.e === 1;
          case 'consultar': return item.c === 1;
          default: return false;
        }
      });

      if (tieneAccion) {
        return next();
      }

      return res.status(403).json({ 
        mensaje: "No tiene permiso para esta acción" 
      });
    } catch (error) {
      return res.status(401).json({ mensaje: "Token inválido o expirado" });
    }
  };
};

export const verificarRol = (rolesRequeridos) => {
  return (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ mensaje: "No se proporcionó token" });
    }

    try {
      const decoded = jwt.verify(token, "secreto");
      req.usuario = decoded;

      // Verificar si el usuario tiene al menos uno de los roles requeridos
      const tieneRol = rolesRequeridos.some(role => 
        decoded.roles.includes(role)
      );

      if (!tieneRol) {
        return res.status(403).json({ 
          mensaje: "No tiene los permisos necesarios para acceder a este recurso" 
        });
      }

      next();
    } catch (error) {
      return res.status(401).json({ mensaje: "Token inválido o expirado" });
    }
  };
};

export const verificarPermiso = (permisosRequeridos) => {
  return (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ mensaje: "No se proporcionó token" });
    }

    try {
      const decoded = jwt.verify(token, "secreto");
      req.usuario = decoded;

      // Verificar si el usuario tiene al menos uno de los permisos requeridos
      const tienePermiso = permisosRequeridos.some(permiso => 
        decoded.permisos.includes(permiso)
      );

      if (!tienePermiso) {
        return res.status(403).json({ 
          mensaje: "No tiene los permisos necesarios para acceder a este recurso" 
        });
      }

      next();
    } catch (error) {
      return res.status(401).json({ mensaje: "Token inválido o expirado" });
    }
  };
};

export const verificarAccionesItem = (idItem, acciones = []) => {
  return (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ mensaje: "No se proporcionó token" });
    }

    try {
      const decoded = jwt.verify(token, "secreto");
      req.usuario = decoded;

      // Si es admin, tiene todos los permisos
      if (decoded.roles && decoded.roles.includes(1)) {
        return next();
      }

      // Obtener permisos específicos del item de la sesión
      const permisos = decoded.rolesItems || [];
      const itemPermiso = permisos.find(p => p.idItem === idItem);

      if (!itemPermiso) {
        return res.status(403).json({ 
          mensaje: "No tiene acceso a este recurso" 
        });
      }

      // Verificar cada acción requerida
      const tieneAcceso = acciones.every(accion => {
        switch(accion) {
          case 'agregar': return itemPermiso.agregar;
          case 'modificar': return itemPermiso.modificar;
          case 'eliminar': return itemPermiso.eliminar;
          case 'consultar': return itemPermiso.consultar;
          default: return false;
        }
      });

      if (!tieneAcceso) {
        return res.status(403).json({ 
          mensaje: "No tiene los permisos necesarios para esta acción" 
        });
      }

      next();
    } catch (error) {
      return res.status(401).json({ mensaje: "Token inválido o expirado" });
    }
  };
};

export const filtrarPorEspecialidad = () => {
  return (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ mensaje: "No se proporcionó token" });
    }

    try {
      const decoded = jwt.verify(token, "secreto");
      req.usuario = decoded;

      // Si no es médico o es admin, no aplicar filtro
      if (!decoded.isMedico || (decoded.roles && decoded.roles.includes(1))) { 
        req.filtroEspecialidades = null; // Explícitamente nulo, no undefined
        return next();
      }

      // Verificar que existe el array de especialidades antes de usarlo
      req.filtroEspecialidades = Array.isArray(decoded.especialidades) && 
                                decoded.especialidades.length > 0 
        ? decoded.especialidades 
        : null;
      
      // También almacenar el ID del médico para filtrar
      req.idMedico = decoded.idMedico || null;
      
      next();
    } catch (error) {
      return res.status(401).json({ mensaje: "Token inválido o expirado" });
    }
  };
};