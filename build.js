require('dotenv').config();
const { Client } = require('@notionhq/client');
const { NotionToMarkdown } = require('notion-to-md');
const { marked } = require('marked');
const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');

const apiKey = process.env.NOTION_API_KEY;
const parentPageId = process.env.NOTION_DB_PERSONNEL;
const clientProjectsDbId = process.env.NOTION_CLIENT_PROJECTS_DB_ID;
const filamentsDbId = process.env.NOTION_FILAMENTS_DB_ID;
const featuredPrintsDbId = process.env.NOTION_PRINTS_DB_ID;

const notion = new Client({ auth: apiKey || 'secret_dummy' });

// --- NOTION RATE LIMITER & RETRY SYSTEM ---
// Notion API autorise en moyenne 3 requêtes/seconde par jeton d'intégration.
// Pour prévenir tout dépassement (code: 'rate_limited', HTTP 429) sur Render
// et lors du traitement intensif des blocs Markdown (notion-to-md),
// nous sérialisons toutes les requêtes (cadence minimale de 360ms) et appliquons
// un réessai automatique avec backoff exponentiel (jusqu'à 6 tentatives, respect de Retry-After).

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const MIN_NOTION_REQUEST_INTERVAL_MS = 360;
let notionRequestQueue = Promise.resolve();

function enqueueNotionRequest(fn) {
    const run = async () => {
        await sleep(MIN_NOTION_REQUEST_INTERVAL_MS);
        return fn();
    };
    const promise = notionRequestQueue.then(run, run);
    notionRequestQueue = promise.catch(() => {});
    return promise;
}

const originalNotionRequest = notion.request.bind(notion);

notion.request = function (args) {
    return enqueueNotionRequest(async () => {
        const maxRetries = 6;
        let attempt = 0;

        while (true) {
            try {
                return await originalNotionRequest(args);
            } catch (error) {
                attempt++;
                const isRateLimit = error.code === 'rate_limited' || 
                                    error.status === 429 || 
                                    (error.message && error.message.toLowerCase().includes('rate limited'));
                const isServerError = (error.status >= 500 && error.status <= 599) || 
                                      error.code === 'internal_server_error' || 
                                      error.code === 'service_unavailable';

                if ((isRateLimit || isServerError) && attempt <= maxRetries) {
                    let waitSeconds = Math.pow(2, attempt); // 2s, 4s, 8s, 16s, 32s, 64s
                    if (error.headers && typeof error.headers.get === 'function') {
                        const retryAfter = error.headers.get('retry-after');
                        if (retryAfter && !isNaN(retryAfter)) {
                            waitSeconds = Math.max(waitSeconds, parseInt(retryAfter, 10) + 1);
                        }
                    } else if (error.headers && (error.headers['retry-after'] || error.headers['Retry-After'])) {
                        const retryAfter = error.headers['retry-after'] || error.headers['Retry-After'];
                        if (retryAfter && !isNaN(retryAfter)) {
                            waitSeconds = Math.max(waitSeconds, parseInt(retryAfter, 10) + 1);
                        }
                    }
                    console.warn(`\x1b[33m⏳ [Notion API] ${isRateLimit ? 'Rate limit (429)' : 'Erreur ' + (error.status || error.code)} sur "${args?.path || 'requête'}". Pause de ${waitSeconds}s avant réessai ${attempt}/${maxRetries}...\x1b[0m`);
                    await sleep(waitSeconds * 1000);
                } else {
                    throw error;
                }
            }
        }
    });
};

const n2m = new NotionToMarkdown({ notionClient: notion });


function slugify(text) {
    return text.toString().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, "") // Enlever les accents
        .replace(/\s+/g, '-')           // Remplacer les espaces par -
        .replace(/[^\w-]+/g, '')       // Supprimer les caractères non-alphanumériques
        .replace(/--+/g, '-')         // Éviter les tirets multiples
        .replace(/^-+|-+$/g, '');      // Enlever les tirets au début et à la fin
}

// --- COLONNES NOTION ---
n2m.setCustomTransformer('column_list', async (block) => {
    const { results } = await notion.blocks.children.list({ block_id: block.id });
    const mdblocks = await n2m.blocksToMarkdown(results);
    const mdString = n2m.toMarkdownString(mdblocks);
    const content = typeof mdString === 'string' ? mdString : (mdString?.parent || "");
    return `\n<div class="notion-row">\n\n${content}\n\n</div>\n`;
});

n2m.setCustomTransformer('column', async (block) => {
    const { results } = await notion.blocks.children.list({ block_id: block.id });
    const mdblocks = await n2m.blocksToMarkdown(results);
    const mdString = n2m.toMarkdownString(mdblocks);
    const content = typeof mdString === 'string' ? mdString : (mdString?.parent || "");
    return `\n<div class="notion-col">\n\n${content}\n\n</div>\n`;
});

// --- VIDEOS & EMBEDS ---
const parseYouTubeUrl = (url) => {
    let videoId = '';
    let isShort = false;
    if (url.includes('youtube.com/watch')) {
        try { videoId = new URL(url).searchParams.get('v'); } catch { }
    } else if (url.includes('youtu.be/')) {
        try { videoId = new URL(url).pathname.substring(1); } catch { }
    } else if (url.includes('youtube.com/shorts/')) {
        try {
            videoId = new URL(url).pathname.split('/shorts/')[1].split('?')[0];
            isShort = true;
        } catch { }
    }
    return { videoId, isShort };
};

const renderYouTubeEmbed = (videoId, isShort) => {
    if (isShort) {
        return `\n<div style="max-width: 350px; margin: 40px auto;"><div class="notion-short-wrapper" style="position: relative; width: 100%; padding-bottom: 177.77%; height: 0; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.06);"><iframe style="position: absolute; top:0; left:0; width:100%; height:100%; border:none;" src="https://www.youtube.com/embed/${videoId}?loop=1&color=white&controls=1&modestbranding=1&playsinline=1&rel=0" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div></div>\n`;
    } else {
        return `\n<div class="notion-video-wrapper"><iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>\n`;
    }
};

const renderSketchfabEmbed = (url) => {
    let embedUrl = url;
    if (!embedUrl.endsWith('/embed') && !embedUrl.includes('/embed?')) {
        const match = url.match(/([a-f0-9]{32})/);
        if (match) {
            embedUrl = `https://sketchfab.com/models/${match[1]}/embed`;
        }
    }
    return `\n<div class="notion-video-wrapper" style="margin: 40px 0;"><iframe src="${embedUrl}" frameborder="0" allow="autoplay; fullscreen; vr" allowfullscreen style="width: 100%; height: 500px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.06);"></iframe></div>\n`;
};

const isNativeVideoUrl = (url) => {
    try {
        const parsed = new URL(url);
        const isCloudflareR2 = parsed.hostname.endsWith('.r2.dev');
        const isVideoExt = /\.(mp4|webm|mov)$/i.test(parsed.pathname);
        return isCloudflareR2 || isVideoExt;
    } catch {
        return false;
    }
};

n2m.setCustomTransformer('video', async (block) => {
    const video = block.video;
    if (!video) return '';
    let url = '';
    if (video.type === 'external') {
        url = video.external.url;
    } else if (video.type === 'file') {
        url = video.file.url;
    }
    if (!url) return '';

    if (url.includes('youtube.com/') || url.includes('youtu.be/')) {
        const { videoId, isShort } = parseYouTubeUrl(url);
        if (videoId) return renderYouTubeEmbed(videoId, isShort);
    } else if (url.includes('vimeo.com/')) {
        const match = /vimeo\.com\/(?:video\/)?(\d+)/.exec(url);
        if (match) {
            const videoId = match[1];
            return `\n<div class="notion-video-wrapper"><iframe src="https://player.vimeo.com/video/${videoId}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>\n`;
        }
    } else if (url.includes('drive.google.com/file/d/')) {
        const match = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/.exec(url);
        if (match) {
            const fileId = match[1];
            return `\n<div class="notion-video-wrapper"><iframe src="https://drive.google.com/file/d/${fileId}/preview" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>\n`;
        }
    } else if (url.includes('sketchfab.com/')) {
        return renderSketchfabEmbed(url);
    }
    return `\n<div class="notion-video-wrapper"><video controls src="${url}"></video></div>\n`;
});

n2m.setCustomTransformer('embed', async (block) => {
    const embed = block.embed;
    if (!embed?.url) return '';
    const url = embed.url;

    if (url.includes('youtube.com/') || url.includes('youtu.be/')) {
        const { videoId, isShort } = parseYouTubeUrl(url);
        if (videoId) return renderYouTubeEmbed(videoId, isShort);
    } else if (url.includes('vimeo.com/')) {
        const match = /vimeo\.com\/(?:video\/)?(\d+)/.exec(url);
        if (match) {
            const videoId = match[1];
            return `\n<div class="notion-video-wrapper"><iframe src="https://player.vimeo.com/video/${videoId}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>\n`;
        }
    } else if (url.includes('drive.google.com/file/d/')) {
        const match = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/.exec(url);
        if (match) {
            const fileId = match[1];
            return `\n<div class="notion-video-wrapper"><iframe src="https://drive.google.com/file/d/${fileId}/preview" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>\n`;
        }
    } else if (url.includes('sketchfab.com/')) {
        return renderSketchfabEmbed(url);
    } else if (isNativeVideoUrl(url)) {
        return `\n<div class="notion-video-wrapper"><video controls src="${url}"></video></div>\n`;
    }
    return `\n<a href="${url}" target="_blank" class="link-act" style="color: var(--provence-violet);">${url}</a>\n`;
});

