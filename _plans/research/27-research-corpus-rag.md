# 27 — Research Corpus RAG Assessment

**Scope:** Assess whether `PeakPerformanceData/ppd_research_papers` can support evidence-grounded coaching (agent cites peer-reviewed sports-science literature), and specify a retrieval design if viable.  
**Status:** Read-only research. No application code was modified.  
**Date:** 2026-08-02  
**Submodule remote:** `git@github.com:daniellpsilva1/ppd_research_papers.git`  
**Submodule HEAD (local):** `8d3a664` — *Add initial research papers collection*

---

## Verdict (TL;DR)

| Question | Answer |
|---|---|
| Is this a full-text literature corpus? | **No.** There are **zero PDFs**. The repo is a **curated research memo**: Markdown annotated bibliographies + one BibTeX file. |
| Document count / size | **45 files** (excl. `.git`), **~363 KB** total content. |
| Cited papers (not full text) | README claims **250+**; team Top-10 lists contain **~330 numbered entries** (~323 unique titles); BibTeX has **88 structured entries**. |
| Can it support evidence-grounded coaching today? | **Partially — as citation metadata + synopsis RAG**, not as full-text scientific RAG. |
| Full-text peer-reviewed RAG? | **Not viable until PDFs/OA full text are acquired and legally cleared.** |
| Phase recommendation | **Early phase:** lightweight “evidence card” tool from existing MD + BibTeX (after DOI hygiene). **Later phase:** full-text PDF pipeline. |
| Effort (honest) | **Phase A (citation cards):** ~1.5–3 eng-weeks. **Phase B (full-text RAG):** ~6–10 eng-weeks + legal/acquisition cost, after PDF corpus exists. |

**Bottom line:** Treat this submodule as an **algorithm research brief and curated reading list**, not a literature warehouse. It is excellent seed material for *which* papers to cite and *why they matter to PPD*, but it cannot currently ground recommendations in verifiable paper passages.

---

## 1. Corpus structure

```
PeakPerformanceData/ppd_research_papers/
├── README.md                          # Index + how to read
├── STATUS.md                          # Data/algorithm caveats (not literature)
├── 00_briefable_research_memo.md      # Executive brief
├── 01_stack_and_data_map.md           # PPD stack mapping
├── 02_curated_top_50.md               # Cross-team Top 50 papers
├── 03_top_algorithms.md               # Algorithm shortlist
├── 04_application_map_to_ppd_stack.md # Algo → data → package map
├── 05_competitive_landscape.md
├── 06_open_datasets_benchmarks.md
├── bib/references.bib                 # Structured BibTeX (88 entries)
├── teams/                             # 33 Top-10 must-read lists
│   ├── A_wearable_anomaly_top10.md … AG_biomechanics_top10.md
│   └── Q_… AB_… (industry/landscape teams)
└── _plans/ppd_algorithm_research_cf3f801b.plan.md
```

**README purpose (verbatim intent):** algorithm research memo consolidated from a 48-agent research swarm — stack/data map, curated top-50, team Top-10s, algorithms, application map. Explicitly **out of scope:** designing/building an AI agentic layer.

**Formats present:** Markdown (`.md`), BibTeX (`.bib`), `.gitignore`.  
**Formats absent:** PDF, HTML full text, RIS, CSV indexes, embeddings, vector stores, extracted plain text of papers.

---

## 2. Exact counts and sizes

| Format | Files | Bytes | Size |
|--------|------:|------:|------|
| Markdown (`.md`) | 43 | 345,467 | 337.4 KB |
| BibTeX (`.bib`) | 1 | 25,829 | 25.2 KB |
| Other (`.gitignore`) | 1 | 38 | ~0 KB |
| **Total (excl. `.git`)** | **45** | **371,334** | **~0.35 MB** |

**Breakdown of the 43 Markdown files:**
| Bucket | Count | Role |
|--------|------:|------|
| Root memo docs (`00`–`06`, `README`, `STATUS`) | 9 | Synthesis / ops notes |
| `teams/*.md` | 33 | Domain Top-10 lists |
| `_plans/*.md` | 1 | Internal plan |

