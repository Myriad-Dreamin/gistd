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
  const DEBUG_KEY = "__gistdLauncherDebug";

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
      document.querySelector('[class*="BlobViewHeader-module"]') ||
      document.querySelector('[data-testid="blob-header"]') ||
      document.querySelector('[data-testid="blob-view-header"]') ||
      document.querySelector('[data-testid="file-header"]') ||
      document.querySelector(".Box-header")
    );
  }

  function normalizedText(element) {
    const labelledBy = element
      .getAttribute("aria-labelledby")
      ?.split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent)
      .filter(Boolean)
      .join(" ");

    return [
      element.textContent,
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.getAttribute("data-testid"),
      labelledBy,
    ]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function isNamedControl(element, name) {
    const normalizedName = name.toLowerCase();
    const text = normalizedText(element);
    return text === normalizedName || text.includes(normalizedName);
  }

  function isVisible(element) {
    const style = window.getComputedStyle(element);
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      element.getClientRects().length > 0
    );
  }

  function findControl(name, root = document) {
    const candidates = root.querySelectorAll("button, a, [role='button']");
    for (const candidate of candidates) {
      if (isVisible(candidate) && isNamedControl(candidate, name)) {
        return candidate;
      }
    }
    return null;
  }

  function nearestActionItem(element) {
    return element?.closest("li, [role='listitem']") || element;
  }

  function outerActionItem(element) {
    const item = nearestActionItem(element);
    if (item !== element) {
      return item;
    }

    if (!element?.parentElement) {
      return element;
    }

    let node = element;
    while (node.parentElement) {
      const parent = node.parentElement;
      const controls = parent.querySelectorAll("button, a, [role='button']");
      const parentRect = parent.getBoundingClientRect();
      const nodeRect = node.getBoundingClientRect();

      if (
        controls.length > 1 ||
        parentRect.width > nodeRect.width + 48 ||
        parentRect.height > nodeRect.height + 24
      ) {
        return node;
      }

      node = parent;
    }

    return node;
  }

  function nearestActionContainer(element) {
    return (
      element?.closest('[role="group"]') ||
      element?.closest("ul") ||
      element?.parentElement
    );
  }

  function findRawButton() {
    return (
      findControl("Raw") ||
      findControl("Copy raw file") ||
      findControl("Download raw file")
    );
  }

  function isIconOnlyControl(element) {
    const labelText = element.querySelector(".Button-label")?.textContent?.trim();
    const text = element.textContent?.trim();
    const rect = element.getBoundingClientRect();
    return (
      isVisible(element) &&
      element.id !== BUTTON_ID &&
      element.querySelector("svg") &&
      !labelText &&
      !text &&
      rect.width > 0 &&
      rect.height > 0 &&
      rect.width <= rect.height + 24
    );
  }

  function findIconButtonTemplate(toolbar) {
    const controls = toolbar.querySelectorAll("button, a, [role='button']");
    for (const control of controls) {
      if (isIconOnlyControl(control)) {
        return control;
      }
    }
    return null;
  }

  function findToolbarTargetFromRaw(rawButton) {
    const rawItem = nearestActionItem(rawButton);
    const toolbar = nearestActionContainer(rawItem || rawButton);
    if (!toolbar) {
      return null;
    }

    const iconTemplate = findIconButtonTemplate(toolbar);
    const addToSpaceButton = findControl("Add to space", toolbar);
    if (addToSpaceButton) {
      const item = outerActionItem(addToSpaceButton);
      return {
        kind: "file-toolbar-add-to-space",
        parent: item?.parentElement || toolbar,
        before: item || addToSpaceButton,
        template: iconTemplate || addToSpaceButton,
      };
    }

    const firstAction = [...toolbar.children].find((child) => child.id !== BUTTON_ID && isVisible(child));

    return {
      kind: "file-toolbar",
      parent: toolbar,
      before: firstAction || rawItem || rawButton,
      template: iconTemplate || rawButton,
    };
  }

  function findBlobHeaderTarget() {
    const header = findBlobHeader();
    if (!header) {
      return null;
    }

    const addToSpaceButton = findControl("Add to space", header);
    if (!addToSpaceButton) {
      return null;
    }

    return {
      kind: "blob-header-add-to-space",
      parent: addToSpaceButton.parentElement || header,
      before: addToSpaceButton,
      template: addToSpaceButton,
    };
  }

  function findFilenameHeader() {
    const filename = window.location.pathname.split("/").pop();
    if (!filename) {
      return null;
    }

    for (const element of document.querySelectorAll("span, strong, h1, h2, a")) {
      if (element.textContent?.trim() === filename) {
        return element.closest('[class*="BlobViewHeader-module"], .Box-header, .d-flex, .d-md-flex') || element.parentElement;
      }
    }

    return null;
  }

  function findFileActionsTarget() {
    const headerTarget = findBlobHeaderTarget();
    if (headerTarget) {
      return headerTarget;
    }

    const rawButton = findRawButton();
    if (rawButton) {
      const target = findToolbarTargetFromRaw(rawButton);
      if (target) {
        return target;
      }
    }

    const header = findBlobHeader() || findFilenameHeader();
    return header ? { parent: header, before: null } : null;
  }

  function insertButton(button) {
    const target = findFileActionsTarget();
    const targetRect = target?.before?.getBoundingClientRect();
    window[DEBUG_KEY] = {
      href: window.location.href,
      isTypstBlobPage: isTypstBlobPage(),
      targetKind: target?.kind || "none",
      targetParent: target?.parent?.tagName || null,
      targetBefore: target?.before?.tagName || null,
      targetTemplate: target?.template?.tagName || null,
      targetRect: targetRect
        ? {
            width: targetRect.width,
            height: targetRect.height,
          }
        : null,
      inserted: false,
    };

    if (!target?.parent) {
      return false;
    }

    const before = target.before;
    syncButtonWithTemplate(button, target.template);

    if (before) {
      if (button.parentElement === target.parent && button.nextElementSibling === before) {
        window[DEBUG_KEY].inserted = true;
        return true;
      }
      target.parent.insertBefore(button, before);
      window[DEBUG_KEY].inserted = true;
      return true;
    }

    if (button.parentElement !== target.parent || button.nextElementSibling) {
      target.parent.appendChild(button);
    }
    window[DEBUG_KEY].inserted = true;
    return true;
  }

  function createButton() {
    const button = document.createElement("a");
    button.id = BUTTON_ID;
    button.className = "Button Button--secondary Button--small gistd-userscript-button";
    button.href = gistdUrl();
    button.target = "_blank";
    button.rel = "noopener noreferrer";
    button.setAttribute("aria-label", "Previewing on Gistd");
    button.title = "Previewing on Gistd";
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

  function syncButtonWithTemplate(button, template) {
    if (!template) {
      return;
    }

    button.className = template.className || button.className;
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
    for (const attribute of ["data-testid", "data-hotkey", "aria-describedby", "aria-labelledby"]) {
      button.removeAttribute(attribute);
    }
    button.setAttribute("href", gistdUrl());
    button.setAttribute("target", "_blank");
    button.setAttribute("rel", "noopener noreferrer");
    button.setAttribute("aria-label", "Previewing on Gistd");
    button.setAttribute("title", "Previewing on Gistd");
  }

  function installStyles() {
    if (document.getElementById("gistd-userscript-styles")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "gistd-userscript-styles";
    style.textContent = `
      .gistd-userscript-button {
        white-space: nowrap;
      }

      #gistd-userscript-open-button .Button-label {
        display: none;
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

    installStyles();

    if (existing) {
      existing.href = gistdUrl();
      insertButton(existing);
      return;
    }

    insertButton(createButton());
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
