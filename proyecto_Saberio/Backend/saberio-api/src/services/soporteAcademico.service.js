const SoporteAcademico = require('../../models/soporteAcademico.model');
const Usuario = require('../../models/usuario.model');
const Materia = require('../../models/materia.model');
const PerfilMonitor = require('../../models/perfilMonitor.model');
const HttpError = require('../utils/HttpError');
const path = require('path');
const fs = require('fs');

async function crear(
  idMonitor,
  datos,
  archivo
) {
  const materia = await Materia.findById(
    datos.materia
  );

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

  if (!perfil) {
    throw new HttpError(
      400,
      'Debes crear tu perfil de monitor antes de cargar soportes',
      'PERFIL_NO_ENCONTRADO'
    );
  }

  const materiaEnPerfil = perfil.materiasOfrecidas.some(
    (materiaPerfil) =>
      materiaPerfil.toString() ===
      materia._id.toString()
  );

  if (!materiaEnPerfil) {
    throw new HttpError(
      400,
      'Solo puedes cargar soportes de materias incluidas en tu perfil',
      'MATERIA_NO_EN_PERFIL'
    );
  }

  const soporte = await SoporteAcademico.create({
    monitor: idMonitor,
    materia: materia._id,
    tipoDocumento: datos.tipoDocumento,
    nombreOriginal: archivo.originalname,
    nombreArchivo: archivo.filename,
    rutaArchivo: archivo.path,
    tipoMime: archivo.mimetype,
    tamanoBytes: archivo.size,
  });

  return soporte;
}

async function listar() {
  const soportes = await SoporteAcademico.find()
    .populate('monitor', 'nombre')
    .populate('materia', 'nombre codigo')
    .sort({ createdAt: -1 });

  return soportes;
}

async function listarPropios(idMonitor) {
  const soportes = await SoporteAcademico.find({
    monitor: idMonitor,
  })
    .populate('materia', 'nombre codigo')
    .sort({ createdAt: -1 });

  return soportes;
}

async function obtenerPorId(idSoporte) {
  const soporte = await SoporteAcademico.findById(
    idSoporte
  )
    .populate('monitor', 'nombre')
    .populate('materia', 'nombre codigo');

  if (!soporte) {
    throw new HttpError(
      404,
      'El soporte no existe',
      'SOPORTE_NO_ENCONTRADO'
    );
  }

  return soporte;
}

async function descargar(
  idSoporte,
  idUsuario,
  rolUsuario
) {
  const soporte = await SoporteAcademico.findById(
    idSoporte
  );

  if (!soporte) {
    throw new HttpError(
      404,
      'El soporte no existe',
      'SOPORTE_NO_ENCONTRADO'
    );
  }

  const esPropietario =
    soporte.monitor.toString() === idUsuario;

  const esAdministrador =
    rolUsuario === 'admin';

  if (!esPropietario && !esAdministrador) {
    throw new HttpError(
      403,
      'No puedes descargar este soporte',
      'ACCESO_DENEGADO'
    );
  }

  const rutaAbsoluta = path.resolve(
    soporte.rutaArchivo
  );

  if (!fs.existsSync(rutaAbsoluta)) {
    throw new HttpError(
      404,
      'El archivo no está disponible',
      'ARCHIVO_NO_ENCONTRADO'
    );
  }

  return {
    soporte,
    rutaAbsoluta,
  };
}

async function revisar(
  idSoporte,
  datos
) {
  const soporte = await SoporteAcademico.findById(
    idSoporte
  );

  if (!soporte) {
    throw new HttpError(
      404,
      'El soporte no existe',
      'SOPORTE_NO_ENCONTRADO'
    );
  }

  if (soporte.estado !== 'Pendiente') {
    throw new HttpError(
      400,
      'Este soporte ya fue revisado',
      'SOPORTE_YA_REVISADO'
    );
  }

  if (
    datos.estado === 'Rechazado' &&
    (!datos.observacionesAdmin ||
      !datos.observacionesAdmin.trim())
  ) {
    throw new HttpError(
      400,
      'Debes indicar observaciones al rechazar el soporte',
      'OBSERVACIONES_REQUERIDAS'
    );
  }

  soporte.estado = datos.estado;
  soporte.observacionesAdmin =
    datos.observacionesAdmin || '';
  soporte.fechaRevision = new Date();

  await soporte.save();

  if (datos.estado === 'Aprobado') {
    await PerfilMonitor.updateOne(
      {
        usuario: soporte.monitor,
      },
      {
        $addToSet: {
          materiasAcreditadas:
            soporte.materia,
        },
      }
    );
  }

  return soporte;
}

async function eliminar(
  idSoporte,
  idMonitor
) {
  const soporte = await SoporteAcademico.findById(
    idSoporte
  );

  if (!soporte) {
    throw new HttpError(
      404,
      'El soporte no existe',
      'SOPORTE_NO_ENCONTRADO'
    );
  }

  if (
    soporte.monitor.toString() !==
    idMonitor
  ) {
    throw new HttpError(
      403,
      'No puedes eliminar este soporte',
      'ACCESO_DENEGADO'
    );
  }

  if (soporte.estado !== 'Pendiente') {
    throw new HttpError(
      400,
      'Solo puedes eliminar soportes pendientes',
      'SOPORTE_NO_ELIMINABLE'
    );
  }

  const rutaAbsoluta = path.resolve(
    soporte.rutaArchivo
  );

  if (fs.existsSync(rutaAbsoluta)) {
    fs.unlinkSync(rutaAbsoluta);
  }

  await SoporteAcademico.findByIdAndDelete(
    idSoporte
  );

  return soporte;
}

module.exports = {
  crear,
  listar,
  listarPropios,
  obtenerPorId,
  descargar,
  revisar,
  eliminar,
};