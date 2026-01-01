// CONFIGURATION
// ⚠️ PASTE YOUR KEYS HERE FOR THE DEMO (In production, use Env Vars/Auth)
const SUPABASE_URL = "YOUR_SUPABASE_URL"; 
const SUPABASE_KEY = "YOUR_ANON_KEY"; 
const PROVIDER_ID = 12; // SeedLegals

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// DOM Elements
const thresholdSlider = document.getElementById('threshold');
const thresholdVal = document.getElementById('thresholdVal');
const allowedPathsInput = document.getElementById('allowedPaths');
const saveBtn = document.getElementById('saveBtn');
const codeBlock = document.getElementById('codeBlock');

// 1. Load Current Settings on Init
async function loadSettings() {
    console.log("Fetching settings...");
    const { data, error } = await supabase
        .from('provider_site_settings')
        .select('*')
        .eq('provider_id', PROVIDER_ID)
        .single();

    if (error) {
        console.error("Error loading settings:", error);
        alert("Error loading settings. Check console.");
        return;
    }

    if (data) {
        // Update UI
        thresholdSlider.value = data.match_threshold;
        thresholdVal.textContent = data.match_threshold;
        allowedPathsInput.value = (data.allowed_paths || []).join(', ');
        
        // Generate Code Snippet
        updateSnippet(data.match_threshold, data.allowed_paths);
    }
}

// 2. Handle Slider Changes (Live Update)
thresholdSlider.addEventListener('input', (e) => {
    thresholdVal.textContent = e.target.value;
});

// 3. Save Changes
saveBtn.addEventListener('click', async () => {
    saveBtn.textContent = "Saving...";
    saveBtn.classList.add('saving');

    const newThreshold = parseFloat(thresholdSlider.value);
    const newPaths = allowedPathsInput.value.split(',').map(s => s.trim()).filter(s => s.length > 0);

    const { error } = await supabase
        .from('provider_site_settings')
        .update({ 
            match_threshold: newThreshold,
            allowed_paths: newPaths,
            updated_at: new Date()
        })
        .eq('provider_id', PROVIDER_ID);

    saveBtn.classList.remove('saving');
    
    if (error) {
        console.error("Save failed:", error);
        saveBtn.textContent = "Error!";
        setTimeout(() => saveBtn.textContent = "Save Changes", 2000);
    } else {
        saveBtn.textContent = "Saved!";
        setTimeout(() => saveBtn.textContent = "Save Changes", 2000);
        updateSnippet(newThreshold, newPaths);
    }
});

// Helper: Update the Code Block text
function updateSnippet(thresh, paths) {
    // We point to your Vercel deployment
    const scriptUrl = "https://your-project.vercel.app/web-embed/loader.js"; 
    
    const html = `<script>
  window.SL_CONFIG = {
    threshold: ${thresh},
    allowed_paths: ${JSON.stringify(paths)}
  };
</script>
<script src="${scriptUrl}" async></script>`;
    
    codeBlock.textContent = html;
}

// Start
loadSettings();