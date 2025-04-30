

SELECT * from SIGH_EXTERNA..atencionesCE WHEre TriajeFecha>='20250414' order by idAtencion desc

SELECT DISTINCT LTRIM(RTRIM(NroDocumento)) AS NroDocumento
FROM Pacientes
WHERE NroDocumento IS NOT NULL
  AND LTRIM(RTRIM(NroDocumento)) <> ''
  AND LEN(LTRIM(RTRIM(NroDocumento))) >= 8

SELECT * from SIGH..Atenciones where IdAtencion=13742

use SIGH_EXTERNA
DECLARE @idAtencion Int = 149
SELECT TOP 1 idAtencion 
        FROM atencionesCE 
        WHERE idAtencion = @idAtencion


/*
20600876491
Whest Falia
920662164
70244729

1

*/

USE SIGH
-- Verificar esta tabla para el triaje (más adelante)
--exec TriajeListarVariableTodos 

--USE SIGH_EXTERNA
--exec TriajeValorNormalesSegunParamtros 8201,1,'2025-04-22 00:00:00',0

exec FacturacionCuentasAtencionSeleccionarPorId 266607


exec AtencionesDiagnosticosSeleccionarPorAtencion 266563,1

exec DiagnosticosSeleccionarPorId 50850

select * from AtencionesDatosAdicionales where idAtencion=266607

select * from PacientesDatosAdicionales where idPaciente=232248

select  * from Pacientes where NroDocumento='62962727'

select * from AtencionesDiagnosticos where IdAtencion=266607

select top 3 * from Diagnosticos

DECLARE @Fecha Date = '20250422';

WITH PacientesData AS (
    SELECT 
        pa.IdPaciente,
        pa.NroDocumento,
        LOWER(pa.ApellidoPaterno + ' ' + pa.ApellidoMaterno) AS ApellidosPaciente,
        LOWER(RTRIM(pa.PrimerNombre + ' ' + ISNULL(pa.SegundoNombre, '') + ' ' + ISNULL(pa.TercerNombre, ''))) AS NombresPaciente,
        pa.NroHistoriaClinica
    FROM Pacientes pa
    WHERE pa.NroDocumento IS NOT NULL
)

SELECT
        pd.NroDocumento,  -- Cambio: Usamos pd en lugar de pa
        a.IdAtencion,
        pd.ApellidosPaciente,
        pd.NombresPaciente,
        a.Edad, -- para registrar Triaje (atencionesCE)
        pd.NroHistoriaClinica, -- para registrar Triaje (atencionesCE)
        LOWER(s.Nombre) AS Servicio,
        s.IdServicio, -- para registrar Triaje (atencionesCE)
        LOWER(es.Nombre) AS Especialidad, 
        LOWER(d.Nombre) AS Departamento, 
        LOWER(e.Nombres) AS NombreDoctor, 
        LOWER(e.ApellidoPaterno + ' ' + e.ApellidoMaterno) AS ApellidoDoctor,  
        e.ApellidoPaterno + ' ' + e.ApellidoMaterno + ' ' + e.Nombres AS CitaMedico, -- para registrar Triaje (atencionesCE)
        CONVERT(varchar, p.Fecha, 23) AS FechaCita, 
        c.HoraInicio,
        c.HoraFin,
        FORMAT(c.FechaSolicitud, 'yyyy/MM/dd HH:mm') AS FechaSolicitud,
        e.Usuario,
        fu.Descripcion AS FuenteFinanciamiento,
        ISNULL(PDA.antecedentes,'') as antecedentes, -- para datos del modal
        ISNULL(PDA.antecedAlergico, '') AS antecedAlergico, -- para datos del modal
        ISNULL(PDA.antecedObstetrico, '') AS antecedObstetrico, -- para datos del modal
        ISNULL(PDA.antecedQuirurgico, '') AS antecedQuirurgico, -- para datos del modal
        ISNULL(PDA.antecedFamiliar, '') AS antecedFamiliar, -- para datos del modal
        ISNULL(PDA.antecedPatologico, '') AS antecedPatologico, -- para datos del modal
        t.Descripcion AS Estado
