const PerfilMonitor = require('../../models/perfilMonitor.model');
const HttpError = require('../utils/HttpError');

async function obtenerPerfil(idUsuario) {
  const perfil = await PerfilMonitor.findOne({
    usuario: idUsuario,
  });

  if (!perfil) {
    throw new HttpError(
      404,
      'Aún no has creado tu perfil de monitor',
      'PERFIL_NO_ENCONTRADO'
    );
  }

  return perfil;
}

async function crearOActualizarPerfil(idUsuario, datos) {
  const perfil = await PerfilMonitor.findOneAndUpdate(
    { usuario: idUsuario },
    { ...datos, usuario: idUsuario },
    {
      upsert: true,
      returnDocument: 'after',
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );

  return perfil;
}

module.exports = {
  obtenerPerfil,
  crearOActualizarPerfil,
};