const Usuario = require('../../models/usuario.model');
const Materia = require('../../models/materia.model');
const { enviarCorreo } = require('../../config/mailer');

async function notificarNuevaSolicitud(
  solicitud
) {
  try {
    const monitor = await Usuario.findById(
      solicitud.monitor
    );

    if (!monitor) {
      return;
    }

    if (!monitor.notificacionesCorreo) {
      return;
    }

    const materia = await Materia.findById(
      solicitud.materia
    );

    const enlace = `${process.env.FRONTEND_URL}/solicitudes/${solicitud._id}`;

    const asunto =
      'Nueva solicitud de monitoría en Saberio';

    const html = `
      <h2>Nueva solicitud de monitoría</h2>
      <p>Hola, ${monitor.nombre}:</p>
      <p>Un estudiante ha enviado una nueva solicitud de monitoría.</p>
      <ul>
        <li><strong>Materia:</strong> ${
          materia ? materia.nombre : 'No disponible'
        }</li>
        <li><strong>Tema:</strong> ${solicitud.tema}</li>
        <li><strong>Fecha preferida:</strong> ${new Date(
          solicitud.fechaPreferida
        ).toLocaleDateString('es-CO')}</li>
        <li><strong>Hora preferida:</strong> ${solicitud.horaPreferida}</li>
        <li><strong>Modalidad:</strong> ${solicitud.modalidad}</li>
      </ul>
      <p>
        Puedes revisar y gestionar la solicitud aquí:
        <a href="${enlace}">Ver solicitud</a>
      </p>
    `;

    await enviarCorreo(
      monitor.correo,
      asunto,
      html
    );
  } catch (error) {
    console.error(
      'No fue posible enviar la notificación por correo:',
      error.message
    );
  }
}

module.exports = {
  notificarNuevaSolicitud,
};