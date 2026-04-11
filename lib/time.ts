const BUSINESS_TIMEZONE = "America/Denver";

export function getMonthYearForDate(date: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    month: "numeric",
    year: "numeric"
  }).formatToParts(date);

  const month = Number(parts.find((part) => part.type === "month")?.value ?? 1);
  const year = Number(parts.find((part) => part.type === "year")?.value ?? new Date().getFullYear());

  return { month, year };
}

export function getCurrentMonthYear() {
  return getMonthYearForDate();
}

export function formatMonthYear(month: number, year: number) {
  const date = new Date(Date.UTC(year, month - 1, 1));
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}

export function monthKey(month: number, year: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export { BUSINESS_TIMEZONE };
