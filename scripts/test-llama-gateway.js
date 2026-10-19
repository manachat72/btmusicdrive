#!/usr/bin/env node
const assert = require('assert');

process.env.OLLAMA_GATEWAY_KEY = 'test-key-only-for-unit-tests-0123456789';
process.env.GATEWAY_PORT = '11436';
const gateway = require('./ollama-gateway');

const request = gateway.toLlamaRequest({
  model: 'gpt-oss:20b',
  stream: false,
  think: 'low',
  messages: [
    { role: 'system', content: 'You are helpful.' },
    { role: 'user', content: 'สวัสดี' },
  ],
  options: { num_predict: 1500, temperature: 0.3 },
});

assert.deepStrictEqual(request, {
  model: 'qwen3.8-27b',
  stream: false,
  messages: [
    { role: 'system', content: 'You are helpful.' },
    { role: 'user', content: 'สวัสดี' },
  ],
  max_tokens: 1500,
  temperature: 0.3,
});

const response = gateway.toOllamaResponse({
  id: 'chatcmpl-test',
  model: 'qwen3.8-27b',
  choices: [{ message: { role: 'assistant', content: 'สวัสดีค่ะ' }, finish_reason: 'stop' }],
});

assert.deepStrictEqual(response, {
  model: 'qwen3.8-27b',
  created_at: 'chatcmpl-test',
  message: { role: 'assistant', content: 'สวัสดีค่ะ' },
  done: true,
  done_reason: 'stop',
});

console.log('llama gateway translation tests passed.');
