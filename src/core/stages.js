// Этапы уровня: по 20 ребусов подряд, хвост короче 10 присоединяется к предыдущему.
export const STAGE_SIZE = 20;
export function chunkStages(items) {
  const out = [];
  for (let i = 0; i < items.length; i += STAGE_SIZE) out.push(items.slice(i, i + STAGE_SIZE));
  if (out.length > 1 && out[out.length - 1].length < STAGE_SIZE / 2) out[out.length - 2].push(...out.pop());
  return out;
}
