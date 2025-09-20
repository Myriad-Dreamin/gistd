import { DiagnosticsData } from "@myriaddreamin/typst.ts/compiler";
import van from "vanjs-core";
import type { State } from "vanjs-core";
const { div } = van.tags;

export type DiagnosticMessage = DiagnosticsData["full"];
//
// div({ class: "error", textContent: error }),
export const ErrorPanel = ({
  error,
}: {
  error: State<string | DiagnosticMessage[]>;
}) => {
  //   return van.derive(() => {
  //     if (error.val && typeof error.val === "string") {
  //       return div({ class: "error", textContent: error.val });
  //     } else if (error.val && Array.isArray(error.val)) {
  //       return div(
  //         { class: "error" },
  //         error.val.map((e) =>
  //           div({ class: "error-item" }, e.path, " ", e.range, " ", e.message)
  //         )
  //       );
  //     } else {
  //       return div(
  //         { class: "error" },
  //         (_dom?: Element) =>
  //           div(fsState.val?.fsList.map((t) => FsItem(projectDir + "/", t)) || []));
  //     }
  //   });
  return div({ class: "error" }, (_dom?: Element) => {
    if (error.val && typeof error.val === "string") {
      return div({ class: "error", textContent: error.val });
    } else if (error.val && Array.isArray(error.val)) {
      return div(
        { class: "error" },
        error.val.map((e) =>
          div({ class: "error-item" }, e.path, " ", e.range, " ", e.message)
        )
      );
    }
    return div();
  });
};
