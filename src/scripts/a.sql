DROP INDEX IF EXISTS IX_farmSaldo_cantidad ON dbo.farmSaldo;
DROP INDEX IF EXISTS IX_farmSaldo_producto_almacen ON dbo.farmSaldo;

-- Eliminar índice de la tabla farmAlmacen
DROP INDEX IF EXISTS IX_farmAlmacen_tipo ON dbo.farmAlmacen;

-- Eliminar índice de la tabla FactCatalogoBienesInsumos
DROP INDEX IF EXISTS IX_FactCatalogo_busqueda ON dbo.FactCatalogoBienesInsumos;

select Usuario, LTRIM(RTRIM(DNI)) as DNI from Empleados where Usuario ='ngaspar'

SELECT 
    pa.IdPaciente,
    TDI.Descripcion as TipoDocumento,
    pa.NroDocumento,
    pa.ApellidoPaterno + ' ' + pa.ApellidoMaterno AS ApellidosPaciente,
    UPPER(RTRIM(pa.PrimerNombre + ' ' + ISNULL(PA.SegundoNombre, '') + ' ' + ISNULL(PA.TercerNombre,''))) AS NombrePaciente,
    pa.NroHistoriaClinica,
    PA.FechaNacimiento
FROM Pacientes PA 
INNER JOIN TiposDocIdentidad TDI on PA.IdDocIdentidad=TDI.IdDocIdentidad
WHERE NroDocumento='62962727'


exec MedicosPorFiltroConEspecialidad ' where EsActivo = 1  order by Nombre'

exec ProgramacionMedicaSeleccionarPorId 37348 -- retorna la programación médica por el id seleccionado // se usa el id el médico
exec EspecialidadesSeleccionarPorMedico 535 
exec FactCatalogoServiciosSeleccionarTipoConsulta 78 -- retorna el idProducto para la tabla FacturacionServicioDespacho
exec EspecialidadesSeleccionarPorId 78 -- retorna el servicio
exec MedicosSeleccionarPorIdMedicoPlanilla 535

exec ServiciosSeleccionarXidentificador 149

exec PacientesFiltraPorNroDocumentoYtipo '25780879',1 -- autocompletado

exec AtencionesSeleccionarPorIdPaciente 206574,1

exec PacientesSeleccionarPorId 206574

exec SunasaPacientesHistoricosSeleccionarPorIdPaciente 206574 -- para filtrar 

exec FacturacionCuentasAtencionSeleccionarPorIdPaciente 206574

SELECT * FROM Empleados
                      
exec HistoriasClinicasXIdPaciente 206574

exec TiposCondicionPacienteCondicionAlEstablecimientoYservicio 206574,'2025-04-09 00:00:00',0

exec CatalogoServiciosHospSeleccionarXidProductoIdTipoFinanciamiento 4584,16

exec PacientesTieneCita ' where  dbo.Citas.Fecha = ''29/04/2025'' and dbo.Citas.IdServicio = 149'


DECLARE @idServicio int = 149
SELECT s.IdServicio, s.Nombre, s.IdEspecialidad
                FROM Servicios s
                INNER JOIN ServiciosAccesibles sa ON s.IdServicio = sa.idServicio
                WHERE s.IdServicio = @idServicio

select * from TiposEstadosCita

exec FacturacionCuentasAtencionxIdCuentaAtencion 0,261729

select * from Medicos where IdMedico=535

select * from ProgramacionMedica where IdServicio=149 and Fecha='20250409' order by IdProgramacion desc

select top 5 * from ProgramacionMedica where Fecha='20250414'    

select * from   SIGH_EXTERNA..atencionesCE where idAtencion = 132810


SELECT TOP 1 1 AS existe 
        FROM SIGH_EXTERNA..atencionesCE 
        WHERE idAtencion = 132810

SELECT COLUMN_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Pacientes';

select * from TiposSexo

