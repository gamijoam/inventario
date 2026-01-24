const { google } = require('googleapis');
const { getClient } = require('./index');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Leer el project_id del archivo credentials.json
const creds = JSON.parse(fs.readFileSync(path.join(__dirname, 'credentials.json')));
const projectId = creds.installed?.project_id || creds.web?.project_id || creds.project_id;

async function setupEnterprise() {
    console.clear();
    console.log('---------------------------------------------------------');
    console.log('   CONFIGURACIÓN DE ANDROID ENTERPRISE - NUEVA SESIÓN    ');
    console.log('---------------------------------------------------------');
    console.log('Project ID detectado:', projectId);

    const auth = await getClient();
    const androidmanagement = google.androidmanagement({ version: 'v1', auth });

    console.log('Generando NUEVA URL de registro...');

    try {
        const signupUrlResult = await androidmanagement.signupUrls.create({
            projectId: projectId,
            callbackUrl: 'https://localhost/callback',
        });

        const url = signupUrlResult.data.url;
        const signupUrlName = signupUrlResult.data.name;

        console.log('\n=========================================================');
        console.log('¡IMPORTANTE! LEER ATENTAMENTE:');
        console.log('1. Cierra cualquier pestaña anterior de "Android Enterprise".');
        console.log('2. Copia y abre ESTA NUEVA URL (es única para este intento):');
        console.log('\n' + url + '\n');
        console.log('3. Sigue los pasos en el navegador hasta que te redirija.');
        console.log('4. Copia la URL final o el "enterpriseToken".');
        console.log('=========================================================\n');

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question('Pega el Token (o la URL completa) aquí: ', async (input) => {
            rl.close();

            let token = input.trim();

            // Limpiamos caracteres invisibles que a veces se pegan
            token = token.replace(/[\u200B-\u200D\uFEFF]/g, '');

            if (token.includes('enterpriseToken=')) {
                try {
                    if (token.startsWith('http')) {
                        const urlObj = new URL(token);
                        token = urlObj.searchParams.get('enterpriseToken');
                    } else {
                        const match = token.match(/enterpriseToken=([^&]+)/);
                        if (match) token = match[1];
                    }
                } catch (e) {
                    const match = token.match(/enterpriseToken=([^&]+)/);
                    if (match) token = match[1];
                }
            }

            if (!token) {
                console.error('❌ Error: El token está vacío.');
                return;
            }

            console.log('Procesando token...');

            try {
                console.log('Contactando a Google para crear la empresa...');

                const enterpriseResult = await androidmanagement.enterprises.create({
                    projectId: projectId,
                    enterpriseToken: token,
                    signupUrlName: signupUrlName,
                    requestBody: {
                        enterpriseDisplayName: "Ferreteria Management",
                    }
                });

                console.log('\n✅ ¡ÉXITO! Empresa creada correctamente.');
                console.log('------------------------------------------------');
                console.log('Enterprise Name:', enterpriseResult.data.name);
                console.log('Display Name:', enterpriseResult.data.enterpriseDisplayName);
                console.log('------------------------------------------------');
                console.log('Guarda el "Enterprise Name" para usarlo en tus políticas.');

            } catch (error) {
                console.error('❌ Error creando empresa:', error.message);
                if (error.response) {
                    console.error('Detalle API:', JSON.stringify(error.response.data, null, 2));

                    if (error.response.data.error.code === 400 && error.response.data.error.message.includes("INVALID_COMPLETION_TOKEN")) {
                        console.log('\n⚠️ CAUSA PROBABLE: El token usado no corresponde a la URL generada en ESTA sesión.');
                        console.log('SOLUCIÓN: Debes correr el script de nuevo y usar ESE link específico.');
                    }
                }
            }
        });
    } catch (err) {
        console.error("Error inicial:", err);
    }
}

if (require.main === module) {
    if (!projectId) {
        console.error('Error: No se pudo encontrar el project_id en credentials.json');
    } else {
        setupEnterprise().catch(console.error);
    }
}
