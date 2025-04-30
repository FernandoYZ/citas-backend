const MODO = process.env.NODE_ENV || 'prod'

// Diccionario de errores personalizados
export const ERRORES = {
    FECHA_REQUERIDA: {
        status: 400,
        message: 'La fecha es requerida'
    },
    PARAMETROS_INCOMPLETOS: {
        status: 400,
        message: 'Parámetros incompletos, por favor complete los campos necesarios'
    },
    PARAMETROS_INVALIDOS: {
        status: 400,
        message: 'Parámetros inválidos'
    },
    SERVICIO_NO_DISPONIBLE: {
        status: 400,
        message: 'El servicio seleccionado no está disponible para citas'
    },
    CITA_EXISTENTE: {
        status: 400,
        message: 'Ya existe una cita para ese día y servicio'
    },
    FORMATO_FECHA_INVALIDO: {
        status: 400,
        message: 'Formato de fecha inválido'
    },
    HORA_OCUPADA: {
        status: 400,
        message: 'Esa hora ya está reservada'
    },
    FECHA_PASADA: {
        status: 400,
        message: 'La fecha no puede ser en el pasado'
    },
    FORMATO_HORA_INVALIDO: {
        status: 400,
        message: 'El formato de la hora no es válido. Por favor ingrese la hora en formato de 24 horas (HH:MM)'
    },
    PACIENTE_NO_ENCONTRADO: {
        status: 404,
        message: 'No se encontró el paciente con el número de documento proporcionado'
    },
    MEDICO_NO_DISPONIBLE: {
        status: 400,
        message: 'El médico no está disponible en el horario solicitado'
    },
    SERVICIO_NO_ENCONTRADO: {
        status: 404,
        message: 'El servicio seleccionado no existe en el sistema'
    },
    ERROR_GENERICO: {
        status: 500,
        message: 'Ocurrió un error inesperado, por favor intente nuevamente más tarde'
    }
};

// Manejador global de errores
export function manejarError(error, res) {
    const codigo = error.message?.trim();
    const errorDefinido = ERRORES[codigo];

    if (errorDefinido) {
        return res.status(errorDefinido.status).json({
            success: false,
            message: errorDefinido.message,
            ...(MODO === 'dev' && { debug: error.stack || error.message })
        });
    }

    const respuesta = {
        success: false,
        message: ERRORES.ERROR_GENERICO.message
    };

    if (MODO === 'dev') {
        respuesta.debug = error.stack || error.message;
    }

    return res.status(500).json(respuesta);
}
