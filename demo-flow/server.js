import express from 'express';
import fetch from 'node-fetch';
import demoConfigs from './demo-configs.js';

const app = express();
const PORT = 3000;
const DEFAULT_DEMO = 'default';
const DEMO_COOKIE_NAME = 'dialogue_demo';

const MY_COOKIE = `ahoy_visitor=f1ed83e8-210e-49b0-8e5d-7987542551c7; cookies_enabled=true; circle_gdpr_cookies_enabled=false; browser_time_zone=Europe/London; locale=en; __stripe_mid=5c1e9816-3040-4998-8f98-eb99e8e723c82ecf2a; _vwo_uuid=D145F5562791B9F5FE76C790D94FAA205; _vis_opt_s=1%7C; _vis_opt_test_cookie=1; hubspotutk=ad40272c30fbd45097126067e178a118; __hssrc=1; cookieyes-consent=consentid:VUp6TkdYaGtMTU1zdnBEY3c4bDVMRmtvRzkzcmxDUHA,consent:no,action:yes,necessary:yes,analytics:no,advertisement:no,other:no; _vwo_ds=3%3Aa_0%2Ct_0%3A0%241766129576%3A13.36012798%3A%3A%3A%3A0%3A1768839089%3A1766311079%3A6; __hstc=15923433.ad40272c30fbd45097126067e178a118.1766129580871.1766311080984.1768839092612.4; anonymous_user_uuid=a0e3eb85-1970-44e8-b2e2-7bf5f10625f8; community_member_visit_id=99853%3A74137865; ahoy_visit=1e759dd3-9ece-4f9d-afcf-0e2727c73e52; remember_user_token=eyJfcmFpbHMiOnsibWVzc2FnZSI6IlcxczFNVFEyTkRNMk0xMHNJaVF5WVNReE1TUXpla04xTGtGRllsVXdaRTVrZVRKb1FrUk1Ta1YxSWl3aU1UYzJPVEF5TXpFMk1TNHhNRFEzTmpVeUlsMD0iLCJleHAiOiIyMDI3LTAxLTIxVDE5OjE5OjIxLjEwNFoiLCJwdXIiOiJjb29raWUucmVtZW1iZXJfdXNlcl90b2tlbiJ9fQ%3D%3D--fd2cf0a0a00cba7d72f6f60f97a14a953ad426eb; user_session_identifier=tKzNFOgrBs%2Bs8I%2BUF6aDk3NbIeXwOrzXVszlYMepSmyrRLGrzqUSaMkMR%2F6LoY1QXAyiJyb5MW6rmxXPJrf8dOsd%2F0vZnPkUuz0b8qgEaKP6pWD9NVywfRbQ2De0%2F83Urm044g5MXs58YCkwpt9g9024IxXzqo4VMtFrr%2Bs37Hg79OPyRs12ULlmmXSLQwi%2F%2BVAoRXOjjofHTsNgdky5fJN15X9TDSdOmoUIKnbthkWdaVm1NFn1r5sJh3l%2F2jbWniA6GGKQW5Ga13gxiw%3D%3D--o%2BsNaIVIOT9Bx3NZ--bwxbd6kiIMpofN97yf2Ydw%3D%3D; cf_clearance=MnAhGbsb.Cs_qeBQb3XavZWYIJ5d9cIblnGIJWC1m78-1769023162-1.2.1.1-7SZt_Zcgo8o35VxIxbK4o.DfJzg0YqzLDdPY464QbB1nmwLEmr6MfgYCsTgqF8JXUiiph5wBrr3JjbBasezqg5KNY2loKSekuzXkdrfwc1.vZg_F3yk2PKHcShEvACxEFPks0JFheHDKpVY6z9Zb25r0h3W1dhyiy7k_5yO9c8WWbiqOQKxkQIqh4xfRQ4NVtbKtEMu5g8YanYtjdnKeP5mOCZaR.CzP.KfGZlNEs_U; __stripe_sid=e14eac9f-6bbb-4184-b515-7229a9790bee4bcb5c; _circle_session=g6PvDIGgEPaYfg99siGBXRWQnbqf1nMWrk1OH%2BgY%2B95SvJPfMACRpivSBBkgGI8yMarcL7uDDEt0oanVqjh0%2FEv1vcciRxAZXzFbo7h98ubt5th7SYAAIQ%2BeiesdAAQlTwX52BWq5Y34hplOxJoppVB8wdTC%2BK4yinuzgKc4s2gE8bCGXZQLoxQCU%2FOuDBDsCSF%2FWhZYWCIfRuPxwcHcAawsHMXeP7wLa%2FDJCY47E7KmeTYIdqqxP3B8t%2BRADqXi%2BGc5uWwM1%2FnyF6LDnIfQkMeMBKdEe6JpNkyCF8SUurtFfbY%2B0KJIY4N5RchIIhCUb7hV6Wbn0mJOTvtAfJ4%2BydgKOvCjfcTT6bkcJlzGXwJN21nM6UQfEFnn9m4wRkIsoec4rZGA07FR77LMnMhI1M4H1QpMs2BXV545w5UEYNZKK9TlQ%2B10RS9H8F%2Fujs4w1nG9--YmLJV75XCiDOzu7T--0ls%2Bf2e9FwWQ2%2Bxd6A23Mw%3D%3D; __cf_bm=dDBSjbPg49jG_7Q9iD19d5IKvu726nE5f6FFnie.348-1769024090-1.0.1.1-C7gmTUMOFlp7kFDXz.cs3FNwmxLvbqJuwTAQgiVbWmgIwBZpdihLzxw4TxhoQ9.xsq8X2mgerDHtrnk435x_ksXPjJ7xeio1zZbQTtCTBGk`;

