/**
 * RootOverlays — mounts every global blocking overlay.
 *
 * Layer: UI
 * Owner: shared/overlays
 *
 * Drop this into every page entry (sidebar, workflow-editor, …). Each child
 * decides when to render itself, so this stays a no-op the vast majority of
 * the time.
 */

import { CloneDetectedOverlay } from './CloneDetectedOverlay';
import { OfflineOverlay } from './OfflineOverlay';

export function RootOverlays() {
  return (
    <>
      <OfflineOverlay />
      <CloneDetectedOverlay />
    </>
  );
}
