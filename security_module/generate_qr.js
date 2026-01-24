const { google } = require('googleapis');
const { getClient } = require('./index');
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, 'config.json');
let enterpriseId;

try {
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE));
    enterpriseId = config.enterpriseId;
} catch (e) {
    console.error('Error leyendo config.json. Asegúrate de haber completado setup_enterprise.js');
    process.exit(1);
}

async function generateQr() {
    console.log('Generando código QR para política UNLOCKED...');
    const auth = await getClient();
    const androidmanagement = google.androidmanagement({ version: 'v1', auth });

    const enrollmentToken = {
        policyName: `${enterpriseId}/policies/policy_unlocked`,
        oneTimeOnly: true, // Cambiado a TRUE para evitar límites de tokens reusables
        duration: '3600s'
    };

    try {
        const res = await androidmanagement.enterprises.enrollmentTokens.create({
            parent: enterpriseId,
            resource: enrollmentToken
        });

        console.log('\n✅ Token de enrolamiento creado con éxito.');
        console.log('------------------------------------------------');
        console.log('Token Value:', res.data.value);
        console.log('QR Code URL:', res.data.qrCode);

        // Guardar URL en archivo para evitar problemas de truncado en terminal
        fs.writeFileSync(path.join(__dirname, 'qr.txt'), res.data.qrCode);
        console.log('URL guardada en qr.txt');

        console.log('------------------------------------------------');
        console.log(' Abre la URL del QR en tu navegador y escanéalo con tu dispositivo.');
        console.log(' (Toca 6 veces en la pantalla de bienvenida de Android para iniciar el lector QR)');

    } catch (error) {
        console.error('❌ Error generando QR:', error.message);
        if (error.response) console.error(JSON.stringify(error.response.data, null, 2));
    }
}

if (require.main === module) {
    generateQr().catch(console.error);
}
