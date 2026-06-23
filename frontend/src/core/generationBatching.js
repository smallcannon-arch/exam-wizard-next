export const SERIAL_BATCHING_DEFAULTS = {
  singleCallLimit: 6,
  maxSerialBatchItems: 12,
  maxItemsPerBatch: 4,
};

function normalizePositiveInteger(value, fallback) {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeOptions(options = {}) {
  return {
    singleCallLimit: normalizePositiveInteger(options.singleCallLimit, SERIAL_BATCHING_DEFAULTS.singleCallLimit),
    maxSerialBatchItems: normalizePositiveInteger(options.maxSerialBatchItems, SERIAL_BATCHING_DEFAULTS.maxSerialBatchItems),
    maxItemsPerBatch: normalizePositiveInteger(options.maxItemsPerBatch, SERIAL_BATCHING_DEFAULTS.maxItemsPerBatch),
  };
}

export function shouldUseSerialBatching(intents = [], options = {}) {
  if (!Array.isArray(intents)) return false;
  const { singleCallLimit, maxSerialBatchItems } = normalizeOptions(options);
  return intents.length > singleCallLimit && intents.length <= maxSerialBatchItems;
}

export function createGenerationBatches(intents = [], options = {}) {
  if (!Array.isArray(intents) || intents.length === 0) return [];
  const { maxItemsPerBatch } = normalizeOptions(options);
  const batchCount = Math.ceil(intents.length / maxItemsPerBatch);

  return Array.from({ length: batchCount }, (_, index) => {
    const start = index * maxItemsPerBatch;
    const batchIntents = intents.slice(start, start + maxItemsPerBatch);
    return {
      batchIndex: index,
      batchNumber: index + 1,
      batchCount,
      startIndex: start,
      requestedCount: batchIntents.length,
      expectedItemIds: batchIntents.map((intent) => String(intent?.itemId || "").trim()).filter(Boolean),
      intents: batchIntents,
    };
  });
}

export function mergeSerialBatchItems({ batches = [], batchItems = [] } = {}) {
  if (!Array.isArray(batches) || !Array.isArray(batchItems) || batches.length !== batchItems.length) {
    return {
      ok: false,
      error: "Batch merge failed because batch result count did not match request count.",
    };
  }

  const merged = [];
  const seenIds = new Set();

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
    const items = batchItems[batchIndex];
    if (!Array.isArray(items) || items.length === 0) {
      return {
        ok: false,
        error: `Batch ${batchIndex + 1} did not return any validated items.`,
      };
    }

    for (const item of items) {
      const itemId = String(item?.itemId || "").trim();
      if (!itemId) {
        return {
          ok: false,
          error: `Batch ${batchIndex + 1} returned an item without itemId.`,
        };
      }

      const key = itemId.toLowerCase();
      if (seenIds.has(key)) {
        return {
          ok: false,
          error: `Batch ${batchIndex + 1} returned duplicate itemId ${itemId}.`,
        };
      }

      seenIds.add(key);
      merged.push(item);
    }
  }

  return { ok: true, items: merged };
}