**Cited-paper inventory (not files):**
| Metric | Count | Source |
|--------|------:|--------|
| Team Top-10 numbered entries | ~330 | `teams/*.md` (`## N. Title`) |
| Approx. unique titles | ~323 | Deduped titles across teams |
| Unique DOI-like strings in team MD | ~206 | Regex `10.xxxx/...` |
| BibTeX entries | 88 | `bib/references.bib` (`@article` 75, `@inproceedings` 11, `@book` 1, `@incollection` 1) |
| BibTeX with `doi = {}` | 65 | 23 entries lack DOI (mostly CS/arXiv/conference) |
| Curated Top 50 | 50 | `02_curated_top_50.md` |

**PDFs:** **0**. `.gitignore` only ignores `.DS_Store` / IDE folders — PDFs are not gitignored; they simply were never added.

---

## 3. Content quality (sampled)

### 3.1 What each “document” actually contains

Team files (e.g. `teams/B_hrv_readiness_top10.md`, `teams/C_training_load_top10.md`, `teams/AC_junior_ltad_top10.md`) are **structured annotated bibliographies**, typically:

- Title / lead author
- Year, venue
- DOI or “N/A” / “Forthcoming”
- Short “Algorithm” synopsis (1–3 sentences)
- “PPD relevance” paragraph mapping the paper to PPD data/tables/alerts

Root `02_curated_top_50.md` is a scored shortlist with implementability notes (SQL/Python, no ML vs ML, data prerequisites).

`bib/references.bib` holds **canonical bibliographic metadata** for the Top 50 + key must-reads:

```bibtex
@article{plews2013hrv,
  author = {Plews, D. J. and Laursen, P. B. and ...},
  title = {Training adaptation and heart rate variability in elite endurance athletes},
  journal = {Sports Medicine},
  year = {2013},
  volume = {43},
  pages = {773--781},
  doi = {10.1007/s40279-013-0076-4}
}
```

### 3.2 Quality signal — peer-reviewed vs mix

**Primary intent:** peer-reviewed sports science + methods papers (BJSM, Sports Med, IJSPP, MSSE, J. Sports Sci., Circulation HRV Task Force, etc.).

**Actual mix:**
| Class | Examples in corpus | Share (qualitative) |
|-------|--------------------|---------------------|
| Peer-reviewed articles / consensus | Plews 2013, Impellizzeri 2020, Meeusen 2013, IOC youth 2015, Jayanthi 2011 | Core of algorithm teams (A–O, X–AG) |
| Narrative / systematic reviews | Halson 2014, Bourdon 2017, Claudino 2019 (Team AE) | Well represented as “anchors” |
| Conference / arXiv / CS methods | Isolation Forest, PELT, Chronos, ByteTrack, PatchTST | Heavy in ML/CV/TS teams |
| Vendor whitepapers / product docs | Firstbeat whitepapers; Apple/Garmin/Whoop/Fitbit notes (Teams B, Q, R, AB) | Common in industry teams |
| Placeholder / forthcoming / suspicious DOIs | e.g. `10.1080/02640414.2025.1234567 (forthcoming)` in Team B; similar `…1234567` patterns in AG, H, V | **Material risk** — do not cite blindly |
| N/A DOI (book, product, whitepaper, dataset) | Banister book chapter; AMS/startup product notes; open datasets | ~70 N/A/Forthcoming/placeholder-style hits across team MD |

**Honest quality assessment:** The **Top 50 + BibTeX core** looks like a credible, PPD-mapped reading list dominated by real journals. The **long tail of team lists** mixes solid reviews with industry notes and some **unverified / synthetic-looking DOIs**. A swarm-generated corpus without full-text verification is **not citation-safe for production coaching advice** until DOIs are validated against Crossref/OpenAlex.

---

## 4. Topic coverage

Assessed from team file domains + keyword presence across Markdown.

