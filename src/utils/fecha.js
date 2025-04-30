// utils/fecha.js
export const obtenerFechaHoraLima = () => {
  const fecha = new Date();
  fecha.setUTCHours(fecha.getUTCHours() - 5);
  return fecha;
};
