import van, { State } from "vanjs-core";
import type {
  TypstRenderer,
  RenderSession,
} from "@myriaddreamin/typst.ts/dist/esm/renderer.mjs";
import { TypstDomDocument } from "./dom";
import { MountDomOptions } from "@myriaddreamin/typst.ts/dist/esm/options.render.mjs";
import { RenderInSessionOptions } from "@myriaddreamin/typst.ts/dist/esm/options.render.mjs";

const { div } = van.tags;

export class TypstDocument {
  doc: TypstDomDocument = undefined!;
  constructor(
    public elem: HTMLDivElement,
    public plugin: TypstRenderer,
    public kModule: RenderSession
  ) {
    window.addEventListener("scroll", () => {
      this.doc.addViewportChange();
    });
  }

  setPageColor(_color: string) {
    // todo: dark theme
    this.doc.setPageColor("white");
  }

  addChangement(changement: [string, any]) {
    console.log("addChangement", this.elem, changement);
    this.doc.addChangement(changement);
  }
}

export interface DocState {
  maxPage?: State<number>;
  inFullScreen?: State<boolean>;
  page?: State<number>;
  mode?: "slide" | "doc";
  darkMode: State<boolean>;
  compilerLoaded: State<boolean>;
  fontLoaded: State<boolean>;
  typstDoc: State<TypstDocument | undefined>;
}

/// The document component
export const Doc = ({
  inFullScreen,
  maxPage,
  page,
  mode,
  darkMode,
  compilerLoaded,
  fontLoaded,
  typstDoc,
}: DocState) => {
  const docRef = van.state<HTMLDivElement | undefined>(undefined);
  const kModule = van.state<RenderSession | undefined>(undefined);

  /// Creates a render session
  van.derive(
    async () =>
      fontLoaded.val &&
      (await window.$typst.getRenderer()).runWithSession(
        (m: RenderSession) /* module kernel from wasm */ => {
          return new Promise(async (kModuleDispose) => {
            kModule.val = m;
            /// simply let session leak
            void kModuleDispose;
          });
        }
      )
  );

  /// Creates a TypstDocument
  van.derive(async () => {
    if (!(kModule.val && docRef.val)) {
      return;
    }

    if (typstDoc.val) {
      return;
    }

    const hookedElem = docRef.val!;
    if (hookedElem.firstElementChild?.tagName !== "svg") {
      hookedElem.innerHTML = "";
    }
    const doc = new TypstDocument(
      hookedElem,
      await window.$typst.getRenderer(),
      kModule.val!
    );

    doc.doc = await renderDom(doc.plugin, {
      inFullScreen,
      maxPage,
      page: page?.val || 0,
      mode,
      renderSession: doc.kModule,
      container: doc.elem,
      pixelPerPt: 4.5,
      domScale: 1.5,
    });
    van.derive(() => {
      console.log("setPartialPageNumber", page?.val || 0);
      doc.doc.setPartialPageNumber(page?.val || 0);
    });

    typstDoc.val = doc;

    /// Responds to dark mode change
    van.derive(() => doc.setPageColor(darkMode.val ? "#242424" : "white"));
  });

  return div({ id: "gistd-doc" }, (dom?: Element) => {
    dom ||= div();
    if (!compilerLoaded.val) {
      dom.textContent = "Loading compiler from CDN...";
    } else if (!fontLoaded.val) {
      dom.textContent = "Loading fonts from CDN...";
    } else {
      dom.textContent = "";
      /// Catches a new reference to dom
      docRef.val = dom as HTMLDivElement;
    }
    return dom;
  });
};

async function renderDom(renderer: TypstRenderer, options: RenderDomOptions) {
  const t = new TypstDomDocument({
    ...options,
    renderMode: "dom",
    hookedElem: options.container,
    kModule: options.renderSession,
    renderer: renderer,
  });
  await t.impl.mountDom(options.pixelPerPt);
  return t;
}

interface UserRenderDomOptions {
  page?: number;
  mode?: "slide" | "doc";
}

interface RenderDomOptions
  extends RenderInSessionOptions<MountDomOptions>,
    UserRenderDomOptions {
  maxPage?: State<number>;
  inFullScreen?: State<boolean>;
}