| Subject area | Coverage | Evidence |
|--------------|----------|----------|
| **HRV / readiness** | **Strong** | Team B; many Top-50 Tier-1 papers; ~240 “HRV” hits |
| **Training load / ACWR / TSB / TRIMP / sRPE** | **Strong** | Teams C, Z, O; Impellizzeri/Gabbett/Foster/Coyne |
| **Sleep / recovery** | **Strong** | Teams D, AE, AF; Halson; wearable sleep validation |
| **Injury risk** | **Strong** | Team F; Gabbett; Claudino cautionary review |
| **Overreaching / OTS** | **Good** | Team AF; Meeusen consensus |
| **Tennis analytics / CV / pose / spatiotemporal** | **Strong (methods)** | Teams G, H, I, AA, E, AG — more CS/vision than coaching physiology |
| **Tennis biomechanics** | **Moderate** | Team AG — list exists; some entries look thin/placeholder |
| **Youth / junior / LTAD** | **Good** | Team AC (IOC, Jayanthi age-hours rule, PHV, specialization) |
| **Wellness / RPE questionnaires** | **Good** | Team Z |
| **Periodization** | **Moderate** | Team O |
| **PPG / signal quality** | **Good** | Team X |
| **VO2 / lactate / critical power** | **Moderate** | Team Y |
| **Nutrition** | **Thin** | Scattered mentions (Halson recovery; RED-S differential in AF); **no dedicated team** |
| **Biomarkers (blood/labs)** | **Thin** | OTS biomarker paper in AF; no lab-panel literature set |
| **Genetics** | **Absent / near-zero** | No dedicated team; essentially no corpus content |

**Well covered for PPD’s core coaching loop:** readiness (HRV), load progression, recovery/sleep, overreaching screening, junior load caps, injury-risk *framing* (with appropriate caution).  
**Thin for consumer/health expansion:** nutrition programming, lab biomarkers, genetics — these cannot be evidence-grounded from this corpus alone.

---

## 5. Metadata: structured vs PDF-only

| Metadata field | Structured? | Where |
|----------------|-------------|--------|
| Title | Yes (MD + BibTeX) | Team entries, Top 50, `.bib` |
| Authors | Partial → Yes in BibTeX | Team lists often “et al.”; BibTeX fuller |
| Year | Yes | MD + BibTeX |
| Journal / venue | Yes | MD + BibTeX (`journal` / `booktitle`) |
| DOI | Partial | 65/88 BibTeX; many team entries; **some fake/forthcoming** |
| Volume / pages | Yes (BibTeX) | Rarely in MD |
| Abstract | **No** | Not stored |
| Full text / PDF path | **No** | N/A |
| MeSH / topic tags | **No** formal ontology | Implicit via team letter (B=HRV, C=load…) |
| PPD relevance notes | Yes (unstructured prose) | Every team entry + Top 50 |

**Conclusion:** Metadata exists in a **usable structured form for the BibTeX subset (88)** and a **semi-structured form for ~300+ team entries**. Nothing is locked inside PDFs because there are no PDFs. The valuable “PPD relevance” text is Markdown-only and should be preserved as first-class fields in any index.

---

## 6. Existing extraction / indexing / embedding work

### Inside `ppd_research_papers`
- **None.** No scripts, no embeddings, no chunk store, no search index, no PDF pipeline.
- Only human/agent-written Markdown + BibTeX + one plan file.

### Elsewhere in the monorepo (related but not literature RAG)
| Asset | Path | Relevance |
|-------|------|-----------|
| Athlete semantic memory (pgvector) | `peak_performance_data/src/lib/ai/utils/semanticMemory.ts` | `text-embedding-3-small` (1536-d) + `match_ai_memories` RPC |
| `ai_memories` table + HNSW | `supabase/migrations/20260311_ai_telemetry_and_memory.sql` | **User/coach memories**, not papers |
| Eval citation checks | `_plans/research/10-eval-harness.md` | Notes that “citation” today is weak (non-empty string ≠ real source) |
| Insight evidence chips | `_plans/research/03-insight-schema.md` | Metric provenance, not literature DOIs |

**No literature collection, chunk table, or paper-embedding pipeline exists.** pgvector infrastructure for *memories* can be reused as a pattern for a separate `research_chunks` table — do **not** overload `ai_memories`.

---

## 7. Viability decision tree

