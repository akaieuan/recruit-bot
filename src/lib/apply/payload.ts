import type { ApplicationPlan } from './plan.ts'
import type { Profile } from './profile.ts'

/**
 * Compiles a plan into one browser script that fills a whole form in a single
 * execution.
 *
 * The plan already decided what goes in every field. This only decides how to
 * put it there, so the script carries no judgement of its own: it fills what
 * it was given, leaves the rest alone, and reports what happened. It never
 * clicks Submit and never reads or waits on reCAPTCHA. He sends it.
 *
 * Every value is embedded through JSON.stringify at generation time. Company
 * names carry apostrophes and quotes, drafted answers carry both plus
 * newlines, and none of it is ever interpolated into a code position.
 *
 * Filling is asynchronous because the files are fetched over HTTP, so the
 * script returns 'started' immediately and stashes its report on
 * `window.__recruitbot` when the work settles. A driver reads it in a later
 * call.
 */

export interface PayloadOptions {
  /** HTTP URL the page can fetch the resume from. Local paths do not work. */
  resumeUrl?: string
  coverUrl?: string
  portfolioUrl?: string
  /**
   * Attaching files is off unless asked for.
   *
   * Fetching a file into a form from script is the part that looks like
   * automation to an ATS, and the account it would cost is his. The payload
   * fills every text field and leaves the file inputs alone, so the uploads
   * stay two clicks he makes himself with the files already sitting in the
   * folder this tool writes them to.
   */
  attachFiles?: boolean
}

export interface BuiltPayload {
  js: string
  fills: number
  uploads: number
  /** Everything the payload will not do, in the words he needs to read. */
  warnings: string[]
}

type Ats = 'ashby' | 'greenhouse'
type Slot = 'resume' | 'cover' | 'portfolio'

interface FillSpec {
  label: string
  value: string
  /** Guessed rather than published, so a form without it is not a failure. */
  optional?: boolean
}

interface UploadSpec {
  label: string
  slot: Slot
  url: string
  filename: string
  optional?: boolean
}

interface NoteSpec {
  label: string
  reason: string
}

interface PayloadSpec {
  fills: FillSpec[]
  uploads: UploadSpec[]
  /** Deliberately his: demographics and compensation. Reported, never filled. */
  skipped: NoteSpec[]
  /** No honest value. Reported, never guessed at. */
  unresolved: NoteSpec[]
}

/** The name the ATS shows next to the attachment, so it reads as his file. */
const RESUME_FILENAME = 'Ieuan King - Resume 2026.pdf'

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/**
 * Ashby publishes no form schema, so nothing about its standard fields reaches
 * the plan as a known field. These are the ones every Ashby form has. A null
 * stays null: a missing phone number is reported, never invented.
 */
const ASHBY_STANDARD: { label: string; get: (p: Profile) => string | null | undefined }[] = [
  { label: 'Name', get: (p) => p.full_name },
  { label: 'Email', get: (p) => p.email },
  { label: 'LinkedIn', get: (p) => p.linkedin },
  { label: 'GitHub', get: (p) => p.github },
  { label: 'Website', get: (p) => p.portfolio },
  { label: 'Portfolio', get: (p) => p.portfolio },
  { label: 'Location', get: (p) => p.location },
  { label: 'Phone', get: (p) => p.phone },
]

export function buildAshbyPayload(plan: ApplicationPlan, opts: PayloadOptions): BuiltPayload {
  return build(plan, opts, 'ashby')
}

export function buildGreenhousePayload(plan: ApplicationPlan, opts: PayloadOptions): BuiltPayload {
  return build(plan, opts, 'greenhouse')
}

