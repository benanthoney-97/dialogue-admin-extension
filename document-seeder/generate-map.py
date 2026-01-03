import os
import json
import re
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client, Client
from llama_index.embeddings.openai import OpenAIEmbedding

# 1. SETUP
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
load_dotenv(os.path.join(parent_dir, '.env'))

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("PLASMO_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
embed_model = OpenAIEmbedding(model="text-embedding-3-small")

# ⚠️ CONFIGURATION
PROVIDER_ID = 12  # Ensure this matches your data
TARGET_URL = "https://seedlegals.com/resources/what-is-seis-eis-an-essential-read-for-uk-startups/"
OUTPUT_FILE = os.path.join(parent_dir, "web-embed", "seedlegals_mirror.html")


def normalize_source_url(url: str) -> str:
    if not url:
        return ''
    cleaned = re.sub(r'[#?].*', '', url)
    return cleaned.rstrip('/')


def generate_mirror():
    print(f"🌍 Fetching: {TARGET_URL}")

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.9",
        "Referer": "https://www.google.com/",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "cross-site",
        "Sec-Fetch-User": "?1"
    }

    try:
        response = requests.get(TARGET_URL, headers=headers, timeout=10)
        response.raise_for_status()
        html_content = response.text
    except Exception as e:
        print(f"❌ Failed to fetch URL (Bot Protection): {e}")
        return

    soup = BeautifulSoup(html_content, 'html.parser')
    content_area = soup.find('div', class_='elementor-section-wrap') or soup.body

    clean_sentences = []
    print("⚡ Analyzing Page Content...")
    raw_text = content_area.get_text(" ", strip=True)
    potential_sentences = re.split(r'(?<=[.!?])\s+', raw_text)

    for s in potential_sentences:
        clean = s.strip()
        if len(clean) > 30 and len(clean) < 150:
            clean_sentences.append(clean)

    clean_sentences = list(set(clean_sentences))[:50]
    print(f"   Found {len(clean_sentences)} candidate sentences.")

    provider_docs_lookup = {}
    try:
        provider_docs_resp = supabase.table("provider_documents") \
            .select("title, source_url") \
            .eq("provider_id", PROVIDER_ID).execute()
        if provider_docs_resp.data:
            for doc in provider_docs_resp.data:
                normalized_doc_url = normalize_source_url(doc.get("source_url"))
                if normalized_doc_url:
                    provider_docs_lookup[normalized_doc_url] = doc
    except Exception as e:
        print(f"   ⚠️ provider_documents query failed: {e}")

    matches_found = []
    batch_size = 20
    print(f"⚡ Matching against Supabase...")

    for i in range(0, len(clean_sentences), batch_size):
        batch = clean_sentences[i:i + batch_size]
        try:
            vectors = embed_model.get_text_embedding_batch(batch)
            for j, vector in enumerate(vectors):
                sentence = batch[j]
                resp = supabase.rpc("match_provider_knowledge", {
                    "query_embedding": vector,
                    "match_threshold": 0.50,
                    "match_count": 1,
                    "filter_provider_id": PROVIDER_ID
                }).execute()

                if resp.data:
                    match_data = resp.data[0]
                    details = supabase.table("provider_knowledge") \
                        .select("metadata") \
                        .eq("id", match_data['id']) \
                        .single().execute()

                    if details.data:
                        meta = details.data.get('metadata', {})
                        url = meta.get('source') or meta.get('source_url')
                        ts = meta.get('timestampStart', 0)

                        if url:
                            normalized_url = normalize_source_url(url)
                            doc_title = ''
                            doc_ref = provider_docs_lookup.get(normalized_url)
                            if doc_ref:
                                doc_title = doc_ref.get('title', '')
                            meta_title = meta.get('title', '')
                            document_title_value = doc_title or meta_title or ''
                        def vimeo_embed(original_url: str, timestamp: int) -> str:
                            video_id = None
                            for pattern in (r'vimeo\\.com/(\\d+)', r'player\\.vimeo\\.com/video/(\\d+)'):
                                found = re.search(pattern, original_url)
                                if found:
                                    video_id = found.group(1)
                                    break
                            if not video_id:
                                return f"{original_url}#t={timestamp}"
                            ts_param = f"#t={timestamp}s" if timestamp else ""
                            return f"https://player.vimeo.com/video/{video_id}?autoplay=1&title=0&byline=0{ts_param}"

                        matches_found.append({
                            "phrase": sentence,
                            "video_url": vimeo_embed(url, ts),
                            "confidence": match_data.get('confidence', match_data['similarity']),
                            "document_title": document_title_value,
                            "document_id": match_data.get('document_id'),
                            "knowledge_id": match_data.get('id'),
                            "provider_id": PROVIDER_ID
                        })
                        print(f"   📄 Injecting document title: '{document_title_value or '—'}'")
                        print(f"   ✅ Match found: ({match_data['similarity']:.2f}) -> '{sentence[:30]}...'")
        except Exception as e:
            print(f"   ⚠️ Batch error: {e}")

    print(f"🖌️  Injecting {len(matches_found)} matches into HTML...")

    script_template = """
    <script>
    const log = (...args) => console.log("[sg-decision]", ...args);

    const style = document.createElement('style');
    style.innerHTML = `
        .sl-smart-link {
            border-bottom: 2px solid #00bfa5;
            background-color: rgba(0, 191, 165, 0.15);
            cursor: pointer;
            color: #000;
            transition: all 0.2s ease;
        }
        .sl-smart-link:hover {
            background-color: #00bfa5;
            color: white;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        .sl-smart-link::after {
            content: " ▶";
            font-size: 0.8em;
            color: #00bfa5;
        }
        .sl-smart-link:hover::after { color: white; }
    `;
    document.head.appendChild(style);

    const normalize = (str) => str.replace(/\\s+/g, ' ').trim();
    const contentWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);

    const highlightMatches = (MATCH_MAP) => {
        const textNodes = [];
        let node;
        while (node = contentWalker.nextNode()) textNodes.push(node);

        MATCH_MAP.forEach((match, matchIndex) => {
            if (!match.phrase) return;
            const targetPhrase = normalize(match.phrase);

            for (let n of textNodes) {
                const parent = n.parentElement;
                if (!parent || parent.tagName.match(/SCRIPT|STYLE|A|BUTTON|NOSCRIPT/)) continue;
                if (parent.getAttribute('data-sl-scanned') === 'true') continue;

                const currentText = normalize(n.nodeValue);

                if (currentText.includes(targetPhrase) && targetPhrase.length > 0) {
                    if (currentText === targetPhrase) {
                        const span = document.createElement('span');
                        span.className = 'sl-smart-link';
                        span.textContent = match.phrase;
                        span.dataset.matchIndex = matchIndex;
                        parent.replaceChild(span, n);
                        parent.setAttribute('data-sl-scanned', 'true');
                    } else {
                        const safePhrase = match.phrase.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
                        const re = new RegExp(safePhrase, 'i');
                        const newHTML = parent.innerHTML.replace(re, (m) => {
                            return `<span class="sl-smart-link" data-match-index="${matchIndex}">${m}</span>`;
                        });
                        parent.innerHTML = newHTML;
                        parent.setAttribute('data-sl-scanned', 'true');
                    }
                    break;
                }
            }
        });
        log("matches highlighted for extension");
    };

    const fetchMatches = async () => {
        try {
            const response = await fetch("http://localhost:4173/api/match-map?provider_id=12");
            if (!response.ok) throw new Error('match-map fetch failed');
            const data = await response.json();
            const activeMatches = Array.isArray(data) ? data.filter(match => match.status === 'active') : [];
            highlightMatches(activeMatches);
            window.__SL_MATCH_MAP__ = activeMatches;
        } catch (error) {
            log('failed to load match map', error);
            highlightMatches([]);
        }
    };

    document.addEventListener("DOMContentLoaded", function() {
        fetchMatches();
    });
    </script>
    """
    script_content = script_template

    base_tag = f"<base href='{TARGET_URL}'>"
    if "<head>" in html_content:
        final_html = html_content.replace("<head>", f"<head>{base_tag}")
    else:
        final_html = f"{base_tag}{html_content}"

    highlight_script = "<script src=\"/highlight-matches.js\" defer></script>"

    if "</body>" in final_html:
        final_html = final_html.replace("</body>", script_content + highlight_script + "</body>")
    else:
        final_html = final_html + script_content + highlight_script

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(final_html)

    print(f"\n🎉 DONE! Mirror saved to: {OUTPUT_FILE}")


if __name__ == "__main__":
    generate_mirror()
