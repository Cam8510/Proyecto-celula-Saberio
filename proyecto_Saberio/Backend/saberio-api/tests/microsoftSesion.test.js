const assert = require('node:assert/strict');

const {
  guardarSesion,
  obtenerSesion,
  obtenerCuentaAutorizada,
  estaAutorizada,
  cerrarSesion,
  generarEstado,
} = require('../src/services/microsoftSesion.service');

const cuenta = {
  homeAccountId: 'cuenta-ficticia-de-prueba',
  username: ' PRUEBA@OUTLOOK.COM ',
};

try {
  cerrarSesion();

  assert.equal(obtenerSesion(), null);
  assert.equal(estaAutorizada(), false);

  const expiresOn = new Date(Date.now() + 10 * 60 * 1000);

  guardarSesion({
    cuenta,
    token: {
      accessToken: 'token-ficticio-sin-validez',
      expiresOn,
      scopes: ['https://graph.microsoft.com/Mail.Send'],
    },
  });

  assert.equal(estaAutorizada(), true);
  assert.equal(
    obtenerCuentaAutorizada().username,
    'prueba@outlook.com',
  );
  assert.equal(obtenerSesion().expiraEn, expiresOn.getTime());

  const copia = obtenerSesion();
  copia.token.scopes.push('scope-ficticio');
  copia.token.accessToken = 'modificado';

  assert.equal(obtenerSesion().token.scopes.length, 1);
  assert.equal(
    obtenerSesion().token.accessToken,
    'token-ficticio-sin-validez',
  );

  cerrarSesion();

  assert.throws(
    () => guardarSesion({
      cuenta,
      token: {
        accessToken: 'token-ficticio-sin-validez',
        expiresOn: new Date(Date.now() - 1000),
      },
    }),
    { codigo: 'TOKEN_MICROSOFT_VENCIDO' },
  );

  assert.equal(estaAutorizada(), false);

  assert.throws(
    () => guardarSesion({
      cuenta,
      token: {
        accessToken: 'token-ficticio-sin-validez',
      },
    }),
    { codigo: 'VENCIMIENTO_MICROSOFT_INVALIDO' },
  );

  assert.match(generarEstado(), /^[a-f0-9]{64}$/);

  console.log('Pruebas de sesión Microsoft superadas.');
} finally {
  cerrarSesion();
}