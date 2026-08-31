/* ============================================================
   0x4ea · i18n core (shared by every page on 0x4ea.com)
   Dictionary-driven, no build step, no dependencies.

   Usage:
     i18nCore.init({
       dict:  { zh: {...}, en: {...} },
       buttonId: 'langToggle',      // optional
       storeKey: '0x4ea-lang',      // optional, shared across pages
       defaultLang: 'zh'            // optional
     });

   Markup hooks:
     data-i18n="key"        -> textContent
     data-i18n-html="key"   -> innerHTML   (author-controlled strings only)
     data-i18n-alt="key"    -> img alt
     data-i18n-aria="key"   -> aria-label
   ============================================================ */
(function () {
  'use strict';

  var SUPPORTED = ['zh', 'en'];
  var DEFAULT_STORE_KEY = '0x4ea-lang';
  var instances = [];

  function lookup(dict, lang, key) {
    var table = dict[lang] || dict.zh || {};
    if (table[key] != null) return table[key];
    var fallback = dict.zh || {};
    return fallback[key] != null ? fallback[key] : key;
  }

  function readStored(storeKey) {
    try {
      var v = localStorage.getItem(storeKey);
      if (SUPPORTED.indexOf(v) !== -1) return v;
    } catch (e) {}
    return null;
  }

  function detect(defaultLang) {
    var nav = (navigator.language || navigator.userLanguage || '').toLowerCase();
    if (!nav) return defaultLang || 'zh';
    if (nav.indexOf('zh') === 0) return 'zh';
    if (nav.indexOf('en') === 0) return 'en';
    return defaultLang || 'zh';
  }

  function setMeta(sel, value) {
    var el = document.querySelector(sel);
    if (el && el.setAttribute) el.setAttribute('content', value);
  }

  function paint(inst, lang) {
    var dict = inst.dict;
    var root = document.documentElement;
    root.setAttribute('lang', lang === 'zh' ? 'zh-CN' : 'en');
    root.setAttribute('data-lang', lang);

    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = lookup(dict, lang, nodes[i].getAttribute('data-i18n'));
    }
    var htmls = document.querySelectorAll('[data-i18n-html]');
    for (var j = 0; j < htmls.length; j++) {
      htmls[j].innerHTML = lookup(dict, lang, htmls[j].getAttribute('data-i18n-html'));
    }
    var alts = document.querySelectorAll('[data-i18n-alt]');
    for (var k = 0; k < alts.length; k++) {
      alts[k].setAttribute('alt', lookup(dict, lang, alts[k].getAttribute('data-i18n-alt')));
    }
    var arias = document.querySelectorAll('[data-i18n-aria]');
    for (var m = 0; m < arias.length; m++) {
      arias[m].setAttribute('aria-label', lookup(dict, lang, arias[m].getAttribute('data-i18n-aria')));
    }

    if (lookup(dict, lang, 'doc.title')) document.title = lookup(dict, lang, 'doc.title');
    setMeta('meta[name="description"]', lookup(dict, lang, 'doc.desc'));
    setMeta('meta[property="og:title"]', lookup(dict, lang, 'doc.ogTitle'));
    setMeta('meta[property="og:description"]', lookup(dict, lang, 'doc.ogDesc'));

    // Toggle button always advertises the *other* language.
    var btn = inst.button;
    if (btn) {
      btn.setAttribute('data-lang-target', lang === 'zh' ? 'en' : 'zh');
      btn.setAttribute('title', lookup(dict, lang, 'nav.langTitle'));
      btn.setAttribute('aria-label', lookup(dict, lang, 'nav.langAria'));
      var label = btn.querySelector('.lang-toggle__label');
      if (label) label.textContent = lang === 'zh' ? 'EN' : '中';
    }

    inst.lang = lang;
    if (typeof inst.onApply === 'function') inst.onApply(lang);
    document.dispatchEvent(new CustomEvent('0x4ea:langchange', { detail: { lang: lang } }));
  }

  function set(inst, lang, persist) {
    if (SUPPORTED.indexOf(lang) === -1) lang = 'zh';
    paint(inst, lang);
    if (persist) {
      try { localStorage.setItem(inst.storeKey, lang); } catch (e) {}
    }
  }

  function init(opts) {
    opts = opts || {};
    var inst = {
      dict: opts.dict || {},
      storeKey: opts.storeKey || DEFAULT_STORE_KEY,
      defaultLang: opts.defaultLang || 'zh',
      button: opts.buttonId ? document.getElementById(opts.buttonId) : (opts.button || null),
      onApply: opts.onApply || null,
      lang: 'zh'
    };

    set(inst, readStored(inst.storeKey) || detect(inst.defaultLang), false);

    if (inst.button) {
      inst.button.addEventListener('click', function () {
        set(inst, inst.lang === 'zh' ? 'en' : 'zh', true);
      });
    }

    // Keep every instance on the site in sync within one tab.
    window.addEventListener('storage', function (e) {
      if (e.key === inst.storeKey && SUPPORTED.indexOf(e.newValue) !== -1) {
        set(inst, e.newValue, false);
      }
    });

    instances.push(inst);
    return inst;
  }

  window.i18nCore = {
    init: init,
    get: function () { return instances.length ? instances[0].lang : 'zh'; },
    set: function (lang) {
      instances.forEach(function (i) { set(i, lang, true); });
    },
    t: function (lang, key) {
      return instances.length ? lookup(instances[0].dict, lang, key) : key;
    }
  };
})();