function build(plan: ApplicationPlan, opts: PayloadOptions, ats: Ats): BuiltPayload {
  const spec: PayloadSpec = { fills: [], uploads: [], skipped: [], unresolved: [] }
  const warnings: string[] = []
  // One label gets one value. A field already answered by the plan is not
  // answered again by the standard map.
  const claimed = new Set<string>()

  for (const r of plan.resolutions) {
    const label = r.field.label || r.field.name
    claimed.add(norm(label))

    if (r.action === 'fill') {
      spec.fills.push({ label, value: typeof r.value === 'boolean' ? (r.value ? 'Yes' : 'No') : r.value })
      continue
    }

    if (r.action === 'upload') {
      const slot = slotFor(`${label} ${r.field.name}`)
      if (!opts.attachFiles) {
        spec.skipped.push({ label, reason: 'upload left for him' })
        continue
      }
      const url = urlFor(slot, opts)
      if (!url) {
        spec.unresolved.push({ label, reason: `no URL for the ${slot} file` })
        warnings.push(`"${label}": no ${slot} URL was supplied, so that upload stays his click`)
        continue
      }
      spec.uploads.push({ label, slot, url, filename: fileNameFor(slot, url) })
      continue
    }

    if (r.action === 'skip') {
      spec.skipped.push({ label, reason: r.reason })
      continue
    }

    spec.unresolved.push({ label, reason: r.reason })
    warnings.push(`"${label}": ${r.reason}`)
  }

  if (ats === 'ashby') {
    for (const field of ASHBY_STANDARD) {
      if (claimed.has(norm(field.label))) continue
      claimed.add(norm(field.label))
      const value = field.get(plan.profile)
      if (value === null || value === undefined || value === '') {
        spec.unresolved.push({ label: field.label, reason: `no value in data/profile.json` })
        warnings.push(`"${field.label}": no value in data/profile.json, so the field is left blank`)
        continue
      }
      spec.fills.push({ label: field.label, value, optional: true })
    }

    // Ashby's Resume field never arrives as a known field.
    if (opts.attachFiles && opts.resumeUrl && !spec.uploads.some((u) => u.slot === 'resume')) {
      spec.uploads.push({ label: 'Resume', slot: 'resume', url: opts.resumeUrl, filename: RESUME_FILENAME })
    }
    if (opts.attachFiles && opts.coverUrl && !spec.uploads.some((u) => u.slot === 'cover')) {
      spec.uploads.push({
        label: 'Cover letter',
        slot: 'cover',
        url: opts.coverUrl,
        filename: fileNameFor('cover', opts.coverUrl),
        // Plenty of Ashby forms have no cover letter field at all.
        optional: true,
      })
    }
  }

  if (!spec.fills.length && !spec.uploads.length) {
    warnings.push('nothing on this plan can be filled from the page. Fill it by hand.')
  }
  if (!opts.attachFiles) {
    warnings.push('files are not attached: upload the resume (and the cover letter when there is one) yourself')
  }

  return { js: runtime(embed(spec), embed(ats)), fills: spec.fills.length, uploads: spec.uploads.length, warnings }
}

function slotFor(hay: string): Slot {
  const h = norm(hay)
  if (/cover/.test(h)) return 'cover'
  if (/portfolio|work sample/.test(h)) return 'portfolio'
  return 'resume'
}

function urlFor(slot: Slot, opts: PayloadOptions): string | undefined {
  if (slot === 'cover') return opts.coverUrl
  if (slot === 'portfolio') return opts.portfolioUrl
  return opts.resumeUrl
}

function fileNameFor(slot: Slot, url: string): string {
  if (slot === 'resume') return RESUME_FILENAME
  const base = (url.split('?')[0] ?? '').split('/').filter(Boolean).pop() ?? ''
  let name = base
  try {
    name = decodeURIComponent(base)
  } catch {
    name = base
  }
  return name || `${slot}.pdf`
}

/**
 * JSON is already valid JS, but `<` and the two line separators break out of
 * some script wrappers. Escaping them costs nothing and means the payload
 * survives whichever driver runs it.
 */
