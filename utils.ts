import type { Refueling } from './types';

const BR_TIMEZONE = 'America/Sao_Paulo';

export const formatCurrency = (value: number): string => {
  const number = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number);
};

export const formatNumber = (value: number): string => {
  const number = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number);
};

export const formatDate = (dateString: string): string => {
  if (!dateString) return 'Data Inválida';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'Data Inválida';
  return date.toLocaleDateString('pt-BR', { timeZone: BR_TIMEZONE });
};

export const getInitials = (name: string): string => {
  if (!name) return '??';
  const parts = name.split(' ').filter(part => part.length > 0);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const getDateOnlyString = (isoString: string): string => {
  try {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-CA', { timeZone: BR_TIMEZONE });
  } catch {
    return '';
  }
};

export const parseNumericValue = (value: unknown): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isNaN(value) ? 0 : value;

  let normalized = String(value).trim();
  if (!normalized || ['-', '--', 'N/A', 'null', 'undefined'].includes(normalized)) return 0;

  normalized = normalized.replace(/R\$/gi, '').replace(/\$/g, '').trim();
  if (!normalized || normalized === '-' || normalized === '.') return 0;

  if (normalized.includes('.') && normalized.includes(',')) {
    normalized = normalized.lastIndexOf(',') > normalized.lastIndexOf('.')
      ? normalized.replace(/\./g, '').replace(',', '.')
      : normalized.replace(/,/g, '');
  } else if (normalized.includes(',')) {
    normalized = normalized.replace(',', '.');
  }

  normalized = normalized.replace(/[^0-9.-]/g, '');
  if (!normalized || normalized === '-' || normalized === '.') return 0;

  const number = Number.parseFloat(normalized);
  return Number.isNaN(number) ? 0 : number;
};

export const calculateVolumeAndTotal = (
  rawVolume: number,
  rawTotal: number,
  rawPrice: number,
  initialReading: number,
  finalReading: number
): { volume: number; valorTotal: number; precoUnitario: number } => {
  let volume = rawVolume > 0 ? rawVolume : 0;
  let valorTotal = rawTotal > 0 ? rawTotal : 0;
  let precoUnitario = rawPrice > 0 ? rawPrice : 0;

  if (volume <= 0 && finalReading > 0 && initialReading > 0 && finalReading >= initialReading) {
    volume = Math.round((finalReading - initialReading) * 10000) / 10000;
  }
  if (volume <= 0 && valorTotal > 0 && precoUnitario > 0) {
    volume = Math.round((valorTotal / precoUnitario) * 10000) / 10000;
  }
  if (valorTotal <= 0 && volume > 0 && precoUnitario > 0) {
    valorTotal = Math.round((volume * precoUnitario) * 100) / 100;
  }
  if (precoUnitario <= 0 && volume > 0 && valorTotal > 0) {
    precoUnitario = Math.round((valorTotal / volume) * 10000) / 10000;
  }
  if (valorTotal <= 0 && volume > 0 && precoUnitario > 0) {
    valorTotal = Math.round((volume * precoUnitario) * 100) / 100;
  }

  return {
    volume: Number.isNaN(volume) ? 0 : volume,
    valorTotal: Number.isNaN(valorTotal) ? 0 : valorTotal,
    precoUnitario: Number.isNaN(precoUnitario) ? 0 : precoUnitario,
  };
};

export const normalizeHeader = (header: string): string => String(header || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9_]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

export const parseDelimitedText = (text: string, delimiter: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (inQuotes && text[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (character === delimiter && !inQuotes) {
      row.push(current.trim());
      current = '';
    } else if ((character === '\n' || character === '\r') && !inQuotes) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(current.trim());
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
      current = '';
    } else {
      current += character;
    }
  }

  row.push(current.trim());
  if (row.some(value => value !== '')) rows.push(row);
  return rows;
};

export const countDelimiterOutsideQuotes = (line: string, delimiter: string): number => {
  let count = 0;
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === '"') {
      if (inQuotes && line[index + 1] === '"') index += 1;
      else inQuotes = !inQuotes;
    } else if (!inQuotes && line[index] === delimiter) {
      count += 1;
    }
  }
  return count;
};

export const findCol = (
  row: Record<string, string>,
  values: string[],
  aliases: string[],
  fallbackIndex?: number
): string => {
  for (const alias of aliases) {
    const value = row[normalizeHeader(alias)];
    if (value !== undefined && value !== '') return value;
  }
  if (fallbackIndex !== undefined && fallbackIndex < values.length) return values[fallbackIndex] || '';
  return '';
};

const isValidDateParts = (year: number, month: number, day: number, hour: number, minute: number, second: number): boolean => {
  const date = new Date(year, month, day, hour, minute, second);
  return date.getFullYear() === year
    && date.getMonth() === month
    && date.getDate() === day
    && date.getHours() === hour
    && date.getMinutes() === minute
    && date.getSeconds() === second;
};

