import { createLensClient } from "@broberg/lens-client";
import type { LensClient, LensClientOptions } from "@broberg/lens-client";

/**
 * The single choke-point where StoreForm constructs a Lens client (reuse-first:
 * the ONE place we talk to hosted/local Lens — never a raw fetch elsewhere).
 * With no args, baseUrl/token default from env (LENS_CLOUD_URL /
 * LENS_CLOUD_TOKEN). Pass `{ baseUrl }` to drive the local daemon (no token).
 */
export function getLensClient(overrides: LensClientOptions = {}): LensClient {
  return createLensClient(overrides);
}
