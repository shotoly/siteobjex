require('dotenv').config();

async function addEmailNodesToWorkflow() {
    const n8nUrl = 'https://yelp-bakeshop-repaying.ngrok-free.dev';
    const n8nApiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NDcwMTU5Yi1lODU0LTRlYTEtYjQ4YS04ZjNmNGU3YjQzMjIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOWFkOTMwN2ItNzI3Mi00ODYwLTg3MzUtMGIwZjEzZDYzNTE3IiwiaWF0IjoxNzkxMzc0NTUxfQ.a51oILYu0yjHRs2bKIU_aLGI0bY2rxPFmDWlZ-EAqoo';
    const workflowId = '660jyr1c0o5JoQBX';

    console.log(`Récupération du workflow n8n actuel ${workflowId}...`);
    const getRes = await fetch(`${n8nUrl}/api/v1/workflows/${workflowId}`, {
        headers: { 'X-N8N-API-KEY': n8nApiKey }
    });
    const currentWf = await getRes.json();
    if (!getRes.ok) throw new Error(`Échec de récupération : ${JSON.stringify(currentWf)}`);

    let nodes = currentWf.nodes;
    let connections = currentWf.connections;

    // Supprimer les anciens nœuds d'email s'ils existaient déjà
    nodes = nodes.filter(n => 
        n.name !== 'Send_POD_Confirmation_Email' && 
        n.name !== 'Send_Custom_Confirmation_Email' &&
        n.name !== 'Prepare_POD_Email_HTML' &&
        n.name !== 'Prepare_Custom_Email_HTML'
    );

    // 1. Code Node : Prepare_POD_Email_HTML
    const preparePodCode = `
const client = $('Extract_Client_Meta').first().json;
const ticket = $('Generate_POD_Ticket').first().json;
const model = $('Parse_Model_Details').first().json;
const fil = $('Parse_Filament_Config').first().json;
const fin = $('Audit_Financials').first().json;

const clientName = client.client_fullname || (client.client_prenom ? (client.client_prenom + ' ' + (client.client_nom || '')) : 'Client');
const clientEmail = client.client_email || 'objex3d@gmail.com';
const orderRef = ticket.order_reference || 'COMMANDE-OBJEX3D';
const modelTitle = model.model_title || 'Pièce 3D';
const filName = fil.filament_name || 'Standard PLA';
const qty = fin.quantity || 1;
const totalPrice = typeof fin.total_price_eur === 'number' ? fin.total_price_eur.toFixed(2) : (fin.total_price_eur || '0.00');

const html = '<!DOCTYPE html>' +
'<html>' +
'<head>' +
'<meta charset=\"utf-8\">' +
'<style>' +
'body { font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px; color: #111827; }' +
'.email-container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e5e7eb; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }' +
'.header { background: #000000; padding: 32px 24px; text-align: center; }' +
'.header h1 { color: #ffffff; font-size: 26px; margin: 0; font-weight: 800; letter-spacing: -0.02em; }' +
'.header p { color: #a78bfa; margin: 6px 0 0 0; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }' +
'.content { padding: 32px 24px; }' +
'.alert-box { background: #f5f3ff; border: 2px solid #7c3aed; border-radius: 14px; padding: 20px; margin: 24px 0; }' +
'.alert-title { color: #7c3aed; font-size: 16px; font-weight: 800; margin: 0 0 8px 0; }' +
'.alert-text { font-size: 15px; line-height: 1.6; margin: 0; color: #1f2937; }' +
'.recap-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 14px; padding: 20px; margin: 24px 0; }' +
'.recap-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; }' +
'.recap-row:last-child { border-bottom: none; }' +
'.recap-label { color: #6b7280; }' +
'.recap-val { font-weight: 700; color: #111827; text-align: right; }' +
'.recap-total { border-top: 2px solid #7c3aed; padding-top: 12px; margin-top: 8px; font-size: 16px; }' +
'.recap-total .recap-val { color: #7c3aed; font-size: 18px; }' +
'.footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 13px; color: #6b7280; border-top: 1px solid #e5e7eb; }' +
'</style>' +
'</head>' +
'<body>' +
'<div class=\"email-container\">' +
'    <div class=\"header\">' +
'        <h1>OBJEX3D</h1>' +
'        <p>Atelier d\\'impression 3D & Modélisation CAO • Marseille (13ème)</p>' +
'    </div>' +
'    <div class=\"content\">' +
'        <h2 style=\"font-size: 20px; margin-top: 0; color: #111827;\">Bonjour ' + clientName + ',</h2>' +
'        <p style=\"font-size: 15px; line-height: 1.6; color: #374151;\">' +
'            Votre commande d\\'impression 3D a bien été enregistrée à notre atelier sous la référence : <strong style=\"color: #7c3aed;\">' + orderRef + '</strong>.' +
'        </p>' +
'        <div class=\"alert-box\">' +
'            <div class=\"alert-title\">⚠️ Prise en charge de votre commande</div>' +
'            <p class=\"alert-text\">' +
'                <strong>Merci d\\'attendre la prise en charge de votre commande par mes soins (Robin Jallade • Objex3D).</strong><br><br>' +
'                Je vérifie personnellement la géométrie de votre pièce 3D, le bon paramétrage des couches d\\'impression et la disponibilité du filament dans l\\'atelier avant de lancer la fabrication.' +
'            </p>' +
'        </div>' +
'        <div class=\"recap-box\">' +
'            <h3 style=\"margin-top: 0; font-size: 15px; color: #111827;\">Récapitulatif de votre commande :</h3>' +
'            <div class=\"recap-row\"><span class=\"recap-label\">Pièce 3D :</span><span class=\"recap-val\">' + modelTitle + '</span></div>' +
'            <div class=\"recap-row\"><span class=\"recap-label\">Filament :</span><span class=\"recap-val\">' + filName + '</span></div>' +
'            <div class=\"recap-row\"><span class=\"recap-label\">Quantité :</span><span class=\"recap-val\">' + qty + '</span></div>' +
'            <div class=\"recap-row recap-total\"><span class=\"recap-label\">Total TTC :</span><span class=\"recap-val\">' + totalPrice + ' €</span></div>' +
'        </div>' +
'        <p style=\"font-size: 14px; line-height: 1.6; color: #4b5563;\">' +
'            Un nouvel email vous sera envoyé dès que votre impression 3D sera lancée sur nos machines Bambu Lab et prête à être expédiée ou retirée.' +
'        </p>' +
'        <p style=\"font-size: 14px; margin-top: 24px; line-height: 1.5; color: #111827;\">' +
'            À très bientôt,<br>' +
'            <strong>Robin Jallade</strong><br>' +
'            <span style=\"color: #6b7280; font-size: 13px;\">Fondateur Objex3D • Marseille (13ème)</span>' +
'        </p>' +
'    </div>' +
'    <div class=\"footer\">' +
'        © 2026 Objex3D • Robin Jallade. Tous droits réservés.<br>' +
'        Contact : <a href=\"mailto:objex3d@gmail.com\" style=\"color: #7c3aed; text-decoration: none;\">objex3d@gmail.com</a>' +
'    </div>' +
'</div>' +
'</body>' +
'</html>';

return [{
    json: {
        toEmail: clientEmail,
        subject: 'Confirmation de commande Objex3D • Réf: ' + orderRef,
        html: html
    }
}];
`;

    const codePodNode = {
        id: "node-prepare-pod-email",
        name: "Prepare_POD_Email_HTML",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [2352, -240],
        parameters: {
            jsCode: preparePodCode
        }
    };

    // 2. Code Node : Prepare_Custom_Email_HTML
    const prepareCustomCode = `
const client = $('Extract_Client_Meta').first().json;
const ticket = $('Generate_CAD_Ticket').first().json;
const specs = $('Parse_Custom_Specs').first().json;

const clientName = client.client_fullname || (client.client_prenom ? (client.client_prenom + ' ' + (client.client_nom || '')) : 'Client');
const clientEmail = client.client_email || 'objex3d@gmail.com';
const ticketRef = ticket.order_reference || 'TICKET-CAO';
const projectType = specs.project_type || 'Projet sur-mesure / CAO';
const description = specs.project_description || 'Non renseignée';

const html = '<!DOCTYPE html>' +
'<html>' +
'<head>' +
'<meta charset=\"utf-8\">' +
'<style>' +
'body { font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px; color: #111827; }' +
'.email-container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e5e7eb; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }' +
'.header { background: #000000; padding: 32px 24px; text-align: center; }' +
'.header h1 { color: #ffffff; font-size: 26px; margin: 0; font-weight: 800; letter-spacing: -0.02em; }' +
'.header p { color: #3b82f6; margin: 6px 0 0 0; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }' +
'.content { padding: 32px 24px; }' +
'.alert-box { background: #eff6ff; border: 2px solid #3b82f6; border-radius: 14px; padding: 20px; margin: 24px 0; }' +
'.alert-title { color: #3b82f6; font-size: 16px; font-weight: 800; margin: 0 0 8px 0; }' +
'.alert-text { font-size: 15px; line-height: 1.6; margin: 0; color: #1f2937; }' +
'.recap-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 14px; padding: 20px; margin: 24px 0; }' +
'.recap-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; }' +
'.recap-row:last-child { border-bottom: none; }' +
'.recap-label { color: #6b7280; }' +
'.recap-val { font-weight: 700; color: #111827; text-align: right; }' +
'.footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 13px; color: #6b7280; border-top: 1px solid #e5e7eb; }' +
'</style>' +
'</head>' +
'<body>' +
'<div class=\"email-container\">' +
'    <div class=\"header\">' +
'        <h1>OBJEX3D</h1>' +
'        <p>Bureau d\\'études CAO & Fabrication Additive • Marseille (13ème)</p>' +
'    </div>' +
'    <div class=\"content\">' +
'        <h2 style=\"font-size: 20px; margin-top: 0; color: #111827;\">Bonjour ' + clientName + ',</h2>' +
'        <p style=\"font-size: 15px; line-height: 1.6; color: #374151;\">' +
'            Votre demande de projet sur-mesure a bien été transmise à notre bureau d\\'études sous le ticket n° : <strong style=\"color: #3b82f6;\">' + ticketRef + '</strong>.' +
'        </p>' +
'        <div class=\"alert-box\">' +
'            <div class=\"alert-title\">⚠️ Prise en charge de votre projet</div>' +
'            <p class=\"alert-text\">' +
'                <strong>Merci d\\'attendre la prise en charge de votre projet par mes soins (Robin Jallade • Objex3D).</strong><br><br>' +
'                J\\'étudie personnellement votre cahier des charges et vos fichiers 3D pour vous proposer une solution technique optimale et un devis personnalisé sous 24h ouvrées.' +
'            </p>' +
'        </div>' +
'        <div class=\"recap-box\">' +
'            <h3 style=\"margin-top: 0; font-size: 15px; color: #111827;\">Détails de votre demande :</h3>' +
'            <div class=\"recap-row\"><span class=\"recap-label\">Prestation :</span><span class=\"recap-val\">' + projectType + '</span></div>' +
'            <div class=\"recap-row\"><span class=\"recap-label\">Description :</span><span class=\"recap-val\" style=\"max-width: 65%;\">' + description + '</span></div>' +
'            <div class=\"recap-row\"><span class=\"recap-label\">Email de contact :</span><span class=\"recap-val\">' + clientEmail + '</span></div>' +
'        </div>' +
'        <p style=\"font-size: 14px; margin-top: 24px; line-height: 1.5; color: #111827;\">' +
'            À très bientôt pour concrétiser votre projet,<br>' +
'            <strong>Robin Jallade</strong><br>' +
'            <span style=\"color: #6b7280; font-size: 13px;\">Objex3D • Marseille (13ème)</span>' +
'        </p>' +
'    </div>' +
'    <div class=\"footer\">' +
'        © 2026 Objex3D • Robin Jallade. Tous droits réservés.<br>' +
'        Contact : <a href=\"mailto:objex3d@gmail.com\" style=\"color: #3b82f6; text-decoration: none;\">objex3d@gmail.com</a>' +
'    </div>' +
'</div>' +
'</body>' +
'</html>';

return [{
    json: {
        toEmail: clientEmail,
        subject: 'Prise en charge de votre projet Objex3D • Ticket: ' + ticketRef,
        html: html
    }
}];
`;

    const codeCustomNode = {
        id: "node-prepare-custom-email",
        name: "Prepare_Custom_Email_HTML",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [2544, -20],
        parameters: {
            jsCode: prepareCustomCode
        }
    };

    // 3. Nœud Send_POD_Confirmation_Email
    const emailPodNode = {
        id: "node-email-pod",
        name: "Send_POD_Confirmation_Email",
        type: "n8n-nodes-base.emailSend",
        typeVersion: 2.1,
        position: [2560, -240],
        onError: "continueRegularOutput",
        parameters: {
            fromEmail: "Objex3D Atelier <objex3d@gmail.com>",
            toEmail: "={{ $json.toEmail }}",
            subject: "={{ $json.subject }}",
            html: "={{ $json.html }}",
            options: {}
        },
        credentials: {
            smtp: {
                id: "dgPfBlj3GQk6Ti0K",
                name: "SMTP Objex3D"
            }
        }
    };

    // 4. Nœud Send_Custom_Confirmation_Email
    const emailCustomNode = {
        id: "node-email-custom",
        name: "Send_Custom_Confirmation_Email",
        type: "n8n-nodes-base.emailSend",
        typeVersion: 2.1,
        position: [2750, -20],
        onError: "continueRegularOutput",
        parameters: {
            fromEmail: "Objex3D Atelier <objex3d@gmail.com>",
            toEmail: "={{ $json.toEmail }}",
            subject: "={{ $json.subject }}",
            html: "={{ $json.html }}",
            options: {}
        },
        credentials: {
            smtp: {
                id: "dgPfBlj3GQk6Ti0K",
                name: "SMTP Objex3D"
            }
        }
    };

    nodes.push(codePodNode);
    nodes.push(emailPodNode);
    nodes.push(codeCustomNode);
    nodes.push(emailCustomNode);

    // Mettre à jour les connexions
    // Save_POD_To_Notion -> Prepare_POD_Email_HTML -> Send_POD_Confirmation_Email
    if (!connections['Save_POD_To_Notion']) {
        connections['Save_POD_To_Notion'] = { main: [[]] };
    }
    // Nettoyer ancienne connexion directe vers Send_POD_Confirmation_Email
    connections['Save_POD_To_Notion'].main[0] = connections['Save_POD_To_Notion'].main[0].filter(c => c.node !== 'Send_POD_Confirmation_Email' && c.node !== 'Prepare_POD_Email_HTML');
    connections['Save_POD_To_Notion'].main[0].push({
        node: 'Prepare_POD_Email_HTML',
        type: 'main',
        index: 0
    });

    connections['Prepare_POD_Email_HTML'] = {
        main: [[
            {
                node: 'Send_POD_Confirmation_Email',
                type: 'main',
                index: 0
            }
        ]]
    };

    // Save_Custom_To_Notion -> Prepare_Custom_Email_HTML -> Send_Custom_Confirmation_Email
    if (!connections['Save_Custom_To_Notion']) {
        connections['Save_Custom_To_Notion'] = { main: [[]] };
    }
    // Nettoyer ancienne connexion directe vers Send_Custom_Confirmation_Email
    connections['Save_Custom_To_Notion'].main[0] = connections['Save_Custom_To_Notion'].main[0].filter(c => c.node !== 'Send_Custom_Confirmation_Email' && c.node !== 'Prepare_Custom_Email_HTML');
    connections['Save_Custom_To_Notion'].main[0].push({
        node: 'Prepare_Custom_Email_HTML',
        type: 'main',
        index: 0
    });

    connections['Prepare_Custom_Email_HTML'] = {
        main: [[
            {
                node: 'Send_Custom_Confirmation_Email',
                type: 'main',
                index: 0
            }
        ]]
    };

    console.log(`Mise à jour du workflow ${workflowId} via l'API n8n...`);
    const putRes = await fetch(`${n8nUrl}/api/v1/workflows/${workflowId}`, {
        method: 'PUT',
        headers: {
            'X-N8N-API-KEY': n8nApiKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: currentWf.name,
            nodes,
            connections,
            settings: currentWf.settings
        })
    });

    const putData = await putRes.json();
    if (!putRes.ok) throw new Error(`Échec de mise à jour n8n: ${JSON.stringify(putData)}`);

    console.log("✅ Workflow n8n mis à jour avec succès avec nœuds Code dédiés pour HTML pur garanti !");
}

addEmailNodesToWorkflow().catch(e => {
    console.error("❌ Erreur :", e);
    process.exit(1);
});
