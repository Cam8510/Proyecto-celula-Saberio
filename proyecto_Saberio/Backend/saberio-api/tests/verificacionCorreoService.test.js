const assert = require('node:assert/strict');
const HttpError = require('../src/utils/HttpError');

const {
  randomBytes,
} = require('node:crypto');

const rutaUsuario = require.resolve(
  '../models/usuario.model',
);

const rutaServicio = require.resolve(
  '../src/services/verificacionCorreo.service',
);

const rutas = [
  rutaUsuario,
  rutaServicio,
];

const cacheAnterior = new Map(
  rutas.map((ruta) => [ruta, require.cache[ruta]]),
);

const claveAnterior =
  process.env.EMAIL_VERIFICATION_SECRET;

let buscarUsuarioImplementacion;
let actualizarUsuarioImplementacion;

function instalarSimulado(ruta, exports) {
  require.cache[ruta] = {
    id: ruta,
    filename: ruta,
    loaded: true,
    exports,
    children: [],
    paths: [],
  };
}

function crearConsulta(implementacion, argumentos) {
  return {
    async select(campos) {
      return implementacion(
        ...argumentos,
        campos,
      );
    },
  };
}

function reiniciarSimulaciones() {
  buscarUsuarioImplementacion = async () => {
    throw new Error(
      'Configura findOne para esta prueba.',
    );
  };

  actualizarUsuarioImplementacion = async () => {
    throw new Error(
      'Configura findOneAndUpdate para esta prueba.',
    );
  };
}

async function comprobarError(
  operacion,
  codigo,
  status,
) {
  await assert.rejects(
    operacion,
    (error) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.codigo, codigo);
      assert.equal(error.status, status);

      return true;
    },
  );
}

