require('dotenv').config();

async function addTelegramToWorkflow() {
    const n8nUrl = 'https://yelp-bakeshop-repaying.ngrok-free.dev';
    const n8nApiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NDcwMTU5Yi1lODU0LTRlYTEtYjQ4YS04ZjNmNGU3YjQzMjIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOWFkOTMwN2ItNzI3Mi00ODYwLTg3MzUtMGIwZjEzZDYzNTE3IiwiaWF0IjoxNzkxMzc0NTUxfQ.a51oILYu0yjHRs2bKIU_aLGI0bY2rxPFmDWlZ-EAqoo';
    const workflowId = '660jyr1c0o5JoQBX';
    const telegramChatId = '7973289510';
    const telegramCredId = 'qOBGRz8SMIDZXwI7';

    console.log(`Fetching current workflow ${workflowId}...`);
    const getRes = await fetch(`${n8nUrl}/api/v1/workflows/${workflowId}`, {
        headers: { 'X-N8N-API-KEY': n8nApiKey }
    });
    const currentWf = await getRes.json();
    if (!getRes.ok) throw new Error(`Failed to fetch workflow: ${JSON.stringify(currentWf)}`);

    const nodes = currentWf.nodes;
    const connections = currentWf.connections;

    const podTelegramText = "={{ '🖨️ *NOUVELLE COMMANDE PRINT-ON-DEMAND !*\\n\\n' + '📦 *Réf :* ' + $('Generate_POD_Ticket').item.json.order_reference + '\\n' + '👤 *Client :* ' + $('Extract_Client_Meta').item.json.client_fullname + ' (' + $('Extract_Client_Meta').item.json.client_email + ')\\n' + '🧩 *Modèle :* ' + $('Parse_Model_Details').item.json.model_title + ' (' + $('Parse_Model_Details').item.json.model_weight_g + 'g)\\n' + '🎨 *Filament :* ' + $('Parse_Filament_Config').item.json.filament_name + ' [' + $('Parse_Filament_Config').item.json.filament_material + ']\\n' + '🔢 *Quantité :* ' + $('Audit_Financials').item.json.quantity + '\\n' + '💰 *Total TTC :* ' + $('Audit_Financials').item.json.total_price_eur + ' €\\n' + '📝 *Instructions :* ' + ($('Extract_Client_Meta').item.json.client_instructions || 'Aucune') + '\\n\\n' + '🔗 *Fiche Notion :* ' + $json.url }}";

    const customTelegramText = "={{ '📐 *NOUVELLE DEMANDE PROJET SUR-MESURE / CAO !*\\n\\n' + '📦 *Ticket :* ' + $('Generate_CAD_Ticket').item.json.order_reference + '\\n' + '👤 *Client :* ' + $('Extract_Client_Meta').item.json.client_fullname + ' (' + $('Extract_Client_Meta').item.json.client_email + ')\\n' + '🛠️ *Prestation :* ' + $('Parse_Custom_Specs').item.json.project_type + '\\n' + '📋 *Description :*\\n' + ($('Parse_Custom_Specs').item.json.project_description || 'Aucune') + '\\n\\n' + '🔗 *Fiche Notion :* ' + $json.url }}";

    // 1. Telegram node for POD
    const telegramPodNode = {
        id: "node-telegram-pod",
        name: "Send_Telegram_POD_Alert",
        type: "n8n-nodes-base.telegram",
        typeVersion: 1.2,
        position: [2340, -20],
        onError: "continueRegularOutput",
        parameters: {
            chatId: telegramChatId,
            text: podTelegramText,
            additionalFields: {
                parse_mode: "Markdown"
            }
        },
        credentials: {
            telegramApi: {
                id: telegramCredId,
                name: "Telegram account"
            }
        }
    };

    // 2. Telegram node for Custom Project
    const telegramCustomNode = {
        id: "node-telegram-custom",
        name: "Send_Telegram_Custom_Alert",
        type: "n8n-nodes-base.telegram",
        typeVersion: 1.2,
        position: [2540, 180],
        onError: "continueRegularOutput",
        parameters: {
            chatId: telegramChatId,
            text: customTelegramText,
            additionalFields: {
                parse_mode: "Markdown"
            }
        },
        credentials: {
            telegramApi: {
                id: telegramCredId,
                name: "Telegram account"
            }
        }
    };

    // Replace in nodes
    const updatedNodes = nodes.filter(n => 
        !['Send_Telegram_POD_Alert', 'Send_Telegram_Custom_Alert'].includes(n.name)
    );
    updatedNodes.push(telegramPodNode, telegramCustomNode);

    // Connect Save_POD_To_Notion to both Format_POD_Success AND Send_Telegram_POD_Alert
    connections["Save_POD_To_Notion"] = {
        main: [[
            { node: "Format_POD_Success", type: "main", index: 0 },
            { node: "Send_Telegram_POD_Alert", type: "main", index: 0 }
        ]]
    };

    // Connect Save_Custom_To_Notion to both Format_Custom_Success AND Send_Telegram_Custom_Alert
    connections["Save_Custom_To_Notion"] = {
        main: [[
            { node: "Format_Custom_Success", type: "main", index: 0 },
            { node: "Send_Telegram_Custom_Alert", type: "main", index: 0 }
        ]]
    };

    console.log(`Updating workflow ${workflowId} with cleaned Telegram expressions...`);
    const putRes = await fetch(`${n8nUrl}/api/v1/workflows/${workflowId}`, {
        method: 'PUT',
        headers: {
            'X-N8N-API-KEY': n8nApiKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: currentWf.name,
            nodes: updatedNodes,
            connections: connections,
            settings: currentWf.settings
        })
    });

    const putData = await putRes.json();
    if (!putRes.ok) throw new Error(`PUT Error: ${JSON.stringify(putData)}`);

    console.log("✅ Workflow n8n mis à jour avec succès avec alertes Telegram corrigées !");
}

addTelegramToWorkflow().catch(err => console.error("❌ Erreur ajout Telegram :", err.message));