select top 1 * from SIGH_EXTERNA..atencionesCE where CitaIdServicio=149 order by idAtencion desc

select top 1 * from Atenciones where IdServicioIngreso=149 order by IdAtencion desc 

SELECT IdPaciente From Pacientes WHERE NroDocumento = '25780879'

declare @IdPaciente INT = 206574
SELECT IdTipoSexo FROM Pacientes where IdPaciente=@IdPaciente

select * from TiposSexo

select * from UsuariosRoles

SELECT * from Roles

INSERT INTO ProgramacionMedica (
    IdMedico,
    IdDepartamento,
    Fecha,
    HoraInicio,
    HoraFin,
    IdTipoProgramacion,
    Descripcion,
    IdTurno,
    IdEspecialidad,
    Color,
    IdServicio,
    IdTipoServicio,
    FechaReg,
    TiempoPromedioAtencion,
    HoraFinProgramacion
)
VALUES (
    555,
    5,
    '20250507',
    '08:00',
    '12:00',
    1,
    NULL,
    36,
    NULL,
    -2147483643,  
    228,          
    1,         
    '20250507',
    15,
    '12:00'
);

SELECT * from Empleados where Nombres like '%Roxana%' and ApellidoPaterno like '%Araujo%'

select * from Medicos where IdEmpleado=3444

select*from Diagnosticos where CodigoCIE2004 like '%u16%'

SELECT DISTINCT LTRIM(RTRIM(NroDocumento)) AS NroDocumento
FROM Pacientes
WHERE NroDocumento IS NOT NULL
  AND LTRIM(RTRIM(NroDocumento)) <> ''
  AND LEN(LTRIM(RTRIM(NroDocumento))) >= 8

  SELECT DISTINCT LTRIM(RTRIM(NroDocumento)) AS NroDocumento
FROM Pacientes
WHERE NroDocumento IS NOT NULL
  AND LTRIM(RTRIM(NroDocumento)) <> ''
  AND LEN(LTRIM(RTRIM(NroDocumento))) >= 8
  AND LEFT(LTRIM(RTRIM(NroDocumento)), 6) = '000000'


SELECT * from Empleados where Usuario = 'rcruz'

INSERT INTO Empleados (
    ApellidoPaterno, ApellidoMaterno, Nombres, IdCondicionTrabajo, IdTipoEmpleado,
    DNI, CodigoPlanilla, FechaIngreso, FechaAlta, Usuario, Clave, loginEstado, loginPC,
    FechaNacimiento, idTipoDestacado, IdEstablecimientoExterno, HisCodigoDigitador,
    ReniecAutorizado, idTipoDocumento, idSupervisor, esActivo, AccedeVWeb, ClaveVWeb,
    Ris_estado, telefono, correo, Interconsultas, esAuditor, sexo, pais, AccesoCE,
    idArea, idSexo
)
VALUES (
    'Yovera', 'Zavala', 'Fernando Cesar', 32, 241, '62962727', '62962727',
    NULL, NULL, 'FYOV', 'trBuXaInwaahf5ah6+u1oa0vxFM5C0ko1WMpoDcQhyg=', 0, 'DESKTOP-CEQNJ3G',
    '2002-11-08 00:00:00.000', 3, NULL, NULL, 1, 1, NULL, 1, 0,
    NULL, NULL, '940466753', 'fernandozavala266@gmail.com', 0, 0,
    NULL, NULL, NULL, 0, NULL
);


select top 1 * from SIGH_EXTERNA..atencionesCE where CitaFecha is not null order by idAtencion desc

select * from HistoriasClinicas where NroHistoriaClinica = 92288319

select * from Citas order by IdCita desc

SELECT * FROM Pacientes WHERE NroHistoriaClinica LIKE '%123497%';

select * from Atenciones

select * from Medicos m 
INNER JOIN Empleados e ON m.IdEmpleado = e.IdEmpleado
where e.ApellidoPaterno LIKE '%CHIPANA%'

