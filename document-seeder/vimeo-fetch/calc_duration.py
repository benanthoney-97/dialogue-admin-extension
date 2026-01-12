import json

def calculate_duration():
    filename = 'seedlegals_videos.json'
    
    try:
        with open(filename, 'r') as f:
            videos = json.load(f)
            
        # Sum the duration of all videos (defaulting to 0 if missing)
        total_seconds = sum(video.get('duration', 0) for video in videos)
        
        # Calculate readable time
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60
        seconds = total_seconds % 60
        
        print(f"--- RESULTS ---")
        print(f"Total Videos: {len(videos)}")
        print(f"Total Seconds: {total_seconds}")
        print(f"Formatted:     {hours}h {minutes}m {seconds}s")
        
    except FileNotFoundError:
        print(f"Error: Could not find '{filename}'")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    calculate_duration()