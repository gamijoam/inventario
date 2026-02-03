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
    console.log('🔧 Generando QR - WORK PROFILE MODE (COPE)');
    console.log('   Modo: Perfil de trabajo + uso personal permitido');
    console.log('   ⚠️  Este NO es un dispositivo completamente gestionado');
    const auth = await getClient();
    const androidmanagement = google.androidmanagement({ version: 'v1', auth });

    const enrollmentToken = {
        policyName: `${enterpriseId}/policies/policy_unlocked`,
        oneTimeOnly: true,
        duration: '3600s',
        // Modo menos restrictivo: Perfil de trabajo (COPE - Company Owned, Personally Enabled)
        // Permite uso personal + apps de trabajo separadas
        allowPersonalUsage: 'PERSONAL_USAGE_ALLOWED'
    };

    try {
        const res = await androidmanagement.enterprises.enrollmentTokens.create({
            parent: enterpriseId,
            resource: enrollmentToken
        });

        console.log('\n✅ Token de enrolamiento creado con éxito.');
        console.log('------------------------------------------------');
        console.log('Modo de Enrolamiento: FULLY MANAGED (Corporate Owned)');
        console.log('Token Value:', res.data.value);
        console.log('QR Code URL:', res.data.qrCode);

        // Guardar URL en archivo para evitar problemas de truncado en terminal
        fs.writeFileSync(path.join(__dirname, 'qr.txt'), res.data.qrCode);
        console.log('URL guardada en qr.txt');

        console.log('------------------------------------------------');
        console.log('⚠️  IMPORTANTE: Este QR es para DISPOSITIVO COMPLETAMENTE GESTIONADO.');
        console.log('    Debe escanearse en un dispositivo RESTABLECIDO DE FÁBRICA.');
        console.log('    (Toca 6 veces en la pantalla de bienvenida de Android)');

    } catch (error) {
        console.error('❌ Error generando QR:', error.message);
        if (error.response) console.error(JSON.stringify(error.response.data, null, 2));
    }
}

if (require.main === module) {
    generateQr().catch(console.error);
}
