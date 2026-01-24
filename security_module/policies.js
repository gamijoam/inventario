const { google } = require('googleapis');
const { getClient } = require('./index');
const fs = require('fs');
const path = require('path');

// Leer enterpriseId de la configuración guardada
const CONFIG_FILE = path.join(__dirname, 'config.json');
let enterpriseId;

try {
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE));
    enterpriseId = config.enterpriseId;
} catch (e) {
    console.error('Error leyendo config.json. Asegúrate de haber completado setup_enterprise.js');
    process.exit(1);
}

const ANDROID_DIALER_PKG = 'com.google.android.dialer';
const ANDROID_SETTINGS_PKG = 'com.android.settings';

async function createUnlockPolicy() {
    console.log('Creando política UNLOCKED...');
    const auth = await getClient();
    const androidmanagement = google.androidmanagement({ version: 'v1', auth });

    const policy = {
        cameraAccess: 'CAMERA_ACCESS_UNSPECIFIED', // Permite cámara
        // applications: [] // Por defecto, si no se restringe, la Play Store funciona normal en modo personal.
        // En dispositivo completamente gestionado, quizas necesitemos playStoreMode: "BLACKLIST" (que es el default implícito)
    };

    try {
        const res = await androidmanagement.enterprises.policies.patch({
            name: `${enterpriseId}/policies/policy_unlocked`,
            resource: policy
        });
        console.log('✅ Política UNLOCKED creada:', res.data.name);
    } catch (error) {
        console.error('❌ Error creando UNLOCKED:', error.message);
        if (error.response) console.error(JSON.stringify(error.response.data, null, 2));
    }
}

async function createLockPolicy() {
    console.log('Creando política LOCKED...');
    const auth = await getClient();
    const androidmanagement = google.androidmanagement({ version: 'v1', auth });

    const policy = {
        kioskCustomLauncherEnabled: true,
        // statusBar: 'DISABLED', // Comentado por error API: Unknown name
        keyguardDisabledFeatures: ['ALL_FEATURES'],
        applications: [
            {
                packageName: ANDROID_DIALER_PKG,
                installType: "FORCE_INSTALLED"
            },
            {
                packageName: ANDROID_SETTINGS_PKG,
                installType: "FORCE_INSTALLED"
            }
        ],
        // complianceRules removido por error con wildcard
    };

    try {
        const res = await androidmanagement.enterprises.policies.patch({
            name: `${enterpriseId}/policies/policy_locked`,
            resource: policy
        });
        console.log('✅ Política LOCKED creada:', res.data.name);
    } catch (error) {
        console.error('❌ Error creando LOCKED:', error.message);
        if (error.response) console.error(JSON.stringify(error.response.data, null, 2));
    }
}

if (require.main === module) {
    (async () => {
        await createUnlockPolicy();
        await createLockPolicy();
    })();
}

module.exports = { createUnlockPolicy, createLockPolicy };