```
Can we cite peer-reviewed literature in coaching answers?
├── Need verifiable passage from paper body?
│   └── NO today → acquire OA/full-text first (Phase B)
├── Need “authoritative named paper + claim synopsis + DOI link”?
│   └── YES with caveats → Phase A on MD + BibTeX after DOI hygiene
└── Nutrition / genetics / lab biomarkers?
    └── Corpus insufficient → expand bibliography or defer
```

**Viability for the stated capability (“evidence-grounded coaching”):**

1. **Strict definition** (retrieve supporting *passages*, quote/paraphrase with page/section): **Not viable now.**
2. **Pragmatic definition** (retrieve curated evidence cards; agent may only cite `cite_key`s returned by the tool; UI links DOI): **Viable as an early, high-ROI capability** — and better aligned with what the corpus actually is.

---

## 8. Recommended retrieval design

### 8.1 Two-phase architecture

#### Phase A — Evidence Cards (early; use existing corpus)

**Goal:** Agent recommendations can attach **verified bibliographic citations** with short, corpus-authored synopses (algorithm + PPD relevance). No PDF required.

**Ingestion**
1. Parse `bib/references.bib` → `research_papers` rows (canonical).
2. Parse `teams/*.md` + `02_curated_top_50.md` → `research_evidence_cards` (one card per numbered entry).
3. **DOI hygiene job (mandatory before prod):**
   - Resolve DOI via Crossref / OpenAlex / DOI.org.
   - Flag `status ∈ {verified, unresolved, placeholder, vendor_non_peer_reviewed}`.
   - Drop or quarantine entries with placeholder patterns (`1234567`, `Forthcoming` without real DOI).
4. Embed card text: `title + venue + algorithm synopsis + PPD relevance` with `text-embedding-3-small` (already used in-repo) **or** the same embedding provider the agent stack standardizes on.
5. Build Postgres FTS (`tsvector`) on title + synopsis + topics.

**Chunking (Phase A)**
- **Do not chunk like a PDF.** One evidence card ≈ one retrieval unit (typically 150–400 tokens).
- Optional: split “Algorithm” vs “PPD relevance” as two chunks sharing the same `paper_id`, if retrieval quality needs it.

**Metadata to attach (per card / paper)**
| Field | Purpose |
|-------|---------|
| `cite_key` | Stable ID (BibTeX key or slug) — **only IDs the LLM may emit** |
| `title`, `authors`, `year`, `venue` | Display + verification |
| `doi`, `doi_url` | External verifiability |
| `doi_status` | Gate citations |
| `document_class` | `peer_reviewed` / `review` / `preprint` / `whitepaper` / `product` |
| `topics[]` | From team letter + keywords (`hrv`, `training_load`, …) |
| `ppd_fit_tier` | From Top 50 tier if present |
| `source_path` | Absolute path in submodule for audit |
| `license_notes` | For Phase B full text |

#### Phase B — Full-text RAG (later; only after PDF/OA acquisition)

**Extraction**
1. Prefer **open-access** HTML/PDF via Unpaywall / OpenAlex / publisher OA.
2. PDF text: Docling / Grobid / Marker for layout-aware extraction (title, abstract, sections, refs).
3. Store raw extract + section labels; keep PDF in **private object storage** (Supabase Storage or S3), not git.
4. Legal: do not ship closed PDFs in a public submodule; respect license for embedding/storage.

**Chunking suitable for scientific papers**
| Chunk type | Strategy | Why |
|------------|----------|-----|
| Abstract | Single chunk | Dense claims; high citation value |
| Section chunks | By heading (Intro/Methods/Results/Discussion); 400–800 tokens; 80–120 token overlap | Preserves argument structure |
| Claim snippets | Optional LLM extraction of “recommendation-like” sentences with section anchor | Better for coaching Q→A |
| Tables | Separate table-as-text chunks with caption | Load thresholds, SWC defs often live in tables |

**Never** naive fixed 512-token sliding windows across the whole PDF without section boundaries — it destroys Methods/Results locality and increases hallucinated attribution.

### 8.2 Vector store: Supabase pgvector vs ClickHouse

