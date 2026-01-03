(function () {
  if (typeof window === 'undefined' || !window.EventSource) {
    return;
  }

  const PORT = 35729;
  const HOST = 'localhost';
  const URL = `http://${HOST}:${PORT}/reload`;
  const evt = new EventSource(URL);

  evt.onmessage = () => {
    window.location.reload();
  };

  evt.onerror = () => {
    console.warn('Auto-reload stream disconnected; retrying shortly...');
  };
})();
