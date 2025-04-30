CREATE PROCEDURE PacienteXNroDocumento
@NroDocumento VARCHAR(12)
AS BEGIN
    select 
        pa.IdPaciente,
        TDI.Descripcion as TipoDocumento,
        pa.NroDocumento,
        pa.ApellidoPaterno + ' ' + pa.ApellidoPaterno AS ApellidosPaciente,
        RTRIM(pa.PrimerNombre + ' ' + ISNULL(PA.SegundoNombre, '') + ' ' + ISNULL(PA.TercerNombre,'')) AS NombrePaciente,
        pa.NroHistoriaClinica,
        PA.FechaNacimiento
    from Pacientes PA 
    INNER JOIN TiposDocIdentidad TDI on PA.IdDocIdentidad=TDI.IdDocIdentidad
    where NroDocumento=@NroDocumento
END


select * from ProgramacionMedica where IdServicio=149 and Fecha='20250410'

