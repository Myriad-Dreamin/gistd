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

  function findAddToSpaceButton(header) {
    const candidates = header.querySelectorAll("button, a");
    for (const candidate of candidates) {
      if (candidate.textContent?.trim() === "Add to space") {
        return candidate;
      }
    }
    return null;
  }

  function insertButton(header, button) {
    const addToSpaceButton = findAddToSpaceButton(header);
    const addToSpaceItem = addToSpaceButton?.closest("li, div, span") || addToSpaceButton;

    if (addToSpaceItem?.parentElement) {
      if (button.parentElement === addToSpaceItem.parentElement && button.nextElementSibling === addToSpaceItem) {
        return;
      }
      addToSpaceItem.parentElement.insertBefore(button, addToSpaceItem);
      return;
    }

    header.appendChild(button);
  }

  function createButton() {
    const button = document.createElement("a");
    button.id = BUTTON_ID;
    button.className = "Button Button--secondary Button--small gistd-userscript-button";
    button.href = gistdUrl();
    button.target = "_blank";
    button.rel = "noopener noreferrer";
    button.setAttribute("aria-label", "Open this Typst file with gistd");
    button.title = "Open with gistd";
    button.innerHTML = `
      <span class="Button-content">
        <span class="Button-visual">
          <svg class="gistd-userscript-icon" aria-hidden="true" viewBox="0 0 512 512" width="16" height="16">
            <path fill="currentColor" d="M64 64c0-17.7 14.3-32 32-32h256c17.7 0 32 14.3 32 32v384c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V64zm32 0v384h256V64H96z"/>
            <path fill="currentColor" d="M208 240a96 96 0 1 0-67.9 163.9c20.3 0 39.2-6.3 54.7-17.1l75.7 75.7c9.4 9.4 24.6 9.4 33.9 0s9.4-24.6 0-33.9l-75.7-75.7c10.8-15.5 17.1-34.4 17.1-54.7A96 96 0 0 0 208 240zm-96 96a48 48 0 1 1 96 0a48 48 0 1 1-96 0z"/>
          </svg>
        </span>
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
        margin-left: 0;
        margin-right: 8px;
        min-width: 32px;
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
        justify-content: center;
        padding: 3px 8px;
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
      insertButton(header, existing);
      return;
    }

    insertButton(header, createButton());
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
