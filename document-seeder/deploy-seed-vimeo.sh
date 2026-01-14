#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME=seed-vimeo
IMAGE=europe-west2-docker.pkg.dev/dialogue-videos/seed-vimeo/seed-vimeo
REGION=europe-west1  # choose your region

# Build & push
gcloud builds submit --tag "${IMAGE}"

# Deploy (allow unauthenticated if you want to call from Vercel/N8N)
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "SUPABASE_URL=${SUPABASE_URL},SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY},OPENAI_API_KEY=${OPENAI_API_KEY}"
