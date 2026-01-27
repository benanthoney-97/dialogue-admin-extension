// Lightweight demo configuration store.
// Add new entries here so demo-flow/server.js can mirror multiple experiences
// without duplicating the main server logic.

const demos = {
    pitchfork: {
        name: 'Pitchfork Demo',
        description: 'Music reviews and articles from Pitchfork.',
        targetUrl: 'https://pitchfork.com/news/albums-you-should-listen-to-now-ari-lennox-lucinda-williams/',
        targetOrigin: 'https://pitchfork.com/',
        matches: [
            {
                type: 'text',
                style: 'standard',
                phrase: 'Vacancy,',
                videoId: 'jDSKWzheMQ8',
                startSeconds: 0
            },
            {
                type: 'text',
                style: 'standard',
                phrase: 'The following are guidelines for limits associated with personal accounts.',
                videoId: 'YvXSPrAojMQ',
                startSeconds: 1268
            },

        ]
    },
        gitbook: {
        name: 'Gitbook Demo',
        description: 'Music reviews and articles from Gitbook.',
        targetUrl: 'https://developers.llamaindex.ai/python/cloud/llamaextract/getting_started/',
        targetOrigin: 'https://developers.llamaindex.ai/python/cloud/llamaextract/getting_started/',
        matches: [
            {
                type: 'text',
                style: 'standard',
                phrase: 'LlamaExtract provides a simple API for extracting structured data from unstructured documents like PDFs, text files, and images.',
                videoId: 'lYixWuCoGBw',
                startSeconds: 150
            },
            {
                type: 'text',
                style: 'standard',
                phrase: 'Accurate data extraction: We use the best in class LLM models to extract data from your documents.',
                videoId: 'S_u_LR7Gce4',
                startSeconds: 290
            },

        ]
    },
            journalism: {
        name: 'Google DeepMind Demo',
        description: 'Google DeepMind research interviews.',
        targetUrl: 'https://www.bbc.co.uk/news/articles/c4gpq01rvd4o',
        targetOrigin: 'https://www.bbc.co.uk/',
        matches: [
            {
                type: 'text',
                style: 'standard',
                phrase: 'the future of America\'s AI dominance and the scale of investments US firms are planning.',
                videoId: 'PqVbypvxDto',
                startSeconds: 310
            },
        ]
    }
};

// Keep "/" usable by mapping "default" to whichever demo you want as fall-back.
demos.default = demos.pitchfork;

export default demos;