const getDemoKeyFromCookie = (cookieHeader) => {
    if (!cookieHeader) return null;
    const pairs = cookieHeader.split(';').map(part => part.trim());
    for (const pair of pairs) {
        if (pair.startsWith(`${DEMO_COOKIE_NAME}=`)) {
            return pair.split('=')[1] || null;
        }
    }
    return null;
};

const resolveDemoContext = (req) => {
    const queryKey = req.query?.demo;
    if (queryKey) {
        const config = demoConfigs[queryKey];
        if (config) {
            return { key: queryKey, config };
        }
    }

    const cookieKey = getDemoKeyFromCookie(req.headers?.cookie || '');
    if (cookieKey) {
        const config = demoConfigs[cookieKey];
        if (config) {
            return { key: cookieKey, config };
        }
    }

    return { key: DEFAULT_DEMO, config: demoConfigs[DEFAULT_DEMO] };
};

const setActiveDemoCookie = (res, key) => {
    const demoKey = key || DEFAULT_DEMO;
    res.setHeader('Set-Cookie', `${DEMO_COOKIE_NAME}=${demoKey}; Path=/; SameSite=Lax`);
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
        setActiveDemoCookie(res, demoKey);
        const TARGET_URL = config.targetUrl;
        const TARGET_ORIGIN = config.targetOrigin;
        const MATCHES = config.matches;
        console.log(`Fetching mirror for: ${TARGET_URL} (demo=${demoKey})`);

        const response = await fetch(TARGET_URL, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0 Safari/537.36',
                'Cookie': MY_COOKIE
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
                        localStorage.setItem(k, 'dark');
                    });
                    document.documentElement.setAttribute('data-theme', 'black');
                    document.documentElement.classList.add('black');
                    document.documentElement.classList.remove('light');
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
                    if (typeof input === 'string' && input.includes('thegraduateguide.co.uk')) {
                        url = input.replace('https://www.thegraduateguide.co.uk', '');
                    }
                    if (typeof input === 'object' && input instanceof Request) {
                        if (input.url.includes('thegraduateguide.co.uk')) {
                            const newUrl = input.url.replace('https://www.thegraduateguide.co.uk', '');
                            url = new Request(newUrl, {
                                method: input.method, headers: input.headers, body: input.body,
                                mode: 'cors', credentials: input.credentials
                            });
                        }
                    }
                    return originalFetch(url, init);
                };
                
                const originalOpen = XMLHttpRequest.prototype.open;
                XMLHttpRequest.prototype.open = function(method, url) {
                    if (typeof url === 'string' && url.includes('thegraduateguide.co.uk')) {
                        url = url.replace('https://www.thegraduateguide.co.uk', '');
                    }
                    return originalOpen.apply(this, arguments);
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
                    standard: { width: 320, ratio: 16 / 9 },
                    short: { width: 260, ratio: 9 / 16 }
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
                    const desiredLeft = window.scrollX + rect.left;
                    const maxLeft = Math.max(12, window.innerWidth - playerWidth - 12);
                    const constrainedLeft = Math.min(Math.max(desiredLeft, 12), maxLeft);
                    player.style.right = constrainedLeft + 'px';
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
                'Cookie': MY_COOKIE,
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
