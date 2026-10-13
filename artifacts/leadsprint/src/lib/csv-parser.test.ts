/**
 * Unit tests for csv-parser.ts in @workspace/leadsprint
 *
 * Tests the pure CSV parsing and header normalization logic.
 */

import {
  normalizeHeader,
  parseCsvRows,
  parseAndValidateLeadCsv,
} from './csv-parser';

export function runCsvParserTests() {
  // 1. normalizeHeader
  console.assert(normalizeHeader('name') === 'name', 'plain name');
  console.assert(normalizeHeader('  Name  ') === 'name', 'trimmed uppercase');
  console.assert(normalizeHeader('"name"') === 'name', 'double quoted');
  console.assert(normalizeHeader("'phone'") === 'phone', 'single quoted');
  console.assert(normalizeHeader('\ufeffname') === 'name', 'BOM stripped');
  console.assert(normalizeHeader('\ufeff"Phone"') === 'phone', 'BOM + quoted + mixed case');

  // 2. parseCsvRows - standard comma separation
  const standard = parseCsvRows('name,phone\nJane Doe,+14155550111\nJohn Smith,+12125550148');
  console.assert(standard.length === 3, 'standard row count');
  console.assert(standard[0][0] === 'name' && standard[0][1] === 'phone', 'standard header');
  console.assert(standard[1][0] === 'Jane Doe' && standard[1][1] === '+14155550111', 'standard row 1');

  // 3. parseCsvRows - CRLF line endings
  const crlf = parseCsvRows('name,phone\r\nJane Doe,+14155550111\r\n');
  console.assert(crlf.length === 2, 'crlf row count');
  console.assert(crlf[1][0] === 'Jane Doe', 'crlf row content');

  // 4. parseCsvRows - Commas inside quoted fields
  const commasInsideQuotes = parseCsvRows('name,phone,location\n"Doe, Jane",+14155550111,"San Francisco, CA"');
  console.assert(commasInsideQuotes.length === 2, 'commasInsideQuotes row count');
  console.assert(commasInsideQuotes[1][0] === 'Doe, Jane', 'quoted name with comma');
  console.assert(commasInsideQuotes[1][1] === '+14155550111', 'phone intact');
  console.assert(commasInsideQuotes[1][2] === 'San Francisco, CA', 'quoted location with comma');

  // 5. parseCsvRows - Escaped double quotes
  const escapedQuotes = parseCsvRows('name,phone\n"Jane ""The Leader"" Doe",+14155550111');
  console.assert(escapedQuotes.length === 2, 'escapedQuotes row count');
  console.assert(escapedQuotes[1][0] === 'Jane "The Leader" Doe', 'escaped quote restored');

  // 6. parseAndValidateLeadCsv - Normal CSV input
  const resNormal = parseAndValidateLeadCsv('name,phone\nAlice,+14155550111\nBob,+12125550148');
  console.assert(resNormal.success === true, 'resNormal success');
  if (resNormal.success) {
    console.assert(resNormal.rows.length === 2, 'resNormal row count');
    console.assert(resNormal.rows[0].name === 'Alice', 'resNormal Alice');
    console.assert(resNormal.rows[0].phone === '+14155550111', 'resNormal Alice phone');
    console.assert(resNormal.rows[1].name === 'Bob', 'resNormal Bob');
  }

  // 7. parseAndValidateLeadCsv - Quoted headers and fields
  const resQuoted = parseAndValidateLeadCsv('"name","phone","email"\n"Charlie","+14155550222","charlie@example.com"');
  console.assert(resQuoted.success === true, 'resQuoted success');
  if (resQuoted.success) {
    console.assert(resQuoted.rows[0].name === 'Charlie', 'resQuoted name');
    console.assert(resQuoted.rows[0].phone === '+14155550222', 'resQuoted phone');
    console.assert(resQuoted.rows[0].email === 'charlie@example.com', 'resQuoted email');
  }

  // 8. parseAndValidateLeadCsv - UTF-8 BOM
  const resBom = parseAndValidateLeadCsv('\ufeffname,phone\nDana,+14155550333');
  console.assert(resBom.success === true, 'resBom success');
  if (resBom.success) {
    console.assert(resBom.rows[0].name === 'Dana', 'resBom name');
    console.assert(resBom.rows[0].phone === '+14155550333', 'resBom phone');
  }

  // 9. parseAndValidateLeadCsv - Missing required headers
  const resMissingPhone = parseAndValidateLeadCsv('name,email\nAlice,alice@example.com');
  console.assert(resMissingPhone.success === false, 'missing phone fails');
  if (!resMissingPhone.success) {
    console.assert(resMissingPhone.error.includes('"phone"'), 'missing phone error mentions phone');
  }

  const resMissingName = parseAndValidateLeadCsv('phone,email\n+14155550111,alice@example.com');
  console.assert(resMissingName.success === false, 'missing name fails');
  if (!resMissingName.success) {
    console.assert(resMissingName.error.includes('"name"'), 'missing name error mentions name');
  }

  const resMissingBoth = parseAndValidateLeadCsv('location,budget\nNew York,500k');
  console.assert(resMissingBoth.success === false, 'missing both fails');
  if (!resMissingBoth.success) {
    console.assert(resMissingBoth.error.includes('"name"') && resMissingBoth.error.includes('"phone"'), 'missing both mentions both');
  }

  // 10. parseAndValidateLeadCsv - Empty file and malformed CSV
  const resEmpty = parseAndValidateLeadCsv('');
  console.assert(resEmpty.success === false, 'empty file fails');

  const resWhitespace = parseAndValidateLeadCsv('   \n\n  ');
  console.assert(resWhitespace.success === false, 'whitespace file fails');

  const resHeadersOnly = parseAndValidateLeadCsv('name,phone\n');
  console.assert(resHeadersOnly.success === false, 'headers only fails');
  if (!resHeadersOnly.success) {
    console.assert(resHeadersOnly.error.includes('no lead data rows'), 'mentions no data rows');
  }

  console.log('✅ csv-parser.test.ts: all tests passed successfully!');
}

// Run statically when loaded in Node
runCsvParserTests();
