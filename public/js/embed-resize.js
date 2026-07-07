/**
 * Auto-resize Profit Coach embed iframes on host pages (e.g. Go High Level).
 * Load this script on the parent page; embedded pages post their height via
 * postMessage when requested with ?embed=1.
 */
(function () {
  var MESSAGE_TYPE = "boss-score-embed:resize";
  var TRUSTED_ORIGIN_SUFFIXES = [
    "theprofitcoach.com",
    "localhost:3000",
    "127.0.0.1:3000",
  ];

  function isTrustedOrigin(origin) {
    if (!origin) return false;
    for (var i = 0; i < TRUSTED_ORIGIN_SUFFIXES.length; i++) {
      if (origin.indexOf(TRUSTED_ORIGIN_SUFFIXES[i]) !== -1) return true;
    }
    return false;
  }

  function resizeFrame(frame, height) {
    if (!frame || !height || height < 1) return;
    frame.style.width = "100%";
    frame.style.border = "0";
    frame.style.overflow = "hidden";
    frame.style.display = "block";
    frame.style.height = height + "px";
    frame.style.minHeight = height + "px";
    frame.style.maxHeight = "none";
    frame.setAttribute("scrolling", "no");
  }

  window.addEventListener("message", function (event) {
    if (!isTrustedOrigin(event.origin)) return;

    var data = event.data;
    if (!data || data.type !== MESSAGE_TYPE || !data.height) return;

    var frames = document.getElementsByTagName("iframe");
    for (var i = 0; i < frames.length; i++) {
      if (frames[i].contentWindow === event.source) {
        resizeFrame(frames[i], data.height);
        return;
      }
    }

    // Fallback for same-origin tests: first iframe pointing at our app.
    for (var j = 0; j < frames.length; j++) {
      var src = frames[j].getAttribute("src") || "";
      if (
        src.indexOf("theprofitcoach.com") !== -1 ||
        src.indexOf("localhost:3000") !== -1
      ) {
        resizeFrame(frames[j], data.height);
        return;
      }
    }
  });
})();