n2m.setCustomTransformer('bookmark', async (block) => {
    const bookmark = block.bookmark;
    if (!bookmark?.url) return '';
    const url = bookmark.url;

    if (url.includes('drive.google.com/file/d/')) {
        const match = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/.exec(url);
        if (match) {
            const fileId = match[1];
            return `\n<div class="notion-video-wrapper"><iframe src="https://drive.google.com/file/d/${fileId}/preview" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>\n`;
        }
    } else if (url.includes('sketchfab.com/')) {
        return renderSketchfabEmbed(url);
    } else if (isNativeVideoUrl(url)) {
        return `\n<div class="notion-video-wrapper"><video controls src="${url}"></video></div>\n`;
    }
    return `\n<a href="${url}" target="_blank" class="link-act" style="color: var(--provence-violet);">${url}</a>\n`;
});

n2m.setCustomTransformer('link_preview', async (block) => {
    const link_preview = block.link_preview;
    if (!link_preview?.url) return '';
    const url = link_preview.url;

    if (url.includes('drive.google.com/file/d/')) {
        const match = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/.exec(url);
        if (match) {
            const fileId = match[1];
            return `\n<div class="notion-video-wrapper"><iframe src="https://drive.google.com/file/d/${fileId}/preview" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>\n`;
        }
    } else if (url.includes('sketchfab.com/')) {
        return renderSketchfabEmbed(url);
    } else if (isNativeVideoUrl(url)) {
        return `\n<div class="notion-video-wrapper"><video controls src="${url}"></video></div>\n`;
    }
    return `\n<a href="${url}" target="_blank" class="link-act" style="color: var(--provence-violet);">${url}</a>\n`;
});

// --- PDF & FICHIERS ---
n2m.setCustomTransformer('pdf', async (block) => {
    const pdf = block.pdf;
    if (!pdf) return '';
    let url = '';
    if (pdf.type === 'external') {
        url = pdf.external.url;
    } else if (pdf.type === 'file') {
        url = pdf.file.url;
    }
    if (!url) return '';

    return `\n<div class="notion-pdf-wrapper" style="width: 100%; height: 80vh; min-height: 600px; margin: 40px 0; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.06);"><iframe class="notion-pdf-iframe" src="${url}" style="width: 100%; height: 100%; border: none;"></iframe></div>\n`;
});

n2m.setCustomTransformer('file', async (block) => {
    const file = block.file;
    if (!file) return '';
    let url = '';
    if (file.type === 'external') {
        url = file.external.url;
    } else if (file.type === 'file') {
        url = file.file.url;
    }
    if (!url) return '';
    
    if (file.name?.toLowerCase().endsWith('.pdf')) {
        return `\n<div class="notion-pdf-wrapper" style="width: 100%; height: 80vh; min-height: 600px; margin: 40px 0; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.06);"><iframe class="notion-pdf-iframe" src="${url}" style="width: 100%; height: 100%; border: none;"></iframe></div>\n`;
    }

    return `\n<a href="${url}" target="_blank" class="notion-file-link" style="display: inline-block; padding: 10px 20px; background: var(--provence-violet); color: white; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 10px 0;">📎 Télécharger ${file.name || 'le fichier'}</a>\n`;
});

// --- IMAGES & MEDIA PROCESSING ---
async function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        const dir = path.dirname(filepath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const file = fs.createWriteStream(filepath);
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
            }
        };
        const lib = url.startsWith('http://') ? require('http') : https;
        lib.get(url, options, response => {
            if (response.statusCode >= 200 && response.statusCode < 300) {
                response.pipe(file);
                file.on('finish', () => { file.close(); resolve(filepath); });
            } else { reject(new Error(`Failed to download image: ${response.statusCode}`)); }
        }).on('error', err => { fs.unlink(filepath, () => reject(err)); });
    });
}

async function downloadNotionImage(page, propertyName, prefix, id, titre, subfolder) {
    let imageUrl = null;
    if (page.properties[propertyName]?.files?.length > 0) {
        const imgFichier = page.properties[propertyName].files[0];
        const originalUrl = imgFichier.type === 'file' ? imgFichier.file.url : imgFichier.external.url;
        try {
            const ext = originalUrl.split('?')[0].split('.').pop() || 'jpg';
            const localFilename = `${prefix}_${id}.${ext}`;
            const localFilepath = path.join(__dirname, 'photo', subfolder, localFilename);
            console.log(`\x1b[36m   Téléchargement de l'image ${propertyName} pour ${titre}...\x1b[0m`);
            await downloadImage(originalUrl, localFilepath);
            imageUrl = `../../../photo/${subfolder}/${localFilename}`;
        } catch (imgError) {
            console.error(`\x1b[31m   Erreur de téléchargement pour ${propertyName} de ${titre}:\x1b[0m`, imgError.message);
            imageUrl = originalUrl;
        }
    }
    return imageUrl;
}

async function processInternalImages(contenuHtml, id, titre, subfolder) {
    const imgRegex = /<img[^>]+src="([^">]+)"/gi;
    const matches = [...contenuHtml.matchAll(imgRegex)];
    let imgIndex = 0;
    for (const match of matches) {
        const originalImgUrl = match[1];
        if (originalImgUrl.startsWith('http')) {
            imgIndex++;
            try {
                const urlObj = new URL(originalImgUrl);
                let ext = urlObj.pathname.split('.').pop();
                if (!ext || ext.length > 4 || !/^[a-zA-Z0-9]+$/.test(ext)) ext = 'jpg';
                const filename = `interne_${id}_${imgIndex}.${ext}`;
                const filepath = path.join(__dirname, 'photo', subfolder, filename);
                console.log(`\x1b[36m   Téléchargement de l'image interne ${imgIndex} pour l'article ${titre}...\x1b[0m`);
                await downloadImage(originalImgUrl, filepath);
                const localUrl = `../../../photo/${subfolder}/${filename}`;
                contenuHtml = contenuHtml.split(originalImgUrl).join(localUrl);
            } catch (err) {
                console.error(`\x1b[31m   Erreur lors du téléchargement de l'image interne ${imgIndex} pour ${titre}:\x1b[0m`, err.message);
            }
        }
    }
    return contenuHtml;
}

async function processInternalPdfs(contenuHtml, id, titre, subfolder) {
    const pdfRegex = /<iframe[^>]+class="notion-pdf-iframe"[^>]+src="([^">]+)"/gi;
    const matches = [...contenuHtml.matchAll(pdfRegex)];
    let pdfIndex = 0;
    for (const match of matches) {
        const originalPdfUrl = match[1];
        if (originalPdfUrl.startsWith('http')) {
            pdfIndex++;
            try {
                const filename = `interne_${id}_pdf_${pdfIndex}.pdf`;
                const filepath = path.join(__dirname, 'pdf', subfolder, filename);
                console.log(`\x1b[36m   Téléchargement du PDF interne ${pdfIndex} pour l'article ${titre}...\x1b[0m`);
                await downloadImage(originalPdfUrl, filepath);
                const localUrl = `../../../pdf/${subfolder}/${filename}`;
                contenuHtml = contenuHtml.split(originalPdfUrl).join(localUrl);
            } catch (err) {
                console.error(`\x1b[31m   Erreur lors du téléchargement du PDF interne ${pdfIndex} pour ${titre}:\x1b[0m`, err.message);
            }
        }
    }
    return contenuHtml;
}

function processGoogleDriveLinks(contenuHtml) {
    const regex = /<a\b[^>]*\bhref="(https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)[^"]*)"[^>]*>.*?<\/a>/g;
    return contenuHtml.replaceAll(regex, (match, url, fileId) => {
        return `\n<div class="notion-video-wrapper"><iframe src="https://drive.google.com/file/d/${fileId}/preview" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>\n`;
    });
}

function processSketchfabLinks(contenuHtml) {
    const regex = /<a[^>]*href="(https:\/\/sketchfab\.com\/[^"]+)"[^>]*>.*?<\/a>/g;
    return contenuHtml.replaceAll(regex, (match, url) => {
        if (!url.includes('/models/') && !url.includes('/3d-models/')) return match;
        return renderSketchfabEmbed(url);
    });
}

function processNativeVideoLinks(contenuHtml) {
    const regex = /<a[^>]*href="([^"]+)"[^>]*>.*?<\/a>/g;
    return contenuHtml.replaceAll(regex, (match, url) => {
        const decodedUrl = url.replaceAll('&amp;', '&');
        if (isNativeVideoUrl(decodedUrl)) {
            return `\n<div class="notion-video-wrapper"><video controls src="${url}"></video></div>\n`;
        }
        return match;
    });
}

function checkFailedIntegrations(contenuHtml, titre) {
    const mediaDomains = [
        'youtube.com', 'youtu.be', 'vimeo.com', 'drive.google.com', 
        'spotify.com', 'deezer.com', 'soundcloud.com', 'apple.com', 'sketchfab.com'
    ];
    
    const regex = /<a\b[^>]*\bhref="([^"]+)"/gi;
    let match;
    while ((match = regex.exec(contenuHtml)) !== null) {
        const fullTag = match[0];
        const url = match[1];
        
        if (fullTag.includes('social-icon-link')) continue;
        
        let isFailed = false;
        for (const domain of mediaDomains) {
            if (url.includes(domain)) {
                isFailed = true;
                break;
            }
        }

        const decodedUrl = url.replaceAll('&amp;', '&');
        if (!isFailed && isNativeVideoUrl(decodedUrl)) {
            isFailed = true;
        }

        if (isFailed) {
            console.warn(`\x1b[33m   ⚠️ Attention : Le lien "${url}" dans l'article "${titre}" n'a pas été intégré comme lecteur multimédia. Il apparaîtra comme un simple lien texte.\x1b[0m`);
        }
    }
}

