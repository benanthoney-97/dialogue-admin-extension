# Use Python 3.9
FROM python:3.11-slim

# Install system dependencies (FFmpeg is crucial for your video processing)
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

# Set working directory inside the container
WORKDIR /app

# 1. Copy dependencies first (for better caching)
# We copy from the local_functions folder in your project
COPY local_functions/requirements.txt .

# Install Python libraries. 
# We add flask and gunicorn manually since they might be missing from your text file.
RUN pip install --no-cache-dir -r requirements.txt && pip install flask gunicorn

# 2. Copy the actual scripts
# We maintain the folder structure so your imports don't break
COPY scripts/ ./scripts/
COPY local_functions/ ./local_functions/

# 3. Copy the web wrapper we just created
COPY main.py .

# 4. Start the web server
# Timeout set to 0 (infinite) because Cloud Run manages the hard timeout
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--timeout", "0", "main:app"]

# Forces Python to log to console immediately (no buffering)
ENV PYTHONUNBUFFERED=1
