export type ConcreteTypstVersion =
  | "v0.13.0"
  | "v0.13.1"
  | "v0.14.0"
  | "v0.14.1"
  | "v0.14.2"
  | "v0.15.0";

export type RequestedTypstVersion = ConcreteTypstVersion | "latest";

export type TypstRuntimeId =
  | "0.13"
  | "0.14.0"
  | "0.14.1"
  | "0.14.2"
  | "0.15.0";

export interface TypstVersionConfig {
  concreteVersion: ConcreteTypstVersion;
  requestedVersion: RequestedTypstVersion;
  runtime: TypstRuntimeId;
}

export const DEFAULT_TYPST_VERSION: RequestedTypstVersion = "latest";
export const LATEST_TYPST_VERSION: ConcreteTypstVersion = "v0.15.0";

const VERSION_CONFIGS: Record<RequestedTypstVersion, TypstVersionConfig> = {
  "v0.13.0": {
    concreteVersion: "v0.13.0",
    requestedVersion: "v0.13.0",
    runtime: "0.13",
  },
  "v0.13.1": {
    concreteVersion: "v0.13.1",
    requestedVersion: "v0.13.1",
    runtime: "0.13",
  },
  "v0.14.0": {
    concreteVersion: "v0.14.0",
    requestedVersion: "v0.14.0",
    runtime: "0.14.0",
  },
  "v0.14.1": {
    concreteVersion: "v0.14.1",
    requestedVersion: "v0.14.1",
    runtime: "0.14.1",
  },
  "v0.14.2": {
    concreteVersion: "v0.14.2",
    requestedVersion: "v0.14.2",
    runtime: "0.14.2",
  },
  "v0.15.0": {
    concreteVersion: "v0.15.0",
    requestedVersion: "v0.15.0",
    runtime: "0.15.0",
  },
  latest: {
    concreteVersion: LATEST_TYPST_VERSION,
    requestedVersion: "latest",
    runtime: "0.15.0",
  },
};

export const SUPPORTED_TYPST_VERSIONS = Object.keys(
  VERSION_CONFIGS
) as RequestedTypstVersion[];

export function supportedTypstVersionLabel() {
  return SUPPORTED_TYPST_VERSIONS.map((v) => `"${v}"`).join(", ");
}

export function resolveTypstVersion(
  version: string | undefined
): TypstVersionConfig {
  const requested = version || DEFAULT_TYPST_VERSION;
  if (Object.prototype.hasOwnProperty.call(VERSION_CONFIGS, requested)) {
    return VERSION_CONFIGS[requested as RequestedTypstVersion];
  }

  throw new Error(
    `invalid version: ${requested}, expected ${supportedTypstVersionLabel()}`
  );
}
