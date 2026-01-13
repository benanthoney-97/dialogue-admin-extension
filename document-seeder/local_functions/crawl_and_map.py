import os
import time
import requests
import re
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
PROVIDER_ID = 12  # SeedLegals Provider ID
CONFIDENCE_THRESHOLD = 0.5 # High precision for the "Pre-Map"

# Target Pages to Map (We can fetch sitemap, but let's start with the top 3 resources for the Pilot)
TARGET_URLS = [
    "https://seedlegals.com/resources/what-is-seis-eis-an-essential-read-for-uk-startups/",
    "https://seedlegals.com/resources/seis-eis-rules-for-founders/",
    "https://seedlegals.com/resources/advance-assurance-checklist/"
]

headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def process_url(url):
    print(f"\n🌍 Processing: {url}")
    try:
        # 1. Fetch Page
        resp = requests.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(resp.text, 'html.parser')
        
        # 2. Extract Text
        content_area = soup.find('div', class_='elementor-section-wrap') or soup.body
        raw_text = content_area.get_text(" ", strip=True)
        
        # 3. Clean & Split Sentences
        sentences = re.split(r'(?<=[.!?])\s+', raw_text)
        clean_sentences = []
        for s in sentences:
            clean = s.strip()
            # Filter for reasonable sentence length
            if len(clean) > 30 and len(clean) < 150:
                clean_sentences.append(clean)
        
        # Deduplicate and limit to save tokens
        clean_sentences = list(set(clean_sentences))[:50] 
        print(f"   ⚡ Scanned {len(clean_sentences)} sentences. Embedding...")

        if not clean_sentences: 
            return

        # 4. Generate Embeddings
        vectors = embed_model.get_text_embedding_batch(clean_sentences)
        
        matches_to_save = []
        
        # 5. Find Matches
        for i, vector in enumerate(vectors):
            sentence = clean_sentences[i]
            
            # Call Supabase RPC
            rpc_resp = supabase.rpc("match_provider_knowledge", {
                "query_embedding": vector,
                "match_threshold": CONFIDENCE_THRESHOLD, 
                "match_count": 1,
                "filter_provider_id": PROVIDER_ID
            }).execute()

            if rpc_resp.data:
                match_data = rpc_resp.data[0]
                
                # Fetch details to get Video URL and Document ID
                # Note: We select document_id here to link tables
                details = supabase.table("provider_knowledge")\
                    .select("metadata, document_id")\
                    .eq("id", match_data['id'])\
                    .single().execute()
                
                if details.data:
                    doc_id = details.data.get('document_id')
                    meta = details.data.get('metadata', {})
                    video_link = meta.get('source') or meta.get('source_url')
                    ts = meta.get('timestampStart', 0)
                    
                    if video_link:
                        final_video_url = f"{video_link}#t={ts}"
                        
                        matches_to_save.append({
                            "provider_id": PROVIDER_ID,
                            "document_id": doc_id,  # <--- The Critical Link
                            "url": url,
                            "phrase": sentence,
                            "video_url": final_video_url,
                            "confidence": match_data['similarity']
                        })
                        print(f"      ✅ Match ({match_data['similarity']:.2f}): {sentence[:30]}...")

        # 6. Bulk Insert to Supabase
        if matches_to_save:
            # Delete old matches for this URL first (to prevent duplicates during testing)
            supabase.table("page_matches").delete().eq("url", url).execute()
            
            # Insert new ones
            supabase.table("page_matches").insert(matches_to_save).execute()
            print(f"      💾 Saved {len(matches_to_save)} matches to DB.")
        else:
            print("      0 Matches found above threshold.")
            
    except Exception as e:
        print(f"      ⚠️ Failed: {e}")

def run():
    print("🚀 Starting Pre-Mapper...")
    for url in TARGET_URLS:
        process_url(url)
        time.sleep(1) # Be polite

if __name__ == "__main__":
    run()