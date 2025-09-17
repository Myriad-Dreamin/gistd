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

  // @ts-ignore
  const isDev = true; // import.meta.env !== undefined;

  const storage = (() => {
    if (isDev) {
      console.log("isDev");
      const rest = ["charged-ieee", "template", "main.typ"];
      return {
        type: "github" as const,
        user: "typst",
        repo: "templates",
        kind: "blob",
        ref: "main",
        rest,
        slug: rest.join("/"),
      };
    }
    const ghPath = window.location.pathname.slice(1) || "";
    const [user, repo, kind, ref, ...rest] = ghPath.split("/");
    return {
      type: "github" as const,
      user,
      repo,
      kind,
      ref,
      rest,
      slug: rest.join("/"),
    };
  })();
  console.log("storage", storage);

  const mainFilePath = `/repo/${storage.slug}`;

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
  const lastPart =
    storage.rest.length > 0 ? storage.rest[storage.rest.length - 1] : "main";
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
        "GitHub: " + storage.user + "/" + storage.repo + " " + lastPart
      ),
      div(
        { class: "gistd-toolbar-row flex-row" },
        div({ class: "error", textContent: error }),
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
    await $typst.addSource("/repo/.gistd-private/styling.typ", styling);
  }
};

van.add(document.querySelector("#app")!, App());
