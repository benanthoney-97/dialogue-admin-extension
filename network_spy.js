(() => {
  const GUARD_FLAG = '__dialogueSafetyNetworkSpyInjected';
  if (window[GUARD_FLAG]) {
    return;
  }
  window[GUARD_FLAG] = true;

  const SOURCE = 'dialogueSafetyNetwork';
  const RESPONSE_TYPE = 'SAFETY_INTERCEPT_RESPONSE';
  const REQUEST_TYPE = 'SAFETY_INTERCEPT_REQUEST';

  function post(type, detail) {
    window.postMessage({ source: SOURCE, type, ...detail }, '*');
  }

  function isStreamUrl(url) {
    if (!url) {
      return false;
    }
    const stringUrl = String(url);
    return stringUrl.includes('/StreamGenerate');
  }

  function sanitizeBody(body) {
    if (!body) {
      return '';
    }
    if (typeof body === 'string') {
      return body;
    }
    if (body instanceof URLSearchParams) {
      return body.toString();
    }
    if (body instanceof FormData) {
      const entries = [];
      body.forEach((value, key) => {
        entries.push(`${key}=${value}`);
      });
      return entries.join('&');
    }
    if (body instanceof Blob) {
      return '[blob body]';
    }
    if (typeof body === 'object') {
      try {
        return JSON.stringify(body);
      } catch {
        return '';
      }
    }
    return '';
  }

  function isStreamUrl(url) {
    if (!url) {
      return false;
    }
    const stringUrl = String(url);
    return stringUrl.includes('/StreamGenerate');
  }

  function captureRequest(url, method, body) {
    if (!isStreamUrl(url)) {
      return;
    }
    post(REQUEST_TYPE, {
      url: String(url ?? ''),
      method: String(method ?? 'GET').toUpperCase(),
      body: sanitizeBody(body),
    });
  }

  function captureResponse(url, text) {
    if (!isStreamUrl(url)) {
      return;
    }
    post(RESPONSE_TYPE, {
      url: String(url ?? ''),
      text: text ?? '',
    });
  }

  if (window.fetch) {
    const originalFetch = window.fetch.bind(window);
    window.fetch = function (resource, config = {}) {
    const request = resource instanceof Request ? resource : null;
    const requestUrl = request ? request.url : resource;
    const method = (config.method ?? (request?.method ?? 'GET')).toUpperCase();
    if (!isStreamUrl(requestUrl)) {
      return originalFetch.apply(this, arguments);
    }
      captureRequest(requestUrl, method, config.body);
      const responsePromise = originalFetch.apply(this, arguments);
      responsePromise.then((response) => {
        const responseUrl = response.url || requestUrl;
        if (isStreamUrl(responseUrl)) {
          response.clone().text().then((text) => captureResponse(responseUrl, text)).catch(() => {});
        }
        return response;
      }).catch(() => {});
      return responsePromise;
    };
  }

  if (window.XMLHttpRequest) {
    const proto = window.XMLHttpRequest.prototype;
    const originalOpen = proto.open;
    const originalSend = proto.send;

    proto.open = function (method, url, ...args) {
      this.__dialogueSafetyUrl = url;
      this.__dialogueSafetyMethod = method;
      return originalOpen.apply(this, [method, url, ...args]);
    };

    proto.send = function (body) {
      const url = this.__dialogueSafetyUrl ?? '';
      if (!isStreamUrl(url)) {
        return originalSend.apply(this, arguments);
      }
      captureRequest(url, (this.__dialogueSafetyMethod ?? 'GET').toUpperCase(), body);
      this.addEventListener('load', () => {
        try {
          let text = '';
          if (!this.responseType || this.responseType === 'text') {
            text = this.responseText;
          } else if (this.responseType === 'json') {
            text = JSON.stringify(this.response ?? {});
          } else if (typeof this.response === 'string') {
            text = this.response;
          } else if (this.response) {
            text = JSON.stringify(this.response);
          }
          if (text) {
            captureResponse(url, text);
          }
        } catch {
          // ignore read errors
        }
      });
      return originalSend.apply(this, arguments);
    };
  }
})();