function groupSocialLinks(contenuHtml) {
    const iconMappings = {
        'instagram': '<i class="fa-brands fa-instagram" style="color: #E1306C; font-size: 1.5em; vertical-align: middle;"></i>',
        'youtube': '<i class="fa-brands fa-youtube" style="color: #FF0000; font-size: 1.5em; vertical-align: middle;"></i>',
        'facebook': '<i class="fa-brands fa-facebook" style="color: #1877F2; font-size: 1.5em; vertical-align: middle;"></i>',
        'tiktok': '<i class="fa-brands fa-tiktok" style="font-size: 1.5em; vertical-align: middle;"></i>',
        'spotify': '<i class="fa-brands fa-spotify" style="color: #1DB954; font-size: 1.5em; vertical-align: middle;"></i>',
        'linktr\\.ee|link[-\\s]*tree': '<i class="fa-solid fa-link" style="color: #43E660; font-size: 1.25em; vertical-align: text-bottom; margin-right: 5px;"></i>',
        'deezer': '<i class="fa-brands fa-deezer" style="font-size: 1.5em; vertical-align: middle;"></i>',
        'apple[-\\s]*podcast': '<i class="fa-solid fa-podcast" style="color: #872EC4; font-size: 1.5em; vertical-align: middle;"></i>',
        'soundcloud': '<i class="fa-brands fa-soundcloud" style="color: #FF5500; font-size: 1.5em; vertical-align: middle;"></i>',
        'siteinternet': '<i class="fa-solid fa-globe" style="color: #0099ffff; font-size: 1.5em; vertical-align: middle;"></i>',
        'bandcamp': '<i class="fa-brands fa-bandcamp" style="color: #007C9E; font-size: 1.5em; vertical-align: middle;"></i>'
    };

    for (const [networkPattern, iconHtml] of Object.entries(iconMappings)) {
        const regex = new RegExp(String.raw`(?:<[^>]+>|\s)*\b(${networkPattern})\b(?:<[^>]+>|\s)*:(?:<[^>]+>|\s)*<a\s+href="([^"]+)"[^>]*>.*?<\/a>`, 'gi');
        contenuHtml = contenuHtml.replaceAll(regex, (match, p1, href) => {
            return `<!--SOCIAL_LINK_START--><a href="${href}" target="_blank" class="social-icon-link" style="display:flex; align-items:center; justify-content:center; width: 44px; height: 44px; background: rgba(255, 255, 255, 0.1); border-radius: 50%; text-decoration:none; transition: all 0.2s ease; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);">${iconHtml}</a><!--SOCIAL_LINK_END-->`;
        });
    }

    const broadRe = /(?:<p>\s*)?(?:<!--SOCIAL_LINK_START-->.*?<!--SOCIAL_LINK_END-->)+(?:\s*<\/p>)?/gi;
    contenuHtml = contenuHtml.replaceAll(broadRe, (match) => {
        const links = [];
        const linkRe = /<!--SOCIAL_LINK_START-->(.*?)<!--SOCIAL_LINK_END-->/g;
        let linkMatch;
        while ((linkMatch = linkRe.exec(match)) !== null) {
            links.push(linkMatch[1]);
        }
        if (links.length > 0) {
            return `\n<div class="social-links-container" style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap; margin: 20px 0;">\n` + links.join('\n') + `\n</div>\n`;
        }
        return match;
    });
    return contenuHtml;
}

