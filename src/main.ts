import "./gistd.css";
import "./typst.css";
import "./typst.ts";
import "./loader.ts";
import van, { State } from "vanjs-core";
const { div, button, a } = van.tags;

import { DirectoryView, FsItemState } from "./fs";
import { TypstDocument, Doc } from "./doc";
import { specFromUrl } from "./spec";
import { ErrorPanel, DiagnosticMessage } from "./error";

let $typst: import("@myriaddreamin/typst.ts/contrib/snippet").TypstSnippet =
  window.$typst;

/// Checks if the browser is in dark mode
const isDarkMode = () =>
  window.matchMedia?.("(prefers-color-scheme: dark)").matches;

/// Exports the document
const ExportButton = (title: string, onclick: () => void) =>
  button({
    onclick,
    textContent: title,
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
        textContent: van.derive(() => Math.min(page.val, maxPage.val)),
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
  } = specFromUrl();
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
    maxPage = van.state(0);

  /// Storage spec
  const mainFilePath = storage.mainFilePath(),
    url = storage.originUrl(),
    fileName = storage.fileName(),
    description = storage.description(),
    removeExtension = fileName.replace(/\.typ$/, "");

  /// Checks compiler status
  window.$typst$script.then(async () => {
    $typst = window.$typst;

    await $typst.getCompiler();
    compilerLoaded.val = true;
    await $typst.svg({ mainContent: "" });
    fontLoaded.val = true;
  });

  /// Listens to dark mode change
  window
    .matchMedia?.("(prefers-color-scheme: dark)")
    .addEventListener("change", (event) => (darkMode.val = event.matches));

  history.pushState({}, window.location.pathname);

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

        const { result: data, diagnostics } = await compiler.compile({
          mainFilePath,
          diagnostics: "full",
        });
        console.log("diagnostics", diagnostics);
        if (diagnostics && diagnostics.length > 0) {
          error.val = diagnostics;
          return;
        }

        // TODO: support pdfpc
        if (mode === "slide") {
          try {
            const pdfpc = await compiler.query({
              mainFilePath,
              selector: "<pdfpc>",
            });
            console.log("pdfpc", pdfpc);
          } catch (e) {
            console.log("this slide does not have pdfpc");
          }
        }

        typstDoc.val.addChangement(["diff-v1", data]);
      }

      error.val = "";
    } catch (e) {
      error.val = e as string;
      console.error(e);
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

    window.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") {
        page.val = Math.max(Math.min(page.val - 1, maxPage.val), 1);
      }
      if (e.key === "ArrowRight") {
        page.val = Math.max(Math.min(page.val + 1, maxPage.val), 1);
      }
      if (e.key === "ArrowUp") {
        page.val = Math.max(Math.min(page.val - 1, maxPage.val), 1);
      }
      if (e.key === "ArrowDown") {
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

        ExportButton("Settings", () => alert("Not implemented")),
        ExportButton("Export to PDF", exportPdf)
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
};

van.add(document.querySelector("#app")!, App());