| Store | Use |
|-------|-----|
| **Supabase Postgres + pgvector** | **Primary.** Literature is small (even Phase B: hundreds of papers × tens of chunks). Needs transactional metadata, RLS-optional public read for server role, hybrid FTS + vector, joins to `cite_key`. Reuse patterns from `ai_memories` / HNSW — **separate tables**. |
| **ClickHouse** | **Not primary** for this corpus. CH is for high-volume wearable/tennis analytics. Optional later: export citation *telemetry* (which papers were retrieved) for analytics — not the vector index itself. |

Suggested schema (conceptual):

```sql
-- research_papers: one row per bibliographic work
-- research_chunks: paper_id, chunk_type, section, content, embedding vector(1536), fts
-- research_evidence_cards: Phase A cards (may map 1:1 to abstract-level chunks later)
-- RPC: match_research_chunks(query_embedding, query_text, topics[], match_count)
```

Do **not** put papers in `ai_memories` (wrong tenancy, wrong RLS, wrong semantics).

### 8.3 Hybrid search + reranking

**Retrieve (k=30–50):**
1. **Dense:** cosine / HNSW on embedding of user coaching question (+ optional athlete context tags like `junior`, `hrv_low`).
2. **Sparse:** Postgres `ts_rank_cd` / BM25-style FTS on title + body.
3. **Fusion:** RRF (reciprocal rank fusion) or weighted sum after score normalization.
4. **Filters:** `doi_status = 'verified'`; prefer `document_class IN ('peer_reviewed','review')` for athlete-facing advice; allow methods papers for engineer-facing tools.

**Rerank (k→5–8):**
- Cross-encoder or LLM reranker scoring “Does this card support answering the coach question?”
- Boost Top-50 / multi-team ★ papers for PPD-core topics.
- Hard filter: if top score &lt; threshold → **return no citations** (better than weak ones).

### 8.4 Making citations verifiable (anti-fabrication) — critical

The agent must be **unable to invent references**. Enforce mechanically:

1. **Tool-only citations.** System prompt: “You may only cite `cite_key` values returned by `lookup_research_evidence`. Never invent authors, years, titles, or DOIs.”
2. **Structured citation objects** from the tool, not free text:

   ```json
   {
     "cite_key": "plews2013hrv",
     "title": "...",
     "authors": "Plews et al.",
     "year": 2013,
     "venue": "Sports Medicine",
     "doi": "10.1007/s40279-013-0076-4",
     "doi_url": "https://doi.org/10.1007/s40279-013-0076-4",
     "snippet": "7-day rolling LnRMSSD + CV for readiness...",
     "source_path": "teams/B_hrv_readiness_top10.md",
     "doi_status": "verified"
   }
   ```

3. **Server-side citation validator** before response commit:
   - Extract claimed `cite_key` / DOI from model output.
   - Reject if not ⊆ retrieved set for this turn.
   - Reject if `doi_status != verified` for athlete-facing claims.
4. **UI evidence chips** link to `doi_url` (and later to stored PDF page/section). User can open the real paper.
5. **Eval gate** (extend `_plans/research/10-eval-harness.md`): citation validity = key exists in DB + DOI resolves + (Phase B) snippet ⊆ chunk text / embedding similarity floor.
6. **Abstain policy:** If no verified card ranks above threshold, say so and give data-grounded advice without fake literature.
7. **Class labeling:** Never present vendor whitepapers as peer-reviewed. Surface `document_class` in the chip.

Phase A snippets come from **our curated synopses** (still better than hallucinated papers). Label them clearly as “curated evidence note” until Phase B can quote the paper itself.

### 8.5 Agent integration sketch

- New tool: `lookup_research_evidence(query, topics?, max_results=5)`.
- Called by coaching/readiness/load specialists when making a **normative recommendation** (“reduce load”, “HRV below SWC”, “junior hours ≤ age”).
- Insight schema: add optional `literature_citations: CiteKey[]` alongside metric `evidence[]` chips (orthogonal provenance: data vs literature).

---

## 9. Effort estimate

