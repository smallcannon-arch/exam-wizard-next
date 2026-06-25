export const ASYNC_GENERATION_DEFAULTS = {
  minAsyncItems: 13,
  maxAsyncItems: 50,
  batchSize: 4,
  pollIntervalMs: 3000,
  maxPollMs: 20 * 60 * 1000,
};

const SUCCESS_STATUSES = new Set(["completed", "partial"]);
const FAILURE_STATUSES = new Set(["failed", "partial_failed", "expired"]);

function safeCount(value, fallback = 0) {
  const count = Math.floor(Number(value));
  return Number.isFinite(count) && count >= 0 ? count : fallback;
}

export function shouldUseAsyncGeneration(intents = [], options = {}) {
  if (!Array.isArray(intents)) return false;
  const minAsyncItems = safeCount(options.minAsyncItems, ASYNC_GENERATION_DEFAULTS.minAsyncItems);
  const maxAsyncItems = safeCount(options.maxAsyncItems, ASYNC_GENERATION_DEFAULTS.maxAsyncItems);
  return intents.length >= minAsyncItems && intents.length <= maxAsyncItems;
}

export function createAsyncInitialProgress(totalItems, options = {}) {
  const itemCount = safeCount(totalItems);
  const batchSize = safeCount(options.batchSize, ASYNC_GENERATION_DEFAULTS.batchSize);
  const batchCount = itemCount > 0 ? Math.ceil(itemCount / batchSize) : 0;
  return {
    batchIndex: 0,
    batchCount,
    completedItems: 0,
    currentBatchItems: Math.min(itemCount, batchSize),
  };
}

export function progressFromAsyncStatus(status = {}) {
  const requestedItemCount = safeCount(status.requestedItemCount);
  const batchSize = safeCount(status.batchSize, ASYNC_GENERATION_DEFAULTS.batchSize);
  const batchCount = safeCount(
    status.batchCount,
    requestedItemCount > 0 ? Math.ceil(requestedItemCount / batchSize) : 0,
  );
  const completedBatchCount = Math.min(safeCount(status.completedBatchCount), batchCount);
  const completedItems = Math.min(safeCount(status.completedItemCount), requestedItemCount);
  const rawCurrentBatch = status.currentBatch === null || status.currentBatch === undefined
    ? completedBatchCount + 1
    : safeCount(status.currentBatch, completedBatchCount + 1);
  const currentBatch = batchCount > 0 ? Math.min(Math.max(rawCurrentBatch, 1), batchCount) : 0;
  const remainingItems = Math.max(0, requestedItemCount - completedItems);

  return {
    batchIndex: Math.max(0, currentBatch - 1),
    batchCount,
    completedItems,
    currentBatchItems: Math.min(remainingItems || batchSize, batchSize),
  };
}

export function isAsyncGenerationSuccess(status) {
  return SUCCESS_STATUSES.has(String(status || "").toLowerCase());
}

export function isAsyncGenerationFailure(status) {
  return FAILURE_STATUSES.has(String(status || "").toLowerCase());
}