export const parseDateRobust = (value: unknown): string => {
  if (!value) return '';
  const normalized = String(value).trim();
  if (!normalized) return '';

  const dayFirstMatch = normalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:[\sT]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (dayFirstMatch) {
    const day = Number.parseInt(dayFirstMatch[1], 10);
    const month = Number.parseInt(dayFirstMatch[2], 10) - 1;
    let year = Number.parseInt(dayFirstMatch[3], 10);
    if (year < 100) year += 2000;
    const hour = dayFirstMatch[4] ? Number.parseInt(dayFirstMatch[4], 10) : 0;
    const minute = dayFirstMatch[5] ? Number.parseInt(dayFirstMatch[5], 10) : 0;
    const second = dayFirstMatch[6] ? Number.parseInt(dayFirstMatch[6], 10) : 0;
    return isValidDateParts(year, month, day, hour, minute, second)
      ? new Date(year, month, day, hour, minute, second).toISOString()
      : '';
  }

  const yearFirstMatch = normalized.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:[\sT]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (yearFirstMatch) {
    const year = Number.parseInt(yearFirstMatch[1], 10);
    const month = Number.parseInt(yearFirstMatch[2], 10) - 1;
    const day = Number.parseInt(yearFirstMatch[3], 10);
    const hour = yearFirstMatch[4] ? Number.parseInt(yearFirstMatch[4], 10) : 0;
    const minute = yearFirstMatch[5] ? Number.parseInt(yearFirstMatch[5], 10) : 0;
    const second = yearFirstMatch[6] ? Number.parseInt(yearFirstMatch[6], 10) : 0;
    return isValidDateParts(year, month, day, hour, minute, second)
      ? new Date(year, month, day, hour, minute, second).toISOString()
      : '';
  }

  const fallback = new Date(normalized);
  return Number.isNaN(fallback.getTime()) ? '' : fallback.toISOString();
};

export const extractDateTime = (value: unknown): { dateIso: string; horaStr: string } => {
  if (!value) return { dateIso: '', horaStr: '' };
  const normalized = String(value).trim();
  const timeMatch = normalized.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
  let horaStr = '';

  if (timeMatch) {
    const parts = timeMatch[1].split(':');
    if (parts[0].length === 1) parts[0] = `0${parts[0]}`;
    if (parts.length === 2) parts.push('00');
    horaStr = parts.join(':');
  }

  return { dateIso: parseDateRobust(normalized), horaStr };
};

export const getRefuelingFingerprint = (item: Refueling): string => [
  item.registro || '',
  item.data,
  item.hora || '',
  item.bico,
  item.id_frentista,
  item.enc_inicial ?? '',
  item.enc_final ?? '',
  item.litros,
  item.valor
].join('|').toLowerCase();

export const sumRefuelingTotals = (
  items: Array<Pick<Refueling, 'litros' | 'valor'>>
): { volume: number; total: number } => items.reduce(
  (accumulator, item) => ({
    volume: accumulator.volume + parseNumericValue(item.litros),
    total: accumulator.total + parseNumericValue(item.valor)
  }),
  { volume: 0, total: 0 }
);

export const createStableId = (fingerprint: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < fingerprint.length; index += 1) {
    hash ^= fingerprint.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `abast-${(hash >>> 0).toString(36)}`;
};

export const isMeaningfulRefueling = (item: Refueling): boolean => Boolean(
  item.data
  && item.bico
  && item.bico !== 'B?'
  && (item.litros > 0 || item.valor > 0 || (item.enc_final ?? 0) > 0)
);

export const normalizePersistedRefuelings = (value: unknown): Refueling[] => {
  if (!Array.isArray(value)) return [];

  return value.map((item, index) => {
    const initialReading = parseNumericValue(item.enc_inicial);
    const finalReading = parseNumericValue(item.enc_final);
    const rawVolume = item.rawVolumeOriginal !== undefined ? parseNumericValue(item.rawVolumeOriginal) : parseNumericValue(item.litros);
    const rawTotal = item.rawTotalOriginal !== undefined ? parseNumericValue(item.rawTotalOriginal) : parseNumericValue(item.valor);
    const rawPrice = item.rawPrecoOriginal !== undefined ? parseNumericValue(item.rawPrecoOriginal) : parseNumericValue(item.preco_unitario);
    const { volume, valorTotal, precoUnitario } = calculateVolumeAndTotal(rawVolume, rawTotal, rawPrice, initialReading, finalReading);

    return {
      ...item,
      linhaPlanilha: item.linhaPlanilha || index + 2,
      registro: item.registro || '',
      litros: volume,
      valor: valorTotal,
      preco_unitario: precoUnitario,
      enc_inicial: initialReading,
      enc_final: finalReading,
      origemVolumeVazio: item.origemVolumeVazio !== undefined ? item.origemVolumeVazio : rawVolume <= 0,
      origemTotalVazio: item.origemTotalVazio !== undefined ? item.origemTotalVazio : rawTotal <= 0,
      origemPrecoVazio: item.origemPrecoVazio !== undefined ? item.origemPrecoVazio : rawPrice <= 0,
      rawVolumeOriginal: rawVolume,
      rawTotalOriginal: rawTotal,
      rawPrecoOriginal: rawPrice
    } as Refueling;
  });
};
