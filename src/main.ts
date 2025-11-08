import "./typst.ts";

import van, { State } from "vanjs-core";
const { div, button, a } = van.tags;

import { DirectoryView, FsItemState } from "./fs";
import { TypstDocument, Doc } from "./doc";
import { argsFromUrl } from "./args";
import { getFontProvider } from "./font";
import { ErrorPanel, DiagnosticMessage } from "./error";
import type { TypstCompiler } from "typst.ts-0.14";

let $typst = window.$typst;

/// Checks if the browser is in dark mode
const isDarkMode = () =>
  window.matchMedia?.("(prefers-color-scheme: dark)").matches;

/// Exports the document
const ExportButton = (title: string, content: string, onclick: () => void) =>
  button({
    onclick,
    title,
    textContent: content,
  });

const PermalinkButton = () =>
  button({
    title: "Copy As PermaLink",
    textContent: "PermaLink",
    onclick: async () => {
      const args = await argsFromUrl();
      const search = new URLSearchParams(window.location.search || "");
      search.set(
        "g-version",
        (() => {
          switch (args.version) {
            case "v0.13.0":
            case "v0.13.1":
            case "v0.14.0":
              return args.version;
            default:
              return "v0.14.0";
          }
        })()
      );
      window.location.search = search.toString();
    },
  });
const ModeButton = (mode: "slide" | "doc") =>
  button({
    textContent: mode.charAt(0).toUpperCase() + mode.slice(1),
    onclick: () => {
      const newMode = mode === "slide" ? "doc" : "slide";
      const url = new URL(window.location.href);
      url.searchParams.set("g-mode", newMode);
      window.location.href = url.toString();
    },
  });

const fullScreenButton = (mode: "slide" | "doc") => {
  if (mode === "slide") {
    return [
      button({
        onclick: () => {
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            document.documentElement.requestFullscreen();
          }
        },
        textContent: "Full Screen",
      }),
    ];
  }
  return [];
};

const pageControls = ({
  page,
  maxPage,
  mode,
}: {
  page: State<number>;
  maxPage: State<number>;
  mode: "slide" | "doc";
}) => {
  if (mode === "slide") {
    return [
      button({
        onclick: () => {
          page.val = Math.max(Math.min(page.val - 1, maxPage.val), 1);
        },
        textContent: "Prev",
      }),
      button({
        onclick: () => {
          page.val = 1;
        },
        textContent: van.derive(
          () => `${Math.min(page.val, maxPage.val)} / ${maxPage.val}`
        ),
      }),
      button({
        onclick: () => {
          page.val = Math.max(Math.min(page.val + 1, maxPage.val), 1);
        },
        textContent: "Next",
      }),
    ];
  }
  return [];
};