SELECT DNI from Empleados where Usuario='rcruz'

SELECT * from Empleados where IdEmpleado=3479
           
SELECT DISTINCT LTRIM(RTRIM(NroDocumento)) AS NroDocumento, IdPaciente
FROM Pacientes
WHERE NroDocumento IS NOT NULL
  AND LTRIM(RTRIM(NroDocumento)) <> ''
  AND LEN(LTRIM(RTRIM(NroDocumento))) >= 8

  SELECT TOP 1 idAtencion 
        FROM SIGH_EXTERNA..atencionesCE 
        WHERE idAtencion = 13492

declare @HoraInicio CHAR(5) = '08:15'
declare @IdPaciente int = 360114
select COUNT(*) as HorasSeparadas from Citas 
where HoraInicio=@HoraInicio and IdPaciente = @IdPaciente and Fecha=''

select HoraInicio from Citas where IdPaciente=360114 and Fecha='20250415'
  
-- 00014006	360114

SELECT COUNT(*) as citasExistentes
                FROM Atenciones a
                WHERE a.IdPaciente = 360114
                AND a.IdServicioIngreso = 149
                AND CONVERT(date, a.FechaIngreso) = CONVERT(date, '20250415')
                --AND a.idEstadoAtencion <> 4 -- No contar canceladas

SELECT * FROM Atenciones

select * from TiposEstadosCita


DECLARE @Usuario VARCHAR(50) = 'MALDANA' 
      -- Tabla Medicos
      SELECT
        m.IdEmpleado,
        e.Usuario,
        LTRIM(RTRIM(e.DNI)) AS DNI,
        e.Nombres,
        e.ApellidoPaterno 
      FROM Medicos m 
      INNER JOIN Empleados e on m.IdEmpleado = e.IdEmpleado
        -- Tabla Empleados
        /*
        SELECT 
          IdEmpleado, 
          Usuario,
          LTRIM(RTRIM(DNI)) AS DNI,
          Nombres,
          ApellidoPaterno 
        FROM Empleados 
        */
        WHERE Usuario = @Usuario
SELECT TOP 2 * FROM Medicos

SELECT top 2* from Servicios
SELECT * from Especialidades WHERE MedicoNoMedico = 246
Select top 2* from DepartamentosHospital

select * from TiposServicio

DECLARE @fechaActual DATETIME = GETDATE()
PRINT('Fecha actual: ' + CONVERT(VARCHAR, @fechaActual, 120))


select * from FacturacionCuentasAtencion where FechaCreacion>='20250413'

SELECT * from Atenciones where FechaIngreso>='20250413'

SELECT * from Citas where FechaSolicitud>='20250413'


DECLARE @fecha date='20250413'
--declare @idServicio int = 149
SELECT DISTINCT pm.IdMedico,
LOWER(E.Nombres + ' ' + E.ApellidoPaterno + ' ' + E.ApellidoMaterno) AS Doctor
FROM ProgramacionMedica PM
INNER JOIN Medicos M ON PM.IdMedico = M.IdMedico
INNER JOIN Empleados E ON M.IdEmpleado = E.IdEmpleado
WHERE Fecha = @fecha AND 
PM.IdServicio = @idServicio;


drop PROCEDURE PacienteXNroDocumento

-- Esta vaina para mostrar en la tabla
declare @Fecha Date = '20250419'

