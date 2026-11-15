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
  var HTTP_CONFLICT = 409;
  var HTTP_TOO_MANY = 429;
  var HTTP_UNAVAILABLE = 503;
  var VERDICTS = ['ok', 'attention', 'alert'];
  var OK_VERDICT = 'ok';
  var LEVELS = ['green', 'amber', 'red', 'in_doubt', 'unknown'];
  var UNKNOWN_LEVEL = 'unknown';
  var URGENCIES = ['now', 'soon'];
  var DECISIONS = ['manage_on_base', 'consult_surgeon', 'prepare_return'];
  var DECIDED_STATUS = 'decided';
  var SENSOR_ORDER = ['sleep', 'pulse', 'pressure', 'temperature', 'oxygen'];
  var NO_SYMPTOM = 'none';
  var MISSING_DATA_ACTION = 'action.missing_data';
  var TEAM_MARK = '* ';
  var UNKNOWN_CLASS = 'unknown';
  var ERROR_KEYS = {
    invalid: 'code.invalid',
    too_many: 'code.too_many',
    unavailable: 'error.unavailable',
    not_found: 'error.not_found',
    already_decided: 'decision.already',
  };

  var MESSAGES = window.MESSAGES || {};
  var fallbackCode = null;
  var currentView = null;
  var summaryCrewId = null;
  // Request counters: only the latest response of each kind is rendered.
  var boardSeq = 0;
  var summarySeq = 0;

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

  function setDisabled(buttons, disabled) {
    buttons.forEach(function (button) {
      button.disabled = disabled;
    });
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

  /** Readings in the fixed sensor order, as {key, reading} pairs; sensors without a reading are skipped. */
  function sensorEntries(readings) {
    var source = readings || {};
    return SENSOR_ORDER.filter(function (key) {
      return Object.prototype.hasOwnProperty.call(source, key);
    }).map(function (key) {
      return { key: key, reading: source[key] };
    });
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

  /**
   * Request to `/api/v1${path}` with the access code. GET by default; POST sends `body` as JSON.
   * Maps failures to ApiError kinds.
   */
  async function api(path, method, body) {
    var headers = {};
    var response;
    headers[CODE_HEADER] = readCode() || '';
    var init = { method: method || 'GET', headers: headers, cache: 'no-store' };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    try {
      response = await fetch(API_BASE + path, init);
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
    if (response.status === HTTP_CONFLICT) {
      throw new ApiError('already_decided');
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
    alertsTitle: document.getElementById('alerts-title'),
    alertList: document.getElementById('alerts-list'),
    alertsEmpty: document.getElementById('alerts-empty'),
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
    // Responses still in flight belong to the previous session: ignore them.
    boardSeq += 1;
    summarySeq += 1;
    summaryCrewId = null;
    showView('login');
    refs.codeInput.value = '';
  }

  function kindOf(error) {
    return error instanceof ApiError ? error.kind : 'unavailable';
  }

  /** Shows a failure on the code form while logging in, or in the status line otherwise. */
  function handleError(error) {
    var kind = kindOf(error);
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

  // ---- Alert queue (US4) ----

  /** One open alert: urgency, crew, day, verdict, time, summary button and the three decisions. */
  function alertRow(item) {
    var buttons = [];
    DECISIONS.forEach(function (decision) {
      buttons.push(
        el('button', {
          className: 'button',
          attrs: { type: 'button' },
          text: t('decision.' + decision),
          onClick: function () {
            decide(item, decision, buttons);
          },
        }),
      );
    });
    return el('li', { className: 'alert-item' }, [
      el('p', null, [
        el('span', {
          className: 'urgency-' + classToken(item.urgency, URGENCIES),
          text: t('urgency.' + item.urgency),
        }),
        ' ',
        el('span', { className: 'crew-id', text: item.crewId }),
        ' ',
        el('span', { className: 'crew-day', text: t('crew.day', { day: item.missionDay }) }),
        ' ',
        verdictBadge(item.verdict),
      ]),
      el('p', { className: 'muted', text: formatDateTime(item.createdAt) }),
      el('p', null, [
        el('button', {
          className: 'button',
          attrs: { type: 'button' },
          text: t('alerts.open'),
          onClick: function () {
            showSummary(item.crewId);
          },
        }),
      ]),
      el('p', null, [el('strong', { text: t('decision.prompt') })]),
      el('div', { className: 'decision-buttons' }, buttons),
    ]);
  }

  function renderAlerts(alerts) {
    clear(refs.alertList);
    alerts.forEach(function (item) {
      refs.alertList.appendChild(alertRow(item));
    });
    refs.alertsEmpty.textContent = t('alerts.empty');
    refs.alertsEmpty.hidden = alerts.length !== 0;
  }

  /** Sends one decision. The buttons of that alert stay disabled while the request is in flight. */
  async function decide(item, decision, buttons) {
    setDisabled(buttons, true);
    try {
      await api('/surgeon/alerts/' + encodeURIComponent(item.id) + '/decision', 'POST', { decision: decision });
    } catch (error) {
      setDisabled(buttons, false);
      handleError(error);
      if (kindOf(error) === 'already_decided') {
        refreshAll();
      }
      return;
    }
    refreshAll();
  }

  /** Reloads the queue and the crew list, and the summary when it is open. */
  async function refreshAll() {
    await loadBoard();
    if (currentView === 'summary' && summaryCrewId !== null) {
      await loadSummary(summaryCrewId);
    }
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

  function renderCrew(rows) {
    clear(refs.crewList);
    rows.forEach(function (row) {
      refs.crewList.appendChild(crewRow(row));
    });
    refs.crewEmpty.textContent = t('crew.empty');
    refs.crewEmpty.hidden = rows.length !== 0;
  }

  /** Loads the alert queue and the crew list together. Only the latest response is rendered. */
  async function loadBoard() {
    var seq = ++boardSeq;
    try {
      var data = await Promise.all([api('/surgeon/alerts'), api('/surgeon/crew')]);
      if (seq !== boardSeq) {
        return;
      }
      renderAlerts(data[0]);
      renderCrew(data[1]);
    } catch (error) {
      if (seq === boardSeq) {
        handleError(error);
      }
    }
  }

  function loadCrew() {
    showView('crew');
    return loadBoard();
  }

  // ---- Crew summary ----

  /** Spanish sensor name of the first sensor with no usable reading; falls back to the generic label. */
  function missingSensorLabel(readings) {
    var unknown = sensorEntries(readings).filter(function (entry) {
      return entry.reading.level === UNKNOWN_LEVEL;
    });
    return unknown.length > 0 ? t('sensor.' + unknown[0].key) : t('level.unknown');
  }

  function actionText(actionKey, readings) {
    if (actionKey === MISSING_DATA_ACTION) {
      return t(actionKey, { sensor: missingSensorLabel(readings) });
    }
    return t(actionKey);
  }

  function hasTeamCriterion(readings) {
    return sensorEntries(readings).some(function (entry) {
      return entry.reading.teamCriterion;
    });
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

  /** "decided" line for an alert that has a decision; null otherwise. */
  function decisionNote(alert) {
    if (!alert || alert.status !== DECIDED_STATUS || !alert.decision) {
      return null;
    }
    return el('p', {
      text: t('decision.made', {
        decision: t('decision.' + alert.decision),
        time: formatDateTime(alert.decidedAt),
      }),
    });
  }

  function sensorsTable(readings) {
    var table = el('table', { className: 'sensors' });
    sensorEntries(readings).forEach(function (entry) {
      var reading = entry.reading;
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
          el('th', { attrs: { scope: 'row' }, text: t('sensor.' + entry.key) }),
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
      var nodes = [
        t('indicator.' + observation.indicator) + ': ' +
        formatValue(observation.value) + ' ' + observation.unit + ' (' +
        t('summary.source.' + observation.source) + ')',
      ];
      if (observation.simulated) {
        nodes.push(' ', simulatedBadge());
      }
      list.appendChild(el('li', null, nodes));
    });
    return list;
  }

  /** One check (latest check in full): verdict, action, symptoms, decision, sensors and values. */
  function checkDetail(check) {
    var headChildren = [
      el('strong', { text: t('crew.day', { day: check.missionDay }) + ' · ' }),
      verdictBadge(check.verdict),
      ' ' + formatDateTime(check.completedAt) + ' ',
    ];
    if (check.simulated) {
      headChildren.push(simulatedBadge());
    }
    var nodes = [el('p', null, headChildren)];
    if (check.actionKey) {
      nodes.push(labelled('summary.action', actionText(check.actionKey, check.readings)));
    }
    nodes.push(labelled('summary.symptoms', symptomsText(check.symptoms)));
    var decided = decisionNote(check.alert);
    if (decided) {
      nodes.push(decided);
    }
    nodes.push(section('summary.sensors', sensorsTable(check.readings)));
    nodes.push(section('summary.values', observationsList(check.observations)));
    return el('div', null, nodes);
  }

  /** Notes cell of a history row: simulated mark, team criterion mark, decision. */
  function historyNotes(check) {
    var notes = [];
    if (check.simulated) {
      notes.push(el('div', null, [simulatedBadge()]));
    }
    if (check.verdict !== OK_VERDICT && hasTeamCriterion(check.readings)) {
      notes.push(el('div', { className: 'team-mark', text: TEAM_MARK + t('team.criterion') }));
    }
    var decided = decisionNote(check.alert);
    if (decided) {
      notes.push(decided);
    }
    return notes;
  }

  function historyTable(history) {
    var table = el('table', { className: 'history' });
    var headRow = el('tr', null, [
      el('th', { attrs: { scope: 'col' }, text: t('history.col.day') }),
      el('th', { attrs: { scope: 'col' }, text: t('history.col.date') }),
      el('th', { attrs: { scope: 'col' }, text: t('history.col.verdict') }),
      el('th', { attrs: { scope: 'col' }, text: t('history.col.notes') }),
    ]);
    table.appendChild(el('thead', null, [headRow]));
    var body = el('tbody');
    (history || []).forEach(function (check) {
      body.appendChild(
        el('tr', null, [
          el('td', { text: t('crew.day', { day: check.missionDay }) }),
          el('td', { text: formatDate(check.completedAt) }),
          el('td', null, [verdictBadge(check.verdict)]),
          el('td', null, historyNotes(check)),
        ]),
      );
    });
    table.appendChild(body);
    return table;
  }

  function renderSummary(data) {
    clear(refs.summaryBody);
    refs.summaryBody.appendChild(el('h2', { text: data.crewId }));
    refs.summaryBody.appendChild(labelled('summary.mission_start', data.missionStartDate));
    refs.summaryBody.appendChild(section('summary.latest', checkDetail(data.latest)));
    refs.summaryBody.appendChild(section('summary.history', historyTable(data.history)));
  }

  /** Fetches one crew summary and renders it only if it is still the latest request. */
  async function loadSummary(crewId) {
    var seq = ++summarySeq;
    try {
      var data = await api('/surgeon/crew/' + encodeURIComponent(crewId));
      if (seq === summarySeq) {
        renderSummary(data);
      }
    } catch (error) {
      if (seq === summarySeq) {
        handleError(error);
      }
    }
  }

  function showSummary(crewId) {
    summaryCrewId = crewId;
    showView('summary');
    clear(refs.summaryBody);
    return loadSummary(crewId);
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
    summarySeq += 1;
    summaryCrewId = null;
    loadCrew();
  });

  function setStaticText() {
    document.title = t('page.title');
    document.getElementById('app-title').textContent = t('page.title');
    document.getElementById('app-subtitle').textContent = t('page.subtitle');
    document.getElementById('code-label').textContent = t('code.label');
    document.getElementById('code-submit').textContent = t('code.submit');
    refs.logout.textContent = t('code.logout');
    refs.alertsTitle.textContent = t('alerts.title');
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
