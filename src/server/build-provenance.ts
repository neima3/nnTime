import "server-only";

import { BUILD_PROVENANCE } from "./build-provenance.generated";

export type BuildProvenance = {
  commit: string;
  builtAt: string | null;
};

/** Build-time embedded provenance (no process.env reads). */
export function getBuildProvenance(): BuildProvenance {
  return {
    commit: BUILD_PROVENANCE.commit,
    builtAt: BUILD_PROVENANCE.builtAt,
  };
}
