require('dotenv').config();
const { Client } = require('@notionhq/client');

async function checkOrders() {
    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    const res = await notion.databases.query({
        database_id: '3fa6e0b4-a0c3-81c7-a975-fb1fc9fb647e',
        sorts: [{ timestamp: 'created_time', direction: 'descending' }]
    });

    console.log(`\n📦 Total commandes enregistrées dans Notion : ${res.results.length}\n`);
    res.results.forEach((p, idx) => {
        const ref = p.properties['Référence']?.title[0]?.plain_text || 'N/A';
        const type = p.properties['Type']?.select?.name || 'N/A';
        const client = p.properties['Client']?.rich_text[0]?.plain_text || 'N/A';
        const email = p.properties['Email']?.email || 'N/A';
        const model = p.properties['Modèle / Sujet']?.rich_text[0]?.plain_text || 'N/A';
        const filament = p.properties['Filament']?.rich_text[0]?.plain_text || 'N/A';
        const qty = p.properties['Quantité']?.number || 1;
        const total = p.properties['Prix Total (€)']?.number;
        const statut = p.properties['Statut']?.status?.name || 'N/A';
        const date = p.properties['Date']?.date?.start || 'N/A';
        console.log(`${idx + 1}. [${statut}] Réf: ${ref}`);
        console.log(`   Type: ${type} | Date: ${date}`);
        console.log(`   Client: ${client} (${email})`);
        console.log(`   Modèle/Sujet: ${model} | Filament: ${filament}`);
        if (total) console.log(`   Quantité: ${qty} | Total TTC: ${total} €`);
        console.log(`   Lien Notion: ${p.url}\n`);
    });
}

checkOrders().catch(err => console.error(err.message));
