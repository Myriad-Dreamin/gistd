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
      document.querySelector('[class*="BlobViewHeader-module__Box"]')
    );
  }

  function labelledText(element) {
    return element
      .getAttribute("aria-labelledby")
      ?.split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent)
      .filter(Boolean)
      .join(" ");
  }

  function controlText(element) {
    return [
      element.textContent,
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      labelledText(element),
    ]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isVisible(element) {
    const style = window.getComputedStyle(element);
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      element.getClientRects().length > 0
    );
  }

  function findAddToSpaceButton(header) {
    for (const control of header.querySelectorAll("button, a, [role='button']")) {
      if (isVisible(control) && controlText(control).includes("Add to space")) {
        return control;
      }
    }
    return null;
  }

  function createButton() {
    const button = document.createElement("a");
    button.id = BUTTON_ID;
    button.innerHTML = `
      <span class="Button-content">
        <span class="Button-visual">
          <svg data-component="Octicon" aria-hidden="true" focusable="false" class="octicon octicon-file-media gistd-userscript-icon" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" style="display: inline-block; overflow: visible; vertical-align: text-bottom;">
            <path d="M4.75 1A1.75 1.75 0 0 0 3 2.75v4.7a5.25 5.25 0 0 1 1.5-.38V2.75a.25.25 0 0 1 .25-.25H8.5v2.25c0 .966.784 1.75 1.75 1.75h1.25v6.75a.25.25 0 0 1-.25.25h-.7l1.43 1.43A1.75 1.75 0 0 0 13 13.25v-8.5a.75.75 0 0 0-.22-.53l-3-3A.75.75 0 0 0 9.25 1h-4.5Zm5.25 2.56L10.94 5h-.69a.25.25 0 0 1-.25-.25V3.56Z"/>
            <path d="M6.25 8.5a2.25 2.25 0 1 0 0 4.5a2.25 2.25 0 0 0 0-4.5ZM2.5 10.75a3.75 3.75 0 1 1 6.61 2.43l2.1 2.1a.75.75 0 1 1-1.06 1.06l-2.1-2.1a3.75 3.75 0 0 1-5.55-3.49Z"/>
          </svg>
        </span>
      </span>
    `;
    return button;
  }

  function syncButton(button, template) {
    button.className = template.className;
    button.classList.add("gistd-userscript-button");

    for (const attribute of [
      "data-component",
      "data-size",
      "data-variant",
      "data-no-visuals",
      "data-loading",
    ]) {
      const value = template.getAttribute(attribute);
      if (value === null) {
        button.removeAttribute(attribute);
      } else {
        button.setAttribute(attribute, value);
      }
    }

    button.href = gistdUrl();
    button.target = "_blank";
    button.rel = "noopener noreferrer";
    button.setAttribute("aria-label", "Previewing on Gistd");
    button.title = "Previewing on Gistd";
  }

  function upsertButton() {
    const existing = document.getElementById(BUTTON_ID);

    if (!isTypstBlobPage()) {
      existing?.remove();
      return;
    }

    const header = findBlobHeader();
    const addToSpaceButton = header && findAddToSpaceButton(header);
    if (!header || !addToSpaceButton) {
      return;
    }

    const button = existing || createButton();
    syncButton(button, addToSpaceButton);

    if (button.parentElement !== addToSpaceButton.parentElement || button.nextElementSibling !== addToSpaceButton) {
      addToSpaceButton.parentElement.insertBefore(button, addToSpaceButton);
    }
  }

  function scheduleUpsert() {
    if (scheduleUpsert.rafId) {
      window.cancelAnimationFrame(scheduleUpsert.rafId);
    }
    scheduleUpsert.rafId = window.requestAnimationFrame(upsertButton);
  }

  scheduleUpsert.rafId = 0;

  document.addEventListener("turbo:load", scheduleUpsert);
  document.addEventListener("pjax:end", scheduleUpsert);

  new MutationObserver(scheduleUpsert).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  scheduleUpsert();
})();
