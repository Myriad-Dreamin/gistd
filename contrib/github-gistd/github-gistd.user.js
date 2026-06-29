// ==UserScript==
// @name         Gistd Launcher
// @namespace    https://github.com/Myriad-Dreamin/gistd
// @version      0.1.0
// @description  Add a Gistd button to GitHub Typst blob pages.
// @author       Myriad-Dreamin
// @match        https://github.com/*/*/blob/*
// @icon         https://github.githubassets.com/favicons/favicon.svg
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  const BUTTON_ID = "gistd-userscript-open-button";
  const GISTD_ORIGIN = "https://gistd.myriad-dreamin.com";

  function gistdUrl() {
    const url = new URL(window.location.href);
    url.protocol = "https:";
    url.host = new URL(GISTD_ORIGIN).host;
    return url.toString();
  }

  function isTypstBlobPage() {
    return /^\/[^/]+\/[^/]+\/blob\/.+\.typ$/.test(window.location.pathname);
  }

  function findBlobHeader() {
    return (
      document.querySelector(".BlobViewHeader-module__Box_3__ng6v2") ||
      document.querySelector('[class*="BlobViewHeader-module__Box"]') ||
      document.querySelector('[data-testid="blob-header"]') ||
      document.querySelector(".Box-header")
    );
  }

  function createButton() {
    const button = document.createElement("a");
    button.id = BUTTON_ID;
    button.className = "Button Button--secondary Button--small gistd-userscript-button";
    button.href = gistdUrl();
    button.target = "_blank";
    button.rel = "noopener noreferrer";
    button.setAttribute("aria-label", "Open this Typst file with gistd");
    button.innerHTML = `
      <span class="Button-content">
        <span class="Button-visual Button-leadingVisual">
          <svg class="gistd-userscript-icon" aria-hidden="true" viewBox="0 0 576 512" width="14" height="14">
            <path fill="currentColor" d="M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zm0 96a128 128 0 1 1 0 256a128 128 0 1 1 0-256zm0 80a48 48 0 1 0 0 96a48 48 0 1 0 0-96z"/>
          </svg>
        </span>
        <span class="Button-label">Gistd</span>
      </span>
    `;
    return button;
  }

  function installStyles() {
    if (document.getElementById("gistd-userscript-styles")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "gistd-userscript-styles";
    style.textContent = `
      .gistd-userscript-button {
        margin-left: 8px;
        white-space: nowrap;
      }

      .gistd-userscript-icon {
        display: block;
      }

      a.gistd-userscript-button,
      a.gistd-userscript-button:hover,
      a.gistd-userscript-button:focus {
        text-decoration: none;
      }

      a.gistd-userscript-button:not(.Button) {
        align-items: center;
        background-color: var(--button-default-bgColor-rest, #f6f8fa);
        border: 1px solid var(--button-default-borderColor-rest, rgba(31, 35, 40, 0.15));
        border-radius: 6px;
        color: var(--button-default-fgColor-rest, #24292f);
        display: inline-flex;
        font: 500 12px/20px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        min-height: 28px;
        padding: 3px 12px;
      }

      a.gistd-userscript-button:not(.Button):hover {
        background-color: var(--button-default-bgColor-hover, #f3f4f6);
      }
    `;
    document.head.appendChild(style);
  }

  function upsertButton() {
    const existing = document.getElementById(BUTTON_ID);

    if (!isTypstBlobPage()) {
      existing?.remove();
      return;
    }

    const header = findBlobHeader();
    if (!header) {
      return;
    }

    installStyles();

    if (existing) {
      existing.href = gistdUrl();
      if (!header.contains(existing)) {
        header.appendChild(existing);
      }
      return;
    }

    header.appendChild(createButton());
  }

  function scheduleUpsert() {
    window.clearTimeout(scheduleUpsert.timeoutId);
    scheduleUpsert.timeoutId = window.setTimeout(upsertButton, 50);
  }

  scheduleUpsert.timeoutId = 0;

  document.addEventListener("turbo:load", scheduleUpsert);
  document.addEventListener("pjax:end", scheduleUpsert);

  new MutationObserver(scheduleUpsert).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  scheduleUpsert();
})();
