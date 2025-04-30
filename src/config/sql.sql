USE SIGH 
declare @FechaInicio date = '2025-02-01'
declare @FechaFin date = '2025-02-28'
declare @dni int = '45376528' --INGRESE DNI DEL MEDICO

--select * from Empleados where ApellidoPaterno like '%tenorio%'LAZARTE_41990952
SELECT DISTINCT ad.IdAtencion,p.NroDocumento DNI,p.NroHistoriaClinica,P.ApellidoPaterno+' '+P.ApellidoMaterno+' '+P.PrimerNombre Nombre_Paciente,
ad.Edad,tp.Descripcion,
Ad.FechaEgreso Fecha_Atencion,
CASE 
        WHEN ad.IdTipoCondicionALEstab = 1 THEN 'Nuevo' 
        WHEN ad.IdTipoCondicionALEstab IN (2, 3) THEN 'Continuador' 
    END AS CondicionEstablecimiento,
    CASE 
        WHEN ad.IdTipoCondicionALServicio = 1 THEN 'Nuevo'
        WHEN ad.IdTipoCondicionALServicio IN (2, 3) THEN 'Continuador'  
    END AS CondicionServicio,
d.CodigoCIE10 CIE10,sd.Codigo TDiagnostico,ADS.labConfHIS LAB, d.Descripcion NombreCie10,S.Nombre,
E.ApellidoPaterno+' '+e.ApellidoMaterno+' '+e.Nombres Nombre_Medico,tss.Descripcion dd
   
from Atenciones ad


INNER JOIN FactOrdenServicio FOS ON FOS.IdCuentaAtencion=Ad.IdCuentaAtencion
INNER JOIN FacturacionServicioDespacho FSD ON FSD.idOrden=FOS.IdOrden
INNER JOIN TiposEdad tp ON tp.IdTipoEdad=ad.IdTipoEdad
LEFT JOIN FactCatalogoServicios FC ON FC.IdProducto=FSD.IdProducto
inner join Medicos M on m.idmedico = ad.IdMedicoIngreso
inner join Empleados E on e.IdEmpleado=m.IdEmpleado
inner join AtencionesDiagnosticos ads on ads.IdAtencion=ad.IdAtencion
inner join Diagnosticos d on d.IdDiagnostico=ads.IdDiagnostico
inner join Pacientes P ON P.IdPaciente=Ad.IdPaciente
inner JOIN SubclasificacionDiagnosticos SD ON SD.IdSubclasificacionDx=ads.IdSubclasificacionDx
INNER JOIN Servicios S ON S.IdServicio=ad.IdServicioIngreso
inner join TiposServicio tss on tss.IdTipoServicio=ad.IdTipoServicio
AND ad.FyHInicioI is NOT null 
and ad.FechaIngreso between @FECHAINICIO and @FECHAFIN
--AND S.IdServicio IN (250,408,409,410,411,412,413,414,417,423)
--AND AD.IdServicioIngreso IN (250,408,409,410,411,412,413,414,417)







SELECT  DISTINCT ad.IdAtencion,p.NroDocumento DNI,p.NroHistoriaClinica, P.ApellidoPaterno+' '+P.ApellidoMaterno+' '+P.PrimerNombre AS Nombre_Paciente,
        ad.Edad,tp.Descripcion AS Descripcion,Ad.FechaIngreso,
		CASE 
        WHEN ad.IdTipoCondicionALEstab = 1 THEN 'Nuevo'
        WHEN ad.IdTipoCondicionALEstab IN (2, 3) THEN 'Continuador'
    END AS CondicionEstablecimiento,
    CASE 
        WHEN ad.IdTipoCondicionALServicio = 1 THEN 'Nuevo'
        WHEN ad.IdTipoCondicionALServicio IN (2, 3) THEN 'Continuador' 
    END AS CondicionServicio,
		fc.Codigo CPT,'D' AS TDiagnostico ,FSD.labConfHIS LAB,FC.nombre NombreCie10, S.Nombre AS NombreServicio,E.ApellidoPaterno+' '+E.ApellidoMaterno+' '+E.Nombres AS Nombre_Medico,
		tss.Descripcion dd

