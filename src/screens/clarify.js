/* Разбор. Пять вопросов, на которые нельзя ответить правильно —
   можно только честно. */
(function (root) {
  'use strict';

  var M = root.Most, h = M.h, C = M.content;

  var ORDER = ['own', 'tuesday', 'pulls', 'costs', 'core'];

  function rail(q) {
    var i = ORDER.indexOf(q);
    return M.ui.rail(Math.max(0, i), ORDER.length, 'разбор');
  }

  function optionButton(label, hint, pressed, onclick) {
    return h('button', {
      class: 'opt',
      'aria-pressed': pressed ? 'true' : 'false',
      onclick: onclick
    }, [
      h('span', { text: label }),
      hint ? h('span', { class: 'opt-hint', text: hint }) : null
    ]);
  }

  M.screens.clarify = function (params) {
    var b = M.store.current();
    if (!b) { M.go('home'); return h('div'); }
    var q = (params && params.q) || 'own';
    var nodes = [rail(q)];

    if (q === 'own') {
      nodes.push(M.ui.head(C.ownership.q, C.ownership.sub));
      nodes.push(h('div', { class: 'opts' }, C.ownership.opts.map(function (o) {
        return optionButton(o.label, o.hint, b.clarify.ownership === o.id, function () {
          M.store.update(function (x) { x.clarify.ownership = o.id; });
          M.go('clarify', { q: o.id === 'not-mine' ? 'notmine' : 'tuesday' });
        });
      })));
      nodes.push(h('p', { class: 'quote', text: b.wish }));
      nodes.push(M.ui.back('к началу', 'home'));
      return nodes;
    }

    if (q === 'notmine') {
      nodes = [M.ui.head(C.notMine.title, C.notMine.body)];
      nodes.push(h('div', { class: 'opts' }, C.notMine.opts.map(function (o) {
        return optionButton(o.text, null, false, function () {
          M.store.update(function (x) {
            if (o.pull) {
              x.wish = o.text;
              x.clarify.pulls = [o.pull];
              x.clarify.ownership = 'mine';
            }
          });
          M.go('clarify', { q: 'tuesday' });
        });
      })));
      nodes.push(M.ui.back('назад', 'clarify', { q: 'own' }));
      return nodes;
    }

    if (q === 'tuesday') {
      var t = M.ui.field({
        id: 'tuesday', label: C.tuesday.sub, type: 'area', rows: 4,
        placeholder: C.tuesday.placeholder, value: b.clarify.tuesday
      });
      nodes.push(M.ui.head(C.tuesday.q));
      nodes.push(t.wrap);
      nodes.push(h('div', { class: 'row' }, [
        h('button', {
          class: 'btn btn-go',
          onclick: function () {
            M.store.update(function (x) { x.clarify.tuesday = t.input.value.trim(); });
            M.go('clarify', { q: 'pulls' });
          }
        }, 'Дальше'),
        h('button', {
          class: 'btn btn-quiet',
          onclick: function () { M.go('clarify', { q: 'pulls' }); }
        }, 'Пропустить')
      ]));
      nodes.push(M.ui.back('назад', 'clarify', { q: 'own' }));
      return nodes;
    }

    if (q === 'pulls') {
      var chosen = (b.clarify.pulls || []).slice();
      var redraw = function () { M.go('clarify', { q: 'pulls' }); };
      nodes.push(M.ui.head(C.pullsQ.q, C.pullsQ.sub));
      nodes.push(h('div', { class: 'opts' }, C.pulls.map(function (p) {
        var on = chosen.indexOf(p.id) !== -1;
        return optionButton(p.label, p.hint, on, function () {
          M.store.update(function (x) {
            var list = (x.clarify.pulls || []).slice();
            var at = list.indexOf(p.id);
            if (at !== -1) list.splice(at, 1);
            else { list.push(p.id); if (list.length > 2) list.shift(); }
            x.clarify.pulls = list;
          });
          redraw();
        });
      })));
      nodes.push(h('div', { class: 'row' }, [
        h('button', {
          class: 'btn btn-go',
          onclick: function () {
            if (!(M.store.current().clarify.pulls || []).length) return;
            M.go('clarify', { q: 'costs' });
          }
        }, chosen.length ? 'Дальше' : 'Выбери хотя бы одно')
      ]));
      nodes.push(M.ui.back('назад', 'clarify', { q: 'tuesday' }));
      return nodes;
    }

    if (q === 'costs') {
      var costs = (b.clarify.costs || []).slice();
      nodes.push(M.ui.head(C.costs.q, C.costs.sub));
      nodes.push(h('div', { class: 'opts' }, C.costs.opts.map(function (o) {
        var on = costs.indexOf(o.id) !== -1;
        return optionButton(o.label, o.hint, on, function () {
          M.store.update(function (x) {
            var list = (x.clarify.costs || []).slice();
            var at = list.indexOf(o.id);
            if (at !== -1) list.splice(at, 1); else list.push(o.id);
            x.clarify.costs = list;
          });
          M.go('clarify', { q: 'costs' });
        });
      })));
      nodes.push(h('div', { class: 'row' }, [
        h('button', {
          class: 'btn btn-go',
          onclick: function () { M.go('clarify', { q: 'core' }); }
        }, 'Дальше')
      ]));
      nodes.push(M.ui.back('назад', 'clarify', { q: 'pulls' }));
      return nodes;
    }

    /* core */
    var options = C.coreOptions(b.clarify.pulls, b.clarify.tuesday);
    var core = M.ui.field({
      id: 'core', label: 'Своими словами', type: 'area', rows: 3,
      value: b.clarify.core || options[0] || ''
    });
    nodes.push(M.ui.head(C.coreQ.q, C.coreQ.sub));
    nodes.push(h('div', { class: 'opts' }, options.map(function (text) {
      return optionButton(text, null, core.input.value === text, function () {
        core.input.value = text;
        core.input.focus();
      });
    })));
    nodes.push(core.wrap);
    nodes.push(h('div', { class: 'row' }, [
      h('button', {
        class: 'btn btn-go',
        onclick: function () {
          M.store.update(function (x) { x.clarify.core = core.input.value.trim() || x.wish; });
          M.go('resources');
        }
      }, 'Это оно')
    ]));
    nodes.push(M.ui.back('назад', 'clarify', { q: 'costs' }));
    return nodes;
  };
})(typeof window !== 'undefined' ? window : globalThis);
