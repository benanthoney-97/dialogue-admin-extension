import json

# The specific video we want to find
TARGET_URL = "https://vimeo.com/1146767703"

# 1. Load the JSON data
try:
    with open('seedlegals_videos.json', 'r') as f:
        videos = json.load(f)
    print(f"Loaded {len(videos)} videos from JSON.")
except FileNotFoundError:
    print("Error: Could not find 'seedlegals_videos.json'.")
    exit()

# 2. Open a file to write the SQL commands
with open('update_timestamps_specific.sql', 'w') as sql_file:
    
    sql_file.write("BEGIN;\n\n")
    
    found = False
    for video in videos:
        link = video.get('link')
        created_time = video.get('created_time')
        
        # Only process if this is the target video
        if link == TARGET_URL:
            found = True
            print(f"\n--- MATCH FOUND ---")
            print(f"Video URL:    {link}")
            print(f"Created Time: {created_time}")
            
            clean_link = link.replace("'", "''")
            
            statement = f"UPDATE provider_documents SET created_at = '{created_time}' WHERE source_url = '{clean_link}';\n"
            
            sql_file.write(statement)
            print(f"Generated SQL: {statement.strip()}")
            break 

    sql_file.write("\nCOMMIT;")

if not found:
    print(f"\nWarning: Could not find video with URL: {TARGET_URL}")
else:
    print(f"\nDone. Check 'update_timestamps_specific.sql' for the result.")