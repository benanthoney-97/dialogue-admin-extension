// Lightweight demo configuration store.
// Add new entries here so demo-flow/server.js can mirror multiple experiences
// without duplicating the main server logic.

const demos = {
    terra: {
        name: 'Terra technical docs',
        description: 'Demoing Terra technical documentation for an open-source project.',
        targetUrl: 'https://tryterra.co/',
        targetOrigin: 'https://tryterra.co/',
        matches: [
            {
                type: 'text',
                style: 'standard',
                phrase: 'Account limits are a mechanism Unit has built to allow banks and technology companies to control their risk exposure.',
                videoId: 'YvXSPrAojMQ',
                startSeconds: 665
            },
            {
                type: 'text',
                style: 'standard',
                phrase: 'The following are guidelines for limits associated with personal accounts.',
                videoId: 'YvXSPrAojMQ',
                startSeconds: 1268
            },

        ]
    }
};

// Keep "/" usable by mapping "default" to whichever demo you want as fall-back.
demos.default = demos.sheerluxe;

export default demos;
