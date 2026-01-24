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
    console.error('Error leyendo config.json');
    process.exit(1);
}

async function listDevices() {
    console.log(`Listando dispositivos para ${enterpriseId}...`);
    const auth = await getClient();
    const androidmanagement = google.androidmanagement({ version: 'v1', auth });

    try {
        const res = await androidmanagement.enterprises.devices.list({
            parent: enterpriseId
        });

        const devices = res.data.devices || [];
        console.log(`\nDispositivos encontrados: ${devices.length}`);

        devices.forEach((device, index) => {
            console.log(`${index + 1}. [${device.state}] ${device.name} (Policy: ${device.policyName})`);
        });

    } catch (error) {
        console.error('Error listando dispositivos:', error.message);
    }
}

if (require.main === module) {
    listDevices().catch(console.error);
}
