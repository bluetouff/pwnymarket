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
  constructor(filePath) {
    if (!filePath) throw new Error('Vote ledger path is required');
    mkdirSync(dirname(filePath), { mode: 0o700, recursive: true });
    this.filePath = filePath;
    this.votes = new Map();

    if (existsSync(filePath)) {
      if (statSync(filePath).size > MAX_LEDGER_BYTES)
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
    const key = `${marketId}\0${voterKey}`;
    if (this.votes.has(key)) return false;
    const record = { choice, createdAt: Date.now(), marketId, voterKey };
    assertRecord(record);
    const line = `${JSON.stringify(record)}\n`;
    writeSync(this.fileDescriptor, line, null, 'utf8');
    fsyncSync(this.fileDescriptor);
    this.votes.set(key, choice);
    return true;
  }

  summary(marketId, voterKey) {
    let yes = 0;
    let no = 0;
    for (const [key, choice] of this.votes) {
      if (!key.startsWith(`${marketId}\0`)) continue;
      if (choice === 'yes') yes += 1;
      if (choice === 'no') no += 1;
    }
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
