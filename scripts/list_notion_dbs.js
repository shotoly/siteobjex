require('dotenv').config();
const { Client } = require('@notionhq/client');

async function main() {
    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    const search = await notion.search({ filter: { property: 'object', value: 'database' } });
    console.log(`Found ${search.results.length} databases:`);
    for (const db of search.results) {
        const title = db.title && db.title[0] ? db.title[0].plain_text : 'Untitled';
        console.log(`\nDatabase: "${title}" | ID: ${db.id}`);
        console.log('Properties:');
        for (const [propName, propVal] of Object.entries(db.properties)) {
            console.log(`  - "${propName}" (${propVal.type})`);
        }
    }
}

main().catch(err => console.error('Error:', err.message));
