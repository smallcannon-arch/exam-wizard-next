// 依權重把整數名額分配到各類別（最大餘數法），並可交錯排列成序列，
// 讓題型、配分等能平均分散到整卷。純函式，不依賴 DOM。

export function largestRemainder(total, weights) {
  const safeTotal = Number.isInteger(total) && total > 0 ? total : 0;
  const cleaned = (Array.isArray(weights) ? weights : [])
    .map((entry) => ({ key: entry?.key, weight: Number(entry?.weight) }))
    .filter((entry) => entry.key != null && Number.isFinite(entry.weight) && entry.weight > 0);

  if (safeTotal === 0 || cleaned.length === 0) {
    return cleaned.map((entry) => ({ key: entry.key, count: 0 }));
  }

  const sum = cleaned.reduce((accumulator, entry) => accumulator + entry.weight, 0);
  const rows = cleaned.map((entry) => {
    const exact = (safeTotal * entry.weight) / sum;
    const count = Math.floor(exact);
    return { key: entry.key, count, fraction: exact - count };
  });

  const remaining = safeTotal - rows.reduce((accumulator, row) => accumulator + row.count, 0);
  const byFraction = [...rows].sort(
    (a, b) => b.fraction - a.fraction || String(a.key).localeCompare(String(b.key)),
  );
  for (let index = 0; index < remaining; index += 1) {
    byFraction[index % byFraction.length].count += 1;
  }

  return rows.map((row) => ({ key: row.key, count: row.count }));
}

export function interleaveByCounts(counts) {
  const schedule = (Array.isArray(counts) ? counts : [])
    .map((entry) => ({ key: entry?.key, target: Number(entry?.count) || 0, acc: 0, placed: 0 }))
    .filter((entry) => entry.target > 0);

  const total = schedule.reduce((accumulator, entry) => accumulator + entry.target, 0);
  const sequence = [];

  for (let step = 0; step < total; step += 1) {
    for (const entry of schedule) entry.acc += entry.target;

    let pick = null;
    for (const entry of schedule) {
      if (entry.placed < entry.target && (pick === null || entry.acc > pick.acc)) {
        pick = entry;
      }
    }

    pick.acc -= total;
    pick.placed += 1;
    sequence.push(pick.key);
  }

  return sequence;
}

export function buildProportionalSequence(total, weights) {
  return interleaveByCounts(largestRemainder(total, weights));
}