FROM ProgramacionMedica p
INNER JOIN Citas c 
    ON p.IdProgramacion = c.IdProgramacion
    AND c.Fecha >= @Fecha 
    AND c.Fecha < DATEADD(DAY, 1, @Fecha)  -- Corregido: agregamos 1 día a la fecha
INNER JOIN Servicios s ON p.IdServicio = s.IdServicio 
INNER JOIN Atenciones a ON c.IdAtencion = a.IdAtencion
INNER JOIN PacientesData pd ON c.IdPaciente = pd.IdPaciente  -- Usamos el alias correcto "pd"
LEFT JOIN PacientesDatosAdicionales PDA ON pd.IdPaciente = PDA.idPaciente
INNER JOIN FuentesFinanciamiento fu ON a.idfuenteFinanciamiento = fu.IdFuenteFinanciamiento
INNER JOIN TiposEstadosCita t ON c.IdEstadoCita = t.IdEstadoCita
INNER JOIN Medicos me ON p.IdMedico = me.IdMedico
INNER JOIN Empleados e ON me.IdEmpleado = e.IdEmpleado
INNER JOIN Especialidades es ON s.IdEspecialidad = es.IdEspecialidad 
INNER JOIN DepartamentosHospital d ON es.IdDepartamento = d.IdDepartamento
WHERE s.IdServicio IN (145, 149, 230, 312, 346, 347, 358, 367, 407)
ORDER BY c.Fecha, c.HoraInicio;

select top 3* from PacientesDatosAdicionales where idPaciente=232248
select top 3* from Pacientes where NroDocumento='62962727'

SELECT * from Pacientes where ApellidoMaterno = 'Arizapana' and PrimerNombre='Rocio'


select * from AtencionesDiagnosticos where IdAtencion >= 132835
select * from SIGH_EXTERNA..atencionesCE Where idAtencion>=132835

select * from Diagnosticos where CodigoCIE2004 like '%z3%'

select * from SubclasificacionDiagnosticos where IdSubclasificacionDx In (101, 102, 103)
select * from ClasificacionDiagnosticos


DECLARE @Codigo VARCHAR(100) = ''

SELECT IdDiagnostico, CodigoCIE9, Descripcion 
FROM Diagnosticos 
WHERE CodigoCIE2004 LIKE 
    CASE 
        WHEN @Codigo = '' THEN '%'
        ELSE @Codigo 
    END;




SELECT IdSubclasificacionDx, Codigo, Descripcion, IdClasificacionDx, IdTipoServicio
                FROM SubclasificacionDiagnosticos
                WHERE IdTipoServicio = 1
                ORDER BY Descripcion


select * from Atenciones where IdAtencion = 266617

SELECT * from SIGH_EXTERNA..atencionesCE where idAtencion=266618

select * from TiposEstadosCita


use SIGH
exec AtencionesModificar '08:00','2025-04-23 00:00:00',1,174948,266623,1,NULL,NULL,NULL,NULL,NULL,NULL,1,10,10,NULL,1,'14:57','2025-04-23 00:00:00',NULL,97,225,135,367,NULL,266623,16,3752,9,1,0,50776,3

SELECT * FROM TiposOrigenAtencion

SELECT * FROM TiposCondicionPaciente

select * from TiposServicio

select * from Servicios WHERE IdServicio = 149


-- EXEC PacientesActualizarAtencionPacienteSSES

select * from Atenciones WHERE IdAtencion=266623

exec AtencionesDiagnosticosEliminarXIdAtencion 266623

exec AtencionesEpisodiosDetalleSeleccionarXpaciente 174948

exec AtencionesEpisodiosCabeceraSeleccionarPorId 174948

