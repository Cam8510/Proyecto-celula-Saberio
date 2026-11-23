const Usuario = require('../../models/usuario.model');
const HttpError = require('../utils/HttpError');


const {
  generarCodigoVerificacion,
  coincideCodigo,
} = require('../utils/codigoVerificacion');


const {
  validarCorreoInstitucional,
} = require('../utils/validarCorreoInstitucional');


const MAX_INTENTOS = 5;
const MAX_REENVIOS = 6;
const ESPERA_REENVIO_MS = 60 * 1000;


function errorCodigo() {
  return new HttpError(
    400,
    'El código no es válido, venció o no está disponible',
    'CODIGO_NO_VALIDO'
  );
}


function normalizarCorreo(correo) {
  const resultado = validarCorreoInstitucional(correo);


  if (!resultado.valido) {
    throw errorCodigo();
  }


  return resultado.correo;
}


// Método interno: todavía no debe conectarse a una ruta pública.
async function emitirCodigo(correo) {
  const correoNormalizado = normalizarCorreo(correo);


  const usuario = await Usuario.findOne({
    correo: correoNormalizado,
    correoVerificado: false,
    estadoCuenta: 'habilitada',
  }).select('_id correo');


  if (!usuario) {
    return null;
  }


  const generado = generarCodigoVerificacion(usuario._id);


  const limiteReenvio = new Date(
    generado.creadoEn.getTime() - ESPERA_REENVIO_MS
  );


  const emisionActual = await Usuario.findOne({
    _id: usuario._id,
    correoVerificado: false,
    estadoCuenta: 'habilitada',
  })
    .select('+verificacionCorreo')
    .lean();


  const filtro = {
    _id: usuario._id,
    correoVerificado: false,
    estadoCuenta: 'habilitada',
  };


  let actualizacion;


  if (!emisionActual?.verificacionCorreo) {
    // Primera emisión para esta cuenta.
    filtro['verificacionCorreo.creadoEn'] = {
      $exists: false,
    };


    actualizacion = {
      $set: {
        verificacionCorreo: {
          huella: generado.huella,
          nonce: generado.nonce,
          creadoEn: generado.creadoEn,
          venceEn: generado.venceEn,
          intentos: 0,
          reenvios: 0,
        },
      },
    };
  } else {
    // Reenvío: exige que haya pasado la espera
    // y que no se haya alcanzado el límite.
    filtro['verificacionCorreo.creadoEn'] = {
      $lte: limiteReenvio,
    };


    filtro['verificacionCorreo.reenvios'] = {
      $lt: MAX_REENVIOS,
    };


    actualizacion = {
      $set: {
        'verificacionCorreo.huella': generado.huella,
        'verificacionCorreo.nonce': generado.nonce,
        'verificacionCorreo.creadoEn': generado.creadoEn,
        'verificacionCorreo.venceEn': generado.venceEn,
        'verificacionCorreo.intentos': 0,
      },


      $inc: {
        'verificacionCorreo.reenvios': 1,
      },
    };
  }


  const actualizado = await Usuario.findOneAndUpdate(
    filtro,
    actualizacion,
    {
      returnDocument: 'after',
      runValidators: true,
    }
  ).select('_id');


  if (!actualizado) {
    const usuarioActual = await Usuario.findOne({
      _id: usuario._id,
      correoVerificado: false,
      estadoCuenta: 'habilitada',
    })
      .select('+verificacionCorreo')
      .lean();


    const reenvios =
      usuarioActual?.verificacionCorreo?.reenvios ?? 0;


    if (reenvios >= MAX_REENVIOS) {
      const error = new HttpError(
        429,
        'Se alcanzó el límite de reenvíos del código de verificación',
        'REENVIO_NO_DISPONIBLE',
      );


      error.detalles = {
        limite: MAX_REENVIOS,
        reintentarEn: ESPERA_REENVIO_MS,
      };


      throw error;
    }


    // No había emisión previa que reemplazar o
    // todavía no ha pasado el tiempo de espera.
    return null;
  }


  // Solo para el futuro servicio de envío.
  // Nunca devolver este objeto directamente en la API.
  return {
    destinatario: usuario.correo,
    codigo: generado.codigo,
    venceEn: generado.venceEn,
  };
}


async function verificarCodigo({ correo, codigo }) {
  const correoNormalizado = normalizarCorreo(correo);


  if (
    typeof codigo !== 'string' ||
    !/^\d{6}$/.test(codigo)
  ) {
    throw errorCodigo();
  }


  // Reservar un intento antes de comprobar el código.
  // La condición y el incremento se ejecutan juntos.
  const usuario = await Usuario.findOneAndUpdate(
    {
      correo: correoNormalizado,
      correoVerificado: false,
      estadoCuenta: 'habilitada',
      'verificacionCorreo.venceEn': {
        $gt: new Date(),
      },
      'verificacionCorreo.intentos': {
        $lt: MAX_INTENTOS,
      },
    },
    {
      $inc: {
        'verificacionCorreo.intentos': 1,
      },
    },
    {
      returnDocument: 'after',
    }
  ).select('+verificacionCorreo');


  if (!usuario) {
    throw errorCodigo();
  }


  const verificacion = usuario.verificacionCorreo;


  const coincide = coincideCodigo({
    usuarioId: usuario._id,
    codigo,
    nonce: verificacion.nonce,
    huella: verificacion.huella,
  });


  if (!coincide) {
    throw errorCodigo();
  }


  // Consumir únicamente la emisión que acabamos de comprobar.
  // Un reenvío concurrente o un uso previo impiden esta actualización.
  const verificadoEn = new Date();


  const confirmado = await Usuario.findOneAndUpdate(
    {
      _id: usuario._id,
      correoVerificado: false,
      estadoCuenta: 'habilitada',
      'verificacionCorreo.nonce': verificacion.nonce,
      'verificacionCorreo.huella': verificacion.huella,
      'verificacionCorreo.venceEn': {
        $gt: verificadoEn,
      },
    },
    {
      $set: {
        correoVerificado: true,
        correoVerificadoEn: verificadoEn,
      },


      $unset: {
        verificacionCorreo: 1,
      },
    },
    {
      returnDocument: 'after',
      runValidators: true,
    }
  ).select('_id');


  if (!confirmado) {
    throw errorCodigo();
  }


  return {
    mensaje: 'Correo verificado correctamente. Ya puedes iniciar sesión.',
  };
}


module.exports = {
  emitirCodigo,
  verificarCodigo,
};