import { useEffect, useState } from "react";

const STORAGE_PREFIX = "stronghold-atlas:floor-view:v1:";

function readFloor(scope) {
  if (!scope) return null;
  try {
    return window.localStorage.getItem(`${STORAGE_PREFIX}${scope}`);
  } catch {
    return null;
  }
}

// Navigation belongs to this browser view, never to the shared plan or its undo history.
export function useFloorView(floors, scope) {
  const [selection, setSelection] = useState(() => ({ scope, floorId: readFloor(scope) }));
  const activeFloorId = floors.some((floor) => floor.id === selection.floorId)
    ? selection.floorId
    : floors[0]?.id ?? "ground";
  if (selection.scope !== scope) {
    setSelection({ scope, floorId: readFloor(scope) });
  } else if (selection.floorId !== activeFloorId) {
    // A removed floor falls back permanently, including if another user restores it.
    setSelection({ scope, floorId: activeFloorId });
  }

  useEffect(() => {
    if (!scope) return;
    try {
      window.localStorage.setItem(`${STORAGE_PREFIX}${scope}`, activeFloorId);
    } catch {
      // Browsing still works when storage is unavailable.
    }
  }, [activeFloorId, scope]);

  return [activeFloorId, (floorId) => setSelection({ scope, floorId })];
}
