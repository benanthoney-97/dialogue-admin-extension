(() => {
  const MATCH_MAP_KEY = "__SL_MATCH_MAP__";
  const MATCH_CLASS = "sl-smart-link";
  const MATCH_MAP_URL = "/api/match-map?provider_id=12";

  const getMatches = async () => {
    if (window[MATCH_MAP_KEY] && window[MATCH_MAP_KEY].length) {
      return window[MATCH_MAP_KEY];
    }
    try {
      const response = await fetch(MATCH_MAP_URL);
      if (!response.ok) throw new Error("Failed to load match map");
      return await response.json();
    } catch (error) {
      console.error("[highlight-matches] fetch error", error);
      return [];
    }
  };

  const normalize = (str) => str.replace(/\s+/g, " ").trim();

  const highlightMatches = (matches) => {
    if (!matches.length) return;
    const contentWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    const textNodes = [];
    let node;
    while ((node = contentWalker.nextNode())) {
      textNodes.push(node);
    }

    matches.forEach((match, matchIndex) => {
      if (!match.phrase) return;
      const targetPhrase = normalize(match.phrase);
      for (const textNode of textNodes) {
        const parent = textNode.parentElement;
        if (!parent) continue;
        if (parent.closest("script,style,a,button,noscript")) continue;
        if (parent.dataset.slScanned === "true") continue;
        const currentText = normalize(textNode.nodeValue || "");
        if (currentText.includes(targetPhrase)) {
          const span = document.createElement("span");
          span.className = MATCH_CLASS;
          span.dataset.matchIndex = matchIndex;
          span.textContent = match.phrase;
          const replaced = parent.replaceChild(span, textNode);
          parent.dataset.slScanned = "true";
          break;
        }
      }
    });
  };

  const installClickHandler = () => {
    document.body.addEventListener("click", (event) => {
      const target = event.target.closest(`.${MATCH_CLASS}`);
      if (!target) return;
      event.preventDefault();
      const index = Number(target.dataset.matchIndex);
      if (Number.isNaN(index)) return;
      window.dispatchEvent(new CustomEvent("sl-match-clicked", { detail: { matchIndex: index } }));
      const contentScriptEvent = new CustomEvent("sl-match-event", { detail: { matchIndex: index } });
      document.documentElement.dispatchEvent(contentScriptEvent);
    });
  };

  const init = async () => {
    const matches = await getMatches();
    highlightMatches(matches);
    installClickHandler();
    console.log("[highlight-matches] applied", matches.length, "highlights");
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
