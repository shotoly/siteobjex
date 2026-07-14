require('dotenv').config();
const { Client } = require('@notionhq/client');
const { NotionToMarkdown } = require('notion-to-md');
const { marked } = require('marked');
const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const n2m = new NotionToMarkdown({ notionClient: notion });
const parentPageId = process.env.NOTION_DB_PERSONNEL;

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
        https.get(url, response => {
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

        // Optimisation en largeur: forcer l'orientation Left-to-Right
        decodedCode = decodedCode.replace(/^(flowchart|graph)\s+TD\b/m, '$1 LR');

        const imgUrlRegex = /(https?:\/\/[^\s"'()<>]+)/g;
        const urlMatches = [...decodedCode.matchAll(imgUrlRegex)];
        
        let imgIndex = 0;
        for (const urlMatch of urlMatches) {
            const originalUrl = urlMatch[1];
            if (originalUrl.match(/\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i) || decodedCode.includes(`src="${originalUrl}"`) || decodedCode.includes(`image="${originalUrl}"`)) {
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
    
    const dbResponse = await notion.databases.query({
        database_id: dbBlock.id,
        sorts: [{ property: 'Date', direction: 'descending' }],
    });

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

// --- FONCTION PRINCIPALE ---
async function fetchNotionData() {
    console.log(`\n\x1b[35m=== 🚀 DÉMARRAGE DU BUILD ===\x1b[0m`);
    const startTime = Date.now();
    try {
        console.log(`\x1b[36mConnexion à Notion et récupération des bases de données enfants...\x1b[0m`);
        const response = await notion.blocks.children.list({ block_id: parentPageId });
        const databases = response.results.filter(b => b.type === 'child_database');
        
        if (databases.length === 0) {
            console.log(`\x1b[33mAucune base de données enfant trouvée dans la page parente.\x1b[0m`);
            return;
        }

        let totalProcessed = 0;
        let globalSuccessCount = 0;
        let globalErrorCount = 0;
        let globalIgnoredCount = 0;

        for (const dbBlock of databases) {
            const stats = await processDatabase(dbBlock);
            totalProcessed += stats.total;
            globalSuccessCount += stats.successCount;
            globalErrorCount += stats.errorCount;
            globalIgnoredCount += stats.ignoredCount;
        }
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        
        console.log(`\n\x1b[35m=========================================\x1b[0m`);
        console.log(`\x1b[32m🎉 Build terminé en ${duration} secondes !\x1b[0m`);
        console.log(`\x1b[36m📊 RÉSUMÉ DU BUILD :\x1b[0m`);
        console.log(`   - Pages trouvées : ${totalProcessed}`);
        console.log(`   - ✔ Succès        : \x1b[32m${globalSuccessCount}\x1b[0m`);
        console.log(`   - ⚠ Ignorés       : \x1b[33m${globalIgnoredCount}\x1b[0m`);
        if (globalErrorCount > 0) {
            console.log(`   - ❌ Erreurs       : \x1b[31m${globalErrorCount}\x1b[0m (Ignorées)`);
        } else {
            console.log(`   - ❌ Erreurs       : 0`);
        }
        console.log(`\x1b[35m=========================================\x1b[0m\n`);

        process.exit(0);
    } catch (err) {
        console.error(`\x1b[31m❌ Erreur critique lors du fetch initial :\x1b[0m`, err);
        process.exit(1);
    }
}

fetchNotionData();
