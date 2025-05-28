import * as Citas from './citas.model.js'

export async function obtenerCitasSeparadas(fecha) {

    if (!fecha) throw new Error('FECHA_REQUERIDA')

    const fechaDate = new Date(fecha);
    if (isNaN(fechaDate.getTime())) throw new Error('PARAMETROS_INVALIDOS')

    const res = await Citas.obtenerCitasPorFecha(fechaDate)
    return res
}

export async function obtenerCitasMedicoEstrategia(fecha, IdMedico) {

    if (!fecha || !IdMedico) throw new Error('FECHA_REQUERIDA')

    const fechaDate = new Date(fecha);
    if (isNaN(fechaDate.getTime())) throw new Error('PARAMETROS_INVALIDOS')

        const res = await Citas.obtenerCitasMedicoEstrategia(fechaDate, IdMedico);
    return res
}

export async function selectEspecialidad (fecha) {
    if (!fecha) throw new Error('FECHA_REQUERIDA')

    const res = await Citas.selectEspecialidad(fecha)
    return res
}

export async function selectMedicos (fecha, idServicio) { 
    if (!fecha || !idServicio) throw new Error('PARAMETROS_INCOMPLETOS');

    const res = await Citas.selectMedicos(fecha, idServicio)
    return res
}

