USE [sigh]
GO

/****** Object:  Table [dbo].[Atenciones]    Script Date: 07/04/2025 02:45:27 p. m. ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[Atenciones](
	[IdAtencion] [int] IDENTITY(1,1) NOT FOR REPLICATION NOT NULL,
	[IdPaciente] [int] NOT NULL,
	[Edad] [int] NOT NULL,
	[FechaIngreso] [datetime] NOT NULL,
	[HoraIngreso] [char](5) NOT NULL,
	[IdDestinoAtencion] [int] NULL,
	[IdTipoCondicionAlServicio] [int] NULL,
	[IdTipoCondicionALEstab] [int] NULL,
	[IdServicioIngreso] [int] NOT NULL,
	[IdMedicoIngreso] [int] NOT NULL,
	[IdEspecialidadMedico] [int] NULL,
	[IdMedicoEgreso] [int] NULL,
	[FechaEgreso] [datetime] NULL,
	[HoraEgreso] [char](5) NULL,
	[IdOrigenAtencion] [int] NULL,
	[FechaEgresoAdministrativo] [datetime] NULL,
	[HoraEgresoAdministrativo] [char](5) NULL,
	[IdCondicionAlta] [int] NULL,
	[IdTipoAlta] [int] NULL,
	[IdServicioEgreso] [int] NULL,
	[IdCamaIngreso] [int] NULL,
	[IdCamaEgreso] [int] NULL,
	[IdTipoGravedad] [int] NULL,
	[IdTipoEdad] [int] NULL,
	[IdCuentaAtencion] [int] NOT NULL,
	[IdTipoServicio] [int] NULL,
	[IdFormaPago] [int] NULL,
	[idFuenteFinanciamiento] [int] NULL,
	[idEstadoAtencion] [int] NULL,
	[EsPacienteExterno] [bit] NULL,
	[idSunasaPacienteHistorico] [int] NULL,
	[FyHInicioI] [datetime] NULL,
	[FyHFinal] [datetime] NULL,
	[idCondicionMaterna] [int] NULL,
	[idCartaGarantia] [int] NULL,
	[EsHistoriaRecogida] [bit] NULL,
	[FechaHoraHistoriaRecogida] [datetime] NULL,
 CONSTRAINT [PK_Atenciones] PRIMARY KEY CLUSTERED 
(
	[IdAtencion] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO

ALTER TABLE [dbo].[Atenciones] ADD  CONSTRAINT [DF_Atenciones_EsPacienteExterno]  DEFAULT ((0)) FOR [EsPacienteExterno]
GO

ALTER TABLE [dbo].[Atenciones] ADD  DEFAULT ((0)) FOR [EsHistoriaRecogida]
GO

ALTER TABLE [dbo].[Atenciones]  WITH NOCHECK ADD  CONSTRAINT [FK_Atenciones_SunasaPacientesHistoricos] FOREIGN KEY([idSunasaPacienteHistorico])
REFERENCES [dbo].[SunasaPacientesHistoricos] ([idSunasaPacienteHistorico])
GO

ALTER TABLE [dbo].[Atenciones] CHECK CONSTRAINT [FK_Atenciones_SunasaPacientesHistoricos]
GO




-- Crear ServiciosAccesibles - Financiamiento ESTRATEGIA
CREATE TABLE ServiciosAccesibles (
    idServiciosAccesibles INT IDENTITY(1,1) PRIMARY KEY,  -- Identificador único de los servicios accesibles
    idServicio INT NOT NULL,                               -- Referencia al servicio
    CONSTRAINT FK_ServicioAccesible_Servicio FOREIGN KEY (idServicio) 
        REFERENCES Servicios(idServicio)                  -- Relaciona con la tabla Servicios
);



INSERT INTO [dbo].[ServiciosAccesibles]([idServicio])
VALUES 
(145),
(149),
(230),
(312),
(346),
(347),
(358),
(367),
(407);

SELECT sa.idServiciosAccesibles, s.IdServicio, s.Nombre, s.Codigo, 
        e.Nombre as Especialidad, ts.Descripcion as TipoServicio
FROM ServiciosAccesibles sa
INNER JOIN Servicios s ON sa.idServicio = s.IdServicio
INNER JOIN Especialidades e ON s.IdEspecialidad = e.IdEspecialidad
INNER JOIN TiposServicio ts ON s.IdTipoServicio = ts.IdTipoServicio
WHERE s.idEstado = 1 OR s.idEstado IS NULL
ORDER BY s.Nombre

/*
SELECT s.IdServicio, s.Nombre, s.IdEspecialidad
FROM Servicios s
INNER JOIN ServiciosAccesibles sa ON s.IdServicio = sa.idServicio
WHERE s.IdServicio = @idServicio
*/

/*
declare @IdServicio int = 149 
declare @idMedico int = 536
declare @idEspecialidad int = 78
declare @Fecha date='20250407'
EXEC CitasSeleccionarDisponiblesPorMedicoEspecialidadYFecha 
@IdMedico = @idMedico, 
@IdEspecialidad = @idEspecialidad, 
@Fecha = @fecha
*/

declare @lcFiltro VARCHAR(1500) = ' WHERE dbo.ProgramacionMedica.Fecha = CONVERT(DATETIME, ''2025-04-01'', 103) AND dbo.ProgramacionMedica.IdServicio = 149'
EXEC MedicosFiltrarPorProgramacion @lcFiltro

declare @Fecha date='20250407'
declare @idMedico int = 535
EXEC CitasSeleccionarPorMedicoYFecha @IdMedico, @Fecha

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
WHERE CONVERT(date, a.FechaIngreso) = CONVERT(date, '2025-03-01') and IdServicio=149

select * from Citas where Fecha='20250407' order by IdCita desc


SELECT idEstadoAtencion FROM Atenciones order by IdAtencion desc

select * from ServiciosAccesibles