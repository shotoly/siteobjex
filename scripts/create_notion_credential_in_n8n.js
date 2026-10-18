require('dotenv').config();

async function main() {
    const n8nUrl = 'https://yelp-bakeshop-repaying.ngrok-free.dev';
    const n8nApiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NDcwMTU5Yi1lODU0LTRlYTEtYjQ4YS04ZjNmNGU3YjQzMjIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOWFkOTMwN2ItNzI3Mi00ODYwLTg3MzUtMGIwZjEzZDYzNTE3IiwiaWF0IjoxNzkxMzc0NTUxfQ.a51oILYu0yjHRs2bKIU_aLGI0bY2rxPFmDWlZ-EAqoo';
    const notionApiKey = process.env.NOTION_API_KEY;

    console.log("Creating Notion credential on n8n...");
    try {
        const res = await fetch(`${n8nUrl}/api/v1/credentials`, {
            method: 'POST',
            headers: {
                'X-N8N-API-KEY': n8nApiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: 'Notion Objex3D Account',
                type: 'notionApi',
                data: {
                    apiKey: notionApiKey
                }
            })
        });

        const data = await res.json();
        if (res.ok) {
            console.log("✅ Credential Notion créé dans n8n avec succès ! ID:", data.id);
        } else {
            console.error("Erreur création credential:", data);
        }
    } catch (e) {
        console.error("Erreur réseau:", e.message);
    }
}

main();
