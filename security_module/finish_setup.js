const { google } = require('googleapis');
const { getClient } = require('./index');
const fs = require('fs');
const path = require('path');

const creds = JSON.parse(fs.readFileSync(path.join(__dirname, 'credentials.json')));
const projectId = creds.installed?.project_id || creds.web?.project_id || creds.project_id;

// VALORES RECUPERADOS DEL INTENTO ANTERIOR
const SIGNUP_URL_NAME = 'signupUrls/C5129c5997e0e572c';
const ENTERPRISE_TOKEN = 'EABKJ9YAnW6eWGgsLnBeh13_kfSExcaVXWxAXEgLIZYKNKJyqF1xr8_yExyeBPwSGCGpzUwApt9_0gQneolp2o9LlDE3ZE0t0an5lmFpJTUai-BUlQxLFdTc';

async function finishEnterpriseSetup() {
    console.log('Project ID:', projectId);
    console.log('Usando Signup Url Name:', SIGNUP_URL_NAME);
    console.log('Usando Token recuperado (longitud):', ENTERPRISE_TOKEN.length);

    const auth = await getClient();
    const androidmanagement = google.androidmanagement({ version: 'v1', auth });

    try {
        console.log('\nCreando empresa...');

        const enterpriseResult = await androidmanagement.enterprises.create({
            projectId: projectId,
            enterpriseToken: ENTERPRISE_TOKEN,
            signupUrlName: SIGNUP_URL_NAME,
            requestBody: {
                enterpriseDisplayName: "Mi Empresa Android",
            }
        });

        console.log('\n¡Empresa creada exitosamente!');
        console.log('Enterprise ID:', enterpriseResult.data.name);
        console.log('Guarda este ID para futuras operaciones.');

    } catch (error) {
        console.error('Error creando empresa:', error.message);
        if (error.response) {
            console.error(JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error);
        }
    }
}

if (require.main === module) {
    finishEnterpriseSetup().catch(console.error);
}
