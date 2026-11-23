const Publicacion = require('../../models/publicacion.model');
const Materia = require('../../models/materia.model');
const PerfilMonitor = require('../../models/perfilMonitor.model');
const HttpError = require('../utils/HttpError');

async function crear(idMonitor, datos) {
  const perfil = await PerfilMonitor.findOne({
    usuario: idMonitor,
  });

  if (!perfil) {
    throw new HttpError(
      400,
      'Debes crear tu perfil de monitor antes de publicar',
      'PERFIL_NO_ENCONTRADO'
    );
  }

  if (perfil.estadoPerfil !== 'Aprobado') {
    throw new HttpError(
      403,
      'Tu perfil de monitor aún no está aprobado',
      'MONITOR_NO_ACREDITADO'
    );
  }

  const materia = await Materia.findById(datos.materia);

  if (!materia || !materia.activa) {
    throw new HttpError(
      400,
      'La materia indicada no existe o no está activa',
      'MATERIA_INVALIDA'
    );
  }

  const materiaEnPerfil = perfil.materiasOfrecidas.some(
    (materiaPerfil) =>
      materiaPerfil.toString() === materia._id.toString()
  );

  if (!materiaEnPerfil) {
    throw new HttpError(
      400,
      'Solo puedes publicar materias incluidas en tu perfil',
      'MATERIA_NO_EN_PERFIL'
    );
  }

  const publicacion = await Publicacion.create({
    monitor: idMonitor,
    ...datos,
  });

  return publicacion;
}

async function listarActivas() {
  const publicaciones = await Publicacion.find({
    activa: true,
  })
    .populate('monitor', 'nombre')
    .populate('materia', 'nombre codigo')
    .sort({ createdAt: -1 });

  return publicaciones;
}

async function listarPropias(idMonitor) {
  const publicaciones = await Publicacion.find({
    monitor: idMonitor,
  })
    .populate('materia', 'nombre codigo')
    .sort({ createdAt: -1 });

  return publicaciones;
}

async function obtenerPorId(idPublicacion) {
  const publicacion = await Publicacion.findById(idPublicacion)
    .populate('monitor', 'nombre')
    .populate('materia', 'nombre codigo');

  if (!publicacion) {
    throw new HttpError(
      404,
      'La publicación no existe',
      'PUBLICACION_NO_ENCONTRADA'
    );
  }

  return publicacion;
}

async function actualizar(
  idPublicacion,
  idMonitor,
  datos
) {
  const publicacion = await Publicacion.findById(idPublicacion);

  if (!publicacion) {
    throw new HttpError(
      404,
      'La publicación no existe',
      'PUBLICACION_NO_ENCONTRADA'
    );
  }

  if (
    publicacion.monitor.toString() !==
    idMonitor
  ) {
    throw new HttpError(
      403,
      'No puedes editar esta publicación',
      'ACCESO_DENEGADO'
    );
  }

  const materia = await Materia.findById(datos.materia);

  if (!materia || !materia.activa) {
    throw new HttpError(
      400,
      'La materia indicada no existe o no está activa',
      'MATERIA_INVALIDA'
    );
  }

  const perfil = await PerfilMonitor.findOne({
    usuario: idMonitor,
  });

  const materiaEnPerfil = perfil.materiasOfrecidas.some(
    (materiaPerfil) =>
      materiaPerfil.toString() === materia._id.toString()
  );

  if (!materiaEnPerfil) {
    throw new HttpError(
      400,
      'Solo puedes publicar materias incluidas en tu perfil',
      'MATERIA_NO_EN_PERFIL'
    );
  }

  publicacion.materia = datos.materia;
  publicacion.descripcion = datos.descripcion;
  publicacion.modalidad = datos.modalidad;
  publicacion.tarifaPorHora = datos.tarifaPorHora;
  publicacion.duracionMinutos = datos.duracionMinutos;

  await publicacion.save();

  return publicacion;
}

async function cambiarEstado(
  idPublicacion,
  idMonitor,
  activa
) {
  const publicacion = await Publicacion.findById(idPublicacion);

  if (!publicacion) {
    throw new HttpError(
      404,
      'La publicación no existe',
      'PUBLICACION_NO_ENCONTRADA'
    );
  }

  if (
    publicacion.monitor.toString() !==
    idMonitor
  ) {
    throw new HttpError(
      403,
      'No puedes cambiar el estado de esta publicación',
      'ACCESO_DENEGADO'
    );
  }

  publicacion.activa = activa;

  await publicacion.save();

  return publicacion;
}

async function eliminar(
  idPublicacion,
  idMonitor
) {
  const publicacion = await Publicacion.findById(idPublicacion);

  if (!publicacion) {
    throw new HttpError(
      404,
      'La publicación no existe',
      'PUBLICACION_NO_ENCONTRADA'
    );
  }

  if (
    publicacion.monitor.toString() !==
    idMonitor
  ) {
    throw new HttpError(
      403,
      'No puedes eliminar esta publicación',
      'ACCESO_DENEGADO'
    );
  }

  await Publicacion.findByIdAndDelete(idPublicacion);

  return publicacion;
}

module.exports = {
  crear,
  listarActivas,
  listarPropias,
  obtenerPorId,
  actualizar,
  cambiarEstado,
  eliminar,
};