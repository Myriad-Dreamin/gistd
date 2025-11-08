import { DiagnosticsData } from "typst.ts-0.14/compiler";
import van from "vanjs-core";
import type { ChildDom, State } from "vanjs-core";
const { div } = van.tags;

export type DiagnosticMessage = DiagnosticsData["full"];
//
// div({ class: "error", textContent: error }),
export const ErrorPanel = ({
  error,
}: {
  error: State<string | DiagnosticMessage[]>;
}) => {
  return van.derive<ChildDom>(() => {
    if (error.val && typeof error.val === "string") {
      return div({ class: "error", textContent: error.val });
    } else if (error.val && Array.isArray(error.val)) {
      return div(
        { class: "error" },
        error.val.map((e) =>
          div({ class: "error-item" }, e.path, " ", e.range, " ", e.message)
        )
      );
    } else {
      return div();
    }
  }) as any as ChildDom;
  // return div({ class: "error" }, (_dom?: Element) => {
  //   if (error.val && typeof error.val === "string") {
  //     return div({ class: "error", textContent: error.val });
  //   } else if (error.val && Array.isArray(error.val)) {
  //     return div(
  //       { class: "error" },
  //       error.val.map((e) =>
  //         div({ class: "error-item" }, e.path, " ", e.range, " ", e.message)
  //       )
  //     );
  //   }
  //   return div();
  // });
};