FROM Atenciones ad
INNER JOIN FactOrdenServicio FOS ON FOS.IdCuentaAtencion=Ad.IdCuentaAtencion
INNER JOIN FacturacionServicioDespacho FSD ON FSD.idOrden=FOS.IdOrden
INNER JOIN TiposEdad tp ON tp.IdTipoEdad=ad.IdTipoEdad
LEFT JOIN FactCatalogoServicios FC ON FC.IdProducto=FSD.IdProducto
INNER JOIN Medicos M ON M.idmedico = ad.IdMedicoIngreso
INNER JOIN Empleados E ON E.IdEmpleado=M.IdEmpleado
INNER JOIN Pacientes P ON P.IdPaciente=Ad.IdPaciente
INNER JOIN Servicios S ON S.IdServicio=ad.IdServicioIngreso
inner join TiposServicio tss on tss.IdTipoServicio=ad.IdTipoServicio
WHERE ad.IdDestinoAtencion IS NOT NULL 
AND ad.FechaIngreso BETWEEN @FechaInicio AND @FechaFin
-- AND S.IdServicio  IN (250,408,409,410,411,412,413,414,417,423)
and not fc.Codigo in ('99203','9703501')
--AND AD.IdServicioIngreso IN (250,408,409,410,411,412,413,414,417)


--SELECT * FROM Servicios WHERE Nombre LIKE '%TERAPI%'


Select * from Atenciones


-- EXEC sp_rename 'AtencionesDiagnosticos.labConfHIS1', 'LabConfHIS', 'COLUMN';


SELECT * FROM ProgramacionMedica


exec RolesItemSeleccionarPermisosPorIdEmpleadoYIdListItem 3752,102

exec DepartamentosHospitalSeleccionarTodos

exec MedicosPorFiltroConEspecialidad ' where EsActivo = 1  order by Nombre'

exec ParametrosSeleccionarPorId 282

exec MedicosFiltrarPorProgramacion ' WHERE dbo.ProgramacionMedica.Fecha =CONVERT(DATETIME,''01/04/2025'',103) ORDER BY  dbo.Servicios.Nombre'

exec MedicosFiltrarPorProgramacion ' WHERE dbo.ProgramacionMedica.Fecha =CONVERT(DATETIME,''01/04/2025'',103) ORDER BY  dbo.Servicios.Nombre'

exec ProgramacionMedicaPorIdMedicoMesAnio 611,4,2025

exec EspecialidadesSeleccionarPorMedico 611

exec CitasSeleccionarDisponiblesPorMedicoEspecialidadYFecha 611,116,'2025-04-01 00:00:00'

exec CitasSeleccionarBloqueadasPorMedicoYFecha 611,'2025-04-01 00:00:00'

exec CitasSeleccionarPorMedicoYFecha 611,'2025-04-01 00:00:00'

exec CitasSeleeccionarPacientePorMedicoFechaHoras 611,'2025-04-01 00:00:00','14:00','18:00'

exec CitasSeleccionarDisponiblesPorMedicoEspecialidadYFecha 611,116,'2025-04-01 00:00:00'

exec CitasSeleccionarDisponiblesPorMedicoEspecialidadYFecha 611,117,'2025-04-01 00:00:00'

exec CitasSeleeccionarPacientePorMedicoFechaHoras 611,'2025-04-01 00:00:00','14:00','18:00'

exec CitasSeleccionarPorMedicoYFecha 611,'2025-04-01 00:00:00'

exec AtencionesSeleccionarPorIdAtencion 255415

exec AtencionesSeleccionarPorIdAtencion 256140

exec AtencionesSeleccionarPorIdAtencion 257176

exec CitasSeleeccionarPacientePorMedicoFechaHoras 611,'2025-04-01 00:00:00','14:00','18:00'

exec TurnosSeleccionarPorId 38

exec MedicosPorFiltroConEspecialidad ' where EsActivo = 1  order by Nombre'

exec MedicosFiltrarPorProgramacion ' WHERE dbo.ProgramacionMedica.Fecha =CONVERT(DATETIME,''01/04/2025'',103) ORDER BY  dbo.Servicios.Nombre'

exec EspecialidadCEseleccionarIdServicio 271

exec MedicosFiltrarPorProgramacion ' WHERE dbo.ProgramacionMedica.Fecha =CONVERT(DATETIME,''01/04/2025'',103) ORDER BY  dbo.Servicios.Nombre'

exec EspecialidadCEseleccionarIdServicio 271

exec ProgramacionMedicaPorIdMedicoMesAnio 611,4,2025

exec CitasSeleccionarDisponiblesPorMedicoEspecialidadYFecha 611,147,'2025-04-01 00:00:00'

exec CitasSeleccionarDisponiblesPorMedicoEspecialidadYFecha 611,147,'2025-04-01 00:00:00'

exec CitasSeleccionarBloqueadasPorMedicoYFecha 611,'2025-04-01 00:00:00'

exec AtencionesSeleccionarPorIdAtencion 255415

exec AtencionesSeleccionarPorIdAtencion 256140

exec AtencionesSeleccionarPorIdAtencion 257176

exec CitasSeleeccionarPacientePorMedicoFechaHoras 611,'2025-04-01 00:00:00','14:00','18:00'

exec TurnosSeleccionarPorId 38

exec EspecialidadesSeleccionarPorDepartamento 5

exec MedicosPorFiltroConEspecialidad ' where EsActivo = 1 and Especialidades.IdDepartamento = 5 order by Nombre'

exec MedicosFiltrarPorProgramacion ' WHERE dbo.ProgramacionMedica.Fecha =CONVERT(DATETIME,''01/04/2025'',103)       and dbo.ProgramacionMedica.IdDepartamento=5 ORDER BY  dbo.Servicios.Nombre'

exec MedicosFiltrarPorProgramacion ' WHERE dbo.ProgramacionMedica.Fecha =CONVERT(DATETIME,''01/04/2025'',103)       and dbo.ProgramacionMedica.IdDepartamento=5 ORDER BY  dbo.Servicios.Nombre'

exec EspecialidadCEseleccionarIdServicio 353

exec ProgramacionMedicaPorIdMedicoMesAnio 731,4,2025

exec EspecialidadesSeleccionarPorMedico 731

exec CitasSeleccionarDisponiblesPorMedicoEspecialidadYFecha 731,52,'2025-04-01 00:00:00'

exec CitasSeleccionarBloqueadasPorMedicoYFecha 731,'2025-04-01 00:00:00'

exec CitasSeleccionarPorMedicoYFecha 731,'2025-04-01 00:00:00'

exec CitasSeleeccionarPacientePorMedicoFechaHoras 731,'2025-04-01 00:00:00','14:00','18:00'

exec TurnosSeleccionarPorId 38

exec EspecialidadCEseleccionarIdServicio 353

exec ProgramacionMedicaPorIdMedicoMesAnio 731,4,2025

exec EspecialidadesSeleccionarPorMedico 731

exec EspecialidadCEseleccionarIdServicio 170

exec ProgramacionMedicaPorIdMedicoMesAnio 235,4,2025

exec EspecialidadesSeleccionarPorMedico 235

exec AtencionesSeleccionarPorIdAtencion 255990

exec AtencionesSeleccionarPorIdAtencion 256062

exec AtencionesSeleccionarPorIdAtencion 257104

exec AtencionesSeleccionarPorIdAtencion 256594

exec AtencionesSeleccionarPorIdAtencion 256625

exec CitasSeleeccionarPacientePorMedicoFechaHoras 235,'2025-04-01 00:00:00','14:00','18:00'

exec EspecialidadCEseleccionarIdServicio 349

exec ProgramacionMedicaPorIdMedicoMesAnio 244,4,2025

exec EspecialidadesSeleccionarPorMedico 244

exec CitasSeleccionarDisponiblesPorMedicoEspecialidadYFecha 244,54,'2025-04-01 00:00:00'