SELECT
    pa.NroDocumento,
    a.IdAtencion,
    LOWER(pa.ApellidoPaterno + ' ' + pa.ApellidoMaterno) AS ApellidosPaciente,
    LOWER(RTRIM(pa.PrimerNombre + ' ' + ISNULL(pa.SegundoNombre, '') + ' ' + ISNULL(pa.TercerNombre, ''))) AS NombresPaciente,
    a.Edad, -- (DB2)
    pa.NroHistoriaClinica, -- (DB2)
    LOWER(s.Nombre) AS Servicio,
    s.IdServicio, -- (DB2)
    LOWER(es.Nombre) AS Especialidad, 
    LOWER(d.Nombre) AS Departamento, 
    LOWER(e.Nombres) AS NombreDoctor, 
    LOWER(e.ApellidoPaterno + ' ' + e.ApellidoMaterno) AS ApellidoDoctor,  
    e.ApellidoPaterno + ' ' + e.ApellidoMaterno + ' ' + e.Nombres AS CitaMedico, -- (DB2)
    CONVERT(varchar, p.Fecha, 23) AS FechaCita, 
    c.HoraInicio,
    c.HoraFin,
    FORMAT(c.FechaSolicitud, 'yyyy/MM/dd HH:mm') AS FechaSolicitud,
    e.Usuario,
    fu.Descripcion AS FuenteFinanciamiento,
    t.Descripcion AS Estado
FROM ProgramacionMedica p
INNER JOIN Citas c 
    ON p.IdProgramacion = c.IdProgramacion
    AND c.Fecha >= @Fecha 
    AND c.Fecha < DATEADD(DAY, 1, @Fecha)
INNER JOIN Servicios s ON p.IdServicio = s.IdServicio 
INNER JOIN Atenciones a ON c.IdAtencion = a.IdAtencion
INNER JOIN Pacientes pa ON c.IdPaciente = pa.IdPaciente
INNER JOIN FuentesFinanciamiento fu ON a.idfuenteFinanciamiento = fu.IdFuenteFinanciamiento
INNER JOIN TiposEstadosCita t ON c.IdEstadoCita = t.IdEstadoCita
INNER JOIN Medicos me ON p.IdMedico = me.IdMedico
INNER JOIN Empleados e ON me.IdEmpleado = e.IdEmpleado
INNER JOIN Especialidades es ON s.IdEspecialidad = es.IdEspecialidad 
INNER JOIN DepartamentosHospital d ON es.IdDepartamento = d.IdDepartamento
WHERE pa.NroDocumento IS NOT NULL
AND s.IdServicio IN (145, 149, 230, 312, 346, 347, 358, 367, 407, 439);


declare @idMedico int = 535;
declare @idServicio int = 149;
declare @fecha date = '20250421';
WITH HorasProgramadas AS (
          SELECT 
              IdProgramacion,
              HoraInicio,
              HoraFin,
              TiempoPromedioAtencion
          FROM 
              ProgramacionMedica
          WHERE 
              IdMedico = @idMedico
              AND CONVERT(date, Fecha) = CONVERT(date, @fecha)
              AND IdServicio = @idServicio
      ),
      -- CTE para obtener las horas ocupadas en la tabla Citas
      HorasOcupadas AS (
          SELECT 
              HoraInicio
          FROM 
              Citas
          WHERE 
              Fecha = @fecha
              AND IdServicio = @idServicio
      )
      -- Generamos las horas disponibles dentro de cada intervalo de ProgramacionMedica
      SELECT 
          FORMAT(DATEADD(MINUTE, (N.N - 1) * HP.TiempoPromedioAtencion, HP.HoraInicio), 'HH:mm') AS HoraInicioDisponible,
          FORMAT(DATEADD(MINUTE, N.N * HP.TiempoPromedioAtencion, HP.HoraInicio), 'HH:mm') AS HoraFinDisponible
      FROM 
          HorasProgramadas HP
      CROSS APPLY 
          (SELECT 1 AS N UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 
          UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10) AS N
      WHERE 
          DATEADD(MINUTE, (N.N - 1) * HP.TiempoPromedioAtencion, HP.HoraInicio) < HP.HoraFin
          AND NOT EXISTS (
              SELECT 1
              FROM HorasOcupadas HO
              WHERE HO.HoraInicio = DATEADD(MINUTE, (N.N - 1) * HP.TiempoPromedioAtencion, HP.HoraInicio)
          )
      ORDER BY 
          HoraInicioDisponible;




