const { google } = require('googleapis');
const { getClient } = require('./index');
const fs = require('fs');
const path = require('path');

const creds = JSON.parse(fs.readFileSync(path.join(__dirname, 'credentials.json')));
const projectId = creds.installed?.project_id || creds.web?.project_id || creds.project_id;

async function listEnterprises() {
    const auth = await getClient();
    const androidmanagement = google.androidmanagement({ version: 'v1', auth });

    try {
        console.log('Buscando empresas existentes para este proyecto...');
        const res = await androidmanagement.enterprises.list({
            projectId: projectId
        });

        const enterprises = res.data.enterprises;
        if (enterprises && enterprises.length > 0) {
            console.log(`\n¡Encontré ${enterprises.length} empresa(s) creada(s)!`);
            enterprises.forEach(ent => {
                console.log(`- Nombre: ${ent.enterpriseDisplayName} (ID: ${ent.name})`);
            });
        } else {
            console.log('\nNo se encontraron empresas creadas. El proceso anterior falló y es seguro intentar de nuevo.');
        }

    } catch (error) {
        console.error('Error listando empresas:', error.message);
    }
}

if (require.main === module) {
    listEnterprises().catch(console.error);
}