async function main() {
  // Clave temporal: no carga ni modifica el archivo .env.
  process.env.EMAIL_VERIFICATION_SECRET =
    randomBytes(32).toString('hex');

  instalarSimulado(rutaUsuario, {
    findOne: (...args) => crearConsulta(
      buscarUsuarioImplementacion,
      args,
    ),

    findOneAndUpdate: (...args) => crearConsulta(
      actualizarUsuarioImplementacion,
      args,
    ),
  });

  delete require.cache[rutaServicio];

  const {
    emitirCodigo,
    verificarCodigo,
  } = require(rutaServicio);

  const resultados = [];

  async function prueba(nombre, ejecutar) {
    reiniciarSimulaciones();

    try {
      await ejecutar();
      resultados.push(nombre);

      console.log(`OK: ${nombre}`);
    } catch {
      throw new Error(
        `Falló la prueba: ${nombre}`,
      );
    }
  }
    await prueba(
    'No emite para una cuenta no elegible',
    async () => {
      let filtroRecibido;
      let actualizaciones = 0;

      buscarUsuarioImplementacion = async (filtro) => {
        filtroRecibido = filtro;
        return null;
      };

      actualizarUsuarioImplementacion = async () => {
        actualizaciones += 1;
        return null;
      };

      const resultado = await emitirCodigo(
        '  PRUEBA@UROSARIO.EDU.CO  ',
      );

      assert.equal(resultado, null);
      assert.equal(actualizaciones, 0);

      assert.deepEqual(filtroRecibido, {
        correo: 'prueba@urosario.edu.co',
        correoVerificado: false,
        estadoCuenta: 'habilitada',
      });
    },
  );

  await prueba(
    'Devuelve una emisión cuando la actualización es permitida',
    async () => {
      const usuario = {
        _id: 'usuario-ficticio-de-prueba',
        correo: 'prueba@urosario.edu.co',
      };

      let actualizaciones = 0;
      let filtroRecibido;
      let cambioRecibido;
      let opcionesRecibidas;

      buscarUsuarioImplementacion = async () => usuario;

      actualizarUsuarioImplementacion = async (
        filtro,
        cambio,
        opciones,
      ) => {
        actualizaciones += 1;
        filtroRecibido = filtro;
        cambioRecibido = cambio;
        opcionesRecibidas = opciones;

        return { _id: usuario._id };
      };

      const resultado = await emitirCodigo(
        usuario.correo,
      );

      assert.equal(actualizaciones, 1);
      assert.ok(resultado);

      assert.equal(
        resultado.destinatario,
        usuario.correo,
      );

      assert.match(resultado.codigo, /^\d{6}$/);
      assert.ok(resultado.venceEn instanceof Date);

      assert.equal(
        filtroRecibido._id,
        usuario._id,
      );

      assert.equal(
        filtroRecibido.correoVerificado,
        false,
      );

      assert.equal(
        filtroRecibido.estadoCuenta,
        'habilitada',
      );

      const guardado =
        cambioRecibido.$set.verificacionCorreo;

      assert.match(
        guardado.huella,
        /^[a-f0-9]{64}$/,
      );

      assert.match(
        guardado.nonce,
        /^[a-f0-9]{32}$/,
      );

      assert.equal(guardado.intentos, 0);
      assert.ok(guardado.creadoEn instanceof Date);
      assert.ok(guardado.venceEn instanceof Date);

      assert.equal(
        guardado.venceEn.getTime() -
          guardado.creadoEn.getTime(),
        10 * 60 * 1000,
      );

      assert.equal(
        resultado.venceEn.getTime(),
        guardado.venceEn.getTime(),
      );

      // El código en claro no debe guardarse en este objeto.
      assert.deepEqual(
        Object.keys(guardado).sort(),
        [
          'huella',
          'nonce',
          'creadoEn',
          'venceEn',
          'intentos',
        ].sort(),
      );

      // La huella y el nonce no se entregan al servicio de envío.
      assert.deepEqual(
        Object.keys(resultado).sort(),
        [
          'destinatario',
          'codigo',
          'venceEn',
        ].sort(),
      );

      assert.deepEqual(opcionesRecibidas, {
        returnDocument: 'after',
        runValidators: true,
      });
    },
  );

  await prueba(
    'No devuelve una emisión si la actualización de reenvío es rechazada',
    async () => {
      const usuario = {
        _id: 'usuario-ficticio-de-prueba',
        correo: 'prueba@urosario.edu.co',
      };

      let actualizaciones = 0;
      let filtroRecibido;
      let cambioRecibido;

      buscarUsuarioImplementacion = async () => usuario;

      actualizarUsuarioImplementacion = async (
        filtro,
        cambio,
      ) => {
        actualizaciones += 1;
        filtroRecibido = filtro;
        cambioRecibido = cambio;

        // Simula que ninguna cuenta cumple el filtro.
        return null;
      };

      const resultado = await emitirCodigo(
        usuario.correo,
      );

      assert.equal(resultado, null);
      assert.equal(actualizaciones, 1);

      assert.ok(Array.isArray(filtroRecibido.$or));
      assert.equal(filtroRecibido.$or.length, 2);

      assert.deepEqual(
        filtroRecibido.$or[0],
        {
          'verificacionCorreo.creadoEn': {
            $exists: false,
          },
        },
      );

      const limiteReenvio =
        filtroRecibido.$or[1][
          'verificacionCorreo.creadoEn'
        ].$lte;

      const creadoEn =
        cambioRecibido.$set.verificacionCorreo.creadoEn;

      assert.ok(limiteReenvio instanceof Date);

      assert.equal(
        creadoEn.getTime() - limiteReenvio.getTime(),
        60 * 1000,
      );
    },
  );
    await prueba(
    'Rechaza un código numérico sin consultar el modelo',
    async () => {
      let actualizaciones = 0;

      actualizarUsuarioImplementacion = async () => {
        actualizaciones += 1;
        return null;
      };

      await comprobarError(
        () => verificarCodigo({
          correo: 'prueba@urosario.edu.co',
          codigo: 123456,
        }),
        'CODIGO_NO_VALIDO',
        400,
      );

      assert.equal(actualizaciones, 0);
    },
  );

  await prueba(
    'Rechaza la confirmación si no puede reservar un intento',
    async () => {
      let actualizaciones = 0;
      let filtroRecibido;
      let cambioRecibido;
      let opcionesRecibidas;

      actualizarUsuarioImplementacion = async (
        filtro,
        cambio,
        opciones,
      ) => {
        actualizaciones += 1;
        filtroRecibido = filtro;
        cambioRecibido = cambio;
        opcionesRecibidas = opciones;

        return null;
      };

      await comprobarError(
        () => verificarCodigo({
          correo: '  PRUEBA@UROSARIO.EDU.CO  ',
          codigo: '123456',
        }),
        'CODIGO_NO_VALIDO',
        400,
      );

      assert.equal(actualizaciones, 1);

      assert.equal(
        filtroRecibido.correo,
        'prueba@urosario.edu.co',
      );

      assert.equal(
        filtroRecibido.correoVerificado,
        false,
      );

      assert.equal(
        filtroRecibido.estadoCuenta,
        'habilitada',
      );

      assert.ok(
        filtroRecibido[
          'verificacionCorreo.venceEn'
        ].$gt instanceof Date,
      );

      assert.deepEqual(
        filtroRecibido[
          'verificacionCorreo.intentos'
        ],
        { $lt: 5 },
      );

      assert.deepEqual(cambioRecibido, {
        $inc: {
          'verificacionCorreo.intentos': 1,
        },
      });

      assert.deepEqual(opcionesRecibidas, {
        returnDocument: 'after',
      });
    },
  );

  await prueba(
    'Un código incorrecto consume el intento sin confirmar la cuenta',
    async () => {
      const {
        generarCodigoVerificacion,
      } = require('../src/utils/codigoVerificacion');

      const usuarioId = 'usuario-ficticio-de-prueba';
      const generado =
        generarCodigoVerificacion(usuarioId);

      const codigoIncorrecto = (
        (Number(generado.codigo) + 1) % 1000000
      )
        .toString()
        .padStart(6, '0');

      let actualizaciones = 0;
      let cambioRecibido;

      actualizarUsuarioImplementacion = async (
        filtro,
        cambio,
      ) => {
        actualizaciones += 1;
        cambioRecibido = cambio;

        assert.equal(actualizaciones, 1);

        return {
          _id: usuarioId,
          verificacionCorreo: {
            huella: generado.huella,
            nonce: generado.nonce,
            creadoEn: generado.creadoEn,
            venceEn: generado.venceEn,
            intentos: 1,
          },
        };
      };

      await comprobarError(
        () => verificarCodigo({
          correo: 'prueba@urosario.edu.co',
          codigo: codigoIncorrecto,
        }),
        'CODIGO_NO_VALIDO',
        400,
      );

      assert.equal(actualizaciones, 1);

      assert.deepEqual(cambioRecibido, {
        $inc: {
          'verificacionCorreo.intentos': 1,
        },
      });
    },
  );

  await prueba(
    'Un código correcto confirma la cuenta y solicita eliminar la emisión',
    async () => {
      const {
        generarCodigoVerificacion,
      } = require('../src/utils/codigoVerificacion');

      const usuarioId = 'usuario-ficticio-de-prueba';
      const generado =
        generarCodigoVerificacion(usuarioId);

      const llamadas = [];

      actualizarUsuarioImplementacion = async (
        filtro,
        cambio,
        opciones,
      ) => {
        llamadas.push({
          filtro,
          cambio,
          opciones,
        });

        if (llamadas.length === 1) {
          return {
            _id: usuarioId,
            verificacionCorreo: {
              huella: generado.huella,
              nonce: generado.nonce,
              creadoEn: generado.creadoEn,
              venceEn: generado.venceEn,
              intentos: 1,
            },
          };
        }

        assert.equal(llamadas.length, 2);

        return { _id: usuarioId };
      };

      const resultado = await verificarCodigo({
        correo: 'prueba@urosario.edu.co',
        codigo: generado.codigo,
      });

      assert.equal(llamadas.length, 2);

      assert.deepEqual(llamadas[0].cambio, {
        $inc: {
          'verificacionCorreo.intentos': 1,
        },
      });

      const confirmacion = llamadas[1];

      assert.equal(
        confirmacion.filtro._id,
        usuarioId,
      );

      assert.equal(
        confirmacion.filtro.correoVerificado,
        false,
      );

      assert.equal(
        confirmacion.filtro.estadoCuenta,
        'habilitada',
      );

      assert.equal(
        confirmacion.filtro[
          'verificacionCorreo.nonce'
        ],
        generado.nonce,
      );

      assert.equal(
        confirmacion.filtro[
          'verificacionCorreo.huella'
        ],
        generado.huella,
      );

      const verificadoEn =
        confirmacion.cambio.$set.correoVerificadoEn;

      assert.ok(verificadoEn instanceof Date);

      assert.equal(
        confirmacion.cambio.$set.correoVerificado,
        true,
      );

      assert.equal(
        confirmacion.filtro[
          'verificacionCorreo.venceEn'
        ].$gt.getTime(),
        verificadoEn.getTime(),
      );

      assert.deepEqual(
        confirmacion.cambio.$unset,
        { verificacionCorreo: 1 },
      );

      assert.deepEqual(confirmacion.opciones, {
        returnDocument: 'after',
        runValidators: true,
      });

      assert.deepEqual(resultado, {
        mensaje:
          'Correo verificado correctamente. Ya puedes iniciar sesión.',
      });
    },
  );
    await prueba(
    'Rechaza la confirmación si la actualización final no encuentra la emisión',
    async () => {
      const {
        generarCodigoVerificacion,
      } = require('../src/utils/codigoVerificacion');

      const usuarioId = 'usuario-ficticio-de-prueba';
      const generado =
        generarCodigoVerificacion(usuarioId);

      const llamadas = [];

      actualizarUsuarioImplementacion = async (
        filtro,
        cambio,
        opciones,
      ) => {
        llamadas.push({
          filtro,
          cambio,
          opciones,
        });

        if (llamadas.length === 1) {
          return {
            _id: usuarioId,
            verificacionCorreo: {
              huella: generado.huella,
              nonce: generado.nonce,
              creadoEn: generado.creadoEn,
              venceEn: generado.venceEn,
              intentos: 1,
            },
          };
        }

        assert.equal(llamadas.length, 2);

        // Simula que la emisión ya no cumple el filtro.
        return null;
      };

      await comprobarError(
        () => verificarCodigo({
          correo: 'prueba@urosario.edu.co',
          codigo: generado.codigo,
        }),
        'CODIGO_NO_VALIDO',
        400,
      );

      assert.equal(llamadas.length, 2);

      const filtroFinal = llamadas[1].filtro;

      assert.equal(
        filtroFinal[
          'verificacionCorreo.nonce'
        ],
        generado.nonce,
      );

      assert.equal(
        filtroFinal[
          'verificacionCorreo.huella'
        ],
        generado.huella,
      );

      assert.equal(
        filtroFinal.correoVerificado,
        false,
      );
    },
  );

  await prueba(
    'Propaga un fallo del modelo al reservar el intento',
    async () => {
      const esperado = new Error(
        'Fallo simulado al reservar el intento',
      );

      let actualizaciones = 0;

      actualizarUsuarioImplementacion = async () => {
        actualizaciones += 1;
        throw esperado;
      };

      await assert.rejects(
        () => verificarCodigo({
          correo: 'prueba@urosario.edu.co',
          codigo: '123456',
        }),
        (error) => {
          assert.equal(error, esperado);
          return true;
        },
      );

      assert.equal(actualizaciones, 1);
    },
  );

  await prueba(
    'Propaga un fallo del modelo durante la confirmación final',
    async () => {
      const {
        generarCodigoVerificacion,
      } = require('../src/utils/codigoVerificacion');

      const usuarioId = 'usuario-ficticio-de-prueba';
      const generado =
        generarCodigoVerificacion(usuarioId);

      const esperado = new Error(
        'Fallo simulado durante la confirmación',
      );

      let actualizaciones = 0;

      actualizarUsuarioImplementacion = async () => {
        actualizaciones += 1;

        if (actualizaciones === 1) {
          return {
            _id: usuarioId,
            verificacionCorreo: {
              huella: generado.huella,
              nonce: generado.nonce,
              creadoEn: generado.creadoEn,
              venceEn: generado.venceEn,
              intentos: 1,
            },
          };
        }

        assert.equal(actualizaciones, 2);

        throw esperado;
      };

      await assert.rejects(
        () => verificarCodigo({
          correo: 'prueba@urosario.edu.co',
          codigo: generado.codigo,
        }),
        (error) => {
          assert.equal(error, esperado);
          return true;
        },
      );

      assert.equal(actualizaciones, 2);
    },
  );
  

  if (resultados.length === 0) {
    console.log(
      'Estructura preparada. Todavía no hay casos de prueba.',
    );

    return;
  }

  console.log(
    `Pruebas superadas: ${resultados.length}`,
  );
}

main()
  .catch((error) => {
    console.error(
      error.message.startsWith('Falló la prueba:')
        ? error.message
        : 'No se pudo preparar la prueba del servicio.',
    );

    process.exitCode = 1;
  })
  .finally(() => {
    for (const ruta of rutas) {
      const anterior = cacheAnterior.get(ruta);

      if (anterior) {
        require.cache[ruta] = anterior;
      } else {
        delete require.cache[ruta];
      }
    }

    if (claveAnterior === undefined) {
      delete process.env.EMAIL_VERIFICATION_SECRET;
    } else {
      process.env.EMAIL_VERIFICATION_SECRET =
        claveAnterior;
    }
  });