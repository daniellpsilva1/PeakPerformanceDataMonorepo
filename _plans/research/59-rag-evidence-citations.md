# 59 — RAG for Evidence Citations (2026)

**Topic:** Retrieval-augmented generation for a small, metadata-rich, full-text-poor sports-science corpus — retrieval design, embedding/rerank choices, pgvector hybrid search, and citation integrity.  
**Scope:** External research only (web search + web fetch of primary docs, APIs, and 2025–2026 production writeups). No local codebase exploration beyond writing this file. Complements `_plans/research/27-research-corpus-rag.md` (corpus inventory) and `_plans/research/51-reflection-critic-evidence.md` (verifier patterns).  
**Research date:** 2026-08-02  
**Currency note:** Prefer 2025–2026 sources; foundational RAG techniques (BM25 hybrid, Self-RAG, Contextual Retrieval) date to 2023–2024 but remain production defaults.

**Corpus constraints (from audit / dossier 27):**
- 45 markdown files (~337 KB annotated bibliographies) + 1 BibTeX (88 entries)
- ~250–330 cited papers via structured metadata (title, venue, DOI) — **no paper bodies**
- Some DOIs are placeholders and must not be cited blindly
- Topics: HRV/readiness, training load, sleep/recovery, injury, youth development, tennis analytics
- Thin on nutrition, biomarkers, genetics
- Storage: Supabase Postgres (pgvector available) + ClickHouse

---

## Verdict (TL;DR)

| Question | Answer |
|---|---|
| Is naive vector RAG still the 2026 default? | **No.** Production default is **hybrid (dense + BM25/FTS) → RRF → cross-encoder rerank**, often with **query rewrite**. Pure vector-only is a PoC smell. |
| Does GraphRAG earn its keep here? | **No.** Corpus ≪ 1k docs and queries are mostly single-hop fact/citation lookup. Skip. |
| Best embedding path for ES/CA/ZH queries? | **API:** Voyage-4 / Gemini Embedding. **Self-host:** Qwen3-Embedding-4B or BGE-M3. Store 1024-d (or Matryoshka 768). |
| pgvector at a few thousand chunks? | Use **exact search (no ANN index)**. HNSW/IVFFlat add complexity for zero gain. Hybrid with `tsvector` + RRF. |
| Most important requirement? | **Citation integrity:** model may only emit keys from a **server-side allowlist** of verified, retrieved sources; strip/refuse anything else; validate DOIs via Crossref. |
| Phase recommendation | **Supporting feature, Phase B+** after core agent tools work. Ship **Phase A evidence cards** first (~2–3 eng-weeks), not full GraphRAG/PDF pipeline. |

**Bottom line:** Build a **hybrid retrieval + allowlisted citation tool** over annotated bibliography chunks and verified BibTeX metadata. Treat DOI hygiene as a hard gate. Do not cite unverified DOIs. Defer GraphRAG and full-text PDF ingestion until product value of evidence grounding is proven.

---

## 1. RAG best practice in 2026

### 1.1 What replaced naive vector RAG

Naive “embed chunks → cosine top-k → stuff prompt” remains common in tutorials but is **not** the production default in 2025–2026. Consensus across engineering playbooks:

1. **Query rewriting / expansion** — resolve pronouns, expand acronyms, optionally translate query language toward corpus language, multi-query / HyDE when useful.
2. **Hybrid candidate generation** — dense vectors **and** sparse/lexical (BM25 or Postgres FTS) in parallel, top 50–100 each.
3. **Fusion** — **Reciprocal Rank Fusion (RRF)** with \(k \approx 60\) (rank-based; no score calibration).
4. **Cross-encoder reranking** — score query–document pairs jointly; keep top 5–20 for generation.
5. **Generation with citation constraints** — structured output + post-hoc allowlist validation.
6. **Optional agentic loop** — retrieve again if evidence insufficient (budget-capped).

