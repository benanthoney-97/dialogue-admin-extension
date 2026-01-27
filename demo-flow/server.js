import express from 'express';
import fetch from 'node-fetch';
import demoConfigs from './demo-configs.js';

const app = express();
const PORT = 3000;
const DEFAULT_DEMO = 'default';

const resolveDemoContext = (req) => {
    const queryKey = req.query?.demo;
    if (queryKey) {
        const config = demoConfigs[queryKey];
        if (config) {
            return { key: queryKey, config };
        }
    }
    return { key: DEFAULT_DEMO, config: demoConfigs[DEFAULT_DEMO] };
};
// --- MIDDLEWARE ---
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-CSRF-Token");
    res.header("Access-Control-Allow-Credentials", "true");
    if (req.method === 'OPTIONS') return res.status(200).end();
    next();
});
app.use(express.json());

// 1. MAIN MIRROR ROUTE
app.get('/', async (req, res) => {
    try {
        const { key: demoKey, config } = resolveDemoContext(req);
        const TARGET_URL = config.targetUrl;
        const TARGET_ORIGIN = config.targetOrigin;
        const MATCHES = config.matches;
        console.log(`Fetching mirror for: ${TARGET_URL} (demo=${demoKey})`);

        const response = await fetch(TARGET_URL, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        let html = await response.text();
        html = html.replace(new RegExp(TARGET_ORIGIN, 'g'), '');

        // 2. THE SUPER-INTERCEPTOR & DARK MODE ENFORCER
        const brainSurgery = `
            <script>
                // A. HAZMAT (FORCE DARK MODE)
                try {
                    console.log("🌑 Forcing Dark Mode...");
                    const keys = ['theme', 'appearance', 'docusaurus-theme', 'color-mode'];
                    keys.forEach(k => {
                        localStorage.setItem(k, 'light');
                    });
                    document.documentElement.setAttribute('data-theme', 'light');
                    document.documentElement.classList.add('light');
                    document.documentElement.classList.remove('black');
                    if(document.body) {
                        document.body.classList.add('black');
                        document.body.classList.remove('light');
                    } else {
                        document.addEventListener('DOMContentLoaded', () => {
                            document.body.classList.add('dark');
                            document.body.classList.remove('light');
                        });
                    }
                } catch(e) {}

// B. SUPER INTERCEPTOR
const originalFetch = window.fetch;
window.fetch = async function(input, init) {
    let url = input;
    
    // 1. Handle String Inputs
    if (typeof input === 'string') {
        // DYNAMIC FIX: Replace the domain, keep the path
        // This turns "https://seedlegals.../analysis" into "/~/changes/24/retrieve-match-analysis"
        if (input.includes('seedlegals.dialogue-ai.co')) {
            url = input.replace('https://seedlegals.dialogue-ai.co/', '');
        }
    }
    
    // 2. Handle Request Objects
    if (typeof input === 'object' && input instanceof Request) {
        if (input.url.includes('seedlegals.dialogue-ai.co')) {
            const newUrl = input.url.replace('https://seedlegals.dialogue-ai.co/', '');
            url = new Request(newUrl, {
                method: input.method,
                headers: input.headers,
                body: input.body,
                mode: 'cors',
                credentials: input.credentials
            });
        }
    }
    return originalFetch(url, init);
};
            </script>
        `;

// 3. THE PLAYER INJECTION (With Invisible Resize & Footer)
        const playerInjection = `
            <style>
                @keyframes shimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }
                .dialogue-highlight { 
                    background: linear-gradient(110deg, #000000 45%, #a8cbea 50%, #000000 55%);
                    background-size: 250% 100%; background-position: 100% 0;
                    -webkit-background-clip: text; background-clip: text;
                    -webkit-text-fill-color: transparent;
                    color: transparent;
                    font-weight: 600; cursor: pointer; display: inline; text-decoration: none;
                    animation: shimmer 8s infinite linear;
                }
                .no-shimmer { -webkit-text-fill-color: initial !important; text-fill-color: initial !important; background: none !important; }

                #dialogue-nano-player {
                    position: absolute; width: 320px; background: white;
                    border-radius: 12px;
                    box-shadow: 0 10px 40px -10px rgba(0,0,0,0.3);
                    overflow: hidden; display: flex; flex-direction: column; z-index: 2147483647;
                    opacity: 0; pointer-events: none; transition: opacity 0.2s; transform: translateY(10px);
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                }
                #dialogue-nano-player.visible { opacity: 1; pointer-events: auto; transform: translateY(0); }
                
                .d-media-container { width: 100%; height: 180px; background: #000; position: relative; }
                
                /* THE FOOTER */
                .d-meta {
                    height: 40px; 
                    background: #fff;
                    display: flex; 
                    align-items: center; 
                    padding: 0 16px;
                    border-top: 1px solid #f0f0f0;
                    position: relative; /* Context for resize handle */
                }
                .short-format .d-meta {
                    display: none;
                }
                .d-meta-text {
                    font-size: 13px; font-weight: 600; color: #111; letter-spacing: -0.01em;
                }

                /* RESIZE HANDLE (Invisible but Functional) */
                .resize-handle {
                    position: absolute; 
                    width: 20px; 
                    height: 20px; 
                    right: 0; 
                    bottom: 0;
                    cursor: se-resize; /* Cursor changes so user knows it's resizable */
                    z-index: 30;
                }
                
                /* IMAGE BTN STYLES */
                .dialogue-image-btn {
                   transition: transform 0.2s ease;
                }
                .dialogue-image-wrapper:hover .dialogue-image-btn {
                    transform: scale(1.1);
                }
            </style>

            <div id="dialogue-nano-player">
                <div class="d-media-container" id="d-container">
                </div>
                <div class="d-meta">
                    <span class="d-meta-text">Related Video</span>
                    <div class="resize-handle" id="dialogue-resize-handle"></div>
                </div>
            </div>

            <script>
                console.log("🚀 MIRROR ENGINE: Resize + Footer (No Icon)");
                const MATCHES = ${JSON.stringify(MATCHES)};
                
                const player = document.getElementById('dialogue-nano-player');
                const container = document.getElementById('d-container');
                const resizeHandle = document.getElementById('dialogue-resize-handle');
                const mediaContainer = document.getElementById('d-container');
                const wrapEmojis = (text) => text.replace(/([\\u2700-\\u27BF]|[\\uE000-\\uF8FF])/g, '<span class="no-shimmer">$&</span>');

                // --- RESIZING LOGIC ---
                const MIN_WIDTH = 260;
                const FOOTER_HEIGHT = 40;

                const formatSettings = {
                    standard: { width: 480, ratio: 16 / 9 },
                    short: { width: 390, ratio: 9 / 16 }
                };
                let currentFormat = 'standard';
                let currentAspectRatio = formatSettings.standard.ratio;

                const updatePlayerSize = (width, ratio = currentAspectRatio) => {
                    const clampedWidth = Math.max(MIN_WIDTH, width);
                    const videoHeight = clampedWidth / ratio;
                    const isShort = ratio === formatSettings.short.ratio;
                    const footerHeight = isShort ? 0 : FOOTER_HEIGHT;

                    player.style.width = clampedWidth + 'px';
                    player.style.height = videoHeight + footerHeight + 'px';
                    mediaContainer.style.height = videoHeight + 'px';
                    currentAspectRatio = ratio;
                    currentFormat = isShort ? 'short' : 'standard';
                    player.classList.toggle('short-format', isShort);
                };

                const positionPlayerNearRect = (rect) => {
                    const offsetY = 12;
                    const playerWidth = player.offsetWidth;
                    const rectLeft = window.scrollX + rect.left;
                    const maxLeft = Math.max(12, window.innerWidth - playerWidth - 12);
                    const constrainedLeft = Math.min(Math.max(rectLeft, 12), maxLeft);
                    player.style.left = constrainedLeft + 'px';
                    player.style.top = (window.scrollY + rect.bottom + offsetY) + 'px';
                };

                // Initialize size
                updatePlayerSize(formatSettings.standard.width, formatSettings.standard.ratio);

                let isResizing = false;
                let resizeStartX = 0;
                let startWidth = 320;
                let suppressHide = false;

                const startResize = (event) => {
                    event.preventDefault(); event.stopPropagation();
                    isResizing = true;
                    resizeStartX = event.clientX;
                    startWidth = player.offsetWidth;
                    document.documentElement.style.cursor = 'se-resize';
                    document.body.style.userSelect = 'none'; // Prevent text selection
                    suppressHide = true;
                };

                const handleResize = (event) => {
                    if (!isResizing) return;
                    const deltaX = event.clientX - resizeStartX;
                    updatePlayerSize(startWidth + deltaX);
                };

                const stopResize = () => {
                    if (!isResizing) return;
                    isResizing = false;
                    document.documentElement.style.cursor = '';
                    document.body.style.userSelect = '';
                    setTimeout(() => { suppressHide = false; }, 50);
                };

                resizeHandle.addEventListener('pointerdown', startResize);
                document.addEventListener('pointermove', handleResize);
                document.addEventListener('pointerup', stopResize);


                // --- PLAYER LOGIC ---
                window.hidePlayer = () => {
                    player.classList.remove('visible');
                    setTimeout(() => { 
                         const iframe = container.querySelector('iframe');
                         if(iframe) iframe.remove();
                    }, 300);
                };

                window.playVideo = (id, start) => {
                    container.innerHTML = '<iframe width="100%" height="100%" src="https://www.youtube.com/embed/' + id + '?start=' + start + '&autoplay=1" frameborder="0" allow="autoplay; fullscreen"></iframe>';
                    player.classList.add('visible');
                };

                window.addEventListener('click', (event) => {
                    if (isResizing || suppressHide) return;
                    if (player.contains(event.target) || event.target.closest('.dialogue-highlight') || event.target.closest('.dialogue-image-wrapper') || resizeHandle?.contains(event.target)) {
                        return;
                    }
                    hidePlayer();
                });

                let attempts = 0;
                const checkInterval = setInterval(() => {
                    attempts++;
                    
                    const normalizeRangeForPhrase = (phrase) => {
                        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
                        const nodes = [];
                        let node;
                        let textSoFar = '';

                        while (node = walker.nextNode()) {
                            if (!node.parentNode) continue;
                            if (node.parentNode.closest('#dialogue-nano-player') || node.parentNode.closest('.dialogue-highlight')) {
                                continue;
                            }
                            const content = node.nodeValue || '';
                            nodes.push({ node, start: textSoFar.length, length: content.length });
                            textSoFar += content;
                        }

                        const index = textSoFar.indexOf(phrase);
                        if (index === -1) return null;

                        const end = index + phrase.length;
                        const startNode = nodes.find(n => n.start + n.length > index);
                        const endNode = nodes.find(n => n.start + n.length >= end);
                        if (!startNode || !endNode) return null;

                        const range = document.createRange();
                        range.setStart(startNode.node, index - startNode.start);
                        range.setEnd(endNode.node, end - endNode.start);
                        return range;
                    };

                    MATCHES.forEach(match => {
                        // === TEXT MATCH ===
                        if (!match.type || match.type === 'text') {
                            const highlightId = 'highlight-' + match.videoId + '-' + match.startSeconds;
                            if (document.getElementById(highlightId)) return;
                            const range = normalizeRangeForPhrase(match.phrase);
                            if (!range) return;
                            const span = document.createElement('span');
                            span.className = "dialogue-highlight";
                            span.id = highlightId;
                            span.innerHTML = wrapEmojis(match.phrase);
                            span.dataset.videoFormat = match.style || match['video-format'] || match.videoFormat || 'standard';
                            
                            span.onclick = (e) => {
                                e.preventDefault(); e.stopPropagation();
                                const rect = e.target.getBoundingClientRect();
                                const format = e.currentTarget.dataset.videoFormat || 'standard';
                                const settings = formatSettings[format] || formatSettings.standard;
                                updatePlayerSize(settings.width, settings.ratio);
                                positionPlayerNearRect(rect);
                                window.playVideo(match.videoId, match.startSeconds);
                            };
                            range.deleteContents();
                            range.insertNode(span);
                        }
                        
                        // === IMAGE MATCH ===
                        if (match.type === 'image') {
                            const images = document.querySelectorAll('img');
                            images.forEach(img => {
                                if (img.src.includes(match.identifier) && !img.parentNode.classList.contains('dialogue-image-wrapper')) {
                                    
                                    const wrapper = document.createElement('div');
                                    wrapper.className = 'dialogue-image-wrapper';
                                    wrapper.style.position = 'relative';
                                    wrapper.style.display = 'inline-block';
                                    wrapper.style.cursor = 'pointer';
                                    wrapper.style.lineHeight = '0';
                                    
                                    img.parentNode.insertBefore(wrapper, img);
                                    wrapper.appendChild(img);

                                    // Image Button (White Arrow / Black Circle)
                                    const btn = document.createElement('div');
                                    btn.className = 'dialogue-image-btn';
                                    
                                    btn.innerHTML = \`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="dialogue-icon bi bi-play-fill" viewBox="0 0 16 16"><path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/></svg>\`;

                                    Object.assign(btn.style, {
                                        position: 'absolute',
                                        bottom: '12px', right: '12px',
                                        width: '24px', height: '24px',
                                        color: 'white',
                                        background: 'hsla(0, 0%, 0%, 0.7)',
                                        border: '1px solid rgba(255, 255, 255, 0.2)',
                                        borderRadius: '50%',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                                        zIndex: '10',
                                        pointerEvents: 'none'
                                    });

                                    wrapper.onclick = (e) => {
                                        e.preventDefault(); e.stopPropagation();
                                        const rect = wrapper.getBoundingClientRect();
                                        updatePlayerSize(formatSettings.standard.width, formatSettings.standard.ratio);
                                        positionPlayerNearRect(rect);
                                        window.playVideo(match.videoId, match.startSeconds);
                                    };

                                    wrapper.appendChild(btn);
                                    console.log("✅ Image Match Found:", match.identifier);
                                }
                            });
                        }
                    });

                    if (attempts > 50) clearInterval(checkInterval);
                }, 500);
            </script>
        `;

        html = html.replace('<head>', `<head>${brainSurgery}<base href="${TARGET_URL}">`); 
        html = html.replace('</body>', `${playerInjection}</body>`);

        res.send(html);

    } catch (error) {
        console.error(error);
        res.status(500).send(`Error: ${error.message}`);
    }
});

app.use(async (req, res) => {
    try {
        const { config } = resolveDemoContext(req);
        const assetUrl = new URL(req.url, config.targetOrigin).href;
        if (req.url.includes('hot-update') || req.url.includes('bugsnag')) return res.status(404).end();

        const response = await fetch(assetUrl, {
            method: req.method,
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0 Safari/537.36',
                'Referer': config.targetOrigin,
                'Content-Type': req.get('Content-Type') || 'application/json'
            },
            body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body)
        });

        res.set('Content-Type', response.headers.get('content-type'));
        if (response.body && typeof response.body.pipe === 'function') {
            response.body.pipe(res);
        } else {
            const buffer = await response.buffer();
            res.send(buffer);
        }
    } catch (e) {
        res.status(404).send('Not Found');
    }
});

app.listen(PORT, () => console.log(`🚀 Mirror running at http://localhost:${PORT}`));