exec AtencionesEpisodiosCabeceraAgregar 174948,1,'2025-04-23 00:00:00','2025-04-23 00:00:00',1

select * from AtencionesEpisodiosCabecera where idPaciente=407073

select * from AtencionesEpisodiosDetalle WHERE idPaciente=407073

select * from Pacientes where NroDocumento='70162216'

exec AtencionesEpisodiosDetalleAgregar 174948,1,266623,1

exec ListarOtrosProcedimientos 266623

exec AtencionesSeleccionarCEPorCuentaPorHistoriaPorApellidosPorServicio ' WHERE dbo.Atenciones.IdCuentaAtencion=266623      and dbo.Atenciones.IdServicioIngreso=367      and dbo.Atenciones.idTipoServicio=1  and dbo.Atenciones.esPacienteExterno<>1 order by Atenciones.FechaIngreso asc, Atenciones.HoraIngreso asc, Pacientes.ApellidoPaterno, Pacientes.ApellidoMaterno, Pacientes.PrimerNombre'

exec AtencionesModificar '08:00','2025-04-23 00:00:00',1,174948,266623,1,NULL,NULL,NULL,NULL,NULL,NULL,1,10,10,NULL,1,'14:57','2025-04-23 00:00:00',NULL,97,225,135,367,NULL,266623,16,3752,9,1,0,50776,3


exec AtencionesModificarIndicadores 266623,'2025-04-23 14:51:20'

use SIGH_EXTERNA
exec usp_update_atencionesCEModificar_20230926 266623,13082,NULL,'2025-04-23 08:00:00','HUAMANCHA GARRIAZO ROSA ANGELICA','PSICOPROFILAXIS',367,'motivo','examen','(U16.0-D -NIÑO /ADOLESCENTE/ PERSONA SANA) (B24.X-D -SIDA) 
¨',NULL,'tratamiento',NULL,'2025-04-23 14:57:00',3752,'97',NULL,'156',NULL,'80','2025-04-23 00:00:00',5021,NULL,NULL,NULL,NULL,NULL,1,NULL,$80.0000,3752

use sigh
select * from Atenciones where IdAtencion=266624

select * from Atenciones where IdAtencion=266623


select * from TiposCondicionPaciente

SELECT * from SIGH_EXTERNA..atencionesCE where idAtencion=266625

SELECT * from SIGH_EXTERNA..atencionesCE where idAtencion=132845

SELECT*FROM AtencionesDiagnosticos WHERE IdAtencion=132843

select * from Diagnosticos where IdDiagnostico=477

select * from Atenciones where IdAtencion=132845
select * from Pacientes where IdPaciente=293559

SELECT top 3 * from PacientesDatosAdicionales where idPaciente=206574

SELECT * from Pacientes where NroDocumento='62962727'

select top 3 * from AtencionesDiagnosticos

SELECT * from Empleados WHERE IdEmpleado=5021

select * from SubclasificacionDiagnosticos
  
select * from Pacientes where PrimerNombre='Francis'

select * from Atenciones where FechaIngreso<'20250101' and IdEspecialidadMedico <> 78

select * from Atenciones where IdAtencion=132852

select * from TiposMotivoAtencionEmergencia

select * from Pacientes where NroDocumento is not null and NroDocumento like '%00000007%'

select * from Pacientes where IdPaciente=426927

select IdAtencion, FechaIngreso, IdEspecialidadMedico from Atenciones where IdPaciente = 102120

select*from Servicios where IdServicio=177

SELECT * from Especialidades where IdEspecialidad=16

exec FactCatalogoServiciosSeleccionarTipoConsulta 78

select * from Atenciones where IdCuentaAtencion=132857

select * from AtencionesDiagnosticos where IdAtencion=266642

select * from FacturacionServicioDespacho

/*
FacturacionServicioDespachoAgregar

*/

exec FacturacionServicioDespachoAgregar

