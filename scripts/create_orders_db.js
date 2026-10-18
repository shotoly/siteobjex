require('dotenv').config();
const { Client } = require('@notionhq/client');

async function createOrdersDatabase() {
    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    const parentPageId = process.env.NOTION_DB_PERSONNEL || '3936e0b4-a0c3-80cf-b539-d87be1173622';

    console.log(`Checking/Creating 'Commandes' database under parent page ${parentPageId}...`);

    // Check if already exists
    const search = await notion.search({
        query: 'Commandes',
        filter: { property: 'object', value: 'database' }
    });

    const existing = search.results.find(db => {
        const title = db.title && db.title[0] ? db.title[0].plain_text : '';
        return title.toLowerCase() === 'commandes' || title.toLowerCase() === 'commandes objex3d';
    });

    if (existing) {
        console.log(`Database already exists: "${existing.title[0].plain_text}" (ID: ${existing.id})`);
        return existing;
    }

    const newDb = await notion.databases.create({
        parent: {
            type: 'page_id',
            page_id: parentPageId
        },
        title: [
            {
                type: 'text',
                text: { content: 'Commandes' }
            }
        ],
        icon: {
            type: 'emoji',
            emoji: '📦'
        },
        properties: {
            "Référence": {
                title: {}
            },
            "Statut": {
                status: {
                    options: [
                        { name: "Nouvelle commande", color: "blue" },
                        { name: "En cours d'impression", color: "yellow" },
                        { name: "En modélisation CAO", color: "purple" },
                        { name: "Prêt / Emballé", color: "orange" },
                        { name: "Expédié", color: "green" },
                        { name: "Annulé", color: "red" }
                    ]
                }
            },
            "Type": {
                select: {
                    options: [
                        { name: "Print on Demand", color: "purple" },
                        { name: "Projet Sur-Mesure", color: "blue" }
                    ]
                }
            },
            "Client": {
                rich_text: {}
            },
            "Email": {
                email: {}
            },
            "Modèle / Sujet": {
                rich_text: {}
            },
            "Filament": {
                rich_text: {}
            },
            "Quantité": {
                number: { format: "number" }
            },
            "Prix Total (€)": {
                number: { format: "euro" }
            },
            "Instructions": {
                rich_text: {}
            },
            "Lien Source": {
                url: {}
            },
            "Date": {
                date: {}
            }
        }
    });

    console.log(`✅ Base de données 'Commandes' créée avec succès !`);
    console.log(`ID: ${newDb.id}`);
    console.log(`URL: ${newDb.url}`);
    return newDb;
}

createOrdersDatabase().catch(err => {
    console.error('❌ Erreur lors de la création de la base Commandes :', err.message);
    if (err.body) console.error(err.body);
});
