import os
import subprocess
import sys
# Threading is removed to prevent CPU throttling
from flask import Flask, request, jsonify

app = Flask(__name__)

def run_seeder_script():
    """Runs the heavy seeder script BLOCKING (Synchronously)."""
    print("🚀 Starting sync job...", flush=True)
    try:
        # Use the relative path to your script
        script_path = "scripts/run-seed-vimeo.py"
        
        # Run the script using the current python executable
        # checks=True is not used so we can handle return codes manually
        result = subprocess.run(
            [sys.executable, script_path], 
            capture_output=True,
            text=True,
            timeout=3500  # 58 minutes (leave buffer for Cloud Run 60m limit)
        )

        if result.returncode == 0:
            print(f"✅ Job Success:\n{result.stdout}", flush=True)
            return True, result.stdout
        else:
            print(f"❌ Job Failed (Return Code {result.returncode}):\n{result.stderr}", flush=True)
            # Print stdout too, as python scripts often print errors there
            print(f"Standard Output:\n{result.stdout}", flush=True)
            return False, result.stderr + "\n" + result.stdout

    except subprocess.TimeoutExpired:
        msg = "❌ Job timed out after 58 minutes"
        print(msg, flush=True)
        return False, msg
    except Exception as e:
        msg = f"❌ Script Crash: {e}"
        print(msg, flush=True)
        return False, msg

@app.route("/", methods=["POST"])
def handle_request():
    print("✨ VERSION 3.0: SYNC BLOCKING MODE ✨", flush=True)

    # 1. Security Check
    secret = request.headers.get("x-site-secret")
    expected_secret = os.environ.get("SITE_SEEDER_SECRET")
    
    if not expected_secret:
        print("Error: SITE_SEEDER_SECRET not set in environment variables", flush=True)
        return jsonify({"error": "Configuration error"}), 500
        
    if secret != expected_secret:
        print(f"⚠️ Unauthorized access attempt with secret: {secret}", flush=True)
        return jsonify({"error": "Unauthorized"}), 403

    print(f"🚀 Received trigger from N8N. Executing script now (this will wait)...", flush=True)

    # 2. RUN BLOCKING
    # The request will hang here until the script finishes. 
    # This keeps the Cloud Run CPU active.
    success, output = run_seeder_script()

    # 3. Respond to N8N with the actual result
    if success:
        return jsonify({
            "status": "success", 
            "message": "Job completed successfully",
            "logs": output
        }), 200
    else:
        return jsonify({
            "status": "error", 
            "message": "Job failed",
            "logs": output
        }), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)