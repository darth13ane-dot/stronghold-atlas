const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const entities = (value) => Array.isArray(value) && value.every((item) => record(item) && typeof item.id === "string");

function same(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((item, index) => same(item, b[index]));
  if (record(a) && record(b)) {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && same(a[key], b[key]));
  }
  return false;
}

// Entity IDs keep unrelated insertions and removals independent of array positions.
export function stateChanges(before, after, path = []) {
  if (same(before, after)) return [];
  if (entities(before) && entities(after)) {
    const oldItems = new Map(before.map((item) => [item.id, item]));
    const newItems = new Map(after.map((item) => [item.id, item]));
    return [...new Set([...oldItems.keys(), ...newItems.keys()])].flatMap((id) =>
      stateChanges(oldItems.get(id), newItems.get(id), [...path, { id }]),
    );
  }
  if (record(before) && record(after)) {
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap((key) =>
      stateChanges(before[key], after[key], [...path, key]),
    );
  }
  return [{ path, before, after }];
}

export function reverseChanges(changes) {
  return [...changes].reverse().map(({ path, before, after }) => ({ path, before: after, after: before }));
}

function child(value, key) {
  return typeof key === "object" ? value?.find?.((item) => item.id === key.id) : value?.[key];
}

export function applyChanges(current, changes) {
  let state = structuredClone(current);
  const conflicts = [];
  const applied = [];
  for (const change of changes) {
    const { path, before, after } = change;
    let parent = state;
    for (const key of path.slice(0, -1)) parent = child(parent, key);
    const key = path.at(-1);
    const value = path.length ? child(parent, key) : state;
    if (same(value, after)) continue;
    if ((path.length && parent == null) || !same(value, before)) {
      conflicts.push(change);
      continue;
    }
    if (!path.length) {
      state = structuredClone(after);
    } else if (typeof key === "object") {
      const index = parent.findIndex((item) => item.id === key.id);
      if (after === undefined) parent.splice(index, 1);
      else if (index < 0) parent.push(structuredClone(after));
      else parent[index] = structuredClone(after);
    } else if (after === undefined) {
      delete parent[key];
    } else {
      parent[key] = structuredClone(after);
    }
    applied.push(change);
  }
  // Concurrent floor deletion and room placement must not strand objects off-plan.
  if (state.floors) {
    const floorIds = new Set(state.floors.map((floor) => floor.id));
    const objects = [...(state.rooms ?? []), ...(state.layoutObjects ?? [])];
    if (!floorIds.size || objects.some((item) => !floorIds.has(item.floorId ?? "ground"))) {
      return { state: current, applied: [], conflicts: [...conflicts, ...applied] };
    }
  }
  return { state, applied, conflicts };
}
