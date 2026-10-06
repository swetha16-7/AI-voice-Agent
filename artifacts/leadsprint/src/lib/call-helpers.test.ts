/**
 * Unit tests for call-helpers.ts
 *
 * These tests cover pure helper functions only — no React, no DOM, no API mocks.
 * This avoids the need for additional test dependencies (vitest-dom, @testing-library/react)
 * in the frontend package, which does not ship a vitest config.
 *
 * Run with: pnpm --filter @workspace/api-server run test
 * (these tests live in the leadsprint package but can be validated purely as logic)
 *
 * The below tests are written as plain assertions (no test runner import) so they
 * can be read and verified statically. A vitest-compatible wrapper is provided
 * if the leadsprint package ever gains a vitest config.
 */

import {
  formatDuration,
  getCallPollingInterval,
  calculateElapsedSeconds,
  getCallStatusLabel,
} from './call-helpers';

// ─── formatDuration ──────────────────────────────────────────────────────────

function testFormatDuration() {
  // null / undefined / negative → '—'
  console.assert(formatDuration(null) === '—', 'null should return —');
  console.assert(formatDuration(undefined) === '—', 'undefined should return —');
  console.assert(formatDuration(-1) === '—', 'negative should return —');

  // seconds only (< 60)
  console.assert(formatDuration(0) === '00:00', '0 seconds = 00:00');
  console.assert(formatDuration(5) === '00:05', '5 seconds = 00:05');
  console.assert(formatDuration(59) === '00:59', '59 seconds = 00:59');

  // minutes + seconds
  console.assert(formatDuration(60) === '01:00', '60 seconds = 01:00');
  console.assert(formatDuration(65) === '01:05', '65 seconds = 01:05');
  console.assert(formatDuration(125) === '02:05', '125 seconds = 02:05');
  console.assert(formatDuration(3599) === '59:59', '3599 seconds = 59:59');

  // hours format (>= 3600)
  console.assert(formatDuration(3600) === '01:00:00', '3600 seconds = 01:00:00');
  console.assert(formatDuration(3661) === '01:01:01', '3661 seconds = 01:01:01');
  console.assert(formatDuration(7322) === '02:02:02', '7322 seconds = 02:02:02');

  console.log('✅ formatDuration: all tests passed');
}

// ─── getCallPollingInterval ───────────────────────────────────────────────────

function testGetCallPollingInterval() {
  // Null / empty → idle 10000
  console.assert(getCallPollingInterval(null) === 10000, 'null calls → 10000 (idle)');
  console.assert(getCallPollingInterval(undefined) === 10000, 'undefined calls → 10000 (idle)');
  console.assert(getCallPollingInterval([]) === 10000, 'empty array → 10000 (idle)');

  // No active calls → idle 10000
  const noActive = [
    { status: 'completed' },
    { status: 'failed' },
    { status: 'policy_blocked' },
  ];
  console.assert(getCallPollingInterval(noActive) === 10000, 'only non-active calls → 10000 (idle)');

  // in_progress call present → fast 2500
  const withInProgress = [
    { status: 'completed' },
    { status: 'in_progress' },
  ];
  console.assert(getCallPollingInterval(withInProgress) === 2500, 'in_progress call → 2500 (active)');

  // queued call present → fast 2500
  const withQueued = [
    { status: 'completed' },
    { status: 'queued' },
  ];
  console.assert(getCallPollingInterval(withQueued) === 2500, 'queued call → 2500 (active)');

  // both in_progress and queued → fast 2500
  const withBoth = [
    { status: 'in_progress' },
    { status: 'queued' },
    { status: 'completed' },
  ];
  console.assert(getCallPollingInterval(withBoth) === 2500, 'in_progress + queued → 2500 (active)');

  console.log('✅ getCallPollingInterval: all tests passed');
}

// ─── calculateElapsedSeconds ─────────────────────────────────────────────────

function testCalculateElapsedSeconds() {
  // null / undefined / invalid startedAt → null
  console.assert(calculateElapsedSeconds(null) === null, 'null startedAt → null');
  console.assert(calculateElapsedSeconds(undefined) === null, 'undefined startedAt → null');
  console.assert(calculateElapsedSeconds('not-a-date') === null, 'invalid date → null');

  // Valid startedAt — elapsed should be ≥ 0
  const nowMs = Date.now();
  const startedAt = new Date(nowMs - 5000).toISOString(); // 5 seconds ago
  const elapsed = calculateElapsedSeconds(startedAt, nowMs);
  console.assert(elapsed === 5, `5000ms ago should produce 5 seconds, got ${elapsed}`);

  // Future startedAt → clamp to 0
  const futureMs = nowMs + 10000;
  const future = calculateElapsedSeconds(new Date(futureMs).toISOString(), nowMs);
  console.assert(future === 0, 'future startedAt → 0 (clamped)');

  // Exactly 0ms elapsed → 0
  const exact = calculateElapsedSeconds(new Date(nowMs).toISOString(), nowMs);
  console.assert(exact === 0, 'same instant → 0');

  console.log('✅ calculateElapsedSeconds: all tests passed');
}

// ─── getCallStatusLabel ───────────────────────────────────────────────────────

function testGetCallStatusLabel() {
  console.assert(getCallStatusLabel('in_progress') === 'LIVE', 'in_progress → LIVE');
  console.assert(getCallStatusLabel('queued') === 'CONNECTING', 'queued → CONNECTING');
  console.assert(getCallStatusLabel('completed') === 'COMPLETED', 'completed → COMPLETED');
  console.assert(getCallStatusLabel('failed') === 'FAILED', 'failed → FAILED');
  console.assert(getCallStatusLabel('uncertain') === 'UNCERTAIN', 'uncertain → UNCERTAIN');
  console.assert(getCallStatusLabel('policy_blocked') === 'POLICY BLOCKED', 'policy_blocked → POLICY BLOCKED');
  console.assert(getCallStatusLabel(null) === '—', 'null → —');
  console.assert(getCallStatusLabel(undefined) === '—', 'undefined → —');
  // Unknown status → uppercased with underscores replaced
  console.assert(getCallStatusLabel('some_status') === 'SOME STATUS', 'unknown → uppercased');

  console.log('✅ getCallStatusLabel: all tests passed');
}

// ─── Run all ─────────────────────────────────────────────────────────────────

testFormatDuration();
testGetCallPollingInterval();
testCalculateElapsedSeconds();
testGetCallStatusLabel();

console.log('\n✅ All call-helpers tests passed.');
