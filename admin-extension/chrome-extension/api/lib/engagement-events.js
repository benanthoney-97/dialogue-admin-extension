const supabase = require("../supabase-client");

async function logEngagementEvent({ providerId, eventType, pageUrl, metadata }) {
  if (!providerId || !eventType) {
    return;
  }
  try {
    await supabase.from("engagement_events").insert({
      provider_id: providerId,
      event_type: eventType,
      page_url: pageUrl || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    }).single();
  } catch (error) {
    console.error("[engagement-events] insert error", error);
  }
}

module.exports = { logEngagementEvent };