const App = () => {
  /// External status
  const /// Captures compiler load status
    compilerLoaded = van.state(false),
    /// Captures font load status
    fontLoaded = van.state(false),
    /// Binds to filesystem reload event
    reloadBell = van.state(false);
  const {
    /// Creates storage spec from url
    storage,
    page: initialPage,
    mode,
  } = argsFromUrl();
  console.log("storage", storage, "page", initialPage, "mode", mode);
  if (mode === "slide") {
    document.documentElement.dataset.mode = "slide";
  } else {
    document.documentElement.dataset.mode = "doc";
  }

  /// Styles and outputs
  const /// The source code state
    error = van.state<string | DiagnosticMessage[]>(""),
    /// The dark mode style
    darkMode = van.state(isDarkMode()),
    /// The typst document
    typstDoc = van.state<TypstDocument | undefined>(undefined),
    /// request to change focus file
    changeFocusFile = van.state<FsItemState | undefined>(undefined),
    /// The current focus file
    focusFile = van.state<FsItemState | undefined>(undefined),
    /// Whether in full screen
    inFullScreen = van.state(false),
    /// The current page
    page = van.state(initialPage),
    /// The maximum page
    maxPage = van.state(0),
    /// The pdfpc data
    pdfpc = van.state<any>(null),
    /// Record first idx for each label
    labelFirstIdx = van.state<Record<string, number>>({}),
    /// Record current visited idx for each label
    labelCurrentIdx = van.state<Record<string, number>>({});

  /// Storage spec
  const mainFilePath = storage.mainFilePath(),
    url = storage.originUrl(),
    fileName = storage.fileName(),
    description = storage.description(),
    removeExtension = fileName.replace(/\.typ$/, "");

  const initializeLabelIndices = () => {
    if (!pdfpc.val || !pdfpc.val.pages) return;

    const firstIdx: Record<string, number> = {};
    const currentIdx: Record<string, number> = {};

    // Find first occurrence of each label
    pdfpc.val.pages.forEach((page: any, idx: number) => {
      const label = page.label;
      if (!(label in firstIdx)) {
        firstIdx[label] = idx;
        currentIdx[label] = idx; // Initialize current to first
      }
    });

    labelFirstIdx.val = firstIdx;
    labelCurrentIdx.val = currentIdx;
  };

  /// Changes Title for Browser History
  document.title = window.location.pathname;
  /// Checks compiler status
  window.$typst$script.then(async () => {
    $typst = window.$typst;

    await $typst.getCompiler();
    compilerLoaded.val = true;
    if ("setFonts" in $typst) {
      const fontInfo = await getFontProvider();
      console.log("fontInfo", fontInfo);
      // todo: remove me
      // @ts-ignore
      await $typst.setFonts(fontInfo);
    }
    fontLoaded.val = true;
  });

  /// Listens to dark mode change
  window
    .matchMedia?.("(prefers-color-scheme: dark)")
    .addEventListener("change", (event) => (darkMode.val = event.matches));

  /// Triggers compilation when precondition is met or changed
  van.derive(async () => {
    try {
      if (
        /// Compiler with fonts should be loaded
        fontLoaded.val &&
        /// Typst document should be loaded
        typstDoc.val &&
        /// Filesystem should be loaded
        reloadBell.val &&
        /// recompile If focus file changed
        focusFile.val &&
        /// recompile If focus file content changed
        focusFile.val.data.val &&
        /// recompile If dark mode changed
        (darkMode.val || !darkMode.val)
      ) {
        console.log("recompilation");

        setTypstTheme(darkMode.val);

        const compiler = await $typst.getCompiler();

        console.log("start compile", mainFilePath);

        if ("runWithWorld" in compiler) {
          await compiler.reset();
          // todo: remove me
          // @ts-ignore
          await compiler.runWithWorld({ mainFilePath }, async (world) => {
            const { hasError, diagnostics } = (await world.compile()) as {
              hasError?: boolean;
              diagnostics: DiagnosticMessage[];
            };

            console.log("diagnostics", diagnostics);
            if (
              (hasError === undefined &&
                diagnostics &&
                diagnostics.length > 0) ||
              hasError
            ) {
              error.val = diagnostics || [];
              return;
            }

            const { result: data, diagnostics: diagnostics2 } =
              await world.vector();
            if (diagnostics2 && diagnostics2.length > 0) {
              error.val = diagnostics2;
              return;
            }
            typstDoc.val?.addChangement(["new", data]);
            error.val = "";

            if ("title" in world) {
              const title = world.title();
              if (title) {
                document.title = title;
              }
            }

            // support pdfpc
            if (mode === "slide") {
              try {
                const pdfpcData = await world.query({
                  selector: "<pdfpc>",
                });
                const processedPdfpc = processPdfpc(pdfpcData);
                pdfpc.val = processedPdfpc;
                // Initialize label indices when new pdfpc data is loaded
                initializeLabelIndices();
                console.log("processed pdfpc", processedPdfpc);
              } catch (e) {
                console.log("this slide does not have pdfpc");
              }
            }
          });
        } else {
          let compilerCompat = compiler as any as TypstCompiler;
          const { result: data, diagnostics } = await compilerCompat.compile({
            mainFilePath,
            diagnostics: "full",
          });
          console.log("diagnostics", diagnostics);
          if (diagnostics && diagnostics.length > 0) {
            error.val = diagnostics;
            return;
          }

          if (mode === "slide") {
            try {
              const pdfpcData = await compilerCompat.query({
                mainFilePath,
                selector: "<pdfpc>",
              });
              pdfpc.val = processPdfpc(pdfpcData);
              // Initialize label indices when new pdfpc data is loaded
              initializeLabelIndices();
              console.log("processed pdfpc", pdfpc.val);
            } catch (e) {
              console.log("this slide does not have pdfpc");
            }
          }

          typstDoc.val.addChangement(["diff-v1", data]);
          error.val = "";
        }
      }
    } catch (e) {
      error.val = e as string;
      console.error(e);
    }
  });

  // Track current page label for history
  van.derive(() => {
    if (mode === "slide" && pdfpc.val && pdfpc.val.pages && page.val > 0) {
      const currentIdx = page.val - 1;
      const pages = pdfpc.val.pages;
      if (currentIdx >= 0 && currentIdx < pages.length) {
        const currentLabel = pages[currentIdx].label;
        labelCurrentIdx.val = {
          ...labelCurrentIdx.val,
          [currentLabel]: currentIdx,
        };
      }
    }
  });

  // slide mode key bindings
  if (mode === "slide") {
    const detectFullScreen = () => {
      if (window.matchMedia("(display-mode: fullscreen)").matches) {
        inFullScreen.val = true;
      } else {
        inFullScreen.val = false;
      }

      console.log("detectFullScreen", inFullScreen.val);
      if (inFullScreen.val) {
        document.documentElement.dataset.fullscreen = "";
      } else {
        delete document.documentElement.dataset.fullscreen;
      }
    };
    document.addEventListener("fullscreenchange", detectFullScreen);
    detectFullScreen();
    // on click
    window.addEventListener("click", (e) => {
      // if in full screen
      if (!inFullScreen.val) {
        return;
      }

      //  if inside #gistd-doc
      if (e.target instanceof HTMLElement && e.target.closest("#gistd-doc")) {
        page.val = Math.max(Math.min(page.val + 1, maxPage.val), 1);
      }
    });
    // full screen and wheel down
    window.addEventListener("wheel", (e) => {
      // if in full screen
      if (!inFullScreen.val) {
        return;
      }

      if (e.deltaY > 0) {
        page.val = Math.max(Math.min(page.val + 1, maxPage.val), 1);
      } else if (e.deltaY < 0) {
        page.val = Math.max(Math.min(page.val - 1, maxPage.val), 1);
      }
    });

    const getNextPageByLabel = (
      currentPage: number,
      direction: "next" | "prev"
    ): number => {
      if (!pdfpc.val || !pdfpc.val.pages) {
        return direction === "next" ? currentPage + 1 : currentPage - 1;
      }
      const pages = pdfpc.val.pages;
      const currentIdx = currentPage - 1; // page.val from 1, idx from 0
      if (currentIdx < 0 || currentIdx >= pages.length) {
        return direction === "next" ? currentPage + 1 : currentPage - 1;
      }
      const currentLabel = pages[currentIdx].label;

      // Record current label's idx
      labelCurrentIdx.val = {
        ...labelCurrentIdx.val,
        [currentLabel]: currentIdx,
      };

      if (direction === "next") {
        for (let i = currentIdx + 1; i < pages.length; i++) {
          if (pages[i].label !== currentLabel) {
            const targetLabel = pages[i].label;
            // Return to last visited idx of this label, or first occurrence if never visited
            const visitedIdx =
              labelCurrentIdx.val[targetLabel] ??
              labelFirstIdx.val[targetLabel] ??
              i;
            return visitedIdx + 1; // back to 1-based
          }
        }
        return currentPage + 1; // fallback
      } else {
        for (let i = currentIdx - 1; i >= 0; i--) {
          if (pages[i].label !== currentLabel) {
            const targetLabel = pages[i].label;
            // Return to last visited idx of this label, or first occurrence if never visited
            const visitedIdx =
              labelCurrentIdx.val[targetLabel] ??
              labelFirstIdx.val[targetLabel] ??
              i;
            return visitedIdx + 1; // back to 1-based
          }
        }
        return currentPage - 1; // fallback
      }
    };

    window.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const nextPage = getNextPageByLabel(page.val, "prev");
        page.val = Math.max(Math.min(nextPage, maxPage.val), 1);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        const nextPage = getNextPageByLabel(page.val, "next");
        page.val = Math.max(Math.min(nextPage, maxPage.val), 1);
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        page.val = Math.max(Math.min(page.val - 1, maxPage.val), 1);
      }
      if (e.key === "ArrowDown" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        page.val = Math.max(Math.min(page.val + 1, maxPage.val), 1);
      }
    });
  }

  const exportAs = (data: string | Uint8Array | undefined, mime: string) => {
    if (!data) {
      return;
    }

    var fileBlob = new Blob([data as any], { type: mime });

    // Create element with <a> tag
    const link = document.createElement("a");

    // name
    link.download =
      mime === "application/pdf"
        ? `${removeExtension}.pdf`
        : `${removeExtension}.html`;

    // Add file content in the object URL
    link.href = URL.createObjectURL(fileBlob);

    // Add file name
    link.target = "_blank";

    // Add click event to <a> tag to save file.
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const exportPdf = async () => {
    setTypstTheme(false);
    const pdfData = await $typst.pdf({ mainFilePath });
    return exportAs(pdfData, "application/pdf");
  };

  DirectoryView({
    storage,
    compilerLoaded,
    changeFocusFile,
    focusFile,
    reloadBell,
    error: error as State<string>,
  });

  return div(
    { class: "gistd-main flex-column" },
    div(
      {
        class: "header flex-row",
        style: "justify-content: space-between; margin-bottom: 10px",
      },
      a(
        {
          href: url,
          target: "_blank",
          style:
            "display: flex; align-items: center; text-align: center; text-decoration: underline; padding-left: 10px",
        },
        description
      ),
      div(
        { class: "gistd-toolbar-row flex-row" },
        ErrorPanel({ error }),
        // prev, next
        ...fullScreenButton(mode),
        ...pageControls({ page, maxPage, mode }),

        ExportButton("Compilation Settings", "Settings", () =>
          alert("Not implemented")
        ),
        ExportButton("Export To PDF", "PDF", exportPdf),
        PermalinkButton(),
        ModeButton(mode)
        // div({ style: "width: 5px" }),
        // ExportButton("HTML", exportHtml)
      )
    ),
    div(
      { class: "doc-row flex-row" },
      Doc({
        inFullScreen,
        maxPage,
        page,
        mode,
        darkMode,
        compilerLoaded,
        fontLoaded,
        typstDoc,
      })
    ),
    div(
      { class: "footer flex-row" },
      div(
        "Powered by ",
        a({ href: "https://typst.app", target: "_blank" }, "Typst"),
        " and ",
        a(
          { href: "https://github.com/Myriad-Dreamin/gistd", target: "_blank" },
          "gistd."
        )
      )
    )
  );

  async function setTypstTheme(darkMode: boolean) {
    let styling = darkMode
      ? `#let prefer-theme = "dark";`
      : `#let prefer-theme = "light";`;
    await $typst.addSource("/.gistd-private/styling.typ", styling);
  }

  function processPdfpc(pdfpc: unknown): any {
    if (!pdfpc || !(pdfpc as any[]).length) {
      return null;
    }
    const arr = (pdfpc as any[]).map((it) => it.value);
    const newSlideIndices = arr
      .map((item, i) => (item.t === "NewSlide" ? i : -1))
      .filter((i) => i >= 0);
    const config =
      newSlideIndices.length > 0 ? arr.slice(0, newSlideIndices[0]) : arr;
    const slides: any[][] = [];
    for (let i = 0; i < newSlideIndices.length - 1; i++) {
      slides.push(arr.slice(newSlideIndices[i] + 1, newSlideIndices[i + 1]));
    }
    if (newSlideIndices.length > 0) {
      slides.push(arr.slice(newSlideIndices[newSlideIndices.length - 1] + 1));
    }
    const pdfpcObj: any = {
      pdfpcFormat: 2,
      disableMarkdown: false,
    };
    for (const item of config) {
      const key = item.t.charAt(0).toLowerCase() + item.t.slice(1);
      pdfpcObj[key] = item.v;
    }
    const pages: any[] = [];
    for (const slide of slides) {
      const page: any = {
        idx: 0,
        label: "1",
        overlay: 0,
        forcedOverlay: false,
        hidden: false,
      };
      for (const item of slide) {
        if (item.t === "Idx") {
          page.idx = item.v;
        } else if (item.t === "LogicalSlide") {
          page.label = String(item.v);
        } else if (item.t === "Overlay") {
          page.overlay = item.v;
          page.forcedOverlay = item.v > 0;
        } else if (item.t === "HiddenSlide") {
          page.hidden = true;
        } else if (item.t === "SaveSlide") {
          if (!("savedSlide" in pdfpcObj)) {
            pdfpcObj.savedSlide = Number(page.label) - 1;
          }
        } else if (item.t === "EndSlide") {
          if (!("endSlide" in pdfpcObj)) {
            pdfpcObj.endSlide = Number(page.label) - 1;
          }
        } else if (item.t === "Note") {
          page.note = item.v;
        } else {
          const key = item.t.charAt(0).toLowerCase() + item.t.slice(1);
          pdfpcObj[key] = item.v;
        }
      }
      pages.push(page);
    }
    pdfpcObj.pages = pages;
    return pdfpcObj;
  }
};

van.add(document.querySelector("#app")!, App());
