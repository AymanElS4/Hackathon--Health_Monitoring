/* Surgeon page (vanilla browser JS, no framework). Every visible string comes from window.MESSAGES.
 * Server data is written only with textContent / text nodes, as markup (tablet-supplied text must not
 * reach the DOM as HTML). Nothing here diagnoses; it only shows what the server returned. */
(function () {
  'use strict';

  var CODE_KEY = 'bv.code';
  var API_BASE = '/api/v1';
  var CODE_HEADER = 'X-Access-Code';
  var HTTP_UNAUTHORIZED = 401;
  var HTTP_NOT_FOUND = 404;
  var HTTP_TOO_MANY = 429;
  var HTTP_UNAVAILABLE = 503;
  var VERDICTS = ['ok', 'attention', 'alert'];
  var LEVELS = ['green', 'amber', 'red', 'in_doubt', 'unknown'];
  var NO_SYMPTOM = 'none';
  var MISSING_DATA_ACTION = 'action.missing_data';
  var SENSOR_PLACEHOLDER = '…';
  var TEAM_MARK = '* ';
  var UNKNOWN_CLASS = 'unknown';
  var ERROR_KEYS = {
    invalid: 'code.invalid',
    too_many: 'code.too_many',
    unavailable: 'error.unavailable',
    not_found: 'error.not_found',
  };

  var MESSAGES = window.MESSAGES || {};
  var fallbackCode = null;
  var currentView = null;
  var selectedCrewId = null;

  /** Error raised by `api` with a kind that maps to a message key. */
  function ApiError(kind) {
    this.kind = kind;
  }
  ApiError.prototype = Object.create(Error.prototype);
  ApiError.prototype.constructor = ApiError;

  /** Message text by key; `{name}` placeholders are replaced from `vars`; unknown keys show the key. */
  function t(key, vars) {
    var text = Object.prototype.hasOwnProperty.call(MESSAGES, key) ? MESSAGES[key] : key;
    if (!vars) {
      return text;
    }
    return text.replace(/\{(\w+)\}/g, function (match, name) {
      return Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match;
    });
  }

  /** Creates an element. Strings in `children` become text nodes. */
  function el(tag, options, children) {
    var node = document.createElement(tag);
    var opts = options || {};
    if (opts.className) {
      node.className = opts.className;
    }
    if (opts.text !== undefined) {
      node.textContent = opts.text;
    }
    if (opts.attrs) {
      Object.keys(opts.attrs).forEach(function (name) {
        node.setAttribute(name, opts.attrs[name]);
      });
    }
    if (opts.onClick) {
      node.addEventListener('click', opts.onClick);
    }
    (children || []).forEach(function (child) {
      if (child === null || child === undefined || child === false) {
        return;
      }
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return node;
  }

  function clear(node) {
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  /** Restricts a server value used in a CSS class to a known set. */
  function classToken(value, allowed) {
    return allowed.indexOf(value) === -1 ? UNKNOWN_CLASS : value;
  }

  function formatDateTime(iso) {
    var date = new Date(iso);
    return isNaN(date.getTime()) ? String(iso) : date.toLocaleString('es');
  }

  function formatDate(iso) {
    var date = new Date(iso);
    return isNaN(date.getTime()) ? String(iso) : date.toLocaleDateString('es');
  }

  function formatValue(value) {
    if (typeof value === 'object' && value !== null) {
      return value.systolic + '/' + value.diastolic;
    }
    return String(value);
  }

  // ---- Access code (kept for this tab only: sessionStorage, plus memory if storage is blocked) ----

  function readCode() {
    try {
      var stored = sessionStorage.getItem(CODE_KEY);
      if (stored) {
        return stored;
      }
    } catch (error) {
      // Storage blocked: fall back to memory below.
    }
    return fallbackCode;
  }

  function storeCode(code) {
    fallbackCode = code;
    try {
      sessionStorage.setItem(CODE_KEY, code);
    } catch (error) {
      // Storage blocked: the memory copy is used for this page only.
    }
  }

  function clearCode() {
    fallbackCode = null;
    try {
      sessionStorage.removeItem(CODE_KEY);
    } catch (error) {
      // Nothing stored.
    }
  }

  // ---- Data access ----

  /** GET of `/api/v1${path}` with the access code. Maps failures to ApiError kinds. */
  async function api(path) {
    var headers = {};
    var response;
    headers[CODE_HEADER] = readCode() || '';
    try {
      response = await fetch(API_BASE + path, { headers: headers, cache: 'no-store' });
    } catch (error) {
      throw new ApiError('unavailable');
    }
    if (response.status === HTTP_UNAUTHORIZED) {
      clearCode();
      throw new ApiError('invalid');
    }
    if (response.status === HTTP_TOO_MANY) {
      throw new ApiError('too_many');
    }
    if (response.status === HTTP_NOT_FOUND) {
      throw new ApiError('not_found');
    }
    if (response.status === HTTP_UNAVAILABLE || !response.ok) {
      throw new ApiError('unavailable');
    }
    try {
      return await response.json();
    } catch (error) {
      throw new ApiError('unavailable');
    }
  }

  // ---- Views ----

  var refs = {
    login: document.getElementById('login-view'),
    crew: document.getElementById('crew-view'),
    summaryView: document.getElementById('summary-view'),
    logout: document.getElementById('logout-button'),
    codeForm: document.getElementById('code-form'),
    codeInput: document.getElementById('code-input'),
    codeError: document.getElementById('code-error'),
    crewList: document.getElementById('crew-list'),
    crewEmpty: document.getElementById('crew-empty'),
    back: document.getElementById('back-button'),
    summaryBody: document.getElementById('summary'),
    status: document.getElementById('status'),
  };

  function showView(name) {
    currentView = name;
    refs.login.hidden = name !== 'login';
    refs.crew.hidden = name !== 'crew';
    refs.summaryView.hidden = name !== 'summary';
    refs.logout.hidden = name === 'login';
    refs.status.textContent = '';
    refs.codeError.textContent = '';
  }

  function showLogin() {
    showView('login');
    refs.codeInput.value = '';
  }

  /** Shows a failure on the code form while logging in, or in the status line otherwise. */
  function handleError(error) {
    var kind = error instanceof ApiError ? error.kind : 'unavailable';
    var key = ERROR_KEYS[kind] || ERROR_KEYS.unavailable;
    if (kind === 'invalid' || kind === 'too_many') {
      clearCode();
      showLogin();
      refs.codeError.textContent = t(key);
      return;
    }
    if (currentView === 'login') {
      refs.codeError.textContent = t(key);
    } else {
      refs.status.textContent = t(key);
    }
  }

  // ---- Shared small components ----

  function verdictBadge(verdict) {
    return el('span', {
      className: 'badge verdict-' + classToken(verdict, VERDICTS),
      text: t('verdict.' + verdict),
    });
  }

  function simulatedBadge() {
    return el('span', { className: 'badge badge-simulated', text: t('history.simulated') });
  }

  /** A "label: value" paragraph; `value` is a string or a node. */
  function labelled(labelKey, value) {
    return el('p', null, [el('strong', { text: t(labelKey) + ': ' }), value]);
  }

  function section(titleKey, content) {
    return el('section', { className: 'summary-block' }, [el('h3', { text: t(titleKey) }), content]);
  }

  // ---- Crew list ----

  function crewRow(row) {
    var children = [
      el('span', { className: 'crew-id', text: row.crewId }),
      el('span', { className: 'crew-day', text: t('crew.day', { day: row.missionDay }) }),
      verdictBadge(row.verdict),
      el('span', { className: 'crew-time', text: t('crew.last_check') + ': ' + formatDateTime(row.completedAt) }),
    ];
    if (row.simulated) {
      children.push(simulatedBadge());
    }
    if (row.openAlert) {
      children.push(
        el('span', {
          className: 'badge alert-tag',
          text: t('crew.open_alert') + ': ' + t('urgency.' + row.openAlert.urgency),
        }),
      );
    }
    var button = el(
      'button',
      {
        className: 'crew-row',
        attrs: { type: 'button' },
        onClick: function () {
          showSummary(row.crewId);
        },
      },
      children,
    );
    return el('li', null, [button]);
  }

  async function loadCrew() {
    showView('crew');
    clear(refs.crewList);
    refs.crewEmpty.hidden = true;
    try {
      var rows = await api('/surgeon/crew');
      rows.forEach(function (row) {
        refs.crewList.appendChild(crewRow(row));
      });
      refs.crewEmpty.textContent = t('crew.empty');
      refs.crewEmpty.hidden = rows.length !== 0;
    } catch (error) {
      handleError(error);
    }
  }

  // ---- Crew summary ----

  function actionText(actionKey) {
    var vars = actionKey === MISSING_DATA_ACTION ? { sensor: SENSOR_PLACEHOLDER } : undefined;
    return t(actionKey, vars);
  }

  function symptomsText(symptoms) {
    var named = (symptoms || []).filter(function (symptom) {
      return symptom !== NO_SYMPTOM;
    });
    if (named.length === 0) {
      return t('summary.no_symptoms');
    }
    return named.map(function (symptom) {
      return t('symptom.' + symptom);
    }).join(', ');
  }

  function sensorsTable(readings) {
    var table = el('table', { className: 'sensors' });
    Object.keys(readings || {}).forEach(function (key) {
      var reading = readings[key];
      var levelChildren = [
        el('span', {
          className: 'badge level-' + classToken(reading.level, LEVELS),
          text: t('level.' + reading.level),
        }),
      ];
      if (reading.teamCriterion) {
        levelChildren.push(' ', el('span', { className: 'team-mark', text: TEAM_MARK + t('team.criterion') }));
      }
      table.appendChild(
        el('tr', null, [
          el('th', { attrs: { scope: 'row' }, text: t('sensor.' + key) }),
          el('td', { text: reading.value }),
          el('td', null, levelChildren),
        ]),
      );
    });
    return table;
  }

  function observationsList(observations) {
    var list = el('ul', { className: 'list' });
    (observations || []).forEach(function (observation) {
      list.appendChild(
        el('li', {
          text:
            t('indicator.' + observation.indicator) + ': ' +
            formatValue(observation.value) + ' ' + observation.unit + ' (' +
            t('summary.source.' + observation.source) + ')',
        }),
      );
    });
    return list;
  }

  /** One check (latest check in full): verdict, action, symptoms, sensors and values. */
  function checkDetail(check) {
    var head = [
      el('p', null, [
        el('strong', { text: t('crew.day', { day: check.missionDay }) + ' · ' }),
        verdictBadge(check.verdict),
        ' ' + formatDateTime(check.completedAt) + ' ',
      ]),
    ];
    if (check.simulated) {
      head[0].appendChild(simulatedBadge());
    }
    var nodes = head;
    if (check.actionKey) {
      nodes.push(labelled('summary.action', actionText(check.actionKey)));
    }
    nodes.push(labelled('summary.symptoms', symptomsText(check.symptoms)));
    nodes.push(section('summary.sensors', sensorsTable(check.readings)));
    nodes.push(section('summary.values', observationsList(check.observations)));
    return el('div', null, nodes);
  }

  function historyTable(history) {
    var table = el('table', { className: 'history' });
    (history || []).forEach(function (check) {
      var cells = [
        el('td', { text: t('crew.day', { day: check.missionDay }) }),
        el('td', { text: formatDate(check.completedAt) }),
        el('td', null, [verdictBadge(check.verdict)]),
      ];
      if (check.simulated) {
        cells.push(el('td', null, [simulatedBadge()]));
      }
      table.appendChild(el('tr', null, cells));
    });
    return table;
  }

  function renderSummary(data) {
    clear(refs.summaryBody);
    refs.summaryBody.appendChild(el('h2', { text: data.crewId }));
    refs.summaryBody.appendChild(labelled('summary.mission_start', data.missionStartDate));
    refs.summaryBody.appendChild(section('summary.latest', checkDetail(data.latest)));
    refs.summaryBody.appendChild(section('summary.history', historyTable(data.history)));
  }

  async function showSummary(crewId) {
    selectedCrewId = crewId;
    showView('summary');
    clear(refs.summaryBody);
    try {
      var data = await api('/surgeon/crew/' + encodeURIComponent(crewId));
      renderSummary(data);
    } catch (error) {
      handleError(error);
    }
  }

  // ---- Wiring ----

  refs.codeForm.addEventListener('submit', function (event) {
    event.preventDefault();
    var code = refs.codeInput.value.trim();
    if (code === '') {
      showLogin();
      refs.codeError.textContent = t('code.invalid');
      return;
    }
    storeCode(code);
    refs.codeInput.value = '';
    loadCrew();
  });

  refs.logout.addEventListener('click', function () {
    clearCode();
    showLogin();
  });

  refs.back.addEventListener('click', function () {
    selectedCrewId = null;
    loadCrew();
  });

  function setStaticText() {
    document.title = t('page.title');
    document.getElementById('app-title').textContent = t('page.title');
    document.getElementById('app-subtitle').textContent = t('page.subtitle');
    document.getElementById('code-label').textContent = t('code.label');
    document.getElementById('code-submit').textContent = t('code.submit');
    refs.logout.textContent = t('code.logout');
    document.getElementById('crew-title').textContent = t('crew.title');
    refs.back.textContent = t('crew.back');
  }

  setStaticText();
  if (readCode()) {
    loadCrew();
  } else {
    showLogin();
  }
})();
