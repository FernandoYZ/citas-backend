// services/citasService.js
import { citasRepository } from "../repositories/citas.repository.js";

class CitasService {
  async obtenerCitasSeparadas(fechaInicio, fechaFin, filtroEspecialidades) {
    try {
      // Obtener datos básicos de citas
      const citasBasicas = await citasRepository.obtenerCitasPorRangoFecha(fechaInicio, fechaFin, filtroEspecialidades);

      // Enriquecer con estado de triaje (en batch)
      const citasConTriaje = await citasRepository.obtenerEstadosTriaje(
        citasBasicas
      );

      return citasConTriaje;
    } catch (error) {
      console.error("Error en servicio de citas:", error);
      throw error;
    }
  }

  async obtenerCitaDetallada(idCita, idPaciente) {
    // Combinar datos básicos con detalles adicionales bajo demanda
    // Esto se llamaría solo cuando se necesite ver el detalle completo
    try {
      // Obtener datos adicionales del paciente
      const datosPaciente = await citasRepository.obtenerDatosPaciente(
        idPaciente
      );

      // Aquí se podrían obtener más datos relacionados a la cita específica

      return {
        idCita,
        idPaciente,
        datosPaciente,
      };
    } catch (error) {
      console.error("Error al obtener detalles de cita:", error);
      throw error;
    }
  }

  async actualizarDatosCita(idCita, datos) {
    try {
      // Lógica para actualizar datos

      // Importante: invalidar caché después de actualizar
      citasRepository.invalidarCache(datos.fecha);

      return { success: true };
    } catch (error) {
      console.error("Error al actualizar cita:", error);
      throw error;
    }
  }
}

export const citasService = new CitasService();