| Workstream | Effort | Notes |
|------------|--------|-------|
| DOI hygiene + parse MD/BibTeX → Postgres | 3–5 days | Includes Crossref validation; quarantine placeholders |
| Evidence-card embeddings + hybrid RPC | 3–5 days | Mirror `ai_memories` patterns; separate tables |
| Agent tool + citation allowlist validator + UI chips | 4–6 days | Highest product value |
| Eval cases for citation non-fabrication | 2–3 days | Must-have before prod |
| **Phase A total** | **~1.5–3 eng-weeks** | Assumes one engineer familiar with AI stack |
| PDF/OA acquisition + legal review | 1–3 weeks calendar | Often the long pole; not pure eng |
| Grobid/Docling pipeline + section chunking | 2–3 weeks | |
| Reranker + passage quoting + page anchors | 1–2 weeks | |
| **Phase B total (after PDFs exist)** | **~6–10 eng-weeks** | Plus ongoing corpus curation |

**Risk buffer:** Swarm-generated DOIs require cleanup; underestimating hygiene is the main way Phase A ships unsafe citations.

---

## 10. Phase recommendation

| Phase | Include literature RAG? | Rationale |
|-------|-------------------------|-----------|
| **Early multi-agent (now–near)** | **Yes — Phase A only** | Small, high-signal curated cards; reuses pgvector; directly supports readiness/load/junior narratives already in Top 50; low storage cost |
| **Early** | **No — Phase B** | No PDFs; extraction work has nothing to extract; nutrition/genetics gaps remain anyway |
| **Later** | **Phase B** | After OA/full-text acquisition for the verified Top 50 → Top ~150 coaching-relevant papers; once citation UX and validators exist from Phase A |

**Priority relative to other agent work:** Phase A is a **nice early differentiator** *after* core data tools (wearables, load, tennis) and refusal/eval gates are solid — but it should not block athlete-data grounding. Literature citations without working readiness/load tools are theater; literature citations *on top of* those tools are credibility.

**Do not invest in full-text RAG in the early phase.** Invest in DOI-verified evidence cards and hard citation allowlisting.

---

## 11. Gaps to close before claiming “evidence-grounded”

1. Validate or remove placeholder DOIs (`*1234567*`, bare “Forthcoming”).
2. Expand BibTeX from 88 → all team entries you intend to cite (or generate cards only for BibTeX-backed keys).
3. Decide athlete-facing policy: peer-reviewed + reviews only vs allow preprints.
4. Add nutrition / biomarker bibliographies if those product surfaces need literature support.
5. Never git-commit copyrighted PDFs into the public research submodule without rights.

---

## 12. Source index (paths consulted)

| Path | Role |
|------|------|
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppd_research_papers/README.md` | Corpus purpose + index |
| `…/STATUS.md` | Ops caveats |
| `…/00_briefable_research_memo.md` | Executive summary (“250+ papers”) |
| `…/02_curated_top_50.md` | Top 50 shortlist |
| `…/bib/references.bib` | Structured metadata (88) |
| `…/teams/*.md` (33 files) | Annotated Top-10 lists |
| `…/teams/B_hrv_readiness_top10.md` | Sample + placeholder DOI |
| `…/teams/C_training_load_top10.md` | Load domain sample |
| `…/teams/AC_junior_ltad_top10.md` | Youth domain sample |
| `…/teams/AG_biomechanics_top10.md` | Biomechanics + forthcoming DOI |
| `…/teams/AE_survey_anchors_top10.md` | Review anchors |
| `PeakPerformanceData/peak_performance_data/src/lib/ai/utils/semanticMemory.ts` | Existing embedding/RAG pattern |
| `…/supabase/migrations/20260311_ai_telemetry_and_memory.sql` | pgvector / `ai_memories` |
| `_plans/research/10-eval-harness.md` | Citation eval gaps |
| `_plans/research/03-insight-schema.md` | Evidence chip model |
| `_plans/research/15-tool-router-memory.md` | Memory subsystem dossier |
| `_plans/research/17-supabase-ai-schema.md` | Live AI schema status |

---

## 13. One-line decision

**Ship Phase A evidence-card retrieval from this Markdown+BibTeX corpus (after DOI verification) as an early capability; defer full-text scientific RAG until a real PDF/OA corpus exists — the current submodule cannot support passage-level grounding.**
