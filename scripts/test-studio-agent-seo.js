#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { buildPrompt, parseAndValidateDraft } = require('./lib/hermes-seo-agent');

function validAudioDraft(overrides = {}) {
  return {
    name: 'USB แฟลชไดรฟ์ MP3 รวมเพลงฮิตยุค 90 4GB ฟังในรถ',
    metaTitle: 'USB MP3 เพลงฮิตยุค 90 4GB | Bt Music Drive',
    metaDescription: 'รวมเพลงฮิตยุค 90 ลง USB 4GB สำหรับฟังในรถ ใช้งานง่าย เสียบแล้วเล่นได้ทันที',
    tags: ['เพลงฮิตยุค 90', 'เพลงสตริง', 'USB เพลง', 'เพลงในรถ'],
    ...overrides,
  };
}

const audioInput = {
  shortName: 'ฮิตยุค 90',
  categoryName: 'เพลงสตริง',
  capacity: '4GB',
  price: 279,
  tracklist: [],
  contentType: 'audio',
};

const prompt = buildPrompt(audioInput);
assert.match(prompt, /JSON/);
assert.match(prompt, /ห้ามแต่งข้อมูล/);

assert.deepStrictEqual(
  parseAndValidateDraft(JSON.stringify(validAudioDraft()), audioInput),
  validAudioDraft(),
);

assert.throws(
  () => parseAndValidateDraft(JSON.stringify(validAudioDraft({
    name: 'USB แฟลชไดรฟ์ MP3 รวมเพลงรวมเพลงลูกทุ่ง 4GB',
  })), audioInput),
  /duplicate words/,
);

const accessoryInput = {
  shortName: 'หัวแปลง OTG USB',
  categoryName: 'อุปกรณ์เสริม',
  capacity: '',
  price: 99,
  tracklist: [],
  contentType: 'accessory',
};

assert.throws(
  () => parseAndValidateDraft(JSON.stringify(validAudioDraft({
    name: 'USB แฟลชไดรฟ์ MP3 รวมเพลงหัวแปลง OTG USB',
  })), accessoryInput),
  /อุปกรณ์เสริม/,
);

assert.throws(
  () => parseAndValidateDraft(JSON.stringify(validAudioDraft({
    metaTitle: 'USB MP3 เพลงฮิตยุค 90 4GB ฟังในรถพร้อมของแถมสุดพิเศษ | Bt Music Drive',
  })), audioInput),
  /Meta title/,
);

console.log('Product Studio Hermes SEO contract tests passed.');
