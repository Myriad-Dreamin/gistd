import "./gistd.css";
import "./typst.css";
import "./typst.ts";
import "./loader.ts";
import van from "vanjs-core";
const { div, button, a } = van.tags;

import { DirectoryView, FsItemState } from "./fs";
import { TypstDocument, Doc } from "./doc";
import { storageSpecFromUrl } from "./storage";
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

const App = () => {
  /// External status
  const /// Captures compiler load status
    compilerLoaded = van.state(false),
    /// Captures font load status
    fontLoaded = van.state(false),
    /// Binds to filesystem reload event
    reloadBell = van.state(false),
    /// Creates storage spec from url
    storage = storageSpecFromUrl();
  console.log("storage", storage);

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
    focusFile = van.state<FsItemState | undefined>(undefined);

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
        console.log("data", data, "diagnostics", diagnostics);
        if (diagnostics && diagnostics.length > 0) {
          error.val = diagnostics;
          return;
        }

        typstDoc.val.addChangement(["diff-v1", data]);
      }

      error.val = "";
    } catch (e) {
      error.val = e as string;
      console.error(e);
    }
  });

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
  });

  return div(
    { class: "gistd-main flex-column" },
    div(
      {
        class: "flex-row",
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
        ExportButton("Settings", () => alert("Not implemented")),
        ExportButton("Export to PDF", exportPdf)
        // div({ style: "width: 5px" }),
        // ExportButton("HTML", exportHtml)
      )
    ),
    div(
      { class: "doc-row flex-row" },
      Doc({ darkMode, compilerLoaded, fontLoaded, typstDoc })
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
