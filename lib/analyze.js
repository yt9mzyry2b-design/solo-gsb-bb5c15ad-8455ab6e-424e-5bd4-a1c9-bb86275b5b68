'use strict';

/**
 * 故障树最小割集分析。
 *
 * 输入：
 *   basics: string[]               基础故障名称（至多 12 个）
 *   gates:  [{name, type, refs}]   AND / OR 门，refs 引用基础故障或其他门
 *   top:    string                 顶层故障（基础故障或门）
 *
 * 输出：
 *   最小基础故障组合的数组，每个组合是按名称排序的基础故障数组；
 *   组合之间按「故障数升序，再按名称字典序」排序。
 *
 * 语义：
 *   - 基础故障 → 割集 [{自身}]
 *   - OR 门   → 子节点割集的并集（汇总）
 *   - AND 门  → 子节点割集的笛卡尔合并（每个组合取并集）
 *   - 每步合并后都去重，并删除包含更小组合的超集，
 *     使中间结果始终是最小割集，避免重复路径放大结果。
 */

const MAX_BASICS = 12;

class AnalyzeError extends Error {}

/** 组合规范化：去重 + 排序，返回新数组 */
function normalizeSet(members) {
  return [...new Set(members)].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
}

/**
 * 最小化割集列表：
 *  1. 组合内部去重、排序，组合之间去重；
 *  2. 删除超集——若某组合完整包含另一个更小的组合，则它不是最小割集，丢弃。
 */
function minimize(cutSets) {
  const byKey = new Map();
  for (const cs of cutSets) {
    const norm = normalizeSet(cs);
    byKey.set(norm.join(''), norm);
  }
  // 按规模升序处理，已保留的组合规模都不大于当前组合
  const sorted = [...byKey.values()].sort((a, b) => a.length - b.length);
  const kept = [];
  for (const s of sorted) {
    const hasSmallerSubset = kept.some((k) => k.every((m) => s.includes(m)));
    if (!hasSmallerSubset) kept.push(s);
  }
  return kept;
}

function analyze(input) {
  const { basics, gates, top } = input || {};

  // ---- 基础故障校验 ----
  if (!Array.isArray(basics) || basics.length === 0) {
    throw new AnalyzeError('请至少录入 1 个基础故障');
  }
  if (basics.length > MAX_BASICS) {
    throw new AnalyzeError(`基础故障最多 ${MAX_BASICS} 个，当前 ${basics.length} 个`);
  }
  const basicSet = new Set();
  for (const raw of basics) {
    const name = String(raw == null ? '' : raw).trim();
    if (!name) throw new AnalyzeError('基础故障名称不能为空');
    if (basicSet.has(name)) throw new AnalyzeError(`基础故障「${name}」重复录入`);
    basicSet.add(name);
  }

  // ---- 门校验 ----
  const gateMap = new Map();
  for (const g of gates || []) {
    const name = String((g && g.name) || '').trim();
    if (!name) throw new AnalyzeError('门名称不能为空');
    if (basicSet.has(name)) throw new AnalyzeError(`门「${name}」与基础故障重名`);
    if (gateMap.has(name)) throw new AnalyzeError(`门「${name}」重复定义`);
    if (g.type !== 'AND' && g.type !== 'OR') {
      throw new AnalyzeError(`门「${name}」的类型必须是 AND 或 OR`);
    }
    const refs = (Array.isArray(g.refs) ? g.refs : [])
      .map((r) => String(r == null ? '' : r).trim())
      .filter(Boolean);
    if (refs.length === 0) {
      throw new AnalyzeError(`门「${name}」至少需要引用一个基础故障或门`);
    }
    gateMap.set(name, { name, type: g.type, refs });
  }

  const isBasic = (n) => basicSet.has(n);
  const isGate = (n) => gateMap.has(n);

  // ---- 引用存在性校验 ----
  for (const g of gateMap.values()) {
    for (const r of g.refs) {
      if (!isBasic(r) && !isGate(r)) {
        throw new AnalyzeError(`门「${g.name}」引用了不存在的故障或门「${r}」`);
      }
    }
  }

  // ---- 顶层故障校验 ----
  const topName = String(top == null ? '' : top).trim();
  if (!topName) throw new AnalyzeError('未指定顶层故障');
  if (!isBasic(topName) && !isGate(topName)) {
    throw new AnalyzeError(`指定的顶层故障「${topName}」不存在`);
  }

  // ---- 环检测（对所有门，含未被顶层引用的门）----
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map([...gateMap.keys()].map((k) => [k, WHITE]));
  function dfs(name, path) {
    color.set(name, GRAY);
    for (const r of gateMap.get(name).refs) {
      if (!isGate(r)) continue;
      if (color.get(r) === GRAY) {
        const cycle = [...path.slice(path.indexOf(r)), r].join(' → ');
        throw new AnalyzeError(`门定义存在循环引用：${cycle}`);
      }
      if (color.get(r) === WHITE) dfs(r, [...path, r]);
    }
    color.set(name, BLACK);
  }
  for (const name of gateMap.keys()) {
    if (color.get(name) === WHITE) dfs(name, [name]);
  }

  // ---- 自底向上求最小割集（带记忆化，共享子树只算一次）----
  const memo = new Map();
  function resolve(name) {
    if (isBasic(name)) return [[name]];
    if (memo.has(name)) return memo.get(name);
    const g = gateMap.get(name);
    let result;
    if (g.type === 'OR') {
      // 汇总各子节点的割集
      result = g.refs.flatMap((r) => resolve(r));
    } else {
      // AND：逐个子节点做笛卡尔合并，每步最小化以抑制组合爆炸
      result = [[]];
      for (const r of g.refs) {
        const child = resolve(r);
        const merged = [];
        for (const a of result) {
          for (const b of child) merged.push([...a, ...b]);
        }
        result = minimize(merged);
      }
    }
    result = minimize(result);
    memo.set(name, result);
    return result;
  }

  const combos = resolve(topName);

  // ---- 输出排序：故障数升序，再按名称字典序 ----
  combos.sort(
    (a, b) =>
      a.length - b.length ||
      a.join(',').localeCompare(b.join(','), 'zh-Hans-CN')
  );
  return combos;
}

module.exports = { analyze, minimize, AnalyzeError, MAX_BASICS };