Sources:
- [Hybrid Search for RAG (2026 Guide) — denser.ai](https://denser.ai/blog/hybrid-search-for-rag/)
- [Hybrid RAG: BM25 + RRF — AI Workflow Lab](https://aiworkflowlab.dev/article/how-to-build-hybrid-search-rag-bm25-rrf-fusion-cross-encoder-reranking)
- [RAG Architecture Playbook 2026](https://www.kunalganglani.com/rag-architecture-playbook)
- [ActionBridge LLM Primer III, Ch.5 — Retrieval Pipeline](https://actionbridge.io/en-US/llmtutorial/p/llm-primer-3-chapter-5-retrieval-pipeline)
- [Production RAG 61%→97% stages — DEV](https://dev.to/anilatambharii/how-i-took-a-production-rag-pipeline-from-61-to-97-accuracy-6-stages-full-code-37mg)

Reported lifts (illustrative, corpus-dependent): hybrid often +7–15% NDCG / recall@10 over dense-only; reranking often the largest **precision** gain on the fused candidate set (Hit@1 / nDCG@10).

### 1.2 Hybrid search (BM25 / FTS + dense)

| Leg | Strength | Weakness |
|---|---|---|
| Dense embeddings | Paraphrase, cross-lingual semantics | Misses rare IDs, DOIs, exact metric names |
| BM25 / Postgres FTS | Exact terms, author names, “HRV”, “ACWR” | Synonyms, multilingual morphologies |

**Fusion:** Prefer RRF over weighted score blending. Optional per-retriever weights after eval (identifier-heavy → boost lexical; conceptual → boost dense).

For Postgres without a true BM25 extension: `to_tsvector` / `ts_rank_cd` is “good enough” at our scale. Upgrade path: ParadeDB `pg_search` / TigerData `pg_textsearch` for real BM25 if lexical quality becomes the bottleneck.

### 1.3 Reranking — cost and latency

Cross-encoders read (query, doc) jointly. Typical pattern: rerank **top 30–50** fused candidates → return **top 5–10**.

| Option | Type | Latency (typical) | Cost | Multilingual | Notes |
|---|---|---|---|---|---|
| Cohere `rerank-v3.5` / v4 | Hosted API | ~80–150 ms p50 API; ~600 ms wall with RTT | ~$2 / 1k searches (≤100 docs) | 100+ langs | Strong default; used in Anthropic’s Contextual Retrieval tests |
| Voyage `rerank-2.5` | Hosted API | Similar ~600 ms wall | Token/doc priced; often cheaper at volume | Strong EN; multilingual varies | Domain variants exist |
| BGE-reranker-v2-m3 | Self-host | ~80–150 ms / 20 docs on T4 GPU; slower on CPU | Infra only | Excellent multilingual | Best self-host default for ES/CA/ZH |
| Jina Reranker v3 | Self-host / API | Sub-200 ms class (reported) | Infra / freemium | Yes | Check license for commercial self-host |

Sources:
- [Reranker comparison — ianas.fr (2026)](https://ianas.fr/en/blog/2026/06/07/reranker-comparatif-cohere-bge-jina-voyage/)
- [Cohere vs Voyage vs Jina vs BGE — particula.tech](https://particula.tech/blog/reranker-models-compared-cohere-voyage-jina-bge-latency-ndcg)
- [Evaluating Cohere Rerank in RAG (2026)](https://futureagi.com/blog/evaluating-cohere-rerank-rag-2026/)

**PPD recommendation:** Start with **Cohere rerank-v3.5** (zero ops, multilingual). At our QPS, cost is negligible. Fall back to **BGE-reranker-v2-m3** if data residency / cost becomes an issue.

### 1.4 Query rewriting / expansion

Patterns that compose:
- **Standalone rewrite** — resolve pronouns, expand acronyms (HRV, ACWR, sRPE).
- **Multi-query** — 2–4 paraphrases; retrieve each; RRF-merge.
- **Language normalize** — for ES/CA/ZH user queries against an English-majority corpus: either (a) multilingual embedder (preferred) or (b) translate query → EN before lexical leg.
- **HyDE** — generate hypothetical abstract/answer, embed that; useful when queries are coaching questions and chunks are paper annotations. Use sparingly (extra LLM call).

Keep the rewriter small (cheap model). Frontier models at every stage is a common cost/latency anti-pattern.

---

## 2. Chunking for scientific literature when you lack full text

### 2.1 What works with full papers (for later enrichment)

- Split on **IMRaD / section headers** (Abstract, Methods, Results, Discussion), not arbitrary token windows.
- Hierarchical / parent-child: retrieve small children, return parent section for generation.
- Metadata enrichment on every chunk: paper_id, title, year, DOI, section, cite_key, verification_status.

Sources:
- [OHDSI scientific article chunking](https://github.com/OHDSI/py_document_chunker/blob/develop/scientific_article_chunking.md)
- [Atlan chunking strategies](https://atlan.com/know/chunking-strategies-rag/)
- [PMC clinical chunking study](https://pmc.ncbi.nlm.nih.gov/articles/PMC12649634/)
- [Abstract-first academic RAG — arXiv:2412.15404](https://doi.org/10.48550/arxiv.2412.15404)

### 2.2 What to do with abstracts + annotated bibliographies only

Our corpus is **already chunk-sized** at the entry level. Do **not** naively split 200-token annotations into 50-token fragments.

**Recommended unit of retrieval = “evidence card”:**
1. **Paper card** — one chunk per cited work: title, authors, year, venue, DOI, annotation/synopsis, topic tags, source memo path, BibTeX key if present.
2. **Memo section card** — one chunk per markdown H2/H3 section for synthesis docs (`00`–`06`, team Top-10 intros) that are not single-paper entries.
3. **Claim bullet card** (optional) — if annotations contain discrete bulleted claims, split those as children linked to the parent paper card.

**Embed text composition (for dense + BM25):**
```
Title: {title}
Authors: {authors}
Year: {year} Venue: {venue}
DOI: {doi}
Topics: {tags}
Annotation: {annotation_text}
```

**Rules for thin text:**
- Prefer **one chunk per paper** over micro-chunking.
- Put high-signal fields (title, authors, DOI, key terms) in both the embed string and the FTS document (field boosting via weighted `tsvector` or repeated title in lexical text).
- Keep citation metadata **outside** the free-text the LLM may paraphrase; store as structured columns.
- When OA full text arrives later, add section children; keep the abstract/annotation card as the primary retrieval target (abstract-first cascade).

**Context stuffing note (Anthropic):** Knowledge bases under ~200k tokens can skip RAG and go in-prompt with prompt caching. Our ~337 KB markdown is roughly in that ballpark. Still prefer structured retrieval for **citation allowlisting**, selective evidence, and multilingual query handling — but a “load all verified cards” fallback for offline eval is viable.

---

## 3. Contextual retrieval (Anthropic)

**Technique:** Before embedding (and before BM25 indexing), prepend a short LLM-generated situating blurb (≈50–100 tokens) to each chunk.

**Measured improvement** ([Anthropic engineering post, Sep 2024](https://www.anthropic.com/engineering/contextual-retrieval)):
- Contextual embeddings alone: **−35%** top-20 retrieval failure (5.7% → 3.7%)
- + Contextual BM25: **−49%** failure (→ 2.9%)
- + Reranking: **−67%** failure (→ 1.9%)

**Cost:** With Claude prompt caching, **~$1.02 per million document tokens** one-time at index time. Query-time cost unchanged.

**Relevance to PPD:** Gains are largest when chunks lose document identity (“the company’s revenue grew 3%…”). Our paper cards **already include title/authors/DOI in the chunk text**, so contextualization yield is smaller. Optional cheap variant: **template context** without an LLM call:
```
This evidence card summarizes {title} ({year}) on {topics} for Peak Performance Data coaching guidance.
```
Full Claude contextualization over ~337 KB is dollars, not hundreds — fine if eval shows lift; not Phase-A critical.

---

## 4. Embedding model choice (2026)

### 4.1 MTEB / MMTEB state (mid-2026 snapshot)

Public boards reshuffled in 2025–2026; treat scores as shortlist, not gospel. Approximate leaders reported by aggregator writeups:

| Model | Type | Dims (typical) | Multilingual | Notes |
|---|---|---|---|---|
| KaLM-Embedding-Gemma3-12B (Tencent) | Open | ~3840 | Strong MMTEB | Ceiling / heavy |
| Qwen3-Embedding-8B / 4B / 0.6B | Open (Apache-2.0) | 4096 / 2560 / 1024 | Excellent ZH; good ES | Practical OSS leaders |
| Gemini Embedding / Embedding 2 | API | ~3072 | Strong | ~$0.15 / 1M (batch cheaper) |
| Voyage-4 / voyage-4-large | API | 1024 default (256–2048) | Explicit multilingual | Strong retrieval; Matryoshka |
| Cohere Embed v4 | API | ~1536 | Strong + multimodal | |
| OpenAI text-embedding-3-large | API | 3072 | OK; weaker ZH | Ubiquitous |
| BGE-M3 | Open (MIT) | 1024 | Dense+sparse+multi-vector | Production OSS baseline |
| multilingual-e5-large-instruct | Open | 1024 | Solid | Lighter baseline |

Sources:
- [MTEB Leaderboard 2026 — CodeSOTA](https://www.codesota.com/benchmarks/mteb)
- [MTEB 2026 state — Ailog](https://app.ailog.fr/en/blog/news/rag-benchmark-mteb-2026)
- [Embedding models 2026 — Ailog](https://app.ailog.fr/en/blog/news/embedding-models-2026)
- [Official MTEB on Hugging Face](https://huggingface.co/mteb)
- [Voyage embeddings docs (voyage-4 series, Jan 2026)](https://docs.voyageai.com/docs/embeddings)
- [Modal MTEB overview](https://modal.com/blog/mteb-leaderboard-article)

### 4.2 PPD recommendation

| Priority | Choice | Why |
|---|---|---|
| **Default API** | `voyage-4` @ 1024-d (`input_type=document|query`) | Multilingual retrieval, flexible dims, strong RAG track record; Anthropic found Voyage embeddings effective with contextual retrieval |
| **API alt** | Gemini Embedding | Competitive multilingual; Google ecosystem |
| **Self-host** | `Qwen3-Embedding-4B` or `BGE-M3` | Qwen3 for quality; BGE-M3 if you want dense+sparse from one model |
| **Avoid as sole model** | English-only small models | Breaks ES/CA/ZH coaching queries |

**Cost at our scale:** Embedding ~0.1–1M tokens total (cards + reindex) is **cents to a few dollars**. Query embeddings are noise next to generation cost. Optimize for quality and ops simplicity, not embedding price.

**Store:** `vector(1024)` in pgvector (or 768 if Matryoshka truncation after eval). Record `embedding_model` + `embedding_version` on every row for reindex safety.

---

## 5. pgvector in 2026

### 5.1 Version and indexes

- **Current pgvector:** **0.8.6** (2026-07-29). Feature milestone 0.8.0 added iterative index scans for filtered ANN.
- **Indexes:** Exact (default seq scan), **HNSW** (production ANN default), **IVFFlat** (faster build, weaker recall).
- **pgvectorscale (Timescale/TigerData):** StreamingDiskANN + SBQ for **tens of millions** of vectors / memory-constrained hosts. **Not needed** for a few thousand chunks.
- **pgvectorizer:** Convenience for auto-embedding pipelines on Timescale; optional sugar, not required on Supabase.

Sources:
- [pgvector GitHub / v0.8.6](https://github.com/pgvector/pgvector)
- [pgvector CHANGELOG](https://raw.githubusercontent.com/pgvector/pgvector/master/CHANGELOG.md)
- [Postgres vector search 2026 — pgvector vs pgvectorscale](https://devstarsj.github.io/2026/04/04/postgresql-pgvector-pgvectorscale-rag-production-guide-2026/)
- [On pgvectorscale and hybrid search — thebuild.com](https://thebuild.com/blog/on-pgvectorscale-and-hybrid-search-without-an-elasticsearch-sidecar/)
- [dbi Services pgvector indexes (Mar 2026)](https://www.dbi-services.com/blog/pgvector-a-guide-for-dba-part-2-indexes-update-march-2026/)

### 5.2 Small-scale performance (few thousand chunks)

pgvector’s own docs: **exact nearest neighbor is the default** and provides perfect recall. Exact search is appropriate under ~100k rows for many apps. At **1k–5k chunks**, brute-force cosine **beats ANN** on simplicity and often matches or beats latency (no graph build, no recall loss).

**PPD rule:** **Do not create HNSW/IVFFlat** until chunk count exceeds ~50k or p95 latency demands it. Use `max_parallel_workers_per_gather` if seq scans need a boost.

### 5.3 Hybrid pattern in Postgres

```sql
-- Pseudocode pattern: dense + FTS → RRF in SQL or app layer
WITH q AS (
  SELECT $1::vector AS emb, websearch_to_tsquery('english', $2) AS tsq
),
dense AS (
  SELECT c.id, ROW_NUMBER() OVER (ORDER BY c.embedding <=> (SELECT emb FROM q)) AS rnk
  FROM research_chunks c
  WHERE c.is_citable = true AND c.doi_status = 'verified'
  ORDER BY c.embedding <=> (SELECT emb FROM q)
  LIMIT 50
),
lexical AS (
  SELECT c.id, ROW_NUMBER() OVER (
    ORDER BY ts_rank_cd(c.fts, (SELECT tsq FROM q)) DESC
  ) AS rnk
  FROM research_chunks c
  WHERE c.is_citable = true AND c.doi_status = 'verified'
    AND c.fts @@ (SELECT tsq FROM q)
  ORDER BY ts_rank_cd(c.fts, (SELECT tsq FROM q)) DESC
  LIMIT 50
)
SELECT COALESCE(d.id, l.id) AS id,
       COALESCE(1.0/(60+d.rnk),0) + COALESCE(1.0/(60+l.rnk),0) AS rrf
FROM dense d
FULL OUTER JOIN lexical l ON d.id = l.id
ORDER BY rrf DESC
LIMIT 40;
```

Then rerank those ≤40 in the app with Cohere/BGE.

---

## 6. GraphRAG — skeptical assessment

**What it is good for:** Multi-hop relational questions (“how do sleep restriction findings connect to injury risk via HRV mediators across studies?”), global corpus summaries, entity-centric exploration.

**Cost history:** Classic Microsoft GraphRAG indexing was notorious (LLM entity extraction / community summaries → high four-figure costs at modest scale). LazyGraphRAG / LightRAG cut indexing cost dramatically (LazyGraphRAG claims ~0.1% of full GraphRAG indexing; LightRAG ~1/100th).

**For this corpus:** **Not justified.**
- <1k documents / ~few thousand cards → standard hybrid+rerank captures ≥90% of GraphRAG quality for citation lookup.
- Queries are predominantly “what evidence supports X for this athlete?” — single-hop retrieval + synthesis.
- Graph maintenance + entity extraction error modes create **false relations** that look scientific — dangerous in sports-medicine claims.
- Revisit only if product analytics show frequent multi-hop evidence questions **and** Phase A citation RAG is live with evals.

Sources:
- [Graph RAG explained — Ismat Samadov](https://www.ismatsamadov.com/blog/graph-rag-knowledge-graphs-vs-vector-search)
- [RAG vs GraphRAG 2026 decision framework](https://cruxdigits.nl/blog/rag-vs-graphrag-2026/)
- [When graph structures help — ML Digest](https://ml-digest.com/when-to-use-kg-rag/)
- [LazyGraphRAG — Microsoft Research](https://www.microsoft.com/en-us/research/blog/lazygraphrag-setting-a-new-standard-for-quality-and-cost/)

---

## 7. Agentic RAG

**Idea:** The agent decides *whether*, *what*, and *how often* to retrieve; may rewrite queries; may reflect on evidence sufficiency (Self-RAG-style).

Useful patterns for PPD:
1. **Tool-gated retrieval** — `search_sports_science_evidence(query, topics?)` called only when the coach/athlete question needs literature grounding (not for pure wearable math).
2. **Iterative retrieval** — if first pass returns low rerank scores or empty verified set → rewrite once → stop (max 2 rounds).
3. **Sufficiency check** — after retrieval, a cheap classifier/LLM asks: “Do these cards support a citable claim?” If no → answer without citation or refuse to invent one.
4. **Self-RAG caution** — reflection tokens help when paired with **extrinsic** signals (empty allowlist, low scores). Pure self-talk without new evidence is weak (see dossier 51).

Sources:
- [Agentic RAG survey — arXiv:2501.09136](https://arxiv.org/html/2501.09136v4)
- [AgenticRAG enterprise — arXiv:2605.05538](https://arxiv.org/html/2605.05538) (agentic loop ≫ single-shot embeddings in their ablations)
- [Redis on Agentic RAG](https://redis.io/blog/agentic-rag-how-enterprises-are-surmounting-the-limits-of-traditional-rag/)
- [Engineering the RAG Stack — arXiv:2601.05264](https://arxiv.org/html/2601.05264v1)

**PPD stance:** Prefer **simple agentic control** (call tool / don’t call / one rewrite) over a multi-agent Graph-of-Thought orchestra. Budget latency: retrieval+rerank should stay under ~800 ms p95 before generation.

---

## 8. Citation integrity (highest priority)

A sports-science claim with a **fake citation** is a product and trust failure. Prompting “please cite accurately” is insufficient.

### 8.1 Failure modes

1. Invented titles / authors / years  
2. Real DOI + **wrong** title (hardest to catch by eye)  
3. Real paper that does **not** support the claim (attribution error)  
4. Citing placeholder / unverified DOIs from our own corpus  
5. “Phantom references” that pass superficial checks ([arXiv:2607.00738](https://arxiv.org/html/2607.00738v2))

### 8.2 Server-side allowlist pattern (required)

```
retrieve → verified_set = {cite_key, ...}  # only doi_status=verified & is_citable
prompt: "You may ONLY cite keys from: [KEYS]. If none apply, say evidence is insufficient."
generate structured claims: [{claim, cite_keys[]}, ...]
validate:
  - every cite_key ∈ verified_set
  - strip unknown keys
  - if claim had only invalid keys → drop claim or regenerate without citation
  - never invent bibliography entries client-side
```

Emit UI citations from **DB metadata** for allowlisted keys (title, year, DOI, OA link) — never from model-authored bibliography strings.

### 8.3 Attribution verification (tiered)

| Tier | Check | Automation |
|---|---|---|
| L0 | Key ∈ retrieved allowlist | Deterministic |
| L1 | DOI resolves; title matches Crossref (token F1 / fuzzy) | Deterministic APIs |
| L2 | Claim–passage entailment / support score | LLM-as-judge or NLI on annotation text |
| L3 | Human review for athlete-facing medical-adjacent claims | Sampled |

Tools / prior art: [cite-verify](https://github.com/jonckr/cite-verify), [citation-guard](https://github.com/PranayMahendrakar/citation-guard), [refcheck](https://github.com/benchoi93/refcheck), [mcp-refchecker](https://github.com/JonasBaath/mcp-refchecker).

### 8.4 Detecting fabricated references

- DOI not in Crossref / doi.org → **FABRICATED**  
- DOI exists but title mismatch → **MISMATCH** (classic LLM hallucination)  
- No DOI + not in our BibTeX allowlist → **REJECT** for product citations  
- Retracted flag from OpenAlex → **BLOCK** or hard warning  

---

## 9. DOI validation and OA enrichment APIs

### 9.1 Crossref

- Base: `https://api.crossref.org/`  
- Metadata: `GET /works/{doi}`  
- Agency: `GET /works/{doi}/agency`  
- Polite pool: add `mailto=your@email`  
- Docs: [Crossref REST API](https://www.crossref.org/documentation/retrieve-metadata/rest-api/)

**Hygiene pipeline:** normalize DOI → reject empty/placeholder patterns (`10.xxxx/placeholder`, `TBD`, `N/A`) → Crossref lookup → store canonical title/authors/year/venue → fuzzy-match against local title → set `doi_status`.

### 9.2 OpenAlex

- `GET https://api.openalex.org/works/https://doi.org/{doi}`  
- Fields: `best_oa_location.pdf_url`, `open_access`, retraction-related signals, cited_by_count  
- Docs: [OpenAlex works API](https://developers.openalex.org/api-reference/works/get-a-single-work)

### 9.3 Unpaywall

- `GET https://api.unpaywall.org/v2/{doi}?email=YOUR_EMAIL`  
- Returns `is_oa`, `best_oa_location.url_for_pdf`, etc.  
- Covers **Crossref DOIs** primarily ([Unpaywall coverage note](https://help.openalex.org/hc/en-us/articles/41193838206743-Which-DOIs-does-Unpaywall-cover))  
- Rate: 100k calls/day (fine for our 300 DOIs)  
- Docs: [Unpaywall REST API](https://unpaywall.org/products/api), [data format](https://unpaywall.org/data-format)

**Enrichment policy:** Store OA URLs and optionally download legally available PDFs into a private bucket for **internal** RAG. Respect licenses. Do not redistribute copyrighted PDFs. Prefer publisher/repository OA over scraping paywalls.

---

## 10. Concrete system design for PPD

### 10.1 Goals

1. Agent can ground coaching recommendations in **verified** sports-science sources from our curated corpus.  
2. **Never** emit a citation key or DOI that is not verified and in the retrieval allowlist.  
3. Multilingual queries (ES/CA/ZH) retrieve English cards reliably.  
4. Path to enrich with OA full text later without redesigning the schema.

### 10.2 Ingestion pipeline

```
Markdown bibliographies + BibTeX
        │
        ▼
  Parse entries (regex/AST for ## N. Title blocks; bibtexparser)
        │
        ▼
  Upsert research_papers (dedupe by normalized title + DOI)
        │
        ▼
  DOI hygiene job (Crossref + OpenAlex + Unpaywall)
        │
        ▼
  Build evidence cards → research_chunks
        │
        ▼
  Embed (voyage-4) + build tsvector
        │
        ▼
  Mark is_citable = (doi_status = 'verified' OR (no_doi_ok AND bib_verified))
```

**Placeholder DOI heuristics (flag, never cite):**
- Empty, `null`, `N/A`, `TBD`, `TODO`
- Non-matching `^10\.\d{4,9}/[-._;()/:A-Z0-9]+$` (Crossref recommended pattern; still verify live)
- Known test prefixes / obviously fake suffixes (`.../xxxx`, `.../placeholder`)
- Crossref 404

### 10.3 Postgres DDL (Supabase)

```sql
-- Enable extensions (Supabase typically has vector available)
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Canonical paper / citation entity
CREATE TABLE research_papers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cite_key          text NOT NULL UNIQUE,  -- stable key e.g. buchheit2017 or bibtex key
  title             text NOT NULL,
  title_normalized  text NOT NULL,
  authors           text[] NOT NULL DEFAULT '{}',
  year              int,
  venue             text,
  doi               text,
  doi_normalized    text,
  doi_status        text NOT NULL DEFAULT 'unchecked'
                    CHECK (doi_status IN (
                      'unchecked', 'placeholder', 'invalid',
                      'verified', 'mismatch', 'no_doi', 'retracted'
                    )),
  crossref_title    text,
  crossref_json     jsonb,
  openalex_id       text,
  openalex_json     jsonb,
  is_oa             boolean,
  oa_pdf_url        text,
  oa_landing_url    text,
  oa_license        text,
  abstract          text,
  annotation        text,          -- from our markdown synopsis
  topics            text[] NOT NULL DEFAULT '{}',
  source_paths      text[] NOT NULL DEFAULT '{}', -- originating md/bib paths
  bibtex_key        text,
  is_citable        boolean NOT NULL DEFAULT false,
  title_match_score real,          -- local title vs Crossref
  verified_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX research_papers_doi_uidx
  ON research_papers (doi_normalized)
  WHERE doi_normalized IS NOT NULL;

CREATE INDEX research_papers_citable_idx
  ON research_papers (is_citable)
  WHERE is_citable = true;

CREATE INDEX research_papers_topics_gin
  ON research_papers USING gin (topics);

-- Retrievable chunks / evidence cards
CREATE TABLE research_chunks (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id           uuid REFERENCES research_papers(id) ON DELETE CASCADE,
  chunk_type         text NOT NULL CHECK (chunk_type IN (
                       'paper_card', 'memo_section', 'claim_bullet', 'fulltext_section'
                     )),
  cite_key           text,  -- denormalized for allowlist convenience
  section_path       text,  -- e.g. teams/A_wearable_anomaly_top10.md#3
  title              text,
  content            text NOT NULL,       -- raw annotation / section
  content_for_embed  text NOT NULL,       -- title+meta+annotation (+ optional context prefix)
  fts                tsvector GENERATED ALWAYS AS (
                       setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
                       setweight(to_tsvector('english', coalesce(content, '')), 'B')
                     ) STORED,
  embedding          vector(1024),
  embedding_model    text,
  embedding_dims     int,
  token_count        int,
  is_citable         boolean NOT NULL DEFAULT false,
  doi_status         text,
  metadata           jsonb NOT NULL DEFAULT '{}',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX research_chunks_fts_idx ON research_chunks USING gin (fts);
CREATE INDEX research_chunks_paper_idx ON research_chunks (paper_id);
CREATE INDEX research_chunks_citable_idx
  ON research_chunks (is_citable)
  WHERE is_citable = true;

-- NO HNSW at this scale. Add later if needed:
-- CREATE INDEX research_chunks_embedding_hnsw
--   ON research_chunks USING hnsw (embedding vector_cosine_ops)
--   WITH (m = 16, ef_construction = 64);

-- Ingestion / DOI job audit
CREATE TABLE research_doi_checks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id        uuid NOT NULL REFERENCES research_papers(id) ON DELETE CASCADE,
  doi             text,
  check_source    text NOT NULL, -- crossref | openalex | unpaywall | doi_org
  http_status     int,
  ok              boolean NOT NULL,
  response_json   jsonb,
  error           text,
  checked_at      timestamptz NOT NULL DEFAULT now()
);

-- Per-request retrieval allowlist (for post-generation validation)
CREATE TABLE research_retrieval_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid,
  query_text      text NOT NULL,
  rewritten_query text,
  allowlist_keys  text[] NOT NULL,
  chunk_ids       uuid[] NOT NULL,
  latency_ms      jsonb,  -- {embed, dense, lexical, rrf, rerank, total}
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Optional: citation emissions log for audit / eval
CREATE TABLE research_citation_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        uuid REFERENCES research_retrieval_sessions(id),
  conversation_id   uuid,
  emitted_keys      text[] NOT NULL DEFAULT '{}',
  rejected_keys     text[] NOT NULL DEFAULT '{}',
  model_name        text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
```

**Citable rule (application logic):**
```
is_citable = true IFF
  doi_status = 'verified'
  OR (doi_status = 'no_doi' AND bibtex_key IS NOT NULL AND manually_approved = true)
NEVER cite: placeholder | invalid | mismatch | retracted | unchecked
```

### 10.4 Retrieval design (specific)

```
User/agent query (any of EN/ES/CA/ZH)
        │
        ▼
 Query rewrite (cheap model): expand acronyms; keep original + EN paraphrase
        │
        ├─► Dense: embed with voyage-4 input_type=query → exact KNN top 50
        │         (filter is_citable AND doi_status='verified')
        └─► Lexical: tsquery on fts top 50 (same filter)
        │
        ▼
 RRF merge (k=60) → top 40
        │
        ▼
 Cohere rerank-v3.5 → top 8
        │
        ▼
 Return tool payload + allowlist_keys
```

**Expected latency budget (p50 / p95):**

| Stage | p50 | p95 |
|---|---|---|
| Query rewrite | 100–250 ms | 400 ms |
| Embed query | 30–80 ms | 150 ms |
| Dense + FTS + RRF (Postgres) | 5–20 ms | 40 ms |
| Rerank (Cohere, 40 docs) | 80–150 ms | 400–700 ms |
| **Total retrieval** | **~250–500 ms** | **~800–1200 ms** |

At our corpus size, retrieval will almost always be faster than generation.

**Model picks:**
- Embeddings: `voyage-4` @ 1024-d  
- Reranker: `rerank-v3.5` (Cohere)  
- Self-host alt pair: BGE-M3 + BGE-reranker-v2-m3  

### 10.5 Agent tool interface

```ts
// Tool: search_sports_science_evidence
type EvidenceSearchInput = {
  query: string;
  topics?: Array<
    | 'hrv_readiness'
    | 'training_load'
    | 'sleep_recovery'
    | 'injury'
    | 'youth_development'
    | 'tennis_analytics'
    | 'nutrition'
    | 'biomarkers'
    | 'other'
  >;
  k?: number; // default 6, max 10
};

type EvidenceCard = {
  cite_key: string;          // ONLY these may be cited
  title: string;
  authors: string[];
  year: number | null;
  venue: string | null;
  doi: string | null;        // verified only
  doi_url: string | null;
  annotation: string;        // synopsis / abstract snippet
  topics: string[];
  relevance_score: number;   // rerank score
  oa_pdf_url: string | null;
  caveats: string[];         // e.g. "annotation only — not full text"
};

type EvidenceSearchOutput = {
  session_id: string;
  allowlist_keys: string[];  // authoritative
  cards: EvidenceCard[];
  retrieval_notes: string;   // e.g. thin coverage: nutrition
};
```

**Tool contract (prompt + server):**
- The model **must** cite using `cite_key` values from `allowlist_keys` only.  
- If `cards` is empty: say evidence is insufficient; do not invent papers.  
- Cards include the caveat that support text is annotation/abstract-level unless `fulltext_section` exists.

### 10.6 Post-generation citation validation

```python
def validate_citations(claims: list[Claim], allowlist: set[str]) -> ValidationResult:
    accepted, rejected = [], []
    for claim in claims:
        keys = [k for k in claim.cite_keys if k in allowlist]
        bad = [k for k in claim.cite_keys if k not in allowlist]
        rejected.extend(bad)
        if claim.cite_keys and not keys:
            # claim depended entirely on fake/unknown citations
            accepted.append(claim.model_copy(update={
                "cite_keys": [],
                "citation_status": "stripped_unverified",
            }))
        else:
            accepted.append(claim.model_copy(update={
                "cite_keys": keys,
                "citation_status": "ok" if keys else "uncited",
            }))
    return ValidationResult(claims=accepted, rejected_keys=rejected)
```

Additional guards:
- Structured output schema: `cite_keys: string[]` with enum dynamically set to allowlist when the API supports it; otherwise validate after.  
- Render bibliography from DB join on `cite_key`, never from model prose.  
- Log `rejected_keys` for eval / red-team.  
- Optional L2: NLI “annotation supports claim?” before showing athlete-facing medical-adjacent text.

### 10.7 Optional enrichment phase (later)

For each `doi_status='verified'` paper:
1. Unpaywall / OpenAlex → `oa_pdf_url`  
2. If OA and license allows → fetch PDF → section-chunk → `chunk_type='fulltext_section'`  
3. Keep paper_card as parent; prefer abstract/annotation for first-stage retrieval, expand to fulltext children on second hop (agentic open_chunk tool)

---

## 11. Effort estimate and phase placement

| Phase | Deliverable | Effort | Depends on |
|---|---|---|---|
| **A — Evidence cards** | Parse MD+BibTeX → schema → DOI hygiene → hybrid retrieve tool → allowlist validation | **2–3 eng-weeks** | Supabase pgvector; Crossref mailto; embed+rerank API keys |
| **A.1 — Eval** | 50–100 coaching questions; citation precision/recall; hallucination red-team | **3–5 eng-days** | Phase A |
| **B — Agentic loop** | Rewrite-once; sufficiency refuse; topic filters; UI citation chips | **1–2 eng-weeks** | Phase A |
| **C — OA full text** | Unpaywall ingest; section chunks; legal review | **4–8 eng-weeks** | Phase A proven; counsel/license policy |
| **D — GraphRAG** | **Skip** unless multi-hop need proven | — | — |

**Recommendation:** This is a **supporting feature**, not core agent value (wearables, tennis, training plans). Place **Phase A in Phase B of the multi-agent roadmap** — after primary data tools are reliable, before consumer-facing “science-backed” marketing claims. Do **not** block core agent launch on full-text RAG.

**Honest risk:** Annotation-only grounding can still **overclaim** (card mentions HRV; model asserts a specific clinical protocol). Mitigate with L2 support checks and conservative system prompts (“cite only what the annotation states”).

---

## 12. Source index (URLs)

### RAG / hybrid / rerank
- https://denser.ai/blog/hybrid-search-for-rag/
- https://aiworkflowlab.dev/article/how-to-build-hybrid-search-rag-bm25-rrf-fusion-cross-encoder-reranking
- https://www.kunalganglani.com/rag-architecture-playbook
- https://actionbridge.io/en-US/llmtutorial/p/llm-primer-3-chapter-5-retrieval-pipeline
- https://dev.to/anilatambharii/how-i-took-a-production-rag-pipeline-from-61-to-97-accuracy-6-stages-full-code-37mg
- https://ianas.fr/en/blog/2026/06/07/reranker-comparatif-cohere-bge-jina-voyage/
- https://particula.tech/blog/reranker-models-compared-cohere-voyage-jina-bge-latency-ndcg
- https://futureagi.com/blog/evaluating-cohere-rerank-rag-2026/

### Contextual retrieval
- https://www.anthropic.com/engineering/contextual-retrieval
- https://www.infoq.com/news/2024/09/anthropic-contextual-retrieval/

### Embeddings / MTEB
- https://huggingface.co/mteb
- https://www.codesota.com/benchmarks/mteb
- https://app.ailog.fr/en/blog/news/rag-benchmark-mteb-2026
- https://app.ailog.fr/en/blog/news/embedding-models-2026
- https://docs.voyageai.com/docs/embeddings
- https://modal.com/blog/mteb-leaderboard-article

### pgvector
- https://github.com/pgvector/pgvector
- https://raw.githubusercontent.com/pgvector/pgvector/master/CHANGELOG.md
- https://devstarsj.github.io/2026/04/04/postgresql-pgvector-pgvectorscale-rag-production-guide-2026/
- https://thebuild.com/blog/on-pgvectorscale-and-hybrid-search-without-an-elasticsearch-sidecar/
- https://www.dbi-services.com/blog/pgvector-a-guide-for-dba-part-2-indexes-update-march-2026/
- https://jacar.es/en/rag-postgres-pgvector-produccion/

### GraphRAG
- https://www.ismatsamadov.com/blog/graph-rag-knowledge-graphs-vs-vector-search
- https://cruxdigits.nl/blog/rag-vs-graphrag-2026/
- https://ml-digest.com/when-to-use-kg-rag/
- https://www.microsoft.com/en-us/research/blog/lazygraphrag-setting-a-new-standard-for-quality-and-cost/

### Agentic RAG
- https://arxiv.org/html/2501.09136v4
- https://arxiv.org/html/2605.05538
- https://arxiv.org/html/2601.05264v1
- https://redis.io/blog/agentic-rag-how-enterprises-are-surmounting-the-limits-of-traditional-rag/

### Citation integrity
- https://arxiv.org/html/2607.00738v2
- https://github.com/jonckr/cite-verify
- https://github.com/PranayMahendrakar/citation-guard
- https://github.com/benchoi93/refcheck
- https://github.com/JonasBaath/mcp-refchecker

### DOI / OA APIs
- https://www.crossref.org/documentation/retrieve-metadata/rest-api/
- https://github.com/Crossref/rest-api-doc
- https://unpaywall.org/products/api
- https://unpaywall.org/data-format
- https://help.openalex.org/hc/en-us/articles/41193838206743-Which-DOIs-does-Unpaywall-cover
- https://developers.openalex.org/api-reference/works/get-a-single-work
- https://help.openalex.org/hc/en-us/articles/41193798112151-How-is-the-best-OA-location-determined

### Chunking / scientific RAG
- https://github.com/OHDSI/py_document_chunker/blob/develop/scientific_article_chunking.md
- https://atlan.com/know/chunking-strategies-rag/
- https://pmc.ncbi.nlm.nih.gov/articles/PMC12649634/
- https://doi.org/10.48550/arxiv.2412.15404

---

## 13. Decision checklist (for implementers)

- [ ] Parse MD + BibTeX into `research_papers` / `research_chunks`  
- [ ] Run Crossref hygiene; set `is_citable` only for verified (or manually approved no-DOI)  
- [ ] Embed with multilingual model; FTS index; **no ANN index yet**  
- [ ] Ship `search_sports_science_evidence` tool returning `allowlist_keys`  
- [ ] Enforce post-generation allowlist strip + DB-rendered bibliography  
- [ ] Red-team: prompt model to cite fake DOIs; confirm rejection  
- [ ] Eval set of 50+ coaching Qs before any “science-backed” UX copy  
- [ ] Defer GraphRAG; defer PDF pipeline until Phase A metrics look good  
