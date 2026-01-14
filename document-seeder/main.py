import os
import subprocess
import sys
import threading
from flask import Flask, request, jsonify

app = Flask(__name__)

def run_script_in_background():
    """Runs the heavy seeder script in a separate thread."""
    print("🧵 Background thread started...")
    try:
        # Use the relative path to your script
        script_path = "scripts/run-seed-vimeo.py"
        
        # Run the script using the current python executable
        result = subprocess.run(
            [sys.executable, script_path], 
            capture_output=True,
            text=True,
            timeout=3500 
        )

        if result.returncode == 0:
            print(f"✅ Background Job Success:\n{result.stdout}")
        else:
            print(f"❌ Background Job Failed:\n{result.stderr}")
            # print stdout too, sometimes errors appear there
            print(f"Standard Output:\n{result.stdout}")

    except subprocess.TimeoutExpired:
        print("❌ Background Job timed out after 58 minutes")
    except Exception as e:
        print(f"❌ Background Thread Crash: {e}")

@app.route("/", methods=["POST"])
def handle_request():
    # This print helps us verify the new code is running in Cloud Run logs
    print("✨ VERSION 2.0: ASYNC UPDATE IS LIVE ✨")

    # 1. Security Check
    secret = request.headers.get("x-site-secret")
    expected_secret = os.environ.get("SITE_SEEDER_SECRET")
    
    if not expected_secret:
        print("Error: SITE_SEEDER_SECRET not set in environment variables")
        return jsonify({"error": "Configuration error"}), 500
        
    if secret != expected_secret:
        return jsonify({"error": "Unauthorized"}), 403

    print(f"🚀 Received trigger from N8N. Starting background job...")

    # 2. Fire and Forget! 
    # Start the thread and return immediately.
    thread = threading.Thread(target=run_script_in_background)
    thread.start()

    # 3. Respond to N8N instantly
    return jsonify({
        "status": "triggered", 
        "message": "Job started in background. Check Cloud Run logs for progress."
    })

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)