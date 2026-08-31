/* ============================================================
   0x4ea · homepage dictionary (zh / en)
   Logic lives in js/i18n-core.js — this file is data only.
   ============================================================ */
(function () {
  'use strict';

  var DICT = {
    zh: {
      /* ---- document ---- */
      'doc.title': '0x4ea · Soli 的项目集',
      'doc.desc': '独立开发者 Soli 的项目集：宝石学笔记、PuffComic 离线漫画阅读器、数字生命卡框架协议（DLC）、本地 AI 与量化研究。离线优先，隐私优先。',
      'doc.ogTitle': '0x4ea · Soli 的项目集',
      'doc.ogDesc': '0x4ea · 独立开发者 Soli 的项目集：宝石学、阅读、AI 与金融研究的软件作品。',

      /* ---- nav ---- */
      'nav.logoAria': '0x4ea 首页',
      'nav.download': '下载',
      'nav.about': '关于',
      'nav.projects': '项目',
      'nav.github': 'GitHub',
      'nav.themeAria': '切换深色 / 浅色模式',
      'nav.langAria': '切换语言 / Switch language',
      'nav.langTitle': '切换语言（English）',
      'nav.menuAria': '打开菜单',

      /* ---- hero ---- */
      'hero.ctaProjects': '浏览项目',
      'hero.ctaGithub': 'GitHub',
      'hero.stat1': '在维护项目',
      'hero.stat2': '开源框架',
      'hero.stat3': '离线优先',

      /* ---- download ---- */
      'dl.title': '下载',
      'dl.puffAndroid': 'Android · v1.0 · APK',
      'dl.puffIos': 'iOS · App Store',
      'dl.gemAndroid': 'Android · v1.0.6 · APK',
      'dl.gemIos': 'iOS · App Store',
      'dl.apk': '下载 APK ↓',
      'dl.store': 'App Store 下载 ↓',
      'dl.altPuff': 'PuffComic 图标',
      'dl.altGem': '系统宝石学笔记 图标',

      /* ---- about ---- */
      'about.eyebrow': '关于 0x4ea',
      'about.title': '一个不断探索 AI 边界的开发者、交易员、珠宝鉴定师。',
      'about.github': 'GitHub ↗',
      'about.contact': '联系我 ↓',

      /* ---- projects ---- */
      'pj.title': '项目',
      'pj.gemAria': '系统宝石学笔记 GitHub 仓库',
      'pj.gemEyebrow': '移动应用 · 知识库',
      'pj.gemTitle': '系统宝石学笔记',
      'pj.gemDesc': '46 篇经权威文献交叉验证的宝石学笔记，覆盖 29 种宝石矿物、玉石与有机宝石，以及鉴定仪器与量子光学专题。配套 iOS / Android App 与切工可视化工具。',
      'pj.comicAria': 'PuffComic 离线漫画阅读器 GitHub 仓库',
      'pj.comicEyebrow': 'iOS · Android 阅读器',
      'pj.comicTitle': 'PuffComic 离线漫画阅读器',
      'pj.comicDesc': '真正零网络的离线漫画与电子书阅读器。纯 Swift / TextKit 解析引擎，不依赖 WebKit，打开任何格式都不会弹出无线数据请求。支持 CBZ / EPUB / AZW3 / MD，含隐藏书架与密码保护。',
      'pj.dlcAria': '数字生命卡引擎 dsh-dlc GitHub 仓库',
      'pj.dlcEyebrow': '开源框架 · TypeScript',
      'pj.dlcTitle': '数字生命卡引擎 · dsh-dlc',
      'pj.dlcDesc': 'DLC 数字生命卡片协议 × DeepSeek Harness 原生插件，TypeScript 全量重写。状态机引擎、叙事组装、双核线性记忆、可插拔存储，Cordis 插件化直接挂载进 DSH。GitHub 开源，MIT 协议，30 项自动化测试。',

      /* ---- footer ---- */
      'ft.copy': '© 2026 0x4ea · 离线优先，隐私优先',
      'ft.github': 'GitHub'
    },

    en: {
      /* ---- document ---- */
      'doc.title': '0x4ea · Soli’s Projects',
      'doc.desc': 'Selected work by indie developer Soli: Systematic Gemmology Notes, PuffComic offline reader, the Digital Life Card protocol (DLC), local AI and quantitative research. Offline first, privacy first.',
      'doc.ogTitle': '0x4ea · Soli’s Projects',
      'doc.ogDesc': '0x4ea — software by indie developer Soli, spanning gemmology, reading, AI and financial research.',

      /* ---- nav ---- */
      'nav.logoAria': '0x4ea home',
      'nav.download': 'Download',
      'nav.about': 'About',
      'nav.projects': 'Projects',
      'nav.github': 'GitHub',
      'nav.themeAria': 'Toggle dark / light mode',
      'nav.langAria': '切换语言 / Switch language',
      'nav.langTitle': 'Switch language (中文)',
      'nav.menuAria': 'Open menu',

      /* ---- hero ---- */
      'hero.ctaProjects': 'Browse projects',
      'hero.ctaGithub': 'GitHub',
      'hero.stat1': 'Active projects',
      'hero.stat2': 'Open-source frameworks',
      'hero.stat3': 'Offline first',

      /* ---- download ---- */
      'dl.title': 'Download',
      'dl.puffAndroid': 'Android · v1.0 · APK',
      'dl.puffIos': 'iOS · App Store',
      'dl.gemAndroid': 'Android · v1.0.6 · APK',
      'dl.gemIos': 'iOS · App Store',
      'dl.apk': 'Download APK ↓',
      'dl.store': 'App Store ↓',
      'dl.altPuff': 'PuffComic icon',
      'dl.altGem': 'Systematic Gemmology Notes icon',

      /* ---- about ---- */
      'about.eyebrow': 'About 0x4ea',
      'about.title': 'A developer, trader and gemologist, always pushing at the edges of AI.',
      'about.github': 'GitHub ↗',
      'about.contact': 'Get in touch ↓',

      /* ---- projects ---- */
      'pj.title': 'Projects',
      'pj.gemAria': 'Systematic Gemmology Notes on GitHub',
      'pj.gemEyebrow': 'Mobile app · Knowledge base',
      'pj.gemTitle': 'Systematic Gemmology Notes',
      'pj.gemDesc': '46 gemmology notes cross-checked against authoritative literature, covering 29 gem minerals, jades and organic gems, plus instrumentation and quantum-optics topics. Ships with iOS / Android apps and a cut visualiser.',
      'pj.comicAria': 'PuffComic offline reader on GitHub',
      'pj.comicEyebrow': 'iOS · Android reader',
      'pj.comicTitle': 'PuffComic Offline Reader',
      'pj.comicDesc': 'A genuinely zero-network offline comic and ebook reader. Pure Swift / TextKit parsing engine with no WebKit dependency — opening any format never fires a network request. Supports CBZ / EPUB / AZW3 / MD, with a hidden shelf and passcode lock.',
      'pj.dlcAria': 'Digital Life Card engine dsh-dlc on GitHub',
      'pj.dlcEyebrow': 'Open-source framework · TypeScript',
      'pj.dlcTitle': 'Digital Life Card Engine · dsh-dlc',
      'pj.dlcDesc': 'The DLC digital-life-card protocol as a native DeepSeek Harness plugin, fully rewritten in TypeScript. State-machine engine, narrative assembly, dual-core linear memory, pluggable storage — mounts straight into DSH via Cordis. Open source on GitHub, MIT licensed, 30 automated tests.',

      /* ---- footer ---- */
      'ft.copy': '© 2026 0x4ea · Offline first, privacy first',
      'ft.github': 'GitHub'
    }
  };

  window.i18nCore.init({ dict: DICT, buttonId: 'langToggle' });
})();