function embed(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

function runtime(specJson: string, atsJson: string): string {
  return `(() => {
  // Fills and reports. It never clicks Submit and never reads or waits on
  // reCAPTCHA: the last action on an application is his, per application.
  var SPEC = ${specJson};
  var ATS = ${atsJson};

  // A report left by an earlier run must never be read as this one's.
  window.__recruitbot = null;

  var report = {
    status: 'done',
    filled: [],
    uploaded: [],
    skipped: SPEC.skipped.slice(),
    unresolved: SPEC.unresolved.slice(),
    errors: [],
  };

  var cut = function (s) {
    s = s == null ? '' : String(s);
    return s.length > 80 ? s.slice(0, 80) : s;
  };
  var norm = function (s) {
    return (s == null ? '' : String(s)).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  };
  var list = function (nodes) { return Array.prototype.slice.call(nodes); };
  var say = function (err) { return err && err.message ? err.message : String(err); };

  var root = function () {
    if (ATS === 'ashby') {
      // The rest of an Ashby page is the job description, which carries labels
      // of its own. The form is inside the application tabpanel.
      var panel = document.querySelector('[role="tabpanel"]');
      if (panel && panel.querySelector('input, textarea, select')) return panel;
    }
    return document;
  };

  var labelNodes = function () {
    return list(root().querySelectorAll(ATS === 'greenhouse' ? 'label, legend' : 'label'));
  };
  var fileInputs = function () { return list(root().querySelectorAll('input[type=file]')); };
  var textOf = function (el) { return norm(el.textContent); };

  var nearestLabel = function (el) {
    var nodes = labelNodes();
    var found = null;
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) found = nodes[i];
    }
    return found;
  };

  var used = [];

  var findLabel = function (want) {
    var n = norm(want);
    if (!n) return null;
    var nodes = labelNodes().filter(function (l) { return used.indexOf(l) < 0 && textOf(l); });
    var pick = function (test) {
      for (var i = 0; i < nodes.length; i++) if (test(textOf(nodes[i]))) return nodes[i];
      return null;
    };
    // Exact wording first. A short label like "Name" matching loosely would
    // land in the wrong box, so only labels long enough to be distinctive get
    // the containment passes.
    var hit = pick(function (t) { return t === n; });
    if (!hit) hit = pick(function (t) { return t.indexOf(n) === 0; });
    if (!hit && n.length >= 4) hit = pick(function (t) { return t.indexOf(n) >= 0; });
    if (!hit && n.length >= 4) hit = pick(function (t) { return t.length >= 4 && n.indexOf(t) === 0; });
    if (hit) used.push(hit);
    return hit;
  };

  var CONTROLS = 'input:not([type=file]):not([type=hidden]), textarea, select';

  var controlFor = function (labelEl) {
    var id = labelEl.getAttribute('for');
    if (id) {
      var byId = document.getElementById(id);
      if (byId && /^(input|textarea|select)$/i.test(byId.tagName)) return byId;
    }
    var inside = labelEl.querySelector(CONTROLS);
    if (inside) return inside;
    // Ashby puts the control in a sibling container rather than inside the
    // label. The nearest-label check stops the walk up from reaching the next
    // question's field.
    var scope = labelEl.parentElement;
    for (var i = 0; i < 3 && scope; i++) {
      var found = list(scope.querySelectorAll(CONTROLS)).filter(function (el) {
        return nearestLabel(el) === labelEl;
      })[0];
      if (found) return found;
      scope = scope.parentElement;
    }
    return null;
  };

  var nativeSet = function (el, value) {
    // React tracks the value it last wrote and ignores a plain .value write,
    // so the write goes through the prototype's own setter and the events are
    // the ones React is listening for.
    var proto = /textarea/i.test(el.tagName) ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    var setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  var setSelect = function (el, value) {
    var want = norm(value);
    var options = list(el.options);
    var match = null;
    for (var i = 0; i < options.length; i++) {
      if (norm(options[i].textContent) === want || norm(options[i].value) === want) { match = options[i]; break; }
    }
    if (!match) {
      for (var j = 0; j < options.length; j++) {
        var t = norm(options[j].textContent);
        if (t && t.indexOf(want) === 0) { match = options[j]; break; }
      }
    }
    // A value that is not on the list is a gap, not something to force.
    if (!match) return false;
    el.value = match.value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  };

  var clickChoice = function (labelEl, value) {
    var want = String(value).trim().toLowerCase();
    if (want !== 'yes' && want !== 'no') return false;
    var scope = labelEl.parentElement;
    for (var i = 0; i < 4 && scope; i++) {
      var buttons = list(scope.querySelectorAll('button'));
      for (var j = 0; j < buttons.length; j++) {
        var b = buttons[j];
        // Only a button whose entire text is Yes or No, and only one sitting
        // under this question. Nothing else on the page is ever clicked.
        if (String(b.textContent == null ? '' : b.textContent).trim().toLowerCase() !== want) continue;
        if (nearestLabel(b) !== labelEl) continue;
        b.click();
        return true;
      }
      scope = scope.parentElement;
    }
    return false;
  };

  var TEXTUAL = ['text', 'email', 'url', 'tel', 'search', 'number', ''];

  var fill = function (spec) {
    var labelEl = findLabel(spec.label);
    if (!labelEl) {
      // A guessed standard field this form does not have is not an error:
      // Ashby publishes no schema, so that map is guesswork by design.
      if (!spec.optional) report.errors.push('no field on this page labelled "' + cut(spec.label) + '"');
      return;
    }
    var el = controlFor(labelEl);
    if (!el) {
      // Ashby asks yes/no as a pair of buttons with no control to write into.
      if (clickChoice(labelEl, spec.value)) {
        report.filled.push({ label: cut(spec.label), value: cut(spec.value) });
        return;
      }
      if (!spec.optional) report.errors.push('found "' + cut(spec.label) + '" but no control under it');
      return;
    }
    var tag = el.tagName.toLowerCase();
    if (tag === 'select') {
      if (!setSelect(el, spec.value)) {
        report.errors.push('"' + cut(spec.value) + '" is not an option on "' + cut(spec.label) + '"');
        return;
      }
    } else if (tag === 'textarea' || TEXTUAL.indexOf(String(el.type == null ? '' : el.type)) >= 0) {
      nativeSet(el, spec.value);
    } else {
      report.errors.push('"' + cut(spec.label) + '" is a ' + (el.type || tag) + ', which this payload does not fill');
      return;
    }
    report.filled.push({ label: cut(spec.label), value: cut(spec.value) });
  };

  var followingFileInput = function (labelEl) {
    var inputs = fileInputs();
    for (var i = 0; i < inputs.length; i++) {
      if (labelEl.compareDocumentPosition(inputs[i]) & Node.DOCUMENT_POSITION_FOLLOWING) return inputs[i];
    }
    return null;
  };

  var fileInputFor = function (spec) {
    var inputs = fileInputs();
    if (!inputs.length) return null;
    var wanted = spec.slot === 'cover' ? /cover/ : spec.slot === 'portfolio' ? /portfolio|work sample/ : /resume|cv/;
    var stale = function (t) { return spec.slot === 'resume' && /cover|autofill/.test(t); };

    var named = inputs.filter(function (i) {
      var hay = norm(
        (i.getAttribute('name') || '') + ' ' + (i.getAttribute('id') || '') + ' ' + (i.getAttribute('aria-label') || ''),
      );
      return hay && !stale(hay) && wanted.test(hay);
    });
    if (named.length) return named[0];

    var labels = labelNodes().filter(function (l) {
      var t = textOf(l);
      return t && !stale(t) && (t === norm(spec.label) || wanted.test(t));
    });
    // Exact wording first: on Ashby both the Resume field and the "Autofill
    // from resume" box mention a resume.
    var exact = labels.filter(function (l) { return textOf(l) === norm(spec.label); });
    var ordered = exact.concat(labels.filter(function (l) { return exact.indexOf(l) < 0; }));
    for (var k = 0; k < ordered.length; k++) {
      var near = followingFileInput(ordered[k]);
      if (near) return near;
    }

    if (spec.slot !== 'resume') return null;
    // Ashby's first file input is the "Autofill from resume" convenience box,
    // which parses a resume instead of attaching it. The real field is last.
    return ATS === 'ashby' ? inputs[inputs.length - 1] : inputs[0];
  };

  var attach = async function (spec) {
    var input = fileInputFor(spec);
    if (!input) {
      if (!spec.optional) report.errors.push('no file input for "' + cut(spec.label) + '"');
      return;
    }
    var res = await fetch(spec.url);
    if (!res.ok) {
      report.errors.push('could not fetch ' + cut(spec.url) + ' (' + res.status + ')');
      return;
    }
    var blob = await res.blob();
    var file = new File([blob], spec.filename, { type: blob.type || 'application/pdf' });
    // A file input only accepts a FileList, and DataTransfer is the one way to
    // build one from script.
    var dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    report.uploaded.push({ label: cut(spec.label), file: cut(spec.filename), bytes: file.size });
  };

  var run = async function () {
    for (var i = 0; i < SPEC.fills.length; i++) {
      try {
        fill(SPEC.fills[i]);
      } catch (err) {
        report.errors.push('"' + cut(SPEC.fills[i].label) + '": ' + say(err));
      }
    }
    for (var j = 0; j < SPEC.uploads.length; j++) {
      try {
        await attach(SPEC.uploads[j]);
      } catch (err) {
        report.errors.push('"' + cut(SPEC.uploads[j].label) + '": ' + say(err));
      }
    }
  };

  run().then(
    function () {
      // Anything the payload could not do is a failure to look at, not a
      // detail to bury. He reads this before anything is sent.
      report.status = report.errors.length ? 'failed' : 'done';
      window.__recruitbot = report;
    },
    function (err) {
      report.status = 'failed';
      report.errors.push(say(err));
      window.__recruitbot = report;
    },
  );

  return 'started';
})()`
}
