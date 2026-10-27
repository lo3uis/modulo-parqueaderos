// ============================================================
// CALENDARIO REGLAMENTARIO DE SORTEO POR FESTIVIDADES DE FIN DE AÑO
// ============================================================
// Regla PRP v2:
// Por festividades de fin de año:
// 1. Publicación de inscripciones a parqueaderos: Último jueves del mes de noviembre.
// 2. Realización del sorteo: Segundo jueves del mes de diciembre.
// 3. Vigencia adjudicada: Primer trimestre del año siguiente (Q1).
// ============================================================

export interface HolidaySchedule {
  year: number;
  targetPeriod: string;
  publicationDate: Date;
  publicationIso: string;
  publicationFormatted: string;
  raffleDate: Date;
  raffleIso: string;
  raffleFormatted: string;
  quarterStart: string;
  quarterEnd: string;
  ruleSummary: string;
}

export function getYearEndRaffleSchedule(year: number = 2026): HolidaySchedule {
  // 1. Último jueves de noviembre (mes 10 en JS)
  let lastThursdayNov: Date | null = null;
  for (let day = 30; day >= 20; day--) {
    const d = new Date(year, 10, day);
    if (d.getDay() === 4) { // 4 = Jueves
      lastThursdayNov = d;
      break;
    }
  }

  // 2. Segundo jueves de diciembre (mes 11 en JS)
  const thursdaysDec: Date[] = [];
  for (let day = 1; day <= 20; day++) {
    const d = new Date(year, 11, day);
    if (d.getDay() === 4) {
      thursdaysDec.push(d);
    }
  }
  const secondThursdayDec = thursdaysDec[1] || thursdaysDec[0];

  const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

  const formatFull = (d: Date) => {
    const parts = d.toLocaleDateString('es-CO', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return capitalize(parts);
  };

  const isoDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const nextYear = year + 1;

  return {
    year,
    targetPeriod: `${nextYear}-Q1`,
    publicationDate: lastThursdayNov!,
    publicationIso: isoDate(lastThursdayNov!),
    publicationFormatted: formatFull(lastThursdayNov!),
    raffleDate: secondThursdayDec,
    raffleIso: isoDate(secondThursdayDec),
    raffleFormatted: formatFull(secondThursdayDec),
    quarterStart: `${nextYear}-01-01`,
    quarterEnd: `${nextYear}-03-31`,
    ruleSummary: `Por festividades de fin de año: Publicación de inscripciones el último jueves de noviembre (${formatFull(lastThursdayNov!)}) y sorteo oficial el segundo jueves de diciembre (${formatFull(secondThursdayDec)}). Vigencia para ${nextYear}-Q1.`,
  };
}
