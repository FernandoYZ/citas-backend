CREATE PROCEDURE ObtenerCitasAccesiblesPorFecha
    @Fecha DATE
	AS
	BEGIN
		SELECT
			pa.NroDocumento,
			pa.ApellidoPaterno + ' ' + pa.ApellidoMaterno AS ApellidosPaciente,
			RTRIM(pa.PrimerNombre + ' ' + ISNULL(pa.SegundoNombre, '') + ' ' + ISNULL(pa.TercerNombre, '')) AS NombresPaciente,
			s.Nombre AS Servicio,
			es.Nombre AS Especialidad,
			d.Nombre AS Departamento,
			e.Nombres + ' ' + e.ApellidoPaterno + ' ' + e.ApellidoMaterno AS NombreDoctor,
			p.Fecha AS FechaCita,
			c.HoraInicio,
			c.FechaSolicitud,
			e.Usuario,
			fu.Descripcion AS FuenteFinanciamiento,
			t.Descripcion AS Estado
		FROM ProgramacionMedica p
		INNER JOIN Citas c 
			ON p.IdProgramacion = c.IdProgramacion
			AND c.FechaSolicitud >= @Fecha 
			AND c.FechaSolicitud < DATEADD(DAY, 1, @Fecha)
		INNER JOIN ServiciosAccesibles sac ON p.IdServicio = sac.IdServicio
		INNER JOIN Servicios s ON sac.IdServicio = s.IdServicio
		INNER JOIN Atenciones a ON c.IdAtencion = a.IdAtencion
		INNER JOIN Pacientes pa ON c.IdPaciente = pa.IdPaciente
		INNER JOIN FuentesFinanciamiento fu ON a.idfuenteFinanciamiento = fu.IdFuenteFinanciamiento
		INNER JOIN TiposEstadosCita t ON c.IdEstadoCita = t.IdEstadoCita
		INNER JOIN Medicos me ON p.IdMedico = me.IdMedico
		INNER JOIN Empleados e ON me.IdEmpleado = e.IdEmpleado
		INNER JOIN Especialidades es ON s.IdEspecialidad = es.IdEspecialidad 
		INNER JOIN DepartamentosHospital d ON es.IdDepartamento = d.IdDepartamento
		WHERE pa.NroDocumento IS NOT NULL;
END

exec ObtenerCitasAccesiblesPorFecha '2025-04-08'