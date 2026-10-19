require('dotenv').config();

async function updateSmtpPassword() {
    const password = process.argv[2];
    const userEmail = process.argv[3] || 'objex3d@gmail.com';

    if (!password) {
        console.error("Usage: node scripts/update_smtp_password.js <MOT_DE_PASSE_APPLICATION_GOOGLE_16_CARACTERES> [EMAIL]");
        process.exit(1);
    }

    const cleanPassword = password.replace(/\s+/g, '');

    const n8nUrl = 'https://yelp-bakeshop-repaying.ngrok-free.dev';
    const n8nApiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NDcwMTU5Yi1lODU0LTRlYTEtYjQ4YS04ZjNmNGU3YjQzMjIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOWFkOTMwN2ItNzI3Mi00ODYwLTg3MzUtMGIwZjEzZDYzNTE3IiwiaWF0IjoxNzkxMzc0NTUxfQ.a51oILYu0yjHRs2bKIU_aLGI0bY2rxPFmDWlZ-EAqoo';
    const credentialId = 'dgPfBlj3GQk6Ti0K';

    console.log(`Mise à jour du mot de passe SMTP dans n8n pour ${userEmail}...`);

    const res = await fetch(`${n8nUrl}/api/v1/credentials/${credentialId}`, {
        method: 'PATCH',
        headers: {
            'X-N8N-API-KEY': n8nApiKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: 'SMTP Objex3D',
            type: 'smtp',
            data: {
                user: userEmail,
                host: 'smtp.gmail.com',
                port: 465,
                secure: true,
                password: cleanPassword
            }
        })
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(`Erreur n8n: ${JSON.stringify(data)}`);
    }

    console.log("✅ Identifiant SMTP mis à jour avec succès dans n8n !");
}

updateSmtpPassword().catch(err => {
    console.error("❌ Erreur :", err.message);
    process.exit(1);
});
