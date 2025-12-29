export function nextRandom(seed) {
    let x = seed >>> 0;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    const nextSeed = (x >>> 0) || 1;
    const value = nextSeed / 0xffffffff;
    return { value, nextSeed };
}
