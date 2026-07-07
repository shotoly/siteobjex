require('dotenv').config();
const { Client } = require('@notionhq/client');
const notion = new Client({ auth: process.env.NOTION_API_KEY });
const databaseId = process.env.NOTION_DB_PERSONNEL;

async function test() {
    try {
        const response = await notion.databases.query({
            database_id: databaseId,
            sorts: [{ property: 'Date', direction: 'descending' }]
        });
        console.log(`Found ${response.results.length} pages.`);
        const publicPages = response.results.filter(p => p.properties["publiqe"]?.checkbox);
        console.log(`Found ${publicPages.length} public pages.`);
    } catch(err) {
        console.log("Error:", err.message);
    }
}
test();
