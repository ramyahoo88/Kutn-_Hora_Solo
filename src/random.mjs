const UINT32_RANGE = 0x100000000;

function randomUint32(generator) {
  // Advance a full-period 32-bit counter and mix it with the MurmurHash3 finalizer.
  generator.rng = (generator.rng + 0x9e3779b9) >>> 0;
  let value = generator.rng;
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
  return (value ^ (value >>> 16)) >>> 0;
}

export function randomIndex(generator, length) {
  // Reject the incomplete bucket so every index has the same number of inputs.
  const limit = UINT32_RANGE - UINT32_RANGE % length;
  let value;
  do {
    value = randomUint32(generator);
  } while (value >= limit);
  return value % length;
}

export function shuffle(generator, items) {
  const order = [...items];
  for (let i = order.length - 1; i > 0; i--) {
    const pick = randomIndex(generator, i + 1);
    [order[i], order[pick]] = [order[pick], order[i]];
  }
  return order;
}
