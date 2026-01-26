(function () {
  const getApiOrigin = () => {
    if (window.__SL_API_ORIGIN) {
      return window.__SL_API_ORIGIN.replace(/\/$/, "")
    }
    return window.location.origin
  }
  const DEFAULT_MATCH_ENDPOINT = "/api/match-map";
  const MATCH_DATA_SCRIPT_ID = "sl-match-map-data";
  const HIGHLIGHT_STYLE_ID = "sl-smart-link-style";

  const MODE_VISITOR = "visitor";
  const MODE_ADMIN = "admin";

  const state = {
    matches: [],
    observer: null,
    highlightTimer: null,
    initialized: false,
    mode: MODE_VISITOR,
    visitorListenerAttached: false,
    config: null,
  };
  const loadPlayerComponent = () => {
    if (window.DialoguePlayer) {
      return Promise.resolve(window.DialoguePlayer)
    }
    return new Promise((resolve) => {
      const script = document.createElement("script")
      script.src = `${getApiOrigin().replace(/\/+$/, "")}/player-component.js`
      script.async = true
      script.onload = () => resolve(window.DialoguePlayer)
      script.onerror = () => resolve(null)
      document.head.appendChild(script)
    })
  }

  let visitorPlayerInstance = null
  const ensureVisitorPlayer = async () => {
    console.log("[admin-script] ensureVisitorPlayer start")
    if (visitorPlayerInstance) {
      console.log("[admin-script] visitor player cached instance")
      return visitorPlayerInstance
    }
    const module = await loadPlayerComponent()
    console.log("[admin-script] loadPlayerComponent result", module)
    if (module?.initVisitorPlayer) {
      visitorPlayerInstance = module.initVisitorPlayer()
      console.log("[admin-script] visitor player initialized")
      return visitorPlayerInstance
    }
    console.warn("[admin-script] visitor player not available")
    return null
  }

  const hideVisitorPlayer = async () => {
    const player = await ensureVisitorPlayer()
    if (!player) return
    player.hide()
    player.loadVideo("")
    stopCompletionWatcher()
  }

  const showVisitorPlayer = async (match, rect) => {
    if (!match) return
    console.log("[admin-script] showVisitorPlayer start", { matchId: getMatchIdentifier(match), rect })
    const player = await ensureVisitorPlayer()
    if (!player) return
    player.size(320, 16 / 9)
    const url = toVimeoPlayerUrl(match.video_url)
    console.log("[admin-script] player show data", { rect, url })
    player.show({ rect, width: 320, ratio: 16 / 9, url })
  }

  const getMatchIdentifier = (match) =>
    match?.page_match_id ??
    match?.id ??
    match?.pageMatchId ??
    match?.pageMatchID ??
    match?.pageMatchid ??
    match?.pageMatch ??
    null;

  const normalize = (value) =>
    (value || "")
      .replace(/\s+/g, " ")
      .replace(/\s+([.,!?;:])/g, "$1")
      .trim();
  const DISALLOWED_HIGHLIGHT_TAGS = /SCRIPT|STYLE|BUTTON|NOSCRIPT|TEXTAREA|INPUT/;

  const setActiveInlineStyles = (span) => {
    span.style.setProperty("cursor", "pointer", "important");
    span.style.setProperty("color", "#5f61fb", "important");
    span.style.setProperty("font-weight", "500", "important");
    span.style.setProperty("transition", "border-color 0.2s ease, color 0.2s ease", "important");
    span.style.setProperty("line-height", "1.2", "important");
    span.style.setProperty("display", "inline", "important");
  };

  const setInactiveInlineStyles = (span) => {
    span.style.setProperty("border-color", "rgba(148, 163, 184, 0.8)", "important");
    span.style.setProperty("background-color", "rgba(239, 241, 245, 0.85)", "important");
    span.style.setProperty("color", "rgba(55, 65, 81, 0.9)", "important");
    span.style.setProperty("box-shadow", "none", "important");
    span.style.setProperty("cursor", "pointer", "important");
  };

  const setRemovedInlineStyles = (span) => {
    span.style.setProperty("border-bottom", "none", "important");
    span.style.setProperty("background-color", "transparent", "important");
    span.style.setProperty("color", "rgba(55, 65, 81, 0.85)", "important");
    span.style.setProperty("box-shadow", "none", "important");
    span.style.setProperty("cursor", "default", "important");
    span.style.setProperty("pointer-events", "none", "important");
  };

  const knowledgeCache = new Map();
  let completionTimer = null;
  let completionThreshold = null;
  let completionDuration = null;
  let completionStart = null;
  let completionMatch = null;
  let completionRequestId = 0;

  const refreshSpanStyles = (span) => {
    if (!span) return;
    const status = span.dataset.matchStatus || "active";
    if (span.classList.contains("sl-smart-link--removed")) {
      setRemovedInlineStyles(span);
      return;
    }
    if (status === "inactive") {
      setInactiveInlineStyles(span);
      return;
    }
    setActiveInlineStyles(span);
  };

  const createHighlightElement = (match, matchIndex) => {
    const span = document.createElement("span");
    span.classList.add("sl-smart-link");
    span.dataset.matchIndex = String(matchIndex);
    const matchId = getMatchIdentifier(match);
    if (matchId) {
      span.dataset.pageMatchId = String(matchId);
    }
    const confidence = Number(match.confidence);
    if (!Number.isNaN(confidence)) {
      span.dataset.confidence = String(confidence);
    }
    const status = (match.status || "active").toLowerCase();
    span.dataset.matchStatus = status;
    if (status === "inactive") {
      span.classList.add("sl-smart-link--inactive");
    }
    refreshSpanStyles(span);
    return span;
  };

  const fetchKnowledgeMetadata = async ({ knowledgeId, pageMatchId }) => {
    const cacheKey = knowledgeId || `match-${pageMatchId}`;
    if (!knowledgeId && !pageMatchId) return null;
    if (knowledgeCache.has(cacheKey)) {
      return knowledgeCache.get(cacheKey);
    }
    try {
      const query = [];
      if (knowledgeId) {
        query.push(`knowledge_id=${encodeURIComponent(knowledgeId)}`);
      }
      if (pageMatchId) {
        query.push(`page_match_id=${encodeURIComponent(pageMatchId)}`);
      }
      const response = await fetch(
        `${getApiOrigin()}/api/provider-knowledge?${query.join("&")}`
      );
      if (!response.ok) {
        throw new Error(`failed to fetch knowledge metadata (${response.status})`);
      }
      const data = await response.json();
      const normalized = (data.metadata && typeof data.metadata === "object") ? { ...data.metadata, content: data.content ?? "" } : data;
      knowledgeCache.set(cacheKey, normalized);
      return normalized;
    } catch (error) {
      console.error("[admin-script] knowledge metadata fetch failed", error);
      return null;
    }
  };

  const requestIframeCurrentTime = (iframe) => {
    if (!iframe?.contentWindow) {
      return Promise.reject(new Error("iframe not ready"));
    }
    return new Promise((resolve, reject) => {
      const expectedOrigin = "https://player.vimeo.com";
      const requestId = ++completionRequestId;
      const listener = (event) => {
        if (event.source !== iframe.contentWindow) return;
        if (!String(event.origin).startsWith(expectedOrigin)) return;
        let payload = event.data;
        if (typeof payload === "string") {
          try {
            payload = JSON.parse(payload);
          } catch {
            return;
          }
        }
        if (!payload || payload.method !== "getCurrentTime") return;
        const reported =
          payload.value ??
          payload.seconds ??
          payload.currentTime ??
          payload.data?.currentTime ??
          payload.data?.seconds;
        if (reported === undefined || reported === null) return;
        const seconds = Number(reported);
        if (Number.isNaN(seconds)) return;
        window.removeEventListener("message", listener);
        clearTimeout(timeout);
        resolve(Math.max(0, seconds));
      };
      const timeout = window.setTimeout(() => {
        window.removeEventListener("message", listener);
        reject(new Error("timeout waiting for current time"));
      }, 2000);
      window.addEventListener("message", listener);
      iframe.contentWindow.postMessage(
        {
          method: "getCurrentTime",
          value: "",
          player_id: "dialogue-admin-player",
          request_id: requestId,
        },
        "*"
      );
    });
  };

  const stopCompletionWatcher = () => {
    if (completionTimer) {
      clearInterval(completionTimer);
      completionTimer = null;
    }
    completionThreshold = null;
    completionDuration = null;
    completionStart = null;
    completionMatch = null;
  };

  const sendCompletionEvent = async (match, seconds, duration, start) => {
    const providerId = match.provider_id ?? match.providerId;
    if (!providerId) return;
    const pageMatchId = match.page_match_id ?? match.pageMatchId ?? match.id;
    if (!pageMatchId) return;
    const percent = duration ? Math.min(100, Math.max(0, Math.round(((seconds - start) / duration) * 100))) : undefined;
    const payload = {
      provider_id: providerId,
      page_match_id: pageMatchId,
      knowledge_id: match.knowledge_id ?? match.knowledgeId,
      page_url: match.page_url ?? match.pageUrl ?? window.location.href,
      percent,
    };
    try {
      await fetch(`${getApiOrigin()}/api/match-completion`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error("[admin-script] completion POST failed", error);
    }
  };

  const startCompletionWatcher = async (match) => {
    if (!playerState?.iframe) return;
    stopCompletionWatcher();
    const knowledgeId = match.knowledge_id ?? match.knowledgeId;
    const pageMatchId = match.page_match_id ?? match.pageMatchId ?? match.id;
    if (!knowledgeId && !pageMatchId) {
      return;
    }
    const metadata = await fetchKnowledgeMetadata({ knowledgeId, pageMatchId });
    if (!metadata) return;
    const start = Number(metadata.timestampStart ?? metadata.start ?? NaN);
    const end = Number(metadata.timestampEnd ?? metadata.end ?? NaN);
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
      return;
    }
    const duration = end - start;
    completionStart = start;
    completionDuration = duration;
    completionThreshold = start + duration * 0.7;
    completionMatch = match;
    const check = async () => {
      if (!playerState?.iframe) return;
      try {
        const seconds = await requestIframeCurrentTime(playerState.iframe);
        // polling check runs silently
        if (seconds >= completionThreshold) {
          stopCompletionWatcher();
          await sendCompletionEvent(match, seconds, duration, start);
        }
      } catch (error) {
        console.error("[admin-script] completion poll failed", error);
      }
    };
    check();
    completionTimer = setInterval(check, 2000);
  };

  const buildNormalizedTextMap = (root) => {
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (!parent || parent.closest(".sl-smart-link")) {
            return NodeFilter.FILTER_REJECT;
          }
          if (DISALLOWED_HIGHLIGHT_TAGS.test(parent.tagName)) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      },
      false
    );

    const normalizedChars = [];
    const mapping = [];
    let pendingSpace = null;
    let sawNonSpace = false;
    let node;

    const flushPendingSpace = () => {
      if (pendingSpace && sawNonSpace) {
        normalizedChars.push(" ");
        mapping.push({ node: pendingSpace.node, offset: pendingSpace.offset });
      }
      pendingSpace = null;
    };

    while ((node = walker.nextNode())) {
      const text = node.nodeValue || "";
      for (let index = 0; index < text.length; index += 1) {
        const char = text[index];
        if (/\s/.test(char)) {
          if (!pendingSpace) {
            pendingSpace = { node, offset: index };
          }
          continue;
        }
        flushPendingSpace();
        normalizedChars.push(char);
        mapping.push({ node, offset: index });
        sawNonSpace = true;
      }
    }

    return {
      normalized: normalizedChars.join(""),
      mapping
    };
  };

  const highlightRange = (data, start, end, match, matchIndex) => {
    const startEntry = data.mapping[start];
    const endEntry = data.mapping[end - 1];
    if (!startEntry || !endEntry) {
      return null;
    }
    const range = document.createRange();
    try {
      range.setStart(startEntry.node, startEntry.offset);
      range.setEnd(endEntry.node, endEntry.offset + 1);
    } catch (error) {
      return null;
    }
    const fragment = range.extractContents();
    const highlight = createHighlightElement(match, matchIndex);
    highlight.appendChild(fragment);
    range.insertNode(highlight);
    return highlight;
  };

  const whenDOMReady = (cb) => {
    if (document.readyState === "complete" || document.readyState === "interactive") {
      cb();
    } else {
      document.addEventListener("DOMContentLoaded", cb);
    }
  };

  const ensureHighlightStyle = () => {
    let style = document.getElementById(HIGHLIGHT_STYLE_ID);
    const existed = Boolean(style);
    if (!style) {
      style = document.createElement("style");
      style.id = HIGHLIGHT_STYLE_ID;
      document.head.appendChild(style);
    }
    style.textContent = `
      .sl-smart-link:not(.sl-smart-link--inactive):not(.sl-smart-link--removed),
      .sl-admin-mode .sl-smart-link:not(.sl-smart-link--inactive):not(.sl-smart-link--removed),
      body.sl-visitor-mode .sl-smart-link:not(.sl-smart-link--inactive):not(.sl-smart-link--removed) {
        border-bottom: none !important;
        cursor: pointer !important;
        font-weight: 500 !important;
        transition: border-color 0.2s ease, color 0.2s ease !important;
        line-height: 1.2 !important;
        display: inline !important;
        text-decoration-line: underline !important;
        text-decoration-color: #6366F1 !important;
        text-decoration-thickness: 2px !important;
        text-decoration-skip-ink: none !important;
      }
      .sl-smart-link:hover,
      .sl-admin-mode .sl-smart-link:hover,
      body.sl-visitor-mode .sl-smart-link:hover {
        text-decoration-color: #6366F1 !important;
      }
      .sl-smart-link.sl-smart-link--hover,
      .sl-admin-mode .sl-smart-link.sl-smart-link--hover,
      body.sl-visitor-mode .sl-smart-link.sl-smart-link--hover {
        text-decoration-color: #6366F1 !important;
        background-color: rgba(76, 29, 149, 0.9) !important;
        box-shadow: 0 2px 10px rgba(76, 29, 149, 0.4) !important;
      }
      .sl-smart-link:not(.sl-smart-link--inactive):not(.sl-smart-link--removed)::after,
      .sl-admin-mode .sl-smart-link:not(.sl-smart-link--inactive):not(.sl-smart-link--removed)::after,
      body.sl-visitor-mode .sl-smart-link:not(.sl-smart-link--inactive):not(.sl-smart-link--removed)::after {
        content: "";
        display: inline-block;
        width: 1em;
        height: 1em;
        margin-left: 0.15em;
        margin-bottom: 0.25em;
        vertical-align: middle;
        background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="%236366F1" d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393"/></svg>');
        background-size: contain;
        background-repeat: no-repeat;
      }
      .sl-smart-link.sl-smart-link--inactive,
      .sl-admin-mode .sl-smart-link.sl-smart-link--inactive,
      body.sl-visitor-mode .sl-smart-link.sl-smart-link--inactive {
        border-color: rgba(148, 163, 184, 0.8) !important;
        background-color: rgba(239, 241, 245, 0.85) !important;
        color: rgba(55, 65, 81, 0.9) !important;
        box-shadow: none !important;
        cursor: pointer !important;
      }
      .sl-smart-link.sl-smart-link--inactive::after,
      .sl-admin-mode .sl-smart-link.sl-smart-link--inactive::after,
      body.sl-visitor-mode .sl-smart-link.sl-smart-link--inactive::after {
        color: rgba(148, 163, 184, 0.9) !important;
        display: none !important;
      }
      .sl-smart-link.sl-smart-link--removed,
      .sl-admin-mode .sl-smart-link.sl-smart-link--removed,
      body.sl-visitor-mode .sl-smart-link.sl-smart-link--removed {
        border-bottom: none !important;
        background-color: transparent !important;
        color: rgba(55, 65, 81, 0.85) !important;
        box-shadow: none !important;
        cursor: default !important;
        pointer-events: none !important;
      }
      .sl-smart-link.sl-smart-link--removed::after,
      .sl-admin-mode .sl-smart-link.sl-smart-link--removed::after,
      body.sl-visitor-mode .sl-smart-link.sl-smart-link--removed::after {
        content: '';
        display: none;
      }
      .sl-smart-link.sl-smart-link--preview-dim,
      .sl-admin-mode .sl-smart-link.sl-smart-link--preview-dim,
      body.sl-visitor-mode .sl-smart-link.sl-smart-link--preview-dim {
        opacity: 0.35 !important;
        filter: grayscale(1) !important;
      }
      body.sl-visitor-mode .sl-smart-link.sl-smart-link--inactive {
        display: none;
      }
      #sl-visitor-player {
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 320px;
        max-width: 90vw;
        background: rgba(15, 23, 42, 0.9);
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(15, 23, 42, 0.4);
        color: #fff;
        overflow: hidden;
        z-index: 2147483647;
        transform: translateY(20px);
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.28s ease, transform 0.28s ease;
      }
      #sl-visitor-player .sl-visitor-player__close {
        position: absolute;
        top: 2px;
        right: 10px;
        width: 32px;
        height: 32px;
        border: none;
        border-radius: 50%;
        background: #101a2f;
        color: rgba(255, 255, 255, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        padding: 0;
      }
      #sl-visitor-player .sl-visitor-player__close:hover {
        background: #101a2f;
      }
      #sl-visitor-player.visible {
        opacity: 1;
        transform: translateY(0);
        pointer-events: auto;
      }
      #sl-visitor-player .sl-visitor-player__header {
        padding: 8px 12px;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.85);
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        font-weight: 600;
      }
      #sl-visitor-player .sl-visitor-player__frame {
        width: 100%;
        height: 180px;
        background: #000;
        border-radius: 0 0 16px 16px;
        overflow: hidden;
      }
      #sl-visitor-player iframe {
        width: 100%;
        height: 100%;
        border: none;
      }
    `;
  };

  const persistMatches = (matches) => {
    window.__SL_MATCH_MAP__ = matches;
    const updateScript = () => {
      let script = document.getElementById(MATCH_DATA_SCRIPT_ID);
      if (!script) {
        script = document.createElement("script");
        script.id = MATCH_DATA_SCRIPT_ID;
        script.type = "application/json";
        document.body.appendChild(script);
      }
      script.textContent = JSON.stringify(matches);
    };
    if (document.body) {
      updateScript();
    } else {
      whenDOMReady(updateScript);
    }
  };

  const decodeHtmlEntities = (value) => {
    if (!value) return ""
    const textarea = document.createElement("textarea")
    textarea.innerHTML = value
    return textarea.value
  }

  const highlightMatches = (matches) => {

    if (!matches.length || !document.body) {
      return;
    }

    matches.forEach((match, matchIndex) => {
      if (!match || !match.phrase) return;
      const target = normalize(decodeHtmlEntities(match.phrase));
      if (!target) return;


      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
      let node;

      while ((node = walker.nextNode())) {
        const parent = node.parentElement;
        if (!parent || parent.closest(".sl-smart-link")) continue;
        if (DISALLOWED_HIGHLIGHT_TAGS.test(parent.tagName)) continue;

        const block = parent.closest("p, div, li, section, article, h1, h2, h3, h4, h5, h6") || parent;
        const blockText = normalize(block.textContent || "");
        if (!blockText.includes(target)) continue;

        const normalizedMap = buildNormalizedTextMap(block);
        if (!normalizedMap.normalized) continue;

        const normalizedLower = normalizedMap.normalized.toLowerCase();
        const searchTarget = target.toLowerCase();
        const matchStart = normalizedLower.indexOf(searchTarget);
        if (matchStart === -1) {

          continue;
        }

        const highlight = highlightRange(normalizedMap, matchStart, matchStart + searchTarget.length, match, matchIndex);
        if (!highlight) continue;


        block.classList.add("sl-smart-link-block");
        block.dataset.matchIndex = matchIndex;
        const matchId = getMatchIdentifier(match);
        if (matchId) {
          block.dataset.pageMatchId = String(matchId);
        }
        const confidence = Number(match.confidence);
        if (!Number.isNaN(confidence)) {
          block.dataset.confidence = String(confidence);
        }
        const status = (match.status || "active").toLowerCase();
        block.dataset.matchStatus = status;
        if (status === "inactive") {
          block.classList.add("sl-smart-link--inactive");
        }

        break;
      }
    });
  };

  const getSpanConfidence = (span) => {
    const raw = span.dataset.confidence;
    if (!raw) return null;
    const value = Number(raw);
    if (Number.isNaN(value)) return null;
    return value;
  };

  const clearPreviewStyling = () => {
    const previewed = document.querySelectorAll(".sl-smart-link.sl-smart-link--preview-dim");
    previewed.forEach((span) => span.classList.remove("sl-smart-link--preview-dim"));
  };

  const applyPreviewThreshold = (value) => {
    if (typeof value !== "number") return;
    const spans = document.querySelectorAll(".sl-smart-link");
    spans.forEach((span) => {
      const confidence = getSpanConfidence(span);
      if (confidence === null) {
        span.classList.remove("sl-smart-link--preview-dim");
        return;
      }
      if (confidence < value) {
        span.classList.add("sl-smart-link--preview-dim");
      } else {
        span.classList.remove("sl-smart-link--preview-dim");
      }
    });
  };

  const scheduleHighlight = () => {
    if (state.highlightTimer) {
      clearTimeout(state.highlightTimer);
    }
    state.highlightTimer = setTimeout(() => {
      highlightMatches(state.matches);
    }, 120);
  };

  const setupObserver = () => {
    if (state.observer || typeof MutationObserver === "undefined") return;
    state.observer = new MutationObserver(() => {
      scheduleHighlight();
    });
    state.observer.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  };

  let playerState = null;
  const toVimeoPlayerUrl = (value) => {
    if (typeof value !== "string") return value || "";

    const matches = [
      /vimeo\.com\/(\d+)/,
      /player\.vimeo\.com\/video\/(\d+)/
    ];
    let videoId = null;

    for (const pattern of matches) {
      const found = value.match(pattern);
      if (found) {
        videoId = found[1];
        break;
      }
    }

    if (!videoId) return value;

    const timestampMatch = value.match(/#t=(\d+)/);
    const suffix = timestampMatch ? `#t=${timestampMatch[1]}s` : "";
    return `https://player.vimeo.com/video/${videoId}?autoplay=1&muted=0&title=0&byline=0${suffix}`;
  };

    const handleVisitorClick = (event) => {
    if (state.mode !== MODE_VISITOR) return;
    const target = (event.target || event.srcElement);
    if (!(target instanceof Element)) return;
    const matchEl = target.closest(".sl-smart-link");

    if (!matchEl) return;
    const idxAttr = matchEl.getAttribute("data-match-index");

    if (!idxAttr) return;
    const index = Number(idxAttr);
    if (Number.isNaN(index)) {
      return;
    }
    const match = state.matches[index];
    if (!match) {
      return;
    }
    if (match.status === "inactive") {
      return;
    }
    if (event.cancelable) {
      event.preventDefault();
    }
    event.stopImmediatePropagation();
    event.stopPropagation();
    const providerId = match.provider_id ?? match.providerId;
    const pageMatchId = match.page_match_id ?? match.pageMatchId ?? match.id;
    const rect = matchEl.getBoundingClientRect();
    if (providerId && pageMatchId) {
      console.log("[admin-script] sending match-clicked", {
        providerId,
        pageMatchId,
        videoUrl: match.video_url || match.page_url,
      });
      fetch(`${getApiOrigin()}/api/match-clicked`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider_id: providerId,
          page_match_id: pageMatchId,
          page_url: match.page_url ?? match.pageUrl ?? window.location.href,
          knowledge_id: match.knowledge_id ?? match.knowledgeId,
        }),
      }).catch((error) => {
        console.error("[admin-script] match-clicked log error", error);
      });
    }
    showVisitorPlayer(match, rect);
    startCompletionWatcher(match);
    };

  const setupVisitorClicks = () => {
    if (state.visitorListenerAttached) return;
    state.visitorListenerAttached = true;
    document.addEventListener("click", handleVisitorClick);
  };

  const fetchMatchMap = async ({ providerId, apiOrigin, endpoint, limit }) => {
      const origin = (apiOrigin || getApiOrigin()).replace(/\/$/, "");
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const pageUrl = `${window.location.origin}${window.location.pathname}${window.location.search}`;
    const params = new URLSearchParams({
      provider_id: String(providerId),
      limit: String(limit),
    });
    if (pageUrl) {
      params.set("url", pageUrl);
    }
    const url = `${origin}${cleanEndpoint}?${params.toString()}`;
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) {
      throw new Error(`match-map fetch failed (${response.status})`);
    }
    const data = await response.json();

    return data;
  };

  const fetchMatchesAndApply = async () => {
    const config = state.config || {};
    const { providerId, apiOrigin, endpoint = DEFAULT_MATCH_ENDPOINT, limit = 50 } = config;
    if (!providerId) {
      return;
    }
    const matches = await fetchMatchMap({ providerId, apiOrigin, endpoint, limit });
    applyMatches(matches);
  };

  const applyMatches = (matches) => {
    state.matches = Array.isArray(matches) ? matches.slice() : [];
    persistMatches(state.matches);
    whenDOMReady(() => {

      ensureHighlightStyle();
      highlightMatches(state.matches);
      clearPreviewStyling();
      setupObserver();
      ensureVisitorPlayer();
      setupVisitorClicks();
    });
  };

  const markSpansInactive = (pageMatchId) => {
    const spans = Array.from(document.querySelectorAll(`.sl-smart-link[data-page-match-id="${pageMatchId}"]`));
    if (!spans.length) {
      return;
    }
    spans.forEach((span) => {
      span.classList.remove("sl-smart-link--hover", "sl-smart-link--inactive");
      span.classList.add("sl-smart-link--removed");
      span.style.opacity = "1";
      span.dataset.matchStatus = "inactive";
      span.style.pointerEvents = "none";
      refreshSpanStyles(span);
    });
  };

  const removeMatchHighlight = (pageMatchId) => {
    const normalized = getMatchIdentifier({ page_match_id: pageMatchId });
    if (!normalized) return;
    const targetId = String(normalized);
    markSpansInactive(targetId);
    state.matches = state.matches.map((match) => {
      const identifier = getMatchIdentifier(match);
      if (identifier && String(identifier) === targetId) {
        return {
          ...match,
          status: "inactive",
        };
      }
      return match;
    });
    window.__SL_MATCH_MAP__ = state.matches;
    persistMatches(state.matches);
  };

  const clearInactiveSpans = (pageMatchId) => {
    const spans = document.querySelectorAll(`.sl-smart-link[data-page-match-id="${pageMatchId}"].sl-smart-link--inactive`);
    spans.forEach((span) => {
      span.classList.remove("sl-smart-link--inactive");
      span.style.pointerEvents = "";
      span.dataset.matchStatus = "active";
      refreshSpanStyles(span);
    });
  };

  const applyMode = (mode) => {
    state.mode = mode === MODE_ADMIN ? MODE_ADMIN : MODE_VISITOR;
    const root = document.documentElement;
    const body = document.body;
    if (root) {
      root.classList.toggle("sl-admin-mode", state.mode === MODE_ADMIN);
      root.classList.toggle("sl-visitor-mode", state.mode === MODE_VISITOR);
    }
    if (body) {
      body.classList.toggle("sl-admin-mode", state.mode === MODE_ADMIN);
      body.classList.toggle("sl-visitor-mode", state.mode === MODE_VISITOR);
    }
  };

  const addMatchHighlight = (match) => {
    if (!match) return;
    const matchId = getMatchIdentifier(match);
    if (!matchId) return;
    const targetId = String(matchId);
    if (!match.phrase) {
      return;
    }

    clearInactiveSpans(targetId);

    state.matches = state.matches.filter((entry) => {
      const identifier = getMatchIdentifier(entry);
      return !(identifier && String(identifier) === targetId);
    });

    const normalizedMatch = { ...match, status: "active" };
    state.matches.push(normalizedMatch);
    window.__SL_MATCH_MAP__ = state.matches;
    persistMatches(state.matches);

      whenDOMReady(() => {
        ensureHighlightStyle();
        highlightMatches([normalizedMatch]);
      });
  };

  const init = async (config = {}) => {
    state.config = {
      ...(state.config || {}),
      ...config,
    };

    if (!state.config?.providerId) {
      return;
    }

    if (state.initialized) {
      return;
    }
    state.initialized = true;

    try {
      await fetchMatchesAndApply();
    } catch (error) {
    }
  };

  window.__SL_adminScript = {
    init
  };
  window.__SL_removeMatchHighlight = removeMatchHighlight;
  window.__SL_addMatchHighlight = addMatchHighlight;
  window.__SL_setMode = (mode) => {
    applyMode(mode);
  };
  window.__SL_getMode = () => state.mode;
  window.__SL_applyThreshold = (value) => {
    if (typeof value === "number") {
      applyPreviewThreshold(value);
    }
  };

  whenDOMReady(() => {
    applyMode(state.mode);
  });
})();
