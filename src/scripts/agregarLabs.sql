-- AtencionesDiagnosticos
ALTER TABLE AtencionesDiagnosticos  
ADD LabConfHIS2 CHAR(3) NULL,  
    LabConfHIS3 CHAR(3) NULL;

-- FacturacionServicioDespacho
ALTER TABLE FacturacionServicioDespacho  
ADD LabConfHIS2 CHAR(3) NULL,  
    LabConfHIS3 CHAR(3) NULL,
    PDR CHAR(3) NULL;

-- control de contraseñas

ALTER TABLE Empleados ADD Password VARCHAR(100);
UPDATE Empleados SET Password = REPLACE(REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(DNI)), ' ', ''),CHAR(9), ''),CHAR(10), ''),CHAR(13), '');

---

SELECT IdMedico,IdServicio FROM ProgramacionMedica where Fecha='20250526' and IdServicio=146

select top 100 Usuario, LTRIM(RTRIM(DNI)) as dni from Empleados


SELECT DISTINCT LTRIM(RTRIM(NroDocumento)) AS NroDocumento
FROM Pacientes
WHERE NroDocumento IS NOT NULL
  AND LTRIM(RTRIM(NroDocumento)) <> ''
  AND LEN(LTRIM(RTRIM(NroDocumento))) >= 8


select * from Servicios where Nombre like '%est. control de tb - ce.%'

SELECT 
  ur.IdUsuarioRol,
  e.IdEmpleado ,e.ApellidoPaterno+ ' ' + e.ApellidoMaterno + ' ' + e.Nombres AS Empleado,
  r.idrol,
  r.nombre AS NombreRol
FROM UsuariosRoles ur
JOIN Empleados e ON ur.idempleado = e.IdEmpleado
JOIN Roles r ON ur.idrol = r.idrol

SELECT Usuario, DNI, Password FROM Empleados where Usuario = 'YESPINO'



select * from FactCatalogoServicios where Codigo like '%D7410%'

select top 10 * from FacturacionServicioDespacho order by idOrden desc

    ALTER TABLE AtencionesDiagnosticos
ALTER COLUMN LabConfHIS2 CHAR(3) NULL;


ALTER TABLE AtencionesDiagnosticos
ALTER COLUMN LabConfHIS3 CHAR(3) NULL;


UPDATE Empleados
SET Clave = REPLACE(REPLACE(DNI, ' ', ''), CHAR(9), '')
WHERE DNI IS NOT NULL AND DNI <> '';

select top 3 * from Empleados where Usuario like '%fyov%'

select top 3* from SIGH_EXTERNA..atencionesCE where idAtencion = 266644


select * from FactCatalogoServiciosHosp

exec FactCatalogoServiciosHospFiltraPorPuntoCargaTipoFinanciamiento 649,16,2,'5',1

select * from FactPuntosCarga where idServicio=367
exec FactCatalogoServiciosXidTipoFinanciamiento 50562,16

exec TiposFinanciamientoSeleccionarPorId 16

select *from Empleados where IdEmpleado =138821

-- 
select * from TiposEstadosCita

----------

select * from SIGH_EXTERNA..atencionesCE where idAtencion = 272254

select * from MAESTRO_HIS_OTRA_CONDICION

exec RetornaFechaServidorSQL

EXEC ParametrosSeleccionarPorId 346

exec TurnosSeleccionarPorIdentificador 38

exec ProgramacionMedicaSeleccionarXidentificador 37357

SELECT top 10 * FROM FacturacionCuentasAtencion ORDER by IdCuentaAtencion desc  --Todo bien al ejecutar
SELECT top 10 * FROM Atenciones ORDER by IdAtencion desc 
SELECT top 10 * FROM Citas ORDER by IdCita desc
SELECT top 10 * FROM SIGH_EXTERNA..atencionesCE ORDER by idAtencion desc

select top 10 * from AtencionesDiagnosticos order by IdAtencionDiagnostico desc 

SELECT TOP 1 IdEmpleado FROM Empleados ORDER BY IdEmpleado

SELECT * FROM Especialidades WHERE IdEspecialidad = 149

