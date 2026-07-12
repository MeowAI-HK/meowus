export { clearSMEPostAuth, readSMEPostAuth, writeSMEPostAuth };
export type { SMEPostAuthState } from "@/features/smepost/storage";
export { smepostBaseUrl } from "@/features/smepost/client";

import { smepostClient } from "@/features/smepost/client";
import type { SMEPostAuthState } from "@/features/smepost/storage";
import { clearSMEPostAuth, readSMEPostAuth, writeSMEPostAuth } from "@/features/smepost/storage";

export function callSMEPost<T>(
  auth: SMEPostAuthState,
  pathName: string,
  init: RequestInit = {},
): Promise<T> {
  return smepostClient.callCommand<T>(auth, pathName, init);
}
