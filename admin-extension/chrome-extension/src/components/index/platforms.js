export const PROVIDER_ID = 12; // SeedLegals
window.PROVIDER_ID = PROVIDER_ID;

let supabaseClient;
let cachedConfig;

async function loadConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }
  try {
    const response = await fetch('/config.json', { cache: 'no-cache' });
    if (!response.ok) {
      console.warn('Failed to load config.json:', response.status);
      return {};
    }
    cachedConfig = await response.json();
    return cachedConfig;
  } catch (err) {
    console.error('Error fetching config.json:', err);
    return {};
  }
}

async function ensureClient() {
  if (!window.supabase) {
    console.warn('Supabase client is not loaded.');
    return null;
  }

  const config = await loadConfig();
  if (!config?.supabaseUrl || !config?.supabaseKey) {
    console.warn('Supabase URL/key missing from config.json.');
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseKey);
  }

  return supabaseClient;
}

async function loadPlatforms() {
  const client = await ensureClient();
  if (!client) return;

  const sourcesTable = document.querySelector('sources-table');
  if (!sourcesTable) return;

  console.log('Loading provider platforms for provider', PROVIDER_ID);
  const { data, error } = await client
    .from('provider_platforms')
    .select('*')
    .eq('provider_id', PROVIDER_ID)
    .order('connected_on', { ascending: false });

  if (error) {
    console.error('Unable to load provider platforms:', error);
    return;
  }

  console.log(`Fetched ${data.length} platform(s) from Supabase.`);
  const documentCounts = await Promise.all((data || []).map(async platform => {
    try {
      const docs = await fetchProviderDocuments(platform.provider_id, platform.platform_url);
      return Array.isArray(docs) ? docs.length : 0;
    } catch (err) {
      console.error('Unable to fetch document count for platform', platform.platform_name, err);
      return 0;
    }
  }));

  const formatted = (data || []).map((platform, index) => {
    let connectedLabel = '—';
    if (platform.connected_on) {
      const date = new Date(platform.connected_on);
      connectedLabel = date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
    return {
      name: platform.platform_name,
      url: platform.platform_url || '—',
      items: documentCounts[index] ?? 0,
      connected: Boolean(platform.connected_on),
      platform_logo: platform.platform_logo,
      connected_on: platform.connected_on,
      connected_on_display: connectedLabel,
      type: 'platform',
      provider_id: platform.provider_id
    };
  });

  console.log('Formatted platform rows for sources-table:', formatted);
  sourcesTable.data = formatted;
}

async function fetchProviderDocuments(providerId, matchUrl) {
  const client = await ensureClient();
  if (!client) return [];

  let pattern = '%';
  if (matchUrl) {
    try {
      const extracted = new URL(matchUrl);
      pattern = `%${extracted.host}%`;
    } catch {
      pattern = `%${matchUrl}%`;
    }
  }
  const { data, error } = await client
    .from('provider_documents')
    .select('*')
    .eq('provider_id', providerId)
    .ilike('source_url', pattern);

  if (error) {
    console.error('Unable to load provider documents:', error);
    return [];
  }

  return data || [];
}

export async function fetchPageMatches(providerId) {
  const client = await ensureClient();
  if (!client || !providerId) return [];

  const { data, error } = await client
    .from('page_matches')
    .select('id,phrase,url,confidence,status,created_at,document_id')
    .eq('provider_id', providerId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Unable to load page matches:', error);
    return [];
  }

  return data || [];
}

export async function updateDocumentActiveStatus(documentId, isActive) {
  const client = await ensureClient();
  if (!client || !documentId) return null;

  const { data, error } = await client
    .from('provider_documents')
    .update({ is_active: isActive })
    .eq('id', documentId)
    .select()
    .single();

  if (error) {
    console.error('Unable to update document active flag:', error);
    return null;
  }

  return data;
}

window.fetchProviderDocuments = fetchProviderDocuments;
window.fetchPageMatches = fetchPageMatches;

document.addEventListener('DOMContentLoaded', loadPlatforms);
