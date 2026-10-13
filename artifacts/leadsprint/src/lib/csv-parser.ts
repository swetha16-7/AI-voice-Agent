/**
 * LeadSprint CSV Parsing and Normalization Utility
 *
 * Implements RFC 4180-compliant CSV parsing:
 * - Strips leading UTF-8 BOM (\uFEFF)
 * - Supports CRLF (\r\n) and LF (\n) line endings
 * - Supports quoted fields containing commas, newlines, and escaped quotes ("")
 * - Normalizes and validates required headers ("name", "phone")
 * - Safe exception handling: never silently swallows errors
 */

export interface ParsedCsvLead {
  name: string;
  phone: string;
  email?: string;
  source?: string;
  campaign?: string;
  project?: string;
  location?: string;
  property_type?: string;
  budget_label?: string;
  timeline?: string;
  [key: string]: string | undefined;
}

export interface CsvParseSuccess {
  success: true;
  rows: ParsedCsvLead[];
  headers: string[];
}

export interface CsvParseFailure {
  success: false;
  error: string;
}

export type CsvParseResult = CsvParseSuccess | CsvParseFailure;

/**
 * Normalizes a header string:
 * - Strips UTF-8 BOM
 * - Strips enclosing single or double quotes
 * - Trims whitespace
 * - Converts to lower-case
 */
export function normalizeHeader(raw: string): string {
  return raw
    .replace(/^\ufeff/, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Parses raw CSV text into a 2D array of string fields.
 * Follows RFC 4180 parsing semantics.
 */
export function parseCsvRows(csvText: string): string[][] {
  const text = csvText.replace(/^\ufeff/, '');
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          currentField += '"';
          i += 2;
          continue;
        } else {
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentField += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
        i++;
        continue;
      } else if (char === '\r') {
        if (i + 1 < text.length && text[i + 1] === '\n') {
          i++;
        }
        currentRow.push(currentField.trim());
        currentField = '';
        if (currentRow.some((val) => val.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        i++;
        continue;
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        currentField = '';
        if (currentRow.some((val) => val.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        i++;
        continue;
      } else {
        currentField += char;
        i++;
        continue;
      }
    }
  }

  // Push remaining field and row if any
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((val) => val.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Parses raw CSV text and validates required headers and data rows.
 */
export function parseAndValidateLeadCsv(csvText: string): CsvParseResult {
  try {
    if (!csvText || !csvText.trim()) {
      return { success: false, error: 'The uploaded CSV file is empty.' };
    }

    const rawRows = parseCsvRows(csvText);
    if (rawRows.length === 0) {
      return { success: false, error: 'The uploaded CSV file contains no readable content.' };
    }

    const headerRow = rawRows[0];
    const headers = headerRow.map(normalizeHeader);

    const nameIndex = headers.indexOf('name');
    const phoneIndex = headers.indexOf('phone');

    if (nameIndex === -1 && phoneIndex === -1) {
      const detected = headers.filter(Boolean).join(', ') || 'none';
      return {
        success: false,
        error: `Missing required columns: "name" and "phone". Detected headers: [${detected}].`,
      };
    }
    if (nameIndex === -1) {
      const detected = headers.filter(Boolean).join(', ') || 'none';
      return {
        success: false,
        error: `Missing required column: "name". Detected headers: [${detected}].`,
      };
    }
    if (phoneIndex === -1) {
      const detected = headers.filter(Boolean).join(', ') || 'none';
      return {
        success: false,
        error: `Missing required column: "phone". Detected headers: [${detected}].`,
      };
    }

    const dataRows = rawRows.slice(1);
    if (dataRows.length === 0) {
      return { success: false, error: 'The CSV file contains a header row but no lead data rows.' };
    }

    const parsedRows: ParsedCsvLead[] = [];
    for (let r = 0; r < dataRows.length; r++) {
      const values = dataRows[r];
      // Skip completely empty lines
      if (values.every((val) => !val)) {
        continue;
      }

      const lead: ParsedCsvLead = {
        name: values[nameIndex] || '',
        phone: values[phoneIndex] || '',
      };

      for (let c = 0; c < headers.length; c++) {
        const headerName = headers[c];
        if (headerName && c !== nameIndex && c !== phoneIndex) {
          const val = values[c];
          if (val !== undefined && val !== '') {
            lead[headerName] = val;
          }
        }
      }

      parsedRows.push(lead);
    }

    if (parsedRows.length === 0) {
      return { success: false, error: 'The CSV file contains no non-empty lead data rows.' };
    }

    return {
      success: true,
      rows: parsedRows,
      headers,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown CSV parsing error';
    return {
      success: false,
      error: `Failed to parse CSV file: ${message}`,
    };
  }
}
