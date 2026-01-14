import sys
import os

# --- PATH FIX: Allow importing from the parent folder ---
# 1. Get the path of the current script file (.../scripts/run-seed-vimeo.py)
current_script_path = os.path.abspath(__file__)
# 2. Get the folder this script is in (.../scripts)
script_dir = os.path.dirname(current_script_path)
# 3. Get the parent folder (.../app) - this is where local_functions lives
root_dir = os.path.dirname(script_dir)
# 4. Add the root folder to Python's search path
sys.path.append(root_dir)
# --------------------------------------------------------

# Now we can safely import the function
from local_functions.seedvimeo import main as run_seeder

if __name__ == "__main__":
    print("🎬 Starting Vimeo Seeder Script...")
    try:
        run_seeder()
        print("✅ Vimeo Seeder Script Finished Successfully.")
    except Exception as e:
        print(f"❌ Critical Error in Seeder Script: {e}")
        # Exit with error code 1 so main.py knows it failed
        sys.exit(1)
