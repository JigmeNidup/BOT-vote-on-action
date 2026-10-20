export function shortAddress(address: string) {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function formatTime(seconds: bigint | number) {
  const value = typeof seconds === "bigint" ? Number(seconds) : seconds;
  if (!value) return "—";
  return new Date(value * 1000).toLocaleString();
}

export function sameAddress(left?: string, right?: string) {
  if (!left || !right) return false;
  return left.toLowerCase() === right.toLowerCase();
}
