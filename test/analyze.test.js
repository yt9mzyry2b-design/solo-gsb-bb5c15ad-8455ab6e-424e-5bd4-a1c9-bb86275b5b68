'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { analyze, minimize, AnalyzeError } = require('../lib/analyze');

test('OR 门汇总子组合', () => {
  const result = analyze({
    basics: ['A', 'B'],
    gates: [{ name: 'G1', type: 'OR', refs: ['A', 'B'] }],
    top: 'G1',
  });
  assert.deepEqual(result, [['A'], ['B']]);
});

test('AND 门合并子组合（笛卡尔并集）', () => {
  const result = analyze({
    basics: ['A', 'B', 'C'],
    gates: [
      { name: 'G1', type: 'OR', refs: ['A', 'B'] },
      { name: 'G2', type: 'AND', refs: ['G1', 'C'] },
    ],
    top: 'G2',
  });
  assert.deepEqual(result, [['A', 'C'], ['B', 'C']]);
});

test('删除包含更小组合的超集', () => {
  // G1 = A OR B → {A},{B}；G2 = A AND G1 → {A},{A,B} → 超集 {A,B} 被删除
  const result = analyze({
    basics: ['A', 'B'],
    gates: [
      { name: 'G1', type: 'OR', refs: ['A', 'B'] },
      { name: 'G2', type: 'AND', refs: ['A', 'G1'] },
    ],
    top: 'G2',
  });
  assert.deepEqual(result, [['A']]);
});

test('重复路径不放大结果（共享子树去重）', () => {
  // G1 被两个分支引用，结果不应出现重复组合
  const result = analyze({
    basics: ['A', 'B', 'C'],
    gates: [
      { name: 'G1', type: 'OR', refs: ['A', 'B'] },
      { name: 'G2', type: 'OR', refs: ['G1', 'C'] },
      { name: 'G3', type: 'OR', refs: ['G1', 'G2'] },
    ],
    top: 'G3',
  });
  assert.deepEqual(result, [['A'], ['B'], ['C']]);
});

test('结果按故障数与名称排序', () => {
  const result = analyze({
    basics: ['C', 'A', 'B', 'D'],
    gates: [
      { name: 'G1', type: 'AND', refs: ['C', 'D'] },
      { name: 'G2', type: 'OR', refs: ['B', 'G1', 'A'] },
    ],
    top: 'G2',
  });
  assert.deepEqual(result, [['A'], ['B'], ['C', 'D']]);
});

test('引用不存在时报明确错误', () => {
  assert.throws(
    () =>
      analyze({
        basics: ['A'],
        gates: [{ name: 'G1', type: 'AND', refs: ['A', 'X'] }],
        top: 'G1',
      }),
    (e) => e instanceof AnalyzeError && /不存在/.test(e.message) && /X/.test(e.message)
  );
});

test('门成环时报明确错误', () => {
  assert.throws(
    () =>
      analyze({
        basics: ['A'],
        gates: [
          { name: 'G1', type: 'OR', refs: ['G2'] },
          { name: 'G2', type: 'OR', refs: ['G1'] },
        ],
        top: 'G1',
      }),
    (e) => e instanceof AnalyzeError && /循环/.test(e.message)
  );
});

test('门自引用也视为环', () => {
  assert.throws(
    () =>
      analyze({
        basics: ['A'],
        gates: [{ name: 'G1', type: 'OR', refs: ['A', 'G1'] }],
        top: 'G1',
      }),
    /循环/
  );
});

test('未指定顶层故障时报错', () => {
  assert.throws(
    () => analyze({ basics: ['A'], gates: [], top: '' }),
    /顶层故障/
  );
});

test('顶层故障不存在时报错', () => {
  assert.throws(
    () => analyze({ basics: ['A'], gates: [], top: 'NOPE' }),
    /不存在/
  );
});

test('基础故障超过 12 个时报错', () => {
  const basics = Array.from({ length: 13 }, (_, i) => `F${i}`);
  assert.throws(() => analyze({ basics, gates: [], top: 'F0' }), /最多 12/);
});

test('顶层可以是基础故障本身', () => {
  const result = analyze({ basics: ['A', 'B'], gates: [], top: 'A' });
  assert.deepEqual(result, [['A']]);
});

test('minimize：去重并删除超集', () => {
  const out = minimize([
    ['B', 'A'],
    ['A', 'B'],
    ['A'],
    ['A', 'B', 'C'],
    ['C'],
  ]);
  assert.deepEqual(out, [['A'], ['C']]);
});
