export function makeId(prefix, index, width = 3) {
  const number = Number(index);
  const safeNumber = Number.isFinite(number) ? Math.max(1, Math.trunc(number)) : 1;
  return `${prefix}-${String(safeNumber).padStart(width, "0")}`;
}

export function makeObjectiveId(index) {
  return makeId("O", index, 3);
}

export function makeIntentId(index) {
  return makeId("I", index, 3);
}

export function makeItemId(index) {
  return makeId("Q", index, 3);
}

export function makeSectionId(index) {
  return makeId("S", index, 2);
}
