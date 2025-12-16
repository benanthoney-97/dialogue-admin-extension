(function () {
  if (window.__dialogueSafetyNetworkBridgeInjected) {
    return;
  }
  window.__dialogueSafetyNetworkBridgeInjected = true;

  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('network_spy.js');
  script.onload = function () {
    script.remove();
  };
  const container = document.head || document.documentElement || document.body;
  if (container) {
    container.appendChild(script);
  }
})();
