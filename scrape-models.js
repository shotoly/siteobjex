require('dotenv').config();
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { Client } = require('@notionhq/client');

// Configuration
const MAKERWORLD_URL = "https://makerworld.com/en/3d-models?licenses=CC0%2CBY%2CBY-SA%2CBY-ND&orderBy=likeCount";
const STORE_PHOTO_DIR = path.join(__dirname, 'photo', 'store');
const SERVICES_JSON_DIR = path.join(__dirname, 'pages', 'services');
const STORE_JSON_FILE = path.join(SERVICES_JSON_DIR, 'store_prints.json');

// Utilitaire de téléchargement d'image
async function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        const dir = path.dirname(filepath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const file = fs.createWriteStream(filepath);
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
            }
        };
        const lib = url.startsWith('http://') ? http : https;
        lib.get(url, options, response => {
            if (response.statusCode >= 200 && response.statusCode < 300) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve(filepath);
                });
            } else {
                reject(new Error(`HTTP ${response.statusCode} lors du téléchargement de ${url}`));
            }
        }).on('error', err => {
            fs.unlink(filepath, () => reject(err));
        });
    });
}

// Fonction principale de scraping MakerWorld
async function scrapeMakerWorld() {
    console.log(`\n\x1b[35m=== 🚀 DÉMARRAGE DU SCRAPING MAKERWORLD (PUPPETEER) ===\x1b[0m`);
    const startTime = Date.now();

    if (!fs.existsSync(STORE_PHOTO_DIR)) {
        fs.mkdirSync(STORE_PHOTO_DIR, { recursive: true });
    }
    if (!fs.existsSync(SERVICES_JSON_DIR)) {
        fs.mkdirSync(SERVICES_JSON_DIR, { recursive: true });
    }

    console.log(`1. Lancement de Chrome...`);
    let puppeteer;
    try {
        const puppeteerModule = await import('puppeteer');
        puppeteer = puppeteerModule.default || puppeteerModule;
    } catch {
        puppeteer = require('puppeteer');
    }

    // Le mode headless par défaut avec bons flags évite les détections anti-bot
    const isHeadless = process.env.HEADLESS !== 'false';
    const browser = await puppeteer.launch({
        headless: isHeadless ? 'new' : false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1400,900'
        ]
    });

    let rawModels = [];
    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1400, height: 900 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
        
        console.log(`2. Navigation vers : ${MAKERWORLD_URL}`);
        await page.goto(MAKERWORLD_URL, { waitUntil: 'domcontentloaded', timeout: 35000 });

        console.log(`3. Attente des cartes modèles (.js-design-card)...`);
        await page.waitForSelector('.js-design-card', { timeout: 25000 });
        // Pause brève pour stabiliser le rendu asynchrone des images
        await new Promise(r => setTimeout(r, 2000));

        console.log(`4. Extraction des 10 premiers modèles sous licence commerciale...`);
        rawModels = await page.evaluate(() => {
            const cards = Array.from(document.querySelectorAll('.js-design-card'));
            const list = [];

            for (let i = 0; i < cards.length && list.length < 10; i++) {
                const card = cards[i];
                const modelLinks = Array.from(card.querySelectorAll('a[href*="/models/"]'));
                const userLink = card.querySelector('a.user_link') || card.querySelector('a[href*="/@"]');
                const img = card.querySelector('img.child-img') || card.querySelector('img[alt]');

                const modelLink = modelLinks[0];
                if (!modelLink) continue;

                const title = (img && img.alt && img.alt.trim()) ||
                              (modelLinks[1] && modelLinks[1].innerText.trim()) ||
                              (modelLink.innerText.trim()) ||
                              "Modèle 3D MakerWorld";

                const modelUrl = modelLink.href;

                let imageUrl = "";
                if (img) {
                    imageUrl = img.getAttribute('src') || img.getAttribute('data-src') || "";
                    if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
                }

                const authorName = userLink ? userLink.innerText.trim() : "Créateur MakerWorld";
                const authorUrl = userLink ? userLink.href : "";

                // Extraction des likes
                let likes = 0;
                const textLines = card.innerText.split('\n').map(l => l.trim()).filter(Boolean);
                for (const line of textLines) {
                    const num = parseInt(line.replace(/,/g, ''), 10);
                    if (!isNaN(num) && num > 0) {
                        likes = num;
                        break;
                    }
                }

                // ID unique extrait de l'URL du modèle
                const idMatch = modelUrl.match(/\/models\/(\d+)/);
                const modelId = idMatch ? idMatch[1] : `mw_${i + 1}`;

                list.push({
                    id: modelId,
                    rank: list.length + 1,
                    title,
                    url: modelUrl,
                    imageUrl,
                    author: authorName,
                    authorUrl,
                    license: "CC BY",
                    likes
                });
            }

            return list;
        });

        console.log(`\x1b[32m✔ ${rawModels.length} modèles extraits de la liste principale.\x1b[0m`);

        // 5. Deep Scraping : Visite individuelle de chaque page de modèle
        console.log(`\n\x1b[36m--- 🔬 Scraping Profond : Analyse détaillée des 10 modèles MakerWorld ---\x1b[0m`);
        for (let i = 0; i < rawModels.length; i++) {
            const m = rawModels[i];
            console.log(`   [${i + 1}/${rawModels.length}] Chargement page détaillée : "${m.title}"...`);
            try {
                await page.goto(m.url, { waitUntil: 'domcontentloaded', timeout: 35000 });
                // Brève pause pour initialiser les scripts Next.js
                await new Promise(r => setTimeout(r, 2000));

                const detail = await page.evaluate(() => {
                    let weight = 50;
                    let printTimeSec = 3600;
                    let profileTitle = "Profil Standard";
                    const media = [];
                    const seen = new Set();
                    let summary = "";

                    const script = document.getElementById('__NEXT_DATA__');
                    if (script) {
                        try {
                            const data = JSON.parse(script.innerText);
                            const d = data.props?.pageProps?.design || {};

                            summary = d.summary || d.summaryTranslated || "";

                            // Profil d'impression par défaut
                            const defInst = (d.instances || []).find(inst => inst.id === d.defaultInstanceId || inst.isDefault) || (d.instances || [])[0] || {};
                            if (typeof defInst.weight === 'number' && defInst.weight > 0) {
                                weight = defInst.weight;
                            }
                            if (defInst.prediction) {
                                printTimeSec = defInst.prediction;
                            }
                            if (defInst.title) {
                                profileTitle = defInst.title;
                            }

                            // Images et vidéos depuis designExtension
                            const ext = d.designExtension || {};
                            const allPics = [...(ext.design_pictures || []), ...(ext.real_pictures || [])];
                            allPics.forEach(p => {
                                const u = p.url;
                                if (u && !seen.has(u)) {
                                    seen.add(u);
                                    media.push({ type: 'image', url: u, name: p.name || '' });
                                }
                            });

                            const videos = ext.design_video || [];
                            videos.forEach(v => {
                                const vu = v.url || v.videoUrl;
                                if (vu && !seen.has(vu)) {
                                    seen.add(vu);
                                    media.push({ type: 'video', url: vu, cover: v.cover || '' });
                                }
                            });
                        } catch (e) {}
                    }

                    // Fallback DOM si media est vide
                    if (media.length === 0) {
                        document.querySelectorAll('.swiper-slide img, [class*="carousel"] img, [class*="gallery"] img, [class*="preview"] img').forEach(img => {
                            const src = img.currentSrc || img.src || img.getAttribute('data-src');
                            if (src && !seen.has(src) && !src.includes('avatar') && !src.includes('icon')) {
                                seen.add(src);
                                media.push({ type: 'image', url: src });
                            }
                        });
                    }

                    // Fallback DOM pour le poids si resté à 50
                    if (weight === 50) {
                        const bodyText = document.body.innerText;
                        const match = bodyText.match(/(\d+(?:\.\d+)?)\s*g\b/i);
                        if (match) weight = parseFloat(match[1]);
                    }

                    return { weight, printTimeSec, profileTitle, media, summary };
                });

                m.weight = detail.weight;
                m.printTimeMinutes = Math.round(detail.printTimeSec / 60);
                m.profileTitle = detail.profileTitle;
                m.rawMedia = detail.media;
                if (detail.summary) m.description = detail.summary;
                console.log(`      ✔ Poids : ${m.weight}g | Temps : ${m.printTimeMinutes} min | Médias : ${m.rawMedia.length}`);
            } catch (detailErr) {
                console.warn(`      ⚠️ Échec sur page détaillée de "${m.title}":`, detailErr.message);
                m.weight = 45;
                m.printTimeMinutes = 60;
                m.profileTitle = "Standard 0.2mm";
                m.rawMedia = m.imageUrl ? [{ type: 'image', url: m.imageUrl }] : [];
            }
        }

    } finally {
        await browser.close();
    }

    console.log(`\n\x1b[32m✔ Données enrichies extraites pour les ${rawModels.length} modèles.\x1b[0m`);

    // 6. Téléchargement local des médias (couvertures et carrousels) dans photo/store/
    console.log(`\n\x1b[35m--- 📥 Téléchargement local des médias dans photo/store/ ---\x1b[0m`);
    const processedModels = [];

    for (const m of rawModels) {
        let localCoverRelPath = "";

        // A. Téléchargement image principale (couverture)
        if (m.imageUrl) {
            try {
                let ext = 'jpg';
                if (m.imageUrl.includes('format,webp')) ext = 'webp';
                else if (m.imageUrl.includes('.png')) ext = 'png';
                else if (m.imageUrl.includes('.jpeg')) ext = 'jpeg';
                else if (m.imageUrl.includes('.gif')) ext = 'gif';

                const coverFilename = `store_${m.id}.${ext}`;
                const coverAbsPath = path.join(STORE_PHOTO_DIR, coverFilename);

                if (!fs.existsSync(coverAbsPath)) {
                    console.log(`   Téléchargement couverture : ${m.title} -> ${coverFilename}`);
                    await downloadImage(m.imageUrl, coverAbsPath);
                }
                localCoverRelPath = `photo/store/${coverFilename}`;
            } catch (err) {
                console.warn(`   ⚠️ Erreur couverture pour "${m.title}":`, err.message);
                localCoverRelPath = m.imageUrl;
            }
        }

        // B. Téléchargement des médias de carrousel (jusqu'à 6 par modèle)
        const downloadedMedia = [];
        const rawMedia = m.rawMedia || [];

        // Toujours inclure la couverture en premier média si non présente
        if (m.imageUrl && !rawMedia.some(item => item.url === m.imageUrl)) {
            rawMedia.unshift({ type: 'image', url: m.imageUrl });
        }

        const mediaToProcess = rawMedia.slice(0, 6);
        for (let idx = 0; idx < mediaToProcess.length; idx++) {
            const item = mediaToProcess[idx];
            let itemLocalPath = "";

            if (item.type === 'video') {
                // Pour les vidéos distantes, conserver l'URL directe
                itemLocalPath = item.url;
            } else if (item.url && item.url.startsWith('http')) {
                try {
                    let ext = 'jpg';
                    if (item.url.includes('format,webp') || item.url.endsWith('.webp')) ext = 'webp';
                    else if (item.url.includes('.png')) ext = 'png';
                    else if (item.url.includes('.gif')) ext = 'gif';
                    else if (item.url.includes('.jpeg')) ext = 'jpeg';

                    const mediaFilename = `store_${m.id}_${idx}.${ext}`;
                    const mediaAbsPath = path.join(STORE_PHOTO_DIR, mediaFilename);

                    if (!fs.existsSync(mediaAbsPath)) {
                        await downloadImage(item.url, mediaAbsPath);
                    }
                    itemLocalPath = `photo/store/${mediaFilename}`;
                } catch (medErr) {
                    itemLocalPath = item.url; // fallback sur URL distante
                }
            } else {
                itemLocalPath = item.url;
            }

            downloadedMedia.push({
                type: item.type || 'image',
                url: itemLocalPath,
                remoteUrl: item.url
            });
        }

        processedModels.push({
            id: m.id,
            rank: m.rank,
            title: m.title,
            titre: m.title,
            author: m.author,
            auteur: m.author,
            authorUrl: m.authorUrl,
            lienAuteur: m.authorUrl,
            url: m.url,
            urlSource: m.url,
            license: m.license || "CC BY",
            licence: m.license || "CC BY",
            likes: m.likes || 0,
            weight: m.weight || 45, // Poids en grammes
            poids: m.weight || 45,
            printTimeMinutes: m.printTimeMinutes || 60,
            profileTitle: m.profileTitle || "Standard",
            description: m.description || `Modèle 3D sous licence commerciale par ${m.author}.`,
            imageUrl: m.imageUrl,
            image: localCoverRelPath || m.imageUrl,
            localImage: localCoverRelPath || m.imageUrl,
            media: downloadedMedia,
            price: 15 // Prix indicatif de base
        });
    }

    // 7. Sauvegarde du fichier JSON local (store_prints.json)
    fs.writeFileSync(STORE_JSON_FILE, JSON.stringify(processedModels, null, 2), 'utf8');
    console.log(`\n\x1b[32m✔ Fichier enrichi enregistré : pages/services/store_prints.json (${processedModels.length} modèles complets)\x1b[0m`);

    // 8. Synchronisation avec la base de données Notion (Option B)
    await syncWithNotion(processedModels);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n\x1b[32m✨ Scraper MakerWorld Deep terminé avec succès en ${elapsed}s !\x1b[0m`);
    return processedModels;
}

// Synchronisation avec Notion API
async function syncWithNotion(models) {
    const apiKey = process.env.NOTION_API_KEY;
    if (!apiKey) {
        console.warn(`\x1b[33m⚠️ NOTION_API_KEY absente dans .env, saut de la synchronisation Notion.\x1b[0m`);
        return;
    }

    const notion = new Client({ auth: apiKey });
    let dbId = process.env.NOTION_PRINTS_DB_ID;

    // Détection automatique si non configuré
    if (!dbId && process.env.NOTION_DB_PERSONNEL) {
        try {
            const children = await notion.blocks.children.list({ block_id: process.env.NOTION_DB_PERSONNEL });
            const found = children.results.find(b => 
                b.type === 'child_database' && 
                (b.child_database.title.toLowerCase().includes('impress') || b.child_database.title.toLowerCase().includes('maker'))
            );
            if (found) dbId = found.id;
        } catch {}
    }

    if (!dbId) {
        console.warn(`\x1b[33m⚠️ Base Notion "Impressions 3D" introuvable. Configurez NOTION_PRINTS_DB_ID dans .env.\x1b[0m`);
        return;
    }

    console.log(`\n6. Synchronisation avec la base Notion "Impressions 3D" (ID: ${dbId})...`);

    // Récupération des pages déjà existantes dans la base pour éviter les doublons
    let existingPages = [];
    try {
        const queryRes = await notion.databases.query({ database_id: dbId });
        existingPages = queryRes.results;
        console.log(`   ${existingPages.length} entrées déjà présentes dans Notion.`);
    } catch (e) {
        console.warn(`   ⚠️ Erreur lecture base Notion: ${e.message}`);
    }

    let addedCount = 0;
    let updatedCount = 0;
    let newlyAddedList = [];

    for (const m of models) {
        // Recherche par URL Source ou Nom
        const match = existingPages.find(p => {
            const sourceUrl = p.properties["URL Source"]?.url;
            const title = p.properties["Nom"]?.title?.[0]?.plain_text;
            return (sourceUrl && sourceUrl === m.url) || (title && title === m.title);
        });

        if (!match) {
            // Création de la nouvelle fiche Notion
            try {
                await notion.pages.create({
                    parent: { database_id: dbId },
                    properties: {
                        'Nom': {
                            title: [{ text: { content: m.title } }]
                        },
                        'Auteur': {
                            rich_text: [{ text: { content: m.author } }]
                        },
                        'Lien Auteur': m.authorUrl ? { url: m.authorUrl } : undefined,
                        'URL Source': m.url ? { url: m.url } : undefined,
                        'Licence': {
                            select: { name: 'CC BY' }
                        },
                        'prix': {
                            number: m.price || 15
                        },
                        'publiqe': {
                            checkbox: process.env.SCRAPE_AUTO_PUBLISH === 'true' // Par défaut false (brouillon à valider dans Notion)
                        },
                        'Likes': {
                            number: m.likes || 0
                        },
                        'Description': {
                            rich_text: [{ text: { content: m.description || `Modèle 3D par ${m.author}` } }]
                        },
                        'image': m.imageUrl ? {
                            files: [{
                                name: `cover_${m.id}.jpg`,
                                external: { url: m.imageUrl }
                            }]
                        } : undefined
                    }
                });
                addedCount++;
                newlyAddedList.push({
                    title: m.title,
                    author: m.author,
                    weight: m.weight || 50,
                    url: m.url
                });
                console.log(`   ➕ Ajouté dans Notion (Brouillon) : "${m.title}" (par ${m.author})`);
            } catch (createErr) {
                console.error(`   ❌ Erreur création Notion pour "${m.title}":`, createErr.message);
            }
        } else {
            // Fiche existante : mise à jour des likes sans écraser les prix personnalisés
            try {
                await notion.pages.update({
                    page_id: match.id,
                    properties: {
                        'Likes': { number: m.likes || 0 }
                    }
                });
                updatedCount++;
                console.log(`   🔄 Mis à jour dans Notion : "${m.title}" (Likes: ${m.likes})`);
            } catch (upErr) {
                console.warn(`   ⚠️ Erreur mise à jour Notion pour "${m.title}":`, upErr.message);
            }
        }
    }

    console.log(`\x1b[32m✔ Synchronisation Notion achevée : ${addedCount} créés (en attente de validation), ${updatedCount} mis à jour.\x1b[0m`);

    // Alerte optionnelle transmise via n8n vers Telegram
    if (addedCount > 0) {
        try {
            const webhookUrl = process.env.N8N_SCRAPE_ALERT_WEBHOOK || 'https://yelp-bakeshop-repaying.ngrok-free.dev/webhook/nouveau-modele-makerworld';
            await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'new_makerworld_models',
                    addedCount,
                    updatedCount,
                    models: newlyAddedList
                })
            });
            console.log(`\x1b[36m📱 Alerte envoyée vers n8n pour avertir sur Telegram.\x1b[0m`);
        } catch (e) {
            // Silencieux si n8n n'est pas joignable à cet instant
        }
    }
}

// Exécution directe en ligne de commande
if (require.main === module) {
    scrapeMakerWorld().catch(err => {
        console.error("\x1b[31mErreur fatale scraper:\x1b[0m", err);
        process.exit(1);
    });
}

module.exports = { scrapeMakerWorld, downloadImage };
