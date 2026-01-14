import os
import sys
import yt_dlp
from pathlib import Path
from dotenv import load_dotenv
from openai import OpenAI
from supabase import create_client, Client
from llama_index.embeddings.openai import OpenAIEmbedding

# --- CONFIGURATION ---
load_dotenv()
PROJECT_ROOT = Path(__file__).resolve().parent
OUTPUT_DIR = PROJECT_ROOT / "audio_output"

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
openai_client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
supabase: Client = create_client(url, key)
embed_model = OpenAIEmbedding(model="text-embedding-3-small")

# 2. CONFIG
PROVIDER_ID = 12  

if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)

def process_video(video_url, manual_title=None, existing_doc=None):
    print(f"\n🚀 Starting processing for: {video_url}")
    
    audio_path = ""
    detected_title = ""
    doc_id = None

    # yt-dlp Configuration
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': str(OUTPUT_DIR / '%(id)s.%(ext)s'),
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '32',
        }],
        'postprocessor_args': ['-ac', '1'], # Mono
        'quiet': True,
        'no_warnings': True,
        'cookiesfrombrowser': ('chrome',), # Keeps your Vimeo access
    }

    success = False
    try:
        # A. DOWNLOAD
        print("   ⬇️  Downloading audio (using Chrome cookies)...")
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=True)
            detected_title = info.get('title', 'Unknown Title')
            video_id = info.get('id')
            audio_path = str(OUTPUT_DIR / f"{video_id}.mp3")
            print(f"   ✅ Downloaded: {detected_title}")

        # USE MANUAL TITLE IF PROVIDED
        final_title = manual_title if manual_title else detected_title
        print(f"   📝 Using Title: {final_title}")

        # B. TRANSCRIBE WITH TIMESTAMPS
        print("   🎙️  Transcribing (Verbose Mode)...")
        with open(audio_path, "rb") as audio_file:
            transcript = openai_client.audio.transcriptions.create(
                model="whisper-1", 
                file=audio_file,
                response_format="verbose_json",  # <--- CRITICAL CHANGE
                timestamp_granularities=["segment"]
            )
        
        segments = transcript.segments
        print(f"   ✅ Transcription complete ({len(segments)} segments).")

        # C. SAVE PARENT DOC
        print("   💾 Saving to Supabase...")
        if existing_doc:
            doc_id = existing_doc.get("id")
            final_title = manual_title or existing_doc.get("title") or final_title
        else:
            existing = supabase.table('provider_documents').select("id").eq("source_url", video_url).execute()
            if existing.data:
                print(f"      ⚠️ Document already exists (ID: {existing.data[0]['id']}). Reusing row.")
                doc_id = existing.data[0]['id']
            else:
                data, count = supabase.table('provider_documents').insert({
                    "provider_id": PROVIDER_ID,
                    "title": final_title,
                    "source_url": video_url,
                    "media_type": "video" 
                }).execute()
                
            if hasattr(data, 'data') and len(data.data) > 0:
                 doc_id = data.data[0]['id']
            else:
                 doc_id = data[1][0]['id']

        # D. CHUNK WITH TIMESTAMPS
        print("   ⚡ Processing segments...")
        
        rows = []
        current_chunk_text = ""
        chunk_start_time = 0
        
        for i, seg in enumerate(segments):
            # Handle Object vs Dict access
            text = seg.text if hasattr(seg, 'text') else seg['text']
            start = seg.start if hasattr(seg, 'start') else seg['start']
            end = seg.end if hasattr(seg, 'end') else seg['end']
            
            if current_chunk_text == "":
                chunk_start_time = start
                
            current_chunk_text += text + " "
            
            # Aggregate into ~1000 char chunks
            if len(current_chunk_text) > 1000 or i == len(segments) - 1:
                
                vec = embed_model.get_text_embedding(current_chunk_text)
                
                rows.append({
                    "provider_id": PROVIDER_ID,
                    "document_id": doc_id,
                    "content": current_chunk_text.strip(),
                    "embedding": vec,
                    "metadata": {
                        "source": video_url,
                        "timestampStart": int(chunk_start_time), # <--- THE FIX
                        "timestampEnd": int(end)
                    }
                })
                current_chunk_text = ""

        # Batch Insert
        if rows:
            print(f"   💾 Inserting {len(rows)} chunks...")
            batch_size = 20
            for i in range(0, len(rows), batch_size):
                supabase.table('provider_knowledge').insert(rows[i:i+batch_size]).execute()
            print(f"   ✨ SUCCESS! '{final_title}' has been ingested with timestamps.")
        success = True

    except Exception as e:
        print(f"\n❌ Error: {e}")
    finally:
        if audio_path and os.path.exists(audio_path):
            os.remove(audio_path)
    return success, doc_id

def fetch_next_pending_document():
    response = (
        supabase.table("provider_documents")
        .select("id,title,source_url")
        .eq("is_active", False)
        .limit(1)
        .maybe_single()
        .execute()
    )
    data = getattr(response, "data", None)
    error = getattr(response, "error", None)
    if error:
        raise error
    return data


def mark_document_active(document_id):
    supabase.table("provider_documents").update({"is_active": True}).eq("id", document_id).execute()


def main():
    pending = fetch_next_pending_document()
    if not pending:
        print("🎉 Nothing pending.")
        return
    while pending:
        video_url = pending.get("source_url")
        if not video_url:
            print("⚠️  Pending document missing source_url")
            break
        success, doc_id = process_video(video_url, manual_title=pending.get("title"), existing_doc=pending)
        if success and doc_id:
            mark_document_active(doc_id)
        pending = fetch_next_pending_document()


if __name__ == "__main__":
    main()
