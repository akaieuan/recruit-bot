-- recruit-bot schema. Applied idempotently on every open; see src/lib/db.ts.
-- Stage vocabulary and status enums are the contract between the CLI, the
-- Claude Code commands, and the review UI. Changing one means changing all three.

CREATE TABLE IF NOT EXISTS boards (
  id          INTEGER PRIMARY KEY,
  ats         TEXT NOT NULL CHECK (ats IN ('ashby', 'greenhouse')),
  board_token TEXT NOT NULL,
  company     TEXT,
  active      INTEGER NOT NULL DEFAULT 1,
  added_at    TEXT NOT NULL,
  notes       TEXT,
  UNIQUE (ats, board_token)
);

CREATE TABLE IF NOT EXISTS postings (
  id               INTEGER PRIMARY KEY,
  ats              TEXT NOT NULL CHECK (ats IN ('ashby', 'greenhouse', 'manual')),
  board_token      TEXT,
  job_id           TEXT,
  url              TEXT NOT NULL UNIQUE,
  company          TEXT NOT NULL,
  role_title       TEXT NOT NULL,
  location         TEXT,
  remote_policy    TEXT CHECK (remote_policy IN ('onsite', 'hybrid', 'remote', 'unknown')),
  -- Compensation in whole USD. NULL means the employer did not publish it.
  -- Never inferred, never estimated.
  comp_min         INTEGER,
  comp_max         INTEGER,
  -- Extracted from the JD text when stated. Advisory only: years never reject.
  years_min        INTEGER,
  years_max        INTEGER,
  description_html TEXT,
  description_text TEXT,
  content_hash     TEXT,
  first_seen       TEXT NOT NULL,
  last_seen        TEXT NOT NULL,
  closed_at        TEXT,
  stage            TEXT NOT NULL DEFAULT 'new' CHECK (stage IN (
                     'new', 'auto_rejected', 'needs_score', 'scored',
                     'needs_research', 'researched', 'needs_draft',
                     'in_review', 'approved', 'applied', 'skipped')),
  stage_reason     TEXT,
  comp_flag        INTEGER NOT NULL DEFAULT 0,
  years_flag       TEXT,
  UNIQUE (ats, board_token, job_id)
);

CREATE INDEX IF NOT EXISTS idx_postings_stage ON postings (stage);
CREATE INDEX IF NOT EXISTS idx_postings_company ON postings (company);

-- Append-only. The most recent row for a posting is the live score.
CREATE TABLE IF NOT EXISTS scores (
  id                    INTEGER PRIMARY KEY,
  posting_id            INTEGER NOT NULL REFERENCES postings (id) ON DELETE CASCADE,
  scored_at             TEXT NOT NULL,
  score                 INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  tier                  TEXT NOT NULL CHECK (tier IN ('strong', 'possible', 'long_shot', 'reject')),
  title_match           TEXT CHECK (title_match IN ('ideal', 'adjacent', 'off')),
  keyword_hits          TEXT,
  -- Model recall, not verified fact. Labeled as an estimate everywhere it is shown.
  company_size_estimate TEXT,
  stage_estimate        TEXT,
  nyc                   TEXT CHECK (nyc IN ('in_person', 'hybrid', 'remote_ok', 'not_nyc', 'unknown')),
  rationale             TEXT NOT NULL,
  recommendation        TEXT NOT NULL CHECK (recommendation IN ('advance', 'hold', 'skip'))
);

CREATE INDEX IF NOT EXISTS idx_scores_posting ON scores (posting_id, id DESC);

CREATE TABLE IF NOT EXISTS research (
  id              INTEGER PRIMARY KEY,
  posting_id      INTEGER NOT NULL REFERENCES postings (id) ON DELETE CASCADE,
  researched_at   TEXT NOT NULL,
  company_summary TEXT,
  funding         TEXT,
  headcount       TEXT,
  hard_problem    TEXT,
  -- JSON [{ jd_line, fact_ids: [] }]: the JD lines worth answering and the
  -- fact-library entries that answer them.
  jd_lines        TEXT,
  sources         TEXT,
  raw_md          TEXT
);

