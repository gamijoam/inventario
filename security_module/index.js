const { google } = require('googleapis');
const path = require('path');

const KEY_FILE = path.join(__dirname, 'credentials.json');
const SCOPES = ['https://www.googleapis.com/auth/androidmanagement'];

/**
 * Retorna la instancia de la API autenticada.
 */
async function getClient() {
    const auth = new google.auth.GoogleAuth({
        keyFile: KEY_FILE,
        scopes: SCOPES,
    });

    return auth.getClient();
}

if (require.main === module) {
    getClient()
        .then(async (client) => {
            console.log('Autenticación exitosa.');
            // Ejemplo de inicialización del servicio
            const androidmanagement = google.androidmanagement({ version: 'v1', auth: client });
            // Aquí puedes agregar lógica para probar la API
        })
        .catch(console.error);
}

module.exports = { getClient };
