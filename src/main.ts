// http://localhost:5173/?url=https://github.com/johanvx/typst-undergradmath/blob/main/undergradmath.typ

import "./gistd.css";
import "./typst.css";
import "./typst.ts";
import "./loader.ts";
import van from "vanjs-core";
const { div, button, a } = van.tags;

import { DirectoryView, FsItemState } from "./fs";
import { TypstDocument, Doc } from "./doc";

let $typst = window.$typst;

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
    reloadBell = van.state(false);
  // window.location.pathname

  const ghPath = window.location.pathname.slice(1) || "";
  const [user, repo, kind, ref, ...rest] = ghPath.split("/");
  const storage = {
    type: "github" as const,
    user,
    repo,
    kind,
    ref,
    rest,
    slug: rest.join("/"),
  };

  const mainFilePath = `/repo/${rest.join("/")}`;

  const url = `https://github.com/${window.location.pathname}`;

  /// Styles and outputs
  const /// The source code state
    error = van.state(""),
    /// The dark mode style
    darkMode = van.state(isDarkMode()),
    /// The typst document
    typstDoc = van.state<TypstDocument | undefined>(undefined),
    /// request to change focus file
    changeFocusFile = van.state<FsItemState | undefined>(undefined),
    /// The current focus file
    focusFile = van.state<FsItemState | undefined>(undefined);

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

        const { result: data, diagnostics } = await compiler.compile({
          mainFilePath,
        });
        if (diagnostics && diagnostics.length > 0) {
          error.val = diagnostics[0].message;
          return;
        }
        console.log("data", data);

        typstDoc.val.addChangement(["diff-v1", data]);
      }

      error.val = "";
    } catch (e) {
      error.val = e as string;
      console.error(e);
    }
  });

  // get last part of the path
  const lastPart = rest.length > 0 ? rest[rest.length - 1] : "main";
  const removeExtension = lastPart.replace(/\.typ$/, "");

  const exportAs = (data: string | Uint8Array, mime: string) => {
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

  const exportPdf = () => {
    setTypstTheme(false);
    const pdfData = $typst.pdf({ mainFilePath });
    return pdfData.then((pdfData: string) =>
      exportAs(pdfData, "application/pdf")
    );
  };

  const exportHtml = () => {
    setTypstTheme(false);
    const svgData = $typst.svg({
      mainFilePath,
      data_selection: { body: true, defs: true, css: true },
    });
    return svgData.then((svgData: string) =>
      exportAs(
        `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Gistd Viewer</title></head>
<body>${svgData}</body>
</html>
`,
        "text/html"
      )
    );
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
        "GitHub: " + user + "/" + repo + " " + lastPart
      ),
      div(
        { class: "gistd-toolbar-row flex-row" },
        div({ class: "error", textContent: error }),
        ExportButton("Settings", () => alert("Not implemented")),
        ExportButton("Export to PDF", exportPdf),
        div({ style: "width: 5px" }),
        ExportButton("HTML", exportHtml)
      )
    ),
    div(
      { class: "doc-row flex-row" },
      Doc({ darkMode, compilerLoaded, fontLoaded, typstDoc })
    )
  );

  async function setTypstTheme(darkMode: boolean) {
    let styling = darkMode
      ? `#let prefer-theme = "dark";`
      : `#let prefer-theme = "light";`;
    await $typst.addSource("/repo/.gistd-private/styling.typ", styling);
  }
};

van.add(document.querySelector("#app")!, App());