exec CitasSeleccionarBloqueadasPorMedicoYFecha 244,'2025-04-01 00:00:00'

exec AtencionesSeleccionarPorIdAtencion 255213

exec TurnosSeleccionarPorId 36

exec EspecialidadCEseleccionarIdServicio 149

exec ProgramacionMedicaPorIdMedicoMesAnio 536,4,2025

exec EspecialidadesSeleccionarPorMedico 536

exec CitasSeleccionarDisponiblesPorMedicoEspecialidadYFecha 536,78,'2025-04-01 00:00:00'

exec EspecialidadCEseleccionarIdServicio 149

exec ProgramacionMedicaPorIdMedicoMesAnio 536,4,2025

exec EspecialidadesSeleccionarPorMedico 536

exec EspecialidadCEseleccionarIdServicio 149

exec ProgramacionMedicaPorIdMedicoMesAnio 536,4,2025

exec CitasSeleeccionarPacientePorMedicoFechaHoras 536,'2025-04-01 00:00:00','14:00','18:00'

exec DepartamentosHospitalSeleccionarTodos 

exec ParametrosSeleccionarPorId 174

exec SunasaTiposParentescoSeleccionarTodos 

exec SunasaTiposOperacionSeleccionarTodos 

exec SunasaTiposAfiliacionSeleccionarTodos 

exec SunasaTiposRegimenSeleccionarTodos 

exec EtniaHISseleccionarTodos 

exec TiposIdiomasSeleccionarTodos 

exec TiposDocIdentidadSeleccionarTodosIncSinTipoDoc 

exec TiposEdadSeleccionarTodos 

exec ParametrosSeleccionarPorId 172

exec ProvinciasSeleccionarPorDepartamento 15

exec RolesPermisosXidEmpleado 3752

exec FactCatalogoServiciosSeleccionarTipoConsulta 78

exec EspecialidadesSeleccionarPorId 78

exec ServiciosSeleccionarConsultoriosPorEspecialidad 78

exec MedicosSeleccionarPorIdMedicoPlanilla 536

exec TiposNumeracionHistoriaSeleccionarDeConsultaExterna 

exec ParametrosSeleccionarPorId 211

exec ServiciosSeleccionarXidentificador 149

exec ProvinciasSeleccionarPorDepartamento 15

exec PacientesFiltraPorNroDocumentoYtipo '62962727',1

exec RetornaFechaServidorSQL 


SELECT a.IdAtencion, a.FechaIngreso, a.HoraIngreso, a.IdEstadoAtencion,
                   CASE 
                    WHEN a.idEstadoAtencion = 1 THEN 'En espera'
                    WHEN a.idEstadoAtencion = 2 THEN 'Atendiendo'
                    WHEN a.idEstadoAtencion = 3 THEN 'Atendido'
                    ELSE 'Sin estado'
                   END as EstadoDescripcion,
                   p.IdPaciente, p.ApellidoPaterno, p.ApellidoMaterno, p.PrimerNombre,
                   p.IdTipoSexo, ts.Descripcion as Sexo,
                   a.Edad, te.Descripcion as TipoEdad,
                   s.IdServicio, s.Nombre as Servicio,
                   m.IdMedico, e.ApellidoPaterno + ' ' + e.ApellidoMaterno + ' ' + e.Nombres as NombreMedico
            FROM Atenciones a
            INNER JOIN Pacientes p ON a.IdPaciente = p.IdPaciente
            INNER JOIN Servicios s ON a.IdServicioIngreso = s.IdServicio
            INNER JOIN TiposSexo ts ON p.IdTipoSexo = ts.IdTipoSexo
            LEFT JOIN TiposEdad te ON a.IdTipoEdad = te.IdTipoEdad
            LEFT JOIN Medicos m ON a.IdMedicoIngreso = m.IdMedico
            LEFT JOIN Empleados e ON m.IdEmpleado = e.IdEmpleado
            WHERE CONVERT(date, a.FechaIngreso) = CONVERT(date, GETDATE())