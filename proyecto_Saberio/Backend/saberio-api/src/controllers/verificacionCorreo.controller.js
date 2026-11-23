const Usuario = require('../../models/usuario.model');

const {
  emitirCodigo,
  verificarCodigo,
} = require('../services/verificacionCorreo.service');

const {
  enviarCodigoVerificacion,
} = require('../services/correoMicrosoft.service');

const MENSAJE_SOLICITUD =
  'Si el correo corresponde a una cuenta elegible, se solicitará el envío de un código de verificación.';

function normalizarCorreo(valor) {
  if (typeof valor !== 'string') {
    return null;
  }

  const correo = valor.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    return null;
  }

  return correo;
}

function normalizarCodigo(valor) {
  if (typeof valor !== 'string') {
    return null;
  }

  const codigo = valor.trim();

  if (!/^\d{6}$/.test(codigo)) {
    return null;
  }

  return codigo;
}

async function solicitarVerificacion(req, res, next) {
  try {
    const correo = normalizarCorreo(req.body?.correo);

    if (!correo) {
      return res.status(400).json({
        error: 'Correo inválido.',
      });
    }

    const emision = await emitirCodigo(correo);

    if (!emision) {
      return res.status(200).json({
        mensaje: MENSAJE_SOLICITUD,
      });
    }

    const venceEn = new Date(emision.venceEn).getTime();
    const restanteMs = venceEn - Date.now();

    if (!Number.isFinite(venceEn) || restanteMs <= 0) {
      return res.status(503).json({
        error: 'No fue posible preparar el código. Intenta más tarde.',
      });
    }

    const minutosVigencia = Math.ceil(restanteMs / 60000);

    await enviarCodigoVerificacion({
      destinatario: emision.destinatario,
      codigo: emision.codigo,
      minutosVigencia,
    });

    return res.status(200).json({
      mensaje: MENSAJE_SOLICITUD,
    });
  } catch (error) {
    if (error?.codigo === 'SESION_MICROSOFT_AUSENTE') {
      return res.status(503).json({
        error: 'El servicio de correo no está disponible temporalmente.',
      });
    }

    return next(error);
  }
}

async function confirmarVerificacion(req, res, next) {
  try {
    const correo = normalizarCorreo(req.body?.correo);
    const codigo = normalizarCodigo(req.body?.codigo);

    if (!correo || !codigo) {
      return res.status(400).json({
        error: 'Correo o código inválido.',
      });
    }

    await verificarCodigo({
      correo,
      codigo,
    });

    return res.status(200).json({
      mensaje: 'Correo verificado correctamente.',
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  solicitarVerificacion,
  confirmarVerificacion,
};