const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const serveHandler = require('serve-handler');
const decisionDataHandler = require('../admin-extension/chrome-extension/api/decision-data');
const matchMapHandler = require('../admin-extension/chrome-extension/api/match-map');
const pageMatchStatusHandler = require('../admin-extension/chrome-extension/api/page-match-status');
const pageMatchHandler = require('../admin-extension/chrome-extension/api/page-match');
const createPageMatchHandler = require('../admin-extension/chrome-extension/api/create-page-match');
const providerDocumentHandler = require('../admin-extension/chrome-extension/api/provider-document');
const providerKnowledgeHandler = require('../admin-extension/chrome-extension/api/provider-knowledge');
const providerDocumentsListHandler = require('../admin-extension/chrome-extension/api/provider-documents');
const providerSiteSettingsHandler = require('../admin-extension/chrome-extension/api/provider-site-settings');
const sitemapFeedsHandler = require('../admin-extension/chrome-extension/api/sitemap-feeds');
const sitemapPagesHandler = require('../admin-extension/chrome-extension/api/sitemap-pages');
const sitemapPageStatusHandler = require('../admin-extension/chrome-extension/api/sitemap-page-status');
const inactiveViewPagelistHandler = require('../admin-extension/chrome-extension/api/inactive-view-pagelist');
const pageMatchesHandler = require('../admin-extension/chrome-extension/api/page-matches');
const sitemapFeedStatusHandler = require('../admin-extension/chrome-extension/api/sitemap-feed-status');
const matchSuggestionsHandler = require('../admin-extension/chrome-extension/api/match-suggestions');
const authRequestOtpHandler = require('../admin-extension/chrome-extension/api/auth/request-otp');
const authVerifyOtpHandler = require('../admin-extension/chrome-extension/api/auth/verify-otp');
const authSignupRequestHandler = require('../admin-extension/chrome-extension/api/auth/signup-request-otp');
const authSignupVerifyHandler = require('../admin-extension/chrome-extension/api/auth/signup-verify-otp');
const matchClickedHandler = require('../admin-extension/chrome-extension/api/match-clicked');
const matchCompletionHandler = require('../admin-extension/chrome-extension/api/match-completion');
const providerAnalyticsSummaryHandler = require('../admin-extension/chrome-extension/api/provider-analytics-summary');
const providerUpdateWebsiteHandler = require('../admin-extension/chrome-extension/api/provider-update-website');
const youtubeChannelVideosHandler = require('../admin-extension/chrome-extension/api/youtube-channel-videos');

const WEB_ROOT = path.join(__dirname, '..', 'web-platform');
const HTTP_PORT = 4173;
const SSE_PATH = '/reload';

const relayClients = new Set();
let reloadTimer;

function broadcastReload() {
  const message = 'data: reload\n\n';
  for (const res of relayClients) {
    res.write(message);
  }
}

function scheduleReload() {
  if (reloadTimer) {
    clearTimeout(reloadTimer);
  }
  reloadTimer = setTimeout(broadcastReload, 120);
}

function setupWatcher() {
  try {
    const watcher = fs.watch(WEB_ROOT, { recursive: true }, (eventType, filename) => {
      if (!filename) return;
      console.log(`Detected change (${eventType}) on ${filename}`);
      scheduleReload();
    });

    watcher.on('error', (err) => {
      console.error('Watcher error:', err);
    });

    process.on('exit', () => watcher.close());
  } catch (err) {
    console.error('Unable to watch files for reload; auto-refresh disabled.', err);
  }
}

function startHttpServer() {
  const server = http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (parsedUrl.pathname === SSE_PATH) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
      res.write('retry: 10000\n\n');
      relayClients.add(res);

      req.on('close', () => {
        relayClients.delete(res);
      });
      return;
    }

    if (parsedUrl.pathname === '/api/match-map') {
      await matchMapHandler(req, res);
      return;
    }

    if (parsedUrl.pathname === '/api/page-match-status') {
      await pageMatchStatusHandler(req, res);
      return;
    }

  if (parsedUrl.pathname === '/api/page-match') {
    await pageMatchHandler(req, res);
    return;
  }

  if (parsedUrl.pathname === '/api/create-page-match') {
    await createPageMatchHandler(req, res);
    return;
  }

    if (parsedUrl.pathname === '/api/provider-document') {
      await providerDocumentHandler(req, res);
      return;
    }

    if (parsedUrl.pathname === '/api/provider-documents') {
      await providerDocumentsListHandler(req, res);
      return;
    }

    if (parsedUrl.pathname === '/api/match-suggestions') {
      await matchSuggestionsHandler(req, res);
      return;
    }
    if (parsedUrl.pathname === '/api/match-clicked') {
      await matchClickedHandler(req, res);
      return;
    }
    if (parsedUrl.pathname === '/api/match-completion') {
      await matchCompletionHandler(req, res);
      return;
    }

    if (parsedUrl.pathname === '/api/provider-site-settings') {
      await providerSiteSettingsHandler(req, res);
      return;
    }

    if (parsedUrl.pathname === '/api/provider-knowledge') {
      await providerKnowledgeHandler(req, res);
      return;
    }

    if (parsedUrl.pathname === '/api/provider-analytics-summary') {
      await providerAnalyticsSummaryHandler(req, res);
      return;
    }
    if (parsedUrl.pathname === '/api/provider-update-website') {
      await providerUpdateWebsiteHandler(req, res);
      return;
    }
    if (parsedUrl.pathname === '/api/youtube-channel-videos') {
      await youtubeChannelVideosHandler(req, res);
      return;
    }

    if (parsedUrl.pathname === '/api/sitemap-feeds') {
      await sitemapFeedsHandler(req, res);
      return;
    }

    if (parsedUrl.pathname === '/api/sitemap-feed-status') {
      await sitemapFeedStatusHandler(req, res);
      return;
    }

    if (parsedUrl.pathname === '/api/page-matches') {
      await pageMatchesHandler(req, res);
      return;
    }

    if (parsedUrl.pathname === '/api/sitemap-page-status') {
      await sitemapPageStatusHandler(req, res);
      return;
    }

    if (parsedUrl.pathname === '/api/sitemap-pages') {
      await sitemapPagesHandler(req, res);
      return;
    }
    if (parsedUrl.pathname === '/api/inactive-view-pagelist') {
      await inactiveViewPagelistHandler(req, res);
      return;
    }

    if (parsedUrl.pathname === '/api/site-content-seed') {
      await siteContentSeedHandler(req, res);
      return;
    }

    if (parsedUrl.pathname === '/api/auth/request-otp') {
      await authRequestOtpHandler(req, res);
      return;
    }

    if (parsedUrl.pathname === '/api/auth/verify-otp') {
      await authVerifyOtpHandler(req, res);
      return;
    }

    if (parsedUrl.pathname === '/api/auth/signup-request-otp') {
      await authSignupRequestHandler(req, res);
      return;
    }
    if (parsedUrl.pathname === '/api/auth/signup-verify-otp') {
      await authSignupVerifyHandler(req, res);
      return;
    }

    if (parsedUrl.pathname.startsWith('/api/')) {
      await decisionDataHandler(req, res);
      return;
    }

    serveHandler(req, res, { public: WEB_ROOT, cleanUrls: true });
  });

  server.listen(HTTP_PORT, 'localhost', () => {
    console.log(`Static server listening at http://localhost:${HTTP_PORT}`);
  });

  process.on('exit', () => server.close());
  return server;
}

async function run() {
  try {
    await new Promise((resolve, reject) => {
      const bootstrap = spawn(process.execPath, [path.join(__dirname, 'generate-config.js')], {
        stdio: 'inherit'
      });
      bootstrap.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`generate-config.js exited with ${code}`));
        }
      });
    });
  } catch (err) {
    console.error(err);
    process.exit(1);
    return;
  }

  setupWatcher();
  startHttpServer();
}

run().catch((err) => {
  console.error('Development server failed to start:', err);
  process.exit(1);
});
