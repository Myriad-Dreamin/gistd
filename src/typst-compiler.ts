import type { DiagnosticMessage } from "./error";

type ChangeKind = "new" | "diff-v1";

export interface TypstCompileResult {
  changeKind: ChangeKind;
  diagnostics: DiagnosticMessage[];
  hasError: boolean;
  pdfpc?: unknown;
  title?: string;
  vector?: unknown;
}

export interface CompileTypstOptions {
  mainFilePath: string;
  queryPdfpc: boolean;
}

export async function compileTypstDocument(
  $typst: any,
  { mainFilePath, queryPdfpc }: CompileTypstOptions
): Promise<TypstCompileResult> {
  const compiler = await $typst.getCompiler();

  if ("runWithWorld" in compiler) {
    return compileWithWorldCompiler(compiler, { mainFilePath, queryPdfpc });
  }

  return compileWithLegacyCompiler(compiler, { mainFilePath, queryPdfpc });
}

async function compileWithWorldCompiler(
  compiler: any,
  { mainFilePath, queryPdfpc }: CompileTypstOptions
): Promise<TypstCompileResult> {
  await compiler.reset();

  let result: TypstCompileResult | undefined;
  await compiler.runWithWorld({ mainFilePath }, async (world: any) => {
    const compileResult = (await world.compile()) as {
      hasError?: boolean;
      diagnostics?: DiagnosticMessage[];
    };
    const diagnostics = compileResult.diagnostics || [];
    const hasError =
      compileResult.hasError ||
      (compileResult.hasError === undefined && diagnostics.length > 0);

    if (hasError) {
      result = {
        changeKind: "new",
        diagnostics,
        hasError: true,
      };
      return;
    }

    const vectorResult = (await world.vector()) as {
      result: unknown;
      diagnostics?: DiagnosticMessage[];
    };
    const vectorDiagnostics = vectorResult.diagnostics || [];
    if (vectorDiagnostics.length > 0) {
      result = {
        changeKind: "new",
        diagnostics: vectorDiagnostics,
        hasError: true,
      };
      return;
    }

    result = {
      changeKind: "new",
      diagnostics: [],
      hasError: false,
      pdfpc: queryPdfpc ? await queryPdfpcInWorld(world) : undefined,
      title: typeof world.title === "function" ? world.title() : undefined,
      vector: vectorResult.result,
    };
  });

  if (!result) {
    throw new Error("compiler finished without a result");
  }
  return result;
}

async function compileWithLegacyCompiler(
  compiler: any,
  { mainFilePath, queryPdfpc }: CompileTypstOptions
): Promise<TypstCompileResult> {
  const { result: vector, diagnostics = [] } = await compiler.compile({
    mainFilePath,
    diagnostics: "full",
  });

  if (diagnostics.length > 0) {
    return {
      changeKind: "diff-v1",
      diagnostics,
      hasError: true,
    };
  }

  return {
    changeKind: "diff-v1",
    diagnostics: [],
    hasError: false,
    pdfpc: queryPdfpc
      ? await queryPdfpcInLegacyCompiler(compiler, mainFilePath)
      : undefined,
    vector,
  };
}

async function queryPdfpcInWorld(world: any) {
  try {
    return await world.query({
      selector: "<pdfpc>",
    });
  } catch (e) {
    console.log("this slide does not have pdfpc");
    return undefined;
  }
}

async function queryPdfpcInLegacyCompiler(compiler: any, mainFilePath: string) {
  try {
    return await compiler.query({
      mainFilePath,
      selector: "<pdfpc>",
    });
  } catch (e) {
    console.log("this slide does not have pdfpc");
    return undefined;
  }
}