select top 3* from Pacientes where NroDocumento is not null and IdDocIdentidad=2 and NroDocumento like '%66%'

select * from Empleados where ApellidoPaterno like '%ESPINO%' AND ApellidoMaterno LIKE '%SERVELEON%'

SELECT * FROM Medicos WHERE IdEmpleado=3633

SELECT TOP 3 IdMedico, Fecha, HoraInicio, HoraFin FROM ProgramacionMedica where IdServicio=149 and Fecha='20250428'and IdMedico=535

DECLARE @idMedico INT = 535, 
        @fecha DATE = '2025-04-28', 
        @idServicio INT = 149;

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
-- Generamos una tabla de números suficiente (aquí hasta 100)
Numeros AS (
    SELECT TOP (100) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS N
    FROM sys.all_objects
),
-- Citas ocupadas
HorasOcupadas AS (
    SELECT 
        HoraInicio
    FROM 
        Citas
    WHERE 
        Fecha = @fecha
        AND IdServicio = @idServicio
)
SELECT 
    FORMAT(DATEADD(MINUTE, (N.N - 1) * HP.TiempoPromedioAtencion, HP.HoraInicio), 'HH:mm') AS HoraInicioDisponible,
    FORMAT(DATEADD(MINUTE, N.N * HP.TiempoPromedioAtencion, HP.HoraInicio), 'HH:mm') AS HoraFinDisponible
FROM 
    HorasProgramadas HP
JOIN 
    Numeros N ON DATEADD(MINUTE, (N.N - 1) * HP.TiempoPromedioAtencion, HP.HoraInicio) < HP.HoraFin
WHERE 
    NOT EXISTS (
        SELECT 1
        FROM HorasOcupadas HO
        WHERE HO.HoraInicio = DATEADD(MINUTE, (N.N - 1) * HP.TiempoPromedioAtencion, HP.HoraInicio)
    )
ORDER BY 
    HoraInicioDisponible;




/**
Tabla Atenciones
 - IdTipoCondicionAlServicio = default 3
 - IdTipoCondicionALEstab = default 3
 - IdEspecialidadMedico = buscar id de la tabla Especialidades y la tabla ServiciosAccesibles

Tabla Citas:
 - IdEspecialidad = cambiar la lógica, se está guardando con el id de ServiciosAccesibles, pero debería ser el id de la tabla Especialidades.
 - IdProducto: 
 - FechaReferencia: en vez que sea NULL debe estar vacío

Tabla SIGH_EXTERNA..AtencionesCE:
 - CitaFecha: debe ser NULL
 - CitaMedico: debe ser NULL
 - CitaServicioJamo: debe ser NULL
 - CitaIdServicio: debe ser NULL
 - CitaMotivo: debe ser NULL
 - CitaExamenClinico: debe ser NULL
 - CitaDigital: debe ser NULL
 - CitaFechaAtencion: debe ser NULL
 - CitaIdUsuario: debe ser NULL
 - TriajeEdad: debe ser NULL
 -  

En realidad acá se agregan los datos cuando recién el paciente pasó triaje y los demás procesos.
**/

select * from Citas where IdAtencion = 266644

SELECT * from SIGH_EXTERNA..atencionesCE where idAtencion=266646

select * from Citas Where IdAtencion=266646

select * from Atenciones Where IdAtencion=266644

SELECT * from Empleados where IdEmpleado = 5021





select top 10 * from Pacientes 

select * from FactCatalogoServicios
select * from FactCatalogoServiciosGrupo where IdServicioGrupo = 1
select * from FactCatalogoServiciosSubGrupo where IdServicioSubGrupo = 101

select * from FactPuntosCarga
select * from FactPuntosCargaBienesInsumos
select * from FactPuntosCargaServicio

select * from Pacientes where IdPaciente = '101142'
select * from Atenciones where IdPaciente = '101142'
select * from Atenciones where IdPaciente = '206574'
select * from SIGH_EXTERNA..atencionesCE

select top 10 * from UPServicios where IdUPS=5
select  * from FactPuntosCarga where IdPuntoCarga=6 -- resultado: IdPuntoCarga=649
select  * from FactPuntosCarga where idServicio=149 -- resultado: IdPuntoCarga=649


