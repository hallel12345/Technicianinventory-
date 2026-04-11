export type RegistrationStatus = "MISSING" | "EXPIRED" | "DUE_THIS_MONTH" | "UP_TO_DATE";

export function getRegistrationStatus(input: {
  expirationMonth?: number | null;
  expirationYear?: number | null;
  month: number;
  year: number;
}): RegistrationStatus {
  const { expirationMonth, expirationYear, month, year } = input;

  if (!expirationMonth || !expirationYear) {
    return "MISSING";
  }

  if (expirationYear < year) {
    return "EXPIRED";
  }

  if (expirationYear === year && expirationMonth < month) {
    return "EXPIRED";
  }

  if (expirationYear === year && expirationMonth === month) {
    return "DUE_THIS_MONTH";
  }

  return "UP_TO_DATE";
}