async function processMermaid(contenuHtml, id, titre, subfolder) {
    const regex = /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/gi;
    const matches = [...contenuHtml.matchAll(regex)];
    let newContenuHtml = contenuHtml;
    
    let mermaidIndex = 0;
    for (const match of matches) {
        mermaidIndex++;
        let code = match[1];
        
        let decodedCode = code
            .replaceAll('&amp;', '&')
            .replaceAll('&lt;', '<')
            .replaceAll('&gt;', '>')
            .replaceAll('&quot;', '"')
            .replaceAll('&#39;', "'");

        // Optimisation en largeur: forcer l'orientation Left-to-Right (LR)
        decodedCode = decodedCode.replace(/^(flowchart|graph)\s+(TD|TB)\b/mi, '$1 LR');
        // Remplacer les couleurs de fond (fill) et texte (color) par transparent/blanc
        decodedCode = decodedCode.replace(/((?:classDef|style)\s+\w+[^;\n]*?)(fill:\s*[^,;\n]+)/gi, '$1fill:transparent');
        decodedCode = decodedCode.replace(/((?:classDef|style)\s+\w+[^;\n]*?)(color:\s*[^,;\n]+)/gi, '$1color:white');

        const imgUrlRegex = /(https?:\/\/[^\s"'()<>]+)/g;
        const urlMatches = [...decodedCode.matchAll(imgUrlRegex)];
        
        let imgIndex = 0;
        for (const urlMatch of urlMatches) {
            const originalUrl = urlMatch[1];
            if (originalUrl.match(/\.(png|jpe?g|gif|webp|svg|avif)(\?.*)?$/i) || 
                decodedCode.includes(`src="${originalUrl}"`) || 
                decodedCode.includes(`src='${originalUrl}'`) || 
                decodedCode.includes(`image="${originalUrl}"`)) {
                imgIndex++;
                try {
                    const urlObj = new URL(originalUrl);
                    let ext = urlObj.pathname.split('.').pop();
                    if (!ext || ext.length > 4 || !/^[a-zA-Z0-9]+$/.test(ext)) ext = 'png';
                    const filename = `mermaid_${id}_${mermaidIndex}_${imgIndex}.${ext}`;
                    const filepath = path.join(__dirname, 'photo', subfolder, filename);
                    console.log(`\x1b[36m   Téléchargement de l'image Mermaid ${imgIndex} pour l'article ${titre}...\x1b[0m`);
                    await downloadImage(originalUrl, filepath);
                    const localUrl = `../../../photo/${subfolder}/${filename}`;
                    decodedCode = decodedCode.split(originalUrl).join(localUrl);
                } catch (err) {
                    console.error(`\x1b[31m   Erreur lors du téléchargement de l'image Mermaid ${imgIndex} pour ${titre}:\x1b[0m`, err.message);
                }
            }
        }

        const replacement = `\n<div class="mermaid-wrapper"><div class="mermaid">\n${decodedCode}\n</div></div>\n`;
        newContenuHtml = newContenuHtml.replace(match[0], replacement);
    }
    return newContenuHtml;
}

// --- TRAITEMENT D'UNE PAGE ---
function extractTags(page) {
    let tagsArray = [];
    const propEtiq = page.properties["Étiquettes"] || page.properties["Catégorie"] || page.properties["Categorie"];
    if (propEtiq?.status) tagsArray.push(propEtiq.status.name);
    else if (propEtiq?.select) tagsArray.push(propEtiq.select.name);
    else if (propEtiq?.multi_select && propEtiq.multi_select.length > 0) tagsArray.push(...propEtiq.multi_select.map(e => e.name));

    const propSelect = page.properties["select"] || page.properties["Select"];
    if (propSelect?.multi_select && propSelect.multi_select.length > 0) {
        tagsArray.push(...propSelect.multi_select.map(e => e.name));
    } else if (propSelect?.select) {
        tagsArray.push(propSelect.select.name);
    }
    return [...new Set(tagsArray.filter(Boolean))];
}

function generateSommaire(contenuHtml) {
    let sommaireHtml = "";
    const headings = [];
    let headingIndex = 0;
    const seenIds = new Set();
    
    const headingRegex = /<(h[1-4])([^>]*)>(.*?)<\/\1>/gi;
    let newContenuHtml = contenuHtml.replace(headingRegex, (match, tag, attrs, content) => {
        headingIndex++;
        const level = Number.parseInt(tag[1]);
        let safeText = content.replace(/<[^>]+>/g, '').trim();
        let id = safeText.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        if (!id) id = `heading-${headingIndex}`;
        
        let originalId = id;
        let counter = 1;
        while (seenIds.has(id)) {
            id = `${originalId}-${counter}`;
            counter++;
        }
        seenIds.add(id);
        
        if (!attrs.includes('id=')) {
            attrs = `${attrs} id="${id}"`;
        } else {
            attrs = attrs.replace(/id="[^"]*"/, `id="${id}"`);
        }
        headings.push({ level, id, text: safeText });
        return `<${tag}${attrs}>${content}</${tag}>`;
    });
    
    if (headings.length > 0) {
        sommaireHtml = `\n<div class="sommaire-container">\n  <div class="sommaire-wrapper">\n`;
        for (const h of headings) {
            sommaireHtml += `    <div class="sommaire-item" data-level="${h.level}" data-target="${h.id}">\n`;
            sommaireHtml += `      <span class="sommaire-line"></span>\n`;
            sommaireHtml += `      <span class="sommaire-text">${h.text}</span>\n`;
            sommaireHtml += `    </div>\n`;
        }
        sommaireHtml += `  </div>\n</div>\n`;
    }
    return { newContenuHtml, sommaireHtml };
}

async function processPage(page, index, total, category, subfolder) {
    const id = page.id;
    const prefix = `[${category}/${subfolder}] [${index}/${total}]`;
    const isPublic = page.properties["publiqe"]?.checkbox || false;
    
    if (!isPublic) {
        console.log(`\x1b[33m${prefix} Ignoré (Non public) : Page ${id}\x1b[0m`);
        return { status: 'ignored' };
    }

    const titre = page.properties["Nom"]?.title?.[0]?.plain_text || "Sans titre";
    const slug = slugify(titre) || id;
    console.log(`\x1b[34m${prefix} Traitement : "${titre}"\x1b[0m`);

    try {
        const date = page.properties["Date"]?.date?.start || "";
        
        const tagsArray = extractTags(page);

        const getColorForTag = (tag) => {
            const palette = [
                "#E63946", "#1D3557", "#457B9D", "#2A9D8F", "#E76F51", 
                "#6A4C93", "#1982C4", "#55A630", "#FF595E", "#D62828", 
                "#003049", "#D66800", "#7B2CBF", "#0077B6", "#4C956C",
                "#8338EC", "#3A86FF", "#FB5607", "#FF006E", "#023E8A"
            ];
            let hash = 0;
            for (let i = 0; i < tag.length; i++) {
                hash = tag.codePointAt(i) + ((hash << 5) - hash);
            }
            hash = Math.abs(hash);
            return palette[hash % palette.length];
        };

        const categoriesHtml = tagsArray.map(tag => 
            `<span class="tag-badge" style="background-color: ${getColorForTag(tag)}; color: white; padding: 5px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: bold; margin-right: 5px; display: inline-block;">${tag}</span>`
        ).join('');

        const lien = page.properties["Lien"]?.url || "";
        const estAfficheAccueil = page.properties["Accueil"]?.checkbox || false;

        const descriptionProp = page.properties["description"] || page.properties["Description"];
        const description = descriptionProp?.rich_text?.[0]?.plain_text || "";

        let image = await downloadNotionImage(page, "image", "main", id, titre, subfolder) || `../../../photo/photoprojet/robot.jpg`; 
        let imageForJson = image.replace("../../../", "../../"); 

        let imageVinyl = await downloadNotionImage(page, "Image Vinyl", "vinyl", id, titre, subfolder);

        let audioUrl = "";
        if (page.properties["Audio"]?.files?.length > 0) {
            const audioFichier = page.properties["Audio"].files[0];
            audioUrl = audioFichier.type === 'file' ? audioFichier.file.url : audioFichier.external.url;
        }

        const mdblocks = await n2m.pageToMarkdown(id);
        const mdStringObj = n2m.toMarkdownString(mdblocks);
        let texteMarkdown = typeof mdStringObj === 'string' ? mdStringObj : (mdStringObj?.parent || "");
        
        let contenuHtml = marked.parse(texteMarkdown);

        // Nouveaux traitements sur le contenu HTML
        contenuHtml = await processMermaid(contenuHtml, id, titre, subfolder);
        contenuHtml = await processInternalImages(contenuHtml, id, titre, subfolder);
        contenuHtml = await processInternalPdfs(contenuHtml, id, titre, subfolder);
        contenuHtml = groupSocialLinks(contenuHtml);
        contenuHtml = processGoogleDriveLinks(contenuHtml);
        contenuHtml = processSketchfabLinks(contenuHtml);
        contenuHtml = processNativeVideoLinks(contenuHtml);
        checkFailedIntegrations(contenuHtml, titre);

        const resultSommaire = generateSommaire(contenuHtml);
        contenuHtml = resultSommaire.newContenuHtml;
        let sommaireHtml = resultSommaire.sommaireHtml;

        // Template HTML (uniquement pour les pages statiques générées)
        const templatePath = path.join(__dirname, 'pages', 'personnel', 'projet_template.html');
        if (fs.existsSync(templatePath)) {
            let template = fs.readFileSync(templatePath, 'utf8');
            template = template.replaceAll('{{TITRE}}', titre)
                               .replaceAll('{{IMAGE}}', image)
                               .replaceAll('{{DATE}}', date)
                               .replaceAll('{{CATEGORIES}}', categoriesHtml)
                               .replaceAll('{{DESCRIPTION}}', description)
                               .replaceAll('{{SOMMAIRE}}', sommaireHtml)
                               .replaceAll('{{CONTENU}}', contenuHtml);

            const outDir = path.join(__dirname, 'pages', category, subfolder);
            if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
            
            const outPath = path.join(outDir, `${slug}.html`);
            fs.writeFileSync(outPath, template);
        }

        const resultObj = {
            id,
            titre,
            description,
            date,
            etiquettes: tagsArray,
            lien,
            image: imageForJson,
            imageVinyl: imageVinyl ? imageVinyl.replace("../../../", "../../") : null,
            audio: audioUrl,
            url: `${subfolder}/${slug}.html`,
            contenu: contenuHtml,
            accueil: estAfficheAccueil,
            markdown: texteMarkdown
        };
        console.log(`\x1b[32m✅ ${prefix} Succès : "${titre}" généré.\x1b[0m`);
        return { status: 'success', data: resultObj };
    } catch (error) {
        console.error(`\x1b[31m❌ ${prefix} Erreur sur "${titre}" : ${error.message}\x1b[0m`);
        return { status: 'error', error };
    }
}

async function processDatabase(dbBlock) {
    const title = dbBlock.child_database.title.toLowerCase();
    let category = 'personnel';
    let subfolder = 'projets';
    
    if (title.includes('portfolio') || title.includes('educatif')) {
        category = 'educatif';
        subfolder = 'portfolios';
    }

    console.log(`\n\x1b[35m--- 📥 Traitement de la base de données : ${dbBlock.child_database.title} (${category}/${subfolder}) ---\x1b[0m`);
    
    const outDir = path.join(__dirname, 'pages', category, subfolder);
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    let dbResponse;
    try {
        dbResponse = await notion.databases.query({
            database_id: dbBlock.id,
            sorts: [{ property: 'Date', direction: 'descending' }],
        });
    } catch {
        try {
            dbResponse = await notion.databases.query({ database_id: dbBlock.id });
        } catch (err) {
            console.error(`\x1b[31m❌ Impossible de charger la base "${dbBlock.child_database?.title}" : ${err.message}\x1b[0m`);
            return { total: 0, successCount: 0, errorCount: 1, ignoredCount: 0 };
        }
    }

    // Nettoyer les anciens fichiers HTML générés seulement après succès de la requête
    const existingFiles = fs.readdirSync(outDir);
    for (const file of existingFiles) {
        if (file.endsWith('.html')) {
            try { fs.unlinkSync(path.join(outDir, file)); } catch {}
        }
    }

    const total = dbResponse.results.length;
    console.log(`\x1b[36mTotal trouvé dans "${dbBlock.child_database.title}" : ${total} pages.\x1b[0m\n`);

    const articles = [];
    let successCount = 0;
    let errorCount = 0;
    let ignoredCount = 0;

    for (let i = 0; i < total; i++) {
        const page = dbResponse.results[i];
        const result = await processPage(page, i + 1, total, category, subfolder);
        
        if (result.status === 'success') {
            articles.push(result.data);
            successCount++;
        } else if (result.status === 'ignored') {
            ignoredCount++;
        } else if (result.status === 'error') {
            errorCount++;
        }
    }

    const categoryDir = path.join(__dirname, 'pages', category);
    if (!fs.existsSync(categoryDir)) fs.mkdirSync(categoryDir, { recursive: true });
    
    const jsonPath = path.join(categoryDir, 'donnees.json');
    fs.writeFileSync(jsonPath, JSON.stringify(articles, null, 2));

    return { total, successCount, errorCount, ignoredCount };
}

// --- UTILITAIRES COULEURS FILAMENTS ---
function getColorHexFromName(colorName) {
    const c = (colorName || "").toLowerCase().trim();
    if (c.includes("noir") || c.includes("black") || c.includes("carbone")) return "#18181B";
    if (c.includes("blanc") || c.includes("white")) return "#F8FAFC";
    if (c.includes("violet") || c.includes("purple")) return "#7C3AED";
    if (c.includes("bleu") || c.includes("blue")) return "#38BDF8";
    if (c.includes("jaune") || c.includes("yellow")) return "#FBBF24";
    if (c.includes("vert") || c.includes("green")) return "#A3E635";
    if (c.includes("rouge") || c.includes("red")) return "#EF4444";
    if (c.includes("orange")) return "#F97316";
    if (c.includes("gris") || c.includes("grey") || c.includes("gray")) return "#6B7280";
    if (c.includes("rose") || c.includes("pink")) return "#EC4899";
    if (c.includes("or") || c.includes("gold") || c.includes("sable")) return "#EAB308";
    if (c.includes("argent") || c.includes("silver")) return "#94A3B8";
    if (c.includes("bronze") || c.includes("cuivre") || c.includes("copper")) return "#B45309";
    return "#7C3AED";
}

// --- BASE DE DONNÉES : PROJETS CLIENTS ("Pro") ---
async function processClientProjects(dbId) {
    console.log(`\n\x1b[35m--- 📥 Traitement de la base Notion : Projets Clients (${dbId}) ---\x1b[0m`);
    let dbResponse = null;
    try {
        dbResponse = await notion.databases.query({
            database_id: dbId,
            sorts: [{ property: 'Date', direction: 'descending' }]
        });
    } catch {
        // En cas d'erreur avec le tri par Date, requêter sans tri
        try {
            dbResponse = await notion.databases.query({ database_id: dbId });
        } catch (err) {
            console.warn(`\x1b[33m⚠️ Requête Notion Projets Clients impossible (${err.message}). Utilisation des données locales si disponibles.\x1b[0m`);
        }
    }

    const clientProjects = [];
    let successCount = 0;
    let ignoredCount = 0;

    if (dbResponse && Array.isArray(dbResponse.results)) {
        const total = dbResponse.results.length;
        console.log(`\x1b[36mTotal trouvé dans Projets Clients : ${total} pages.\x1b[0m\n`);

        for (let i = 0; i < total; i++) {
            const page = dbResponse.results[i];
            const id = page.id;
            
            // La propriété dans Notion est 'publiqe' (avec un 'q')
            const isPublic = page.properties["publiqe"]?.checkbox 
                          ?? page.properties["publique"]?.checkbox 
                          ?? page.properties["Publique"]?.checkbox 
                          ?? page.properties["public"]?.checkbox 
                          ?? page.properties["Public"]?.checkbox 
                          ?? false;

            if (!isPublic) {
                ignoredCount++;
                continue;
            }

            const titre = page.properties["Nom"]?.title?.[0]?.plain_text 
                       || page.properties["Titre"]?.title?.[0]?.plain_text 
                       || "Projet Client";

            const description = page.properties["Description"]?.rich_text?.map(t => t.plain_text).join('') || "";
            const date = page.properties["Date"]?.date?.start || "";

            // Propriétés réelles Notion : 'Select' et 'filament utilisé'
            const selectTags = (page.properties["Select"]?.multi_select || []).map(s => s.name);
            const filamentTags = (page.properties["filament utilisé"]?.multi_select || []).map(s => s.name);
            const etiquettes = [...selectTags, ...filamentTags];
            const service = selectTags[0] || "Impression 3D";

            let image = await downloadNotionImage(page, "image", "pro", id, titre, "projets_clients")
                     || await downloadNotionImage(page, "Image", "pro", id, titre, "projets_clients")
                     || "";

            if (image.includes('photo/')) {
                image = image.substring(image.indexOf('photo/'));
            }

            clientProjects.push({
                id,
                titre,
                description,
                service,
                etiquettes,
                filamentsUtilises: filamentTags,
                date,
                image
            });
            successCount++;
            console.log(`\x1b[32m✅ [Projets Clients] "${titre}" ajouté.\x1b[0m`);
        }
    }

    if (clientProjects.length === 0) {
        const localPath = path.join(__dirname, 'pages', 'services', 'projets_clients.json');
        if (fs.existsSync(localPath)) {
            try {
                const local = JSON.parse(fs.readFileSync(localPath, 'utf8'));
                if (Array.isArray(local) && local.length > 0) {
                    console.log(`\x1b[33mℹ️ Repli de sécurité : ${local.length} projets clients restaurés depuis le cache local.\x1b[0m`);
                    return { clientProjects: local, total: local.length, successCount: local.length, ignoredCount: 0 };
                }
            } catch {}
        }
    }

    return { clientProjects, total: clientProjects.length, successCount, ignoredCount };
}

// --- BASE DE DONNÉES : FILAMENTS EN STOCK ("filament") ---
async function processFilaments(dbId) {
    console.log(`\n\x1b[35m--- 📥 Traitement de la base Notion : Filaments (${dbId}) ---\x1b[0m`);
    let dbResponse = null;
    try {
        dbResponse = await notion.databases.query({ database_id: dbId });
    } catch (err) {
        console.warn(`\x1b[33m⚠️ Requête Notion Filaments impossible (${err.message}). Utilisation des données locales si disponibles.\x1b[0m`);
    }

    const filaments = [];
    let successCount = 0;
    let ignoredCount = 0;

    if (dbResponse && Array.isArray(dbResponse.results)) {
        const total = dbResponse.results.length;
        console.log(`\x1b[36mTotal trouvé dans Filaments : ${total} pages.\x1b[0m\n`);

        for (let i = 0; i < total; i++) {
            const page = dbResponse.results[i];
            const id = page.id;

            // La propriété dans Notion est 'publiqe' (avec un 'q')
            const isPublic = page.properties["publiqe"]?.checkbox 
                          ?? page.properties["publique"]?.checkbox 
                          ?? page.properties["Publique"]?.checkbox 
                          ?? page.properties["public"]?.checkbox 
                          ?? page.properties["Public"]?.checkbox 
                          ?? false;

            if (!isPublic) {
                ignoredCount++;
                continue;
            }

            const materiau = page.properties["Type"]?.select?.name 
                          || page.properties["Matériau"]?.select?.name 
                          || "PLA";

            const couleur = page.properties["Couleur"]?.rich_text?.[0]?.plain_text 
                         || page.properties["Couleur"]?.select?.name 
                         || "Standard";

            let nom = page.properties["Nom"]?.title?.[0]?.plain_text || "";
            if (!nom) {
                nom = `${materiau} ${couleur}`.trim();
            }

            let codeHex = "";
            if (couleur.startsWith('#')) {
                codeHex = couleur;
            } else {
                codeHex = getColorHexFromName(couleur);
            }

            // Notion 'État' : options 'Absent', 'Commendé', 'En stock'
            const stock = page.properties["État"]?.status?.name 
                       || page.properties["Etat"]?.status?.name 
                       || page.properties["Statut"]?.status?.name 
                       || "En stock";

            const prix = page.properties["prix"]?.number ?? page.properties["Prix"]?.number ?? null;
            const prixKg = prix !== null ? prix : null;
            const prixGramme = prixKg !== null ? Number((prixKg / 1000).toFixed(5)) : 0.022;

            const rawStockLower = (stock || "").toLowerCase();
            const enRupture = rawStockLower.includes("absent") || rawStockLower.includes("rupture") || rawStockLower.includes("out");

            const marques = (page.properties["Marque"]?.multi_select || []).map(m => m.name);
            const marque = marques.join(', ');

            let image = await downloadNotionImage(page, "image", "filament", id, nom, "filaments")
                     || await downloadNotionImage(page, "Image", "filament", id, nom, "filaments")
                     || "";

            if (image.includes('photo/')) {
                image = image.substring(image.indexOf('photo/'));
            }

            filaments.push({
                id,
                nom,
                materiau,
                couleur,
                codeHex,
                stock,
                prix: prixKg,
                prixKg,
                prixGramme,
                enRupture,
                marque,
                image
            });
            successCount++;
            console.log(`\x1b[32m✅ [Filaments] "${nom}" (${materiau} - ${couleur}) ajouté (Stock: ${stock}, ${prixKg ? prixKg + '€/kg' : 'N/C'}).\x1b[0m`);
        }
    }

    if (filaments.length === 0) {
        const localPath = path.join(__dirname, 'pages', 'services', 'filaments.json');
        if (fs.existsSync(localPath)) {
            try {
                const local = JSON.parse(fs.readFileSync(localPath, 'utf8'));
                if (Array.isArray(local) && local.length > 0) {
                    console.log(`\x1b[33mℹ️ Repli de sécurité : ${local.length} filaments restaurés depuis le cache local.\x1b[0m`);
                    return { filaments: local, total: local.length, successCount: local.length, ignoredCount: 0 };
                }
            } catch {}
        }
    }

    return { filaments, total: filaments.length, successCount, ignoredCount };
}

// --- TRAITEMENT DE LA BASE IMPRESSIONS 3D (MAKERWORLD / VEDETTES) ---
async function processFeaturedPrints(dbId) {
    console.log(`\n\x1b[35m=== 🖨️ TRAITEMENT DES IMPRESSIONS 3D EN VEDETTE ===\x1b[0m`);
    
    // Charger le catalogue local store_prints.json (issu du scraper approfondi)
    let localScrapedList = [];
    const localStorePath = path.join(__dirname, 'pages', 'services', 'store_prints.json');
    if (fs.existsSync(localStorePath)) {
        try {
            const raw = JSON.parse(fs.readFileSync(localStorePath, 'utf8'));
            if (Array.isArray(raw)) localScrapedList = raw;
        } catch {}
    }

    let dbResponse = null;
    if (dbId) {
        try {
            dbResponse = await notion.databases.query({
                database_id: dbId,
                sorts: [{ property: 'Likes', direction: 'descending' }]
            });
        } catch {
            try {
                dbResponse = await notion.databases.query({ database_id: dbId });
            } catch (err) {
                console.warn(`\x1b[33m⚠️ Requête Notion Impressions 3D impossible (${err.message}). Utilisation du catalogue local.\x1b[0m`);
            }
        }
    }

    const featuredPrints = [];
    let successCount = 0;
    let ignoredCount = 0;

    if (dbResponse && dbResponse.results && dbResponse.results.length > 0) {
        const total = dbResponse.results.length;
        console.log(`\x1b[36mTotal trouvé dans Impressions 3D Notion : ${total} modèles.\x1b[0m\n`);

        for (let i = 0; i < total; i++) {
            const page = dbResponse.results[i];
            const id = page.id;

            const isPublic = page.properties["publiqe"]?.checkbox 
                          ?? page.properties["publique"]?.checkbox 
                          ?? page.properties["Publique"]?.checkbox 
                          ?? page.properties["public"]?.checkbox 
                          ?? true;

            if (!isPublic) {
                ignoredCount++;
                continue;
            }

            const titre = page.properties["Nom"]?.title?.[0]?.plain_text 
                       || page.properties["Titre"]?.title?.[0]?.plain_text 
                       || "Modèle 3D MakerWorld";

            const auteur = page.properties["Auteur"]?.rich_text?.[0]?.plain_text || "Créateur MakerWorld";
            const lienAuteur = page.properties["Lien Auteur"]?.url || "";
            const urlSource = page.properties["URL Source"]?.url || "";
            const licence = page.properties["Licence"]?.select?.name || "CC BY";
            const prix = page.properties["prix"]?.number ?? null;
            const likes = page.properties["Likes"]?.number ?? 0;
            const description = page.properties["Description"]?.rich_text?.map(t => t.plain_text).join('') || "";

            // Gestion de l'image locale ou téléchargement
            let image = "";
            const idMatch = urlSource.match(/\/models\/(\d+)/);
            const makerId = idMatch ? idMatch[1] : null;

            const storeDir = path.join(__dirname, 'photo', 'store');
            if (fs.existsSync(storeDir) && makerId) {
                const files = fs.readdirSync(storeDir);
                const found = files.find(f => f.includes(makerId));
                if (found) {
                    image = `photo/store/${found}`;
                }
            }

            if (!image) {
                image = await downloadNotionImage(page, "image", "store", id, titre, "store")
                     || await downloadNotionImage(page, "Image", "store", id, titre, "store")
                     || "";
            }

            if (image.includes('photo/')) {
                image = image.substring(image.indexOf('photo/'));
            }

            // Correspondance avec le catalogue scrapé pour enrichir (poids exact, médias pour le carrousel, etc.)
            const matchedScraped = localScrapedList.find(s => 
                (makerId && s.id && s.id.toString() === makerId.toString()) ||
                (s.id && s.id.toString() === id.toString()) ||
                (s.titre && titre && s.titre.toLowerCase().trim() === titre.toLowerCase().trim()) ||
                (s.title && titre && s.title.toLowerCase().trim() === titre.toLowerCase().trim())
            );

            const weight = page.properties["Poids"]?.number 
                        || page.properties["Weight"]?.number 
                        || matchedScraped?.weight 
                        || matchedScraped?.poids 
                        || 50;

            const printTimeMinutes = matchedScraped?.printTimeMinutes || 60;
            const profileTitle = matchedScraped?.profileTitle || "Standard";
            const media = (matchedScraped?.media && matchedScraped.media.length > 0)
                ? matchedScraped.media
                : (image ? [{ type: 'image', url: image }] : []);

            featuredPrints.push({
                id: makerId || id,
                notionId: id,
                titre,
                title: titre,
                auteur,
                author: auteur,
                lienAuteur,
                authorUrl: lienAuteur,
                urlSource,
                url: urlSource,
                licence,
                license: licence,
                prix,
                price: prix,
                likes,
                weight,
                poids: weight,
                printTimeMinutes,
                profileTitle,
                description,
                image,
                localImage: image,
                media
            });
            successCount++;
            console.log(`\x1b[32m✅ [Impressions 3D] "${titre}" par ${auteur} (${weight}g, ${media.length} médias) ajouté.\x1b[0m`);
        }
    }

    // Repli de secours si aucun modèle n'a pu être récupéré de Notion
    if (featuredPrints.length === 0 && localScrapedList.length > 0) {
        console.log(`\x1b[33mℹ️ Repli de sécurité : ${localScrapedList.length} impressions vedettes restaurées depuis store_prints.json local.\x1b[0m`);
        return { featuredPrints: localScrapedList, total: localScrapedList.length, successCount: localScrapedList.length, ignoredCount: 0 };
    }

    return { featuredPrints, total: featuredPrints.length, successCount, ignoredCount };
}

// --- GÉNÉRATION DU HTML STATIQUE ---
function generateStaticHtml(servicesData, isEn, basePath) {
    let clientProjectsHtml = '';
    if (!servicesData.clientProjects || servicesData.clientProjects.length === 0) {
        clientProjectsHtml = `
            <div class="empty-notice">
                <i class="fa-solid fa-folder-open" style="font-size: 2.5rem; color: var(--provence-violet); margin-bottom: 15px; display: block; opacity: 0.7;"></i>
                <h4 style="font-family: var(--police-titre); font-size: 1.2rem; color: var(--couleur-texte); margin-bottom: 8px;">
                    ${isEn ? 'No client projects published yet' : 'Aucun projet client publié pour le moment'}
                </h4>
                <p style="color: var(--couleur-texte-secondaire); font-size: 0.95rem; max-width: 500px; margin: 0 auto;">
                    ${isEn ? 'Projects marked as public in Notion will automatically appear here upon next build.' : 'Les projets cochés comme publics dans Notion apparaîtront automatiquement ici au prochain build.'}
                </p>
            </div>`;
    } else {
        clientProjectsHtml = servicesData.clientProjects.map(p => {
            const titre = p.titre;
            const description = p.description || "";
            
            let imgHtml = '';
            if (p.image) {
                let imgPath = p.image;
                if (imgPath.startsWith("../../")) imgPath = imgPath.substring(6);
                else if (imgPath.startsWith("../")) imgPath = imgPath.substring(3);
                const fullImg = basePath + imgPath;
                imgHtml = `<img src="${fullImg}" alt="${titre}" loading="lazy">`;
            } else {
                imgHtml = `<div class="card-image-placeholder"><i class="fa-solid fa-cube"></i></div>`;
            }

            const rawService = p.service || "Impression 3D";
            const serviceSlug = slugify(rawService);

            const tags = (p.etiquettes && Array.isArray(p.etiquettes) && p.etiquettes.length > 0)
                ? p.etiquettes
                : [rawService];

            const allTagsSlugs = tags.map(t => slugify(t)).join(' ');

            const badgesHtml = tags.map(tag => 
                `<div class="date-badge" style="background: var(--provence-violet); color: white;">${tag}</div>`
            ).join('');

            return `
                <div class="card-podcast reveal-on-scroll is-visible" data-service="${serviceSlug}" data-tags="${allTagsSlugs}" style="display:flex;">
                    <div class="card-image-wrapper">
                        ${imgHtml}
                        <div class="badges-container">${badgesHtml}</div>
                    </div>
                    <div class="client-project-body">
                        <h3 style="font-family: var(--police-titre); font-size: 1.4rem; color: var(--couleur-texte);">${titre}</h3>
                        ${description ? `<p class="client-project-desc">${description}</p>` : ''}
                        <div class="client-project-meta">
                            <span><i class="fa-solid fa-layer-group" style="color: var(--provence-violet); margin-right: 6px;"></i>${rawService}</span>
                            ${p.date ? `<span><i class="fa-regular fa-calendar" style="margin-right: 6px;"></i>${p.date}</span>` : ''}
                        </div>
                    </div>
                </div>`;
        }).join('\n');
    }

    let filamentsHtml = '';
    if (!servicesData.filaments || servicesData.filaments.length === 0) {
        filamentsHtml = `
            <div class="empty-notice">
                <i class="fa-solid fa-cubes-stacked" style="font-size: 2.5rem; color: var(--provence-violet); margin-bottom: 15px; display: block; opacity: 0.7;"></i>
                <h4 style="font-family: var(--police-titre); font-size: 1.2rem; color: var(--couleur-texte); margin-bottom: 8px;">
                    ${isEn ? 'No filaments currently in catalog' : 'Aucun filament dans le catalogue pour le moment'}
                </h4>
                <p style="color: var(--couleur-texte-secondaire); font-size: 0.95rem; max-width: 500px; margin: 0 auto;">
                    ${isEn ? 'Filaments marked as public in Notion will automatically appear here upon next build.' : 'Les filaments cochés comme publics dans Notion apparaîtront automatiquement ici au prochain build.'}
                </p>
            </div>`;
    } else {
        filamentsHtml = servicesData.filaments.map(f => {
            let stockClass = "stock-instock";
            let stockText = isEn ? "In Stock" : "En stock";
            let stockIcon = '<i class="fa-solid fa-circle-check"></i>';
            
            const rawStock = (f.stock || "").toLowerCase();
            if (rawStock.includes("commen") || rawStock.includes("comman") || rawStock.includes("order")) {
                stockClass = "stock-onorder";
                stockText = isEn ? "On Order" : "Sur commande";
                stockIcon = '<i class="fa-solid fa-clock"></i>';
            } else if (rawStock.includes("absent") || rawStock.includes("rupture") || rawStock.includes("out")) {
                stockClass = "stock-out";
                stockText = isEn ? "Absent" : "Absent";
                stockIcon = '<i class="fa-solid fa-circle-xmark"></i>';
            }

            const mat = f.materiau || "PLA";
            const matSlug = slugify(mat);
            const hex = f.codeHex || "#7C3AED";

            return `
                <div class="card-filament reveal-on-scroll is-visible" data-material="${matSlug}">
                    <div>
                        <div class="filament-header">
                            <span class="filament-material-badge">${mat}</span>
                            <span class="filament-stock-badge ${stockClass}">${stockIcon} ${stockText}</span>
                        </div>
                        <h3 class="filament-title">${f.nom}</h3>
                        <div class="filament-color-row">
                            <span class="color-dot" style="background-color: ${hex};"></span>
                            <span class="color-name">${f.couleur || 'Standard'}</span>
                            <span class="color-hex">${hex}</span>
                        </div>
                    </div>
                    <div>
                        <div class="filament-specs">
                            ${f.marque ? `<span><strong>${isEn ? 'Brand' : 'Marque'} :</strong> ${f.marque}</span>` : '<span></span>'}
                            ${f.prix ? `<span><strong>${isEn ? 'Price' : 'Prix'} :</strong> ${f.prix} €</span>` : ''}
                        </div>
                    </div>
                </div>`;
        }).join('\n');
    }

    let featuredPrintsHtml = '';
    if (!servicesData.featuredPrints || servicesData.featuredPrints.length === 0) {
        featuredPrintsHtml = `
            <div class="empty-notice">
                <i class="fa-solid fa-cube" style="font-size: 2.5rem; color: var(--provence-violet); margin-bottom: 15px; display: block; opacity: 0.7;"></i>
                <h4 style="font-family: var(--police-titre); font-size: 1.2rem; color: var(--couleur-texte); margin-bottom: 8px;">
                    ${isEn ? 'No featured 3D models available yet' : 'Aucune impression 3D en vedette pour le moment'}
                </h4>
                <p style="color: var(--couleur-texte-secondaire); font-size: 0.95rem; max-width: 500px; margin: 0 auto;">
                    ${isEn ? 'Models validated in Notion or scraped from MakerWorld will appear here automatically.' : 'Les modèles validés dans Notion ou scrapés depuis MakerWorld apparaîtront automatiquement ici au prochain build.'}
                </p>
            </div>`;
    } else {
        featuredPrintsHtml = servicesData.featuredPrints.map(m => {
            const titre = m.titre || m.title || "Modèle 3D";
            const auteur = m.auteur || m.author || "Créateur";
            const lienAuteur = m.lienAuteur || m.authorUrl || "#";
            const urlSource = m.urlSource || m.url || "#";
            const licence = m.licence || m.license || "CC BY";
            const prix = m.prix ?? m.price ?? null;
            const likes = m.likes ?? 0;
            const rawDesc = isEn
                ? (m.descriptionEn || `3D model under commercial license by ${auteur}.`)
                : (m.description || `Modèle 3D sous licence commerciale par ${auteur}.`);
            // Nettoyage des balises HTML et débris MakerWorld
            let cleanDesc = rawDesc
                .replace(/<boostme>[\s\S]*?<\/boostme>/gi, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/&nbsp;/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            if (!cleanDesc) {
                cleanDesc = isEn ? `3D model under commercial license by ${auteur}.` : `Modèle 3D sous licence commerciale par ${auteur}.`;
            }
            const desc = cleanDesc.length > 130 ? cleanDesc.substring(0, 127) + '...' : cleanDesc;
            
            let imgHtml = '';
            let rawImg = m.image || m.localImage || m.imageUrl || '';
            if (rawImg) {
                if (rawImg.startsWith('../../../')) rawImg = rawImg.substring(9);
                else if (rawImg.startsWith('../../')) rawImg = rawImg.substring(6);
                else if (rawImg.startsWith('../')) rawImg = rawImg.substring(3);
                
                const fullImg = rawImg.startsWith('http') ? rawImg : (basePath + rawImg);
                imgHtml = `<img src="${fullImg}" alt="${titre}" loading="lazy">`;
            } else {
                imgHtml = `<div class="card-image-placeholder"><i class="fa-solid fa-cube"></i></div>`;
            }

            const priceBadge = prix ? `<div class="date-badge" style="background: #10B981; color: white; font-weight: 700;">${prix} €</div>` : '';
            const likesBadge = likes > 0 ? `<div class="date-badge" style="background: rgba(0,0,0,0.65); color: #F59E0B; backdrop-filter: blur(4px);"><i class="fa-solid fa-heart" style="margin-right: 4px;"></i>${likes}</div>` : '';
            const weight = m.weight || m.poids || 50;
            const weightBadge = `<div class="date-badge" style="background: rgba(124, 58, 237, 0.85); color: white;"><i class="fa-solid fa-weight-hanging" style="margin-right: 4px;"></i>${weight}g</div>`;

            return `
                <div class="card-podcast card-pod-item reveal-on-scroll is-visible" data-model-id="${m.id}" style="display:flex; flex-direction:column; justify-content:space-between; cursor: pointer;">
                    <div>
                        <div class="card-image-wrapper">
                            ${imgHtml}
                        </div>
                        <div class="client-project-body" style="padding: 20px 20px 10px 20px;">
                            <h3 style="font-family: var(--police-titre); font-size: 1.25rem; color: var(--couleur-texte); margin-bottom: 8px; line-height: 1.3;">${titre}</h3>
                            <p class="client-project-desc" style="font-size: 0.92rem; color: var(--couleur-texte-secondaire); margin-bottom: 12px; line-height: 1.4;">${desc}</p>
                        </div>
                    </div>
                    <div>
                        <div style="padding: 0 20px 14px 20px;">
                            <button type="button" class="btn-brutal btn-open-pod-modal" data-model-id="${m.id}">
                                <i class="fa-solid fa-cart-shopping" style="margin-right: 8px;"></i>${isEn ? 'Order' : 'Commander'}
                            </button>
                        </div>
                        <div class="client-project-meta" style="padding: 12px 20px 18px 20px; border-top: 1px solid rgba(124, 58, 237, 0.08); display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem;">
                            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 60%;"><i class="fa-solid fa-user-pen" style="color: var(--provence-violet); margin-right: 6px;"></i><strong>${isEn ? 'By' : 'Par'} :</strong> <a href="${lienAuteur}" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: underline;" onclick="event.stopPropagation();">${auteur}</a></span>
                            <span><a href="${urlSource}" target="_blank" rel="noopener noreferrer" style="color: var(--provence-violet); font-weight: 600; display: inline-flex; align-items: center; gap: 4px;" onclick="event.stopPropagation();"><i class="fa-solid fa-arrow-up-right-from-square"></i> MakerWorld</a></span>
                        </div>
                    </div>
                </div>`;
        }).join('\n');
    }

    return { clientProjectsHtml, filamentsHtml, featuredPrintsHtml };
}

function injectServicesHtml(servicesData) {
    const servicesFrPath = path.join(__dirname, 'pages', 'services.html');
    const servicesEnPath = path.join(__dirname, 'en', 'pages', 'services.html');

    if (fs.existsSync(servicesFrPath)) {
        let frHtml = fs.readFileSync(servicesFrPath, 'utf8');
        const frParts = generateStaticHtml(servicesData, false, '../');
        frHtml = frHtml.replace(/<!-- CLIENT_PROJECTS_START -->[\s\S]*?<!-- CLIENT_PROJECTS_END -->/, `<!-- CLIENT_PROJECTS_START -->\n${frParts.clientProjectsHtml}\n                <!-- CLIENT_PROJECTS_END -->`);
        frHtml = frHtml.replace(/<!-- FILAMENTS_START -->[\s\S]*?<!-- FILAMENTS_END -->/, `<!-- FILAMENTS_START -->\n${frParts.filamentsHtml}\n                <!-- FILAMENTS_END -->`);
        frHtml = frHtml.replace(/<!-- FEATURED_PRINTS_START -->[\s\S]*?<!-- FEATURED_PRINTS_END -->/, `<!-- FEATURED_PRINTS_START -->\n${frParts.featuredPrintsHtml}\n                <!-- FEATURED_PRINTS_END -->`);
        fs.writeFileSync(servicesFrPath, frHtml, 'utf8');
        console.log(`\x1b[32m✔ Injection statique réussie dans pages/services.html (FR)\x1b[0m`);
    }

    if (fs.existsSync(servicesEnPath)) {
        let enHtml = fs.readFileSync(servicesEnPath, 'utf8');
        const enParts = generateStaticHtml(servicesData, true, '../../');
        enHtml = enHtml.replace(/<!-- CLIENT_PROJECTS_START -->[\s\S]*?<!-- CLIENT_PROJECTS_END -->/, `<!-- CLIENT_PROJECTS_START -->\n${enParts.clientProjectsHtml}\n                <!-- CLIENT_PROJECTS_END -->`);
        enHtml = enHtml.replace(/<!-- FILAMENTS_START -->[\s\S]*?<!-- FILAMENTS_END -->/, `<!-- FILAMENTS_START -->\n${enParts.filamentsHtml}\n                <!-- FILAMENTS_END -->`);
        enHtml = enHtml.replace(/<!-- FEATURED_PRINTS_START -->[\s\S]*?<!-- FEATURED_PRINTS_END -->/, `<!-- FEATURED_PRINTS_START -->\n${enParts.featuredPrintsHtml}\n                <!-- FEATURED_PRINTS_END -->`);
        fs.writeFileSync(servicesEnPath, enHtml, 'utf8');
        console.log(`\x1b[32m✔ Injection statique réussie dans en/pages/services.html (EN)\x1b[0m`);
    }
}

// --- FONCTION PRINCIPALE ---
async function fetchNotionData() {
    console.log(`\n\x1b[35m=== 🚀 DÉMARRAGE DU BUILD OBJEX3D ===\x1b[0m`);
    const startTime = Date.now();
    
    let totalProcessed = 0;
    let globalSuccessCount = 0;
    let globalErrorCount = 0;
    let globalIgnoredCount = 0;

    const hasApiKey = Boolean(apiKey && apiKey.trim().length > 10);
    if (!hasApiKey) {
        console.error(`\x1b[31m❌ NOTION_API_KEY non configurée dans .env\x1b[0m`);
        process.exit(1);
    }

    let servicesData = { clientProjects: [], filaments: [], featuredPrints: [] };
    let proDbProcessed = false;
    let filamentDbProcessed = false;
    let featuredPrintsDbProcessed = false;

    // Garantir que tous les dossiers nécessaires existent (requis sur Render et sur les clones Git neufs)
    const requiredDirs = [
        path.join(__dirname, 'pages', 'services'),
        path.join(__dirname, 'pages', 'personnel', 'projets'),
        path.join(__dirname, 'pages', 'educatif', 'portfolios'),
        path.join(__dirname, 'photo', 'store'),
        path.join(__dirname, 'photo', 'filaments'),
        path.join(__dirname, 'photo', 'projets'),
        path.join(__dirname, 'photo', 'projets_clients'),
        path.join(__dirname, 'photo', 'portfolios')
    ];
    for (const d of requiredDirs) {
        if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    }

    // 0. EXÉCUTION DU SCRAPER MAKERWORLD (Opt-in via --scrape pour éviter de ralentir ou bloquer Render)
    const shouldScrape = process.argv.includes('--scrape') || process.env.AUTO_SCRAPE === 'true';
    if (shouldScrape) {
        try {
            console.log(`\n\x1b[36m🤖 Lancement du scraper MakerWorld (Puppeteer)...\x1b[0m`);
            const { scrapeMakerWorld } = require('./scrape-models');
            await scrapeMakerWorld();
        } catch (scrapeErr) {
            console.warn(`\x1b[33m⚠️ Attention : Le scraper MakerWorld a rencontré une erreur (${scrapeErr.message}). Le build continue avec les données existantes.\x1b[0m`);
        }
    } else {
        console.log(`\n\x1b[33m⚡ Scraping MakerWorld ignoré (mode build sécurisé/Render par défaut. Utilisez --scrape pour forcer).\x1b[0m`);
    }

    // 1. DÉCOUVERTE ET TRAITEMENT VIA LA PAGE PARENTE NOTION
    if (parentPageId) {
        try {
            console.log(`\x1b[36mConnexion à la page parente Notion (${parentPageId})...\x1b[0m`);
            const response = await notion.blocks.children.list({ block_id: parentPageId });
            const databases = response.results.filter(b => b.type === 'child_database');
            console.log(`\x1b[32m✔ ${databases.length} bases enfants détectées sur la page parente.\x1b[0m`);

            for (const dbBlock of databases) {
                const titleLower = (dbBlock.child_database.title || "").toLowerCase().trim();
                
                try {
                    // Routage selon le titre
                    if (titleLower === 'pro' || (titleLower.includes('pro') && !titleLower.includes('projet'))) {
                        // Base Projets Clients ("Pro")
                        const resProj = await processClientProjects(dbBlock.id);
                        servicesData.clientProjects = resProj.clientProjects;
                        totalProcessed += resProj.total;
                        globalSuccessCount += resProj.successCount;
                        globalIgnoredCount += resProj.ignoredCount;
                        proDbProcessed = true;
                    } else if (titleLower.includes('filament')) {
                        // Base Filaments ("filament")
                        const resFil = await processFilaments(dbBlock.id);
                        servicesData.filaments = resFil.filaments;
                        totalProcessed += resFil.total;
                        globalSuccessCount += resFil.successCount;
                        globalIgnoredCount += resFil.ignoredCount;
                        filamentDbProcessed = true;
                    } else if (titleLower.includes('impress') || titleLower.includes('maker') || titleLower.includes('vedette') || titleLower.includes('store') || titleLower.includes('print')) {
                        // Base Impressions 3D ("Impressions 3D")
                        const resPrints = await processFeaturedPrints(dbBlock.id);
                        servicesData.featuredPrints = resPrints.featuredPrints;
                        totalProcessed += resPrints.total;
                        globalSuccessCount += resPrints.successCount;
                        globalIgnoredCount += resPrints.ignoredCount;
                        featuredPrintsDbProcessed = true;
                    } else if (titleLower.includes('commande') || titleLower.includes('order')) {
                        // Base privée de suivi des commandes clients : ne pas traiter comme contenu de portfolio
                        console.log(`\x1b[33m⏩ Base "${dbBlock.child_database.title}" ignorée (gestion interne des commandes).\x1b[0m`);
                        continue;
                    } else {
                        // Bases Portfolio ("portfolios", "Projet")
                        const stats = await processDatabase(dbBlock);
                        totalProcessed += stats.total;
                        globalSuccessCount += stats.successCount;
                        globalErrorCount += stats.errorCount;
                        globalIgnoredCount += stats.ignoredCount;
                    }
                } catch (dbErr) {
                    console.error(`\x1b[31m❌ Erreur lors du traitement de la base "${dbBlock.child_database?.title || dbBlock.id}" : ${dbErr.message}\x1b[0m`);
                }
            }
        } catch (err) {
            console.error(`\x1b[31m❌ Erreur lors de l'accès à la page parente Notion : ${err.message}\x1b[0m`);
        }
    }

    // 2. VÉRIFICATION DES IDENTIFIANTS DIRECTS SI NON TRAITÉS VIA LA PAGE PARENTE
    const directProDbId = process.env.NOTION_PRO_DB_ID || process.env.NOTION_CLIENT_PROJECTS_DB_ID;
    if (!proDbProcessed && directProDbId) {
        try {
            const resProj = await processClientProjects(directProDbId);
            servicesData.clientProjects = resProj.clientProjects;
            totalProcessed += resProj.total;
            globalSuccessCount += resProj.successCount;
            globalIgnoredCount += resProj.ignoredCount;
            proDbProcessed = true;
        } catch (err) {
            console.error(`\x1b[31m❌ Erreur base Pro directe : ${err.message}\x1b[0m`);
        }
    }

    const directFilamentDbId = process.env.NOTION_FILAMENT_DB_ID || process.env.NOTION_FILAMENTS_DB_ID;
    if (!filamentDbProcessed && directFilamentDbId) {
        try {
            const resFil = await processFilaments(directFilamentDbId);
            servicesData.filaments = resFil.filaments;
            totalProcessed += resFil.total;
            globalSuccessCount += resFil.successCount;
            globalIgnoredCount += resFil.ignoredCount;
            filamentDbProcessed = true;
        } catch (err) {
            console.error(`\x1b[31m❌ Erreur base Filament directe : ${err.message}\x1b[0m`);
        }
    }

    const directPrintsDbId = process.env.NOTION_PRINTS_DB_ID;
    if (!featuredPrintsDbProcessed && directPrintsDbId) {
        try {
            const resPrints = await processFeaturedPrints(directPrintsDbId);
            servicesData.featuredPrints = resPrints.featuredPrints;
            totalProcessed += resPrints.total;
            globalSuccessCount += resPrints.successCount;
            globalIgnoredCount += resPrints.ignoredCount;
            featuredPrintsDbProcessed = true;
        } catch (err) {
            console.error(`\x1b[31m❌ Erreur base Impressions 3D directe : ${err.message}\x1b[0m`);
        }
    }

    // Sauvegarde des fichiers JSON dans pages/services/
    const servicesDir = path.join(__dirname, 'pages', 'services');
    if (!fs.existsSync(servicesDir)) fs.mkdirSync(servicesDir, { recursive: true });

    // Repli de sécurité : si l'une des listes est vide ou absente (ex: erreur Notion ou rate limit),
    // on restaure les données existantes pour ne jamais écraser la production avec des listes vides.
    const fallbackConfigs = [
        { key: 'clientProjects', file: 'projets_clients.json', name: 'Projets Clients' },
        { key: 'filaments', file: 'filaments.json', name: 'Filaments' },
        { key: 'featuredPrints', file: 'store_prints.json', name: 'Impressions Vedettes' }
    ];

    for (const conf of fallbackConfigs) {
        if (!servicesData[conf.key] || servicesData[conf.key].length === 0) {
            const filePath = path.join(servicesDir, conf.file);
            if (fs.existsSync(filePath)) {
                try {
                    const localData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    if (Array.isArray(localData) && localData.length > 0) {
                        servicesData[conf.key] = localData;
                        console.log(`\x1b[33m🛡️ Protection active : ${conf.name} restaurés depuis ${conf.file} (${localData.length} éléments préservés).\x1b[0m`);
                    }
                } catch (e) {
                    console.error(`Erreur lecture cache local ${conf.file}:`, e.message);
                }
            }
        }
    }

    fs.writeFileSync(path.join(servicesDir, 'projets_clients.json'), JSON.stringify(servicesData.clientProjects, null, 2));
    fs.writeFileSync(path.join(servicesDir, 'filaments.json'), JSON.stringify(servicesData.filaments, null, 2));
    fs.writeFileSync(path.join(servicesDir, 'store_prints.json'), JSON.stringify(servicesData.featuredPrints, null, 2));
    fs.writeFileSync(path.join(servicesDir, 'donnees_services.json'), JSON.stringify(servicesData, null, 2));
    console.log(`\x1b[32m✔ Données JSON réelles enregistrées dans pages/services/ (${servicesData.clientProjects.length} projets, ${servicesData.filaments.length} filaments, ${servicesData.featuredPrints.length} impressions vedettes).\x1b[0m`);

    // 3. INJECTION STATIQUE DANS LES PAGES SERVICES
    injectServicesHtml(servicesData);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`\n\x1b[35m=========================================\x1b[0m`);
    console.log(`\x1b[32m🎉 Build terminé avec succès en ${duration} secondes !\x1b[0m`);
    console.log(`\x1b[36m📊 RÉSUMÉ DU BUILD OBJEX3D :\x1b[0m`);
    console.log(`   - Projets Clients Notion : \x1b[32m${servicesData.clientProjects.length}\x1b[0m publics`);
    console.log(`   - Filaments en catalogue : \x1b[32m${servicesData.filaments.length}\x1b[0m publics`);
    console.log(`   - Impressions 3D vedettes: \x1b[32m${servicesData.featuredPrints.length}\x1b[0m publics`);
    console.log(`   - Pages Notion scannées  : ${totalProcessed}`);
    console.log(`   - ✔ Succès               : \x1b[32m${globalSuccessCount}\x1b[0m`);
    console.log(`   - ⚠ Non publics          : \x1b[33m${globalIgnoredCount}\x1b[0m`);
    console.log(`\x1b[35m=========================================\x1b[0m\n`);

    process.exit(0);
}

fetchNotionData();


