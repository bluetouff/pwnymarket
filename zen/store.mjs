import {
  closeSync,
  existsSync,
  fchmodSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  statSync,
  writeSync,
} from 'node:fs';
import { dirname } from 'node:path';

import { ACTIVE_MARKET_ID, VOTE_CHOICES } from './security.mjs';

const MAX_LEDGER_BYTES = 64 * 1024 * 1024;
const VOTER_KEY_PATTERN = /^[a-f0-9]{64}$/;

function assertRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record))
    throw new Error('Invalid vote ledger');
  const keys = Object.keys(record).sort();
  if (keys.join(',') !== 'choice,createdAt,marketId,voterKey')
    throw new Error('Invalid vote ledger');
  if (record.marketId !== ACTIVE_MARKET_ID)
    throw new Error('Invalid vote ledger');
  if (!VOTE_CHOICES.has(record.choice)) throw new Error('Invalid vote ledger');
  if (!VOTER_KEY_PATTERN.test(record.voterKey))
    throw new Error('Invalid vote ledger');
  if (!Number.isSafeInteger(record.createdAt) || record.createdAt < 0)
    throw new Error('Invalid vote ledger');
}

export class VoteStore {
  constructor(filePath, { maxBytes = MAX_LEDGER_BYTES } = {}) {
    if (!filePath) throw new Error('Vote ledger path is required');
    if (
      !Number.isSafeInteger(maxBytes) ||
      maxBytes < 1 ||
      maxBytes > MAX_LEDGER_BYTES
    )
      throw new Error('Invalid vote ledger capacity');
    mkdirSync(dirname(filePath), { mode: 0o700, recursive: true });
    this.filePath = filePath;
    this.votes = new Map();
    this.counts = { yes: 0, no: 0 };
    this.maxBytes = maxBytes;
    this.byteLength = 0;
    this.failed = false;

    if (existsSync(filePath)) {
      this.byteLength = statSync(filePath).size;
      if (this.byteLength > maxBytes)
        throw new Error('Vote ledger is too large');
      const contents = readFileSync(filePath, 'utf8');
      if (contents && !contents.endsWith('\n'))
        throw new Error('Vote ledger is truncated');
      for (const line of contents.split('\n')) {
        if (!line) continue;
        const record = JSON.parse(line);
        assertRecord(record);
        const key = `${record.marketId}\0${record.voterKey}`;
        if (this.votes.has(key))
          throw new Error('Duplicate vote ledger record');
        this.votes.set(key, record.choice);
        this.counts[record.choice] += 1;
      }
    }

    this.fileDescriptor = openSync(filePath, 'a', 0o600);
    fchmodSync(this.fileDescriptor, 0o600);
  }

  close() {
    if (this.fileDescriptor === null) return;
    closeSync(this.fileDescriptor);
    this.fileDescriptor = null;
  }

  record(marketId, voterKey, choice) {
    if (this.failed || this.fileDescriptor === null)
      throw new Error('Vote storage unavailable');
    const key = `${marketId}\0${voterKey}`;
    if (this.votes.has(key)) return false;
    const record = { choice, createdAt: Date.now(), marketId, voterKey };
    assertRecord(record);
    const line = Buffer.from(`${JSON.stringify(record)}\n`, 'utf8');
    if (this.byteLength + line.length > this.maxBytes)
      throw new Error('Vote ledger capacity reached');
    try {
      let offset = 0;
      while (offset < line.length) {
        const written = writeSync(
          this.fileDescriptor,
          line,
          offset,
          line.length - offset,
        );
        if (written < 1) throw new Error('Incomplete ledger write');
        offset += written;
      }
      fsyncSync(this.fileDescriptor);
    } catch {
      // An uncertain append must never be followed by another write.
      this.failed = true;
      throw new Error('Vote storage unavailable');
    }
    this.byteLength += line.length;
    this.votes.set(key, choice);
    this.counts[choice] += 1;
    return true;
  }

  summary(marketId, voterKey) {
    if (marketId !== ACTIVE_MARKET_ID) throw new Error('Unknown market');
    const { yes, no } = this.counts;
    const total = yes + no;
    const choice = this.votes.get(`${marketId}\0${voterKey}`) ?? null;
    const yesPercent = total === 0 ? 50 : Math.round((yes / total) * 100);
    return {
      choice,
      hasVoted: choice !== null,
      no,
      noPercent: 100 - yesPercent,
      total,
      yes,
      yesPercent,
    };
  }
}
