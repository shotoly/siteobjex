require('dotenv').config();

async function updateWorkflow() {
    const n8nUrl = 'https://yelp-bakeshop-repaying.ngrok-free.dev';
    const n8nApiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NDcwMTU5Yi1lODU0LTRlYTEtYjQ4YS04ZjNmNGU3YjQzMjIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOWFkOTMwN2ItNzI3Mi00ODYwLTg3MzUtMGIwZjEzZDYzNTE3IiwiaWF0IjoxNzkxMzc0NTUxfQ.a51oILYu0yjHRs2bKIU_aLGI0bY2rxPFmDWlZ-EAqoo';
    const workflowId = '660jyr1c0o5JoQBX';
    const notionApiKey = process.env.NOTION_API_KEY;
    const notionDbId = '3fa6e0b4-a0c3-81c7-a975-fb1fc9fb647e';

    console.log(`Fetching current workflow ${workflowId}...`);
    const getRes = await fetch(`${n8nUrl}/api/v1/workflows/${workflowId}`, {
        headers: { 'X-N8N-API-KEY': n8nApiKey }
    });
    const currentWf = await getRes.json();
    if (!getRes.ok) throw new Error(`Failed to fetch workflow: ${JSON.stringify(currentWf)}`);

    const nodes = currentWf.nodes;
    const connections = currentWf.connections;

    // 1. Safe Save_POD_To_Notion
    const savePodToNotion = {
        id: "node-save-pod-notion",
        name: "Save_POD_To_Notion",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4.2,
        position: [2120, 140],
        parameters: {
            method: "POST",
            url: "https://api.notion.com/v1/pages",
            sendHeaders: true,
            headerParameters: {
                parameters: [
                    { name: "Authorization", value: `Bearer ${notionApiKey}` },
                    { name: "Notion-Version", value: "2022-06-28" },
                    { name: "Content-Type", value: "application/json" }
                ]
            },
            sendBody: true,
            contentType: "raw",
            rawContentType: "application/json",
            body: `={{
  JSON.stringify({
    parent: { database_id: "${notionDbId}" },
    properties: {
      "Référence": {
        title: [{ text: { content: $json.order_reference } }]
      },
      "Statut": {
        status: { name: "Nouvelle commande" }
      },
      "Type": {
        select: { name: "Print on Demand" }
      },
      "Client": {
        rich_text: [{ text: { content: $json.client_fullname || "Client" } }]
      },
      "Email": {
        email: $json.client_email || null
      },
      "Modèle / Sujet": {
        rich_text: [{ text: { content: $json.model_title || "Modèle 3D" } }]
      },
      "Filament": {
        rich_text: [{ text: { content: ($json.filament_name || "PLA") + " (" + ($json.filament_material || "PLA") + ")" } }]
      },
      "Quantité": {
        number: Number($json.quantity) || 1
      },
      "Prix Total (€)": {
        number: Number($json.total_price_eur) || 0
      },
      "Instructions": {
        rich_text: [{ text: { content: $json.client_instructions || "Aucune" } }]
      },
      "Lien Source": {
        url: ($json.model_url && $json.model_url.startsWith("http")) ? $json.model_url : null
      },
      "Date": {
        date: { start: $now.toISO() }
      }
    }
  })
}}`
        }
    };

    // 2. Format_POD_Success
    const formatPodSuccess = {
        id: "node-format-pod-success",
        name: "Format_POD_Success",
        type: "n8n-nodes-base.set",
        typeVersion: 3.4,
        position: [2340, 140],
        parameters: {
            mode: "manual",
            assignments: {
                assignments: [
                    { id: "fps1", name: "order_reference", type: "string", value: "={{ $('Generate_POD_Ticket').item.json.order_reference }}" },
                    { id: "fps2", name: "ticket_id", type: "string", value: "={{ $('Generate_POD_Ticket').item.json.order_reference }}" },
                    { id: "fps3", name: "status", type: "string", value: "success" },
                    { id: "fps4", name: "notion_url", type: "string", value: "={{ $json.url }}" },
                    { id: "fps5", name: "notion_id", type: "string", value: "={{ $json.id }}" },
                    { id: "fps6", name: "message", type: "string", value: "={{ $('Generate_POD_Ticket').item.json.message }}" }
                ]
            },
            options: {}
        }
    };

    // 3. Safe Save_Custom_To_Notion
    const saveCustomToNotion = {
        id: "node-save-custom-notion",
        name: "Save_Custom_To_Notion",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4.2,
        position: [2320, 340],
        parameters: {
            method: "POST",
            url: "https://api.notion.com/v1/pages",
            sendHeaders: true,
            headerParameters: {
                parameters: [
                    { name: "Authorization", value: `Bearer ${notionApiKey}` },
                    { name: "Notion-Version", value: "2022-06-28" },
                    { name: "Content-Type", value: "application/json" }
                ]
            },
            sendBody: true,
            contentType: "raw",
            rawContentType: "application/json",
            body: `={{
  JSON.stringify({
    parent: { database_id: "${notionDbId}" },
    properties: {
      "Référence": {
        title: [{ text: { content: $json.order_reference } }]
      },
      "Statut": {
        status: { name: "En modélisation CAO" }
      },
      "Type": {
        select: { name: "Projet Sur-Mesure" }
      },
      "Client": {
        rich_text: [{ text: { content: $json.client_fullname || "Client" } }]
      },
      "Email": {
        email: $json.client_email || null
      },
      "Modèle / Sujet": {
        rich_text: [{ text: { content: $json.project_type || "Projet Sur-Mesure" } }]
      },
      "Instructions": {
        rich_text: [{ text: { content: $json.project_description || "Aucune" } }]
      },
      "Date": {
        date: { start: $now.toISO() }
      }
    }
  })
}}`
        }
    };

    // 4. Format_Custom_Success
    const formatCustomSuccess = {
        id: "node-format-custom-success",
        name: "Format_Custom_Success",
        type: "n8n-nodes-base.set",
        typeVersion: 3.4,
        position: [2540, 340],
        parameters: {
            mode: "manual",
            assignments: {
                assignments: [
                    { id: "fcs1", name: "order_reference", type: "string", value: "={{ $('Generate_CAD_Ticket').item.json.order_reference }}" },
                    { id: "fcs2", name: "ticket_id", type: "string", value: "={{ $('Generate_CAD_Ticket').item.json.order_reference }}" },
                    { id: "fcs3", name: "status", type: "string", value: "success" },
                    { id: "fcs4", name: "notion_url", type: "string", value: "={{ $json.url }}" },
                    { id: "fcs5", name: "notion_id", type: "string", value: "={{ $json.id }}" },
                    { id: "fcs6", name: "message", type: "string", value: "={{ $('Generate_CAD_Ticket').item.json.message }}" }
                ]
            },
            options: {}
        }
    };

    // Reposition Respond nodes
    const respPodNode = nodes.find(n => n.name === 'Respond_POD_Success');
    if (respPodNode) respPodNode.position = [2560, 140];

    const respCustomNode = nodes.find(n => n.name === 'Respond_Custom_Success');
    if (respCustomNode) respCustomNode.position = [2760, 340];

    // Filter out existing and replace
    const updatedNodes = nodes.filter(n => 
        !['Save_POD_To_Notion', 'Format_POD_Success', 'Save_Custom_To_Notion', 'Format_Custom_Success'].includes(n.name)
    );
    updatedNodes.push(savePodToNotion, formatPodSuccess, saveCustomToNotion, formatCustomSuccess);

    // Update connections
    connections["Generate_POD_Ticket"] = {
        main: [[{ node: "Save_POD_To_Notion", type: "main", index: 0 }]]
    };
    connections["Save_POD_To_Notion"] = {
        main: [[{ node: "Format_POD_Success", type: "main", index: 0 }]]
    };
    connections["Format_POD_Success"] = {
        main: [[{ node: "Respond_POD_Success", type: "main", index: 0 }]]
    };

    connections["Generate_CAD_Ticket"] = {
        main: [[{ node: "Save_Custom_To_Notion", type: "main", index: 0 }]]
    };
    connections["Save_Custom_To_Notion"] = {
        main: [[{ node: "Format_Custom_Success", type: "main", index: 0 }]]
    };
    connections["Format_Custom_Success"] = {
        main: [[{ node: "Respond_Custom_Success", type: "main", index: 0 }]]
    };

    console.log(`Updating workflow ${workflowId} with ${updatedNodes.length} nodes...`);
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

    console.log("✅ Workflow n8n mis à jour avec succès avec JSON.stringify sécurisé !");
}

updateWorkflow().catch(err => console.error("❌ Erreur mise à jour workflow :", err.message));