CREATE INDEX IF NOT EXISTS idx_research_posting ON research (posting_id, id DESC);

CREATE TABLE IF NOT EXISTS question_schemas (
  id         INTEGER PRIMARY KEY,
  posting_id INTEGER NOT NULL UNIQUE REFERENCES postings (id) ON DELETE CASCADE,
  fetched_at TEXT NOT NULL,
  raw_json   TEXT NOT NULL,
  questions  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS drafts (
  id              INTEGER PRIMARY KEY,
  posting_id      INTEGER NOT NULL REFERENCES postings (id) ON DELETE CASCADE,
  kind            TEXT NOT NULL CHECK (kind IN ('cover_letter', 'answer')),
  question_key    TEXT,
  version         INTEGER NOT NULL DEFAULT 1,
  body            TEXT NOT NULL,
  contact_variant TEXT NOT NULL DEFAULT 'design' CHECK (contact_variant IN ('design', 'engineering')),
  -- JSON array of ids from data/facts.json. Every claim traces to one of these.
  facts_used      TEXT NOT NULL,
  jd_lines        TEXT,
  critique        TEXT,
  review_note     TEXT,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'needs_edit', 'approved', 'rejected')),
  pdf_path        TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  UNIQUE (posting_id, kind, question_key, version)
);

CREATE INDEX IF NOT EXISTS idx_drafts_posting ON drafts (posting_id, id DESC);

-- The tracker. Seeded from the historical CSV, then extended by the pipeline.
CREATE TABLE IF NOT EXISTS applications (
  id                   INTEGER PRIMARY KEY,
  posting_id           INTEGER REFERENCES postings (id) ON DELETE SET NULL,
  company              TEXT NOT NULL,
  role                 TEXT NOT NULL,
  location             TEXT,
  comp_range           TEXT,
  ats                  TEXT,
  url                  TEXT,
  applied_at           TEXT,
  -- 'before' encodes the CSV's "before <date>" sentinel: the application
  -- happened at or before applied_at, exact day unknown.
  applied_at_precision TEXT CHECK (applied_at_precision IN ('day', 'before')),
  materials            TEXT,
  status               TEXT NOT NULL CHECK (status IN (
                         'unknown', 'applied', 'no_response', 'in_progress',
                         'interviewing', 'rejected', 'offer', 'withdrawn', 'do_not_apply')),
  status_raw           TEXT,
  status_ambiguous     INTEGER NOT NULL DEFAULT 0,
  notes                TEXT,
  follow_up_at         TEXT,
  followed_up_at       TEXT,
  source               TEXT NOT NULL DEFAULT 'pipeline' CHECK (source IN ('csv_import', 'pipeline', 'manual', 'linkedin', 'inbox')),
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL,
  UNIQUE (company, role, url)
);

CREATE INDEX IF NOT EXISTS idx_applications_status ON applications (status);
CREATE INDEX IF NOT EXISTS idx_applications_followup ON applications (follow_up_at);

-- Interview prep, one row per posting. Written by /prep, read by the Prep page.
-- Sections mirror the doc that worked: what the product is, the vocabulary that
-- is expensive to get wrong, why he fits, where he does not, and what to ask.
CREATE TABLE IF NOT EXISTS prep (
  id             INTEGER PRIMARY KEY,
  posting_id     INTEGER NOT NULL UNIQUE REFERENCES postings (id) ON DELETE CASCADE,
  written_at     TEXT NOT NULL,
  headline       TEXT,
  product        TEXT,
  -- JSON [{ term, meaning }]. Getting a domain word wrong is expensive.
  vocabulary     TEXT,
  the_angle      TEXT,
  -- JSON [string]
  why_you_fit    TEXT,
  where_you_lack TEXT,
  scoped         TEXT,
  questions      TEXT,
  this_week      TEXT,
  sources        TEXT
);
