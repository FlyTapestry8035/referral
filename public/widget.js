/*! Referral feedback widget. Add to your beta app:
 *  <script src="https://YOUR-REFERRAL-DOMAIN/widget.js" data-program="PROGRAM_ID" defer></script>
 *  Optional: data-label="Feedback", data-position="left".
 *  Opens a small Referral window where the tester (signed in to Referral) reports a bug or tip.
 *  The page URL and window size are passed along; nothing is read from your page's content.
 */
(function () {
  var script = document.currentScript;
  if (!script || window.__referralWidget) return;
  window.__referralWidget = true;
  var origin = new URL(script.src).origin;
  var program = script.getAttribute("data-program") || "";
  var label = script.getAttribute("data-label") || "Report";
  var left = script.getAttribute("data-position") === "left";

  function mount() {
    var button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.setAttribute("aria-label", label + " a bug or idea");
    button.style.cssText =
      "position:fixed;bottom:16px;" + (left ? "left" : "right") + ":16px;z-index:2147483647;" +
      "padding:10px 16px;border:0;border-radius:999px;background:#111827;color:#fff;" +
      "font:600 14px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;cursor:pointer;" +
      "box-shadow:0 4px 14px rgba(0,0,0,.25)";
    button.addEventListener("click", function () {
      var url = new URL(origin + "/widget");
      if (program) url.searchParams.set("program", program);
      url.searchParams.set("url", location.href.slice(0, 2000));
      url.searchParams.set("vw", window.innerWidth + "x" + window.innerHeight);
      var w = 480, h = 760;
      var x = window.screenX + Math.max(0, (window.outerWidth - w) / 2);
      var y = window.screenY + Math.max(0, (window.outerHeight - h) / 2);
      window.open(url.toString(), "referral-report", "popup,width=" + w + ",height=" + h + ",left=" + x + ",top=" + y);
    });
    document.body.appendChild(button);
  }

  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
