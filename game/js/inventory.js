'use strict';
// Инвентарь игрока (30 ячеек с пустыми местами) и контейнеры (плотные списки).

const HOT_FIRST = new Set(['tool', 'weapon', 'build', 'food', 'med']);

function invCount(inv, id) {
  let n = 0;
  for (const s of inv) if (s && s.id === id) n += s.n;
  return n;
}

function invRemove(inv, id, n) {
  for (let i = inv.length - 1; i >= 0 && n > 0; i--) {
    const s = inv[i];
    if (!s || s.id !== id) continue;
    const k = Math.min(n, s.n);
    s.n -= k; n -= k;
    if (s.n <= 0) inv[i] = null;
  }
  return n === 0;
}

// Кладёт стопку в инвентарь игрока. Возвращает остаток (0 — всё влезло).
function invAdd(inv, stack) {
  const def = ITEMS[stack.id];
  if (def.stack > 1) {
    for (const s of inv) {
      if (s && s.id === stack.id && s.n < def.stack) {
        const k = Math.min(def.stack - s.n, stack.n);
        s.n += k; stack.n -= k;
        if (!stack.n) return 0;
      }
    }
  }
  const order = [];
  if (HOT_FIRST.has(def.cat)) { for (let i = 0; i < inv.length; i++) order.push(i); }
  else { for (let i = HOTBAR; i < inv.length; i++) order.push(i); for (let i = 0; i < HOTBAR; i++) order.push(i); }
  for (const i of order) {
    if (inv[i]) continue;
    const k = Math.min(def.stack, stack.n);
    inv[i] = Object.assign({}, stack, { n: k });
    stack.n -= k;
    if (!stack.n) return 0;
  }
  return stack.n;
}

function contAdd(list, cap, stack) {
  const def = ITEMS[stack.id];
  if (def.stack > 1) {
    for (const s of list) {
      if (s.id === stack.id && s.n < def.stack) {
        const k = Math.min(def.stack - s.n, stack.n);
        s.n += k; stack.n -= k;
        if (!stack.n) return 0;
      }
    }
  }
  while (stack.n > 0 && list.length < cap) {
    const k = Math.min(def.stack, stack.n);
    list.push(Object.assign({}, stack, { n: k }));
    stack.n -= k;
  }
  return stack.n;
}

function hasCost(inv, cost, mult = 1) {
  for (const id in cost) if (invCount(inv, id) < cost[id] * mult) return false;
  return true;
}
function payCost(inv, cost, mult = 1) {
  for (const id in cost) invRemove(inv, id, cost[id] * mult);
}
