export function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function startOfWeek(): Date {
  const today = startOfToday();
  const start = new Date(today);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

export function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export function sumSince<T>(
  items: T[],
  since: Date,
  getDate: (item: T) => Date | null,
  getAmount: (item: T) => number,
): number {
  return items
    .filter((item) => {
      const date = getDate(item);
      return date !== null && date >= since;
    })
    .reduce((sum, item) => sum + getAmount(item), 0);
}
