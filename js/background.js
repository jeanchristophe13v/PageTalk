// js/background.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'proxyFetch') {
    let targetUrl = request.fetchOptions.url;
    const fetchParams = {
      method: request.fetchOptions.method,
      headers: request.fetchOptions.headers,
      body: request.fetchOptions.body,
      // signal: controller.signal // AbortController signal cannot be directly passed from content script
    };

    // If a proxy server address is provided, modify the target URL.
    if (request.proxyAddress && request.proxyAddress.trim() !== '') {
      let proxy = request.proxyAddress.trim();
      // Ensure the proxy URL doesn't end with a slash, and the target URL doesn't start with one for clean concatenation.
      if (proxy.endsWith('/')) {
        proxy = proxy.slice(0, -1);
      }
      // Prepend proxy to the target URL
      // Example: http://myproxy.com/https://google.com
      targetUrl = proxy + '/' + targetUrl;

      // Potentially remove original Host header if proxy expects to set it based on the new targetUrl
      // However, for this simple prepend, we'll keep original headers for now.
      // If the proxy is a transparent one, it should handle the Host header correctly.
      // If it's a non-transparent proxy that expects the target URL in the path,
      // it might also expect the Host header to be for the proxy server itself.
      // This area can be tricky.
      console.log(`Background: Using proxy. New target URL: ${targetUrl}`);
    } else {
      console.log(`Background: No proxy or empty proxy address. Fetching directly: ${targetUrl}`);
    }

    fetch(targetUrl, fetchParams)
      .then(response => {
        // Check if the response is ok (status in the range 200-299)
        if (!response.ok) {
          // Not ok, try to read error body as text, then throw to catch block
          return response.text().then(errorBody => {
            throw new Error(`Network response was not ok. Status: ${response.status}. Body: ${errorBody}`);
          });
        }
        // If response is SSE, we can't consume it here directly and send back as one chunk.
        // The original code streams SSE. This background script approach will break SSE streaming
        // if we try to .json() or .text() it here.
        // For now, let's assume non-streaming or that the caller handles the full response.
        // THIS IS A MAJOR SIMPLIFICATION AND POTENTIAL ISSUE for SSE.
        // A proper solution for SSE over proxy via background would require more complex handling,
        // possibly re-establishing an SSE-like stream back to the content script or using long-lived ports.

        // For now, let's attempt to read as text, assuming the API calls being proxied
        // might not all be SSE, or we accept this limitation for the first pass of proxying.
        // The Gemini API uses SSE for streaming responses.
        // This simplistic .text() will wait for the entire stream to finish.
        return response.text(); // Or response.json() if it's always JSON
      })
      .then(data => {
        sendResponse({ success: true, data: data });
      })
      .catch(error => {
        console.error('Background fetch error:', error);
        sendResponse({ success: false, error: error.message });
      });

    return true; // Indicates that the response will be sent asynchronously.
  }
  // It's important to return true from the event listener if sendResponse will be called asynchronously.
  // However, if the action is not 'proxyFetch', and there's no other async response,
  // this listener implicitly returns undefined, which is fine for synchronous message handling.
  // If there were other message types handled here that *also* sendResponse asynchronously,
  // they would also need to ensure `return true;` is reached for their specific conditions.
  // For this script, only 'proxyFetch' is async. If other actions are added, review this.
});

// Keep the service worker alive if alarms permission is granted (optional)
// This is a common pattern but might not be strictly necessary if messages are frequent enough.
if (chrome.alarms) {
  chrome.alarms.create('keepAlive', { periodInMinutes: 4.5 });
  chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === 'keepAlive') {
      // console.log('Background: keepAlive alarm triggered.');
      // Perform a lightweight operation if needed, or just let it be.
    }
  });
}

console.log('Background script loaded and message listener attached.');
