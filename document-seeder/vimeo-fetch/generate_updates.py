import json

# 1. Load the JSON data
try:
    with open('seedlegals_videos.json', 'r') as f:
        videos = json.load(f)
except FileNotFoundError:
    print("Error: Could not find 'seedlegals_videos.json'. Make sure it is in the same folder.")
    exit()

# 2. Open a file to write the SQL commands
with open('update_timestamps.sql', 'w') as sql_file:
    
    # Start a transaction for safety
    sql_file.write("BEGIN;\n\n")
    
    count = 0
    for video in videos:
        link = video.get('link')
        created_time = video.get('created_time')
        
        if link and created_time:
            # Escape single quotes in URLs just in case (though rare in Vimeo links)
            clean_link = link.replace("'", "''")
            
            # Generate the UPDATE statement
            # We match on source_url and update created_at
            statement = f"UPDATE provider_documents SET created_at = '{created_time}' WHERE source_url = '{clean_link}';\n"
            
            sql_file.write(statement)
            count += 1

    # Commit the transaction
    sql_file.write("\nCOMMIT;")

print(f"Successfully generated SQL for {count} videos.")
print("Check 'update_timestamps.sql' and run it in your Supabase SQL Editor.")