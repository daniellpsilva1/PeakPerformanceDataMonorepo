# Voice AI Agents in 2026: Capability, Architecture, Cost, and Whether It Is Worth It

**Research date:** 2026-08-02  
**Scope:** Multi-agent sports-performance platform for tennis academies. Product already has partial voice: `VoiceAssistantButton` / `VoiceAssistantModal` and `/api/transcribe` via Groq Whisper (dictation into text chat). Target languages: English, Spanish, Catalan, Chinese. Hard product constraints: medical-claim guardrails (never diagnose / never prescribe), minors in the data plane, academy coaches often outdoors with hands busy.  
**Method:** External research only (vendor docs, independent benchmarks, GDPR/ICO guidance; prioritize 2025–2026 pricing). No local codebase exploration beyond this output file.

---

## 1. Executive verdict (blunt)

**Do not build a real conversational voice agent now. Improve dictation; leave full duplex voice for a late optional phase.**

The court-side coach with a phone in a pocket is a *real* use case — better than most “voice for voice’s sake” bets. But a speech-to-speech agent that can freely speak coaching advice is the wrong layer to invest in while the text multi-agent system still needs tool reliability, safety parity across languages, and observability. Voice multiplies every existing risk: latency, interruption, noisy ASR, harder output gating, biometric/privacy exposure, and cost that scales with minutes of talking rather than tokens of insight.

**If voice ships later:** cascaded STT → (existing text agent) → TTS only. Never put hard safety constraints solely inside an opaque S2S model. Keep the text control plane (transcript in, transcript out, same guardrails as chat).

**Minimum viable improvement now:** streaming or lower-friction push-to-talk dictation on the existing chat path (keep Groq Whisper or upgrade STT selectively), optional short spoken readback of the *already-gated* text reply via cheap TTS. Cost of MVP: roughly **$0.001–$0.01 per short utterance** for STT; TTS add-on ~**$0.01–0.05 per reply** if enabled. Engineering: days to ~2 weeks, not a new platform.

**Phase:** after core text agents are production-solid (tools, safety evals, multilingual, observability). Treat full voice as **Phase N+1 / optional**, not a parallel track that steals agent eng capacity.

---

## 2. The two architectures

### 2.1 Cascaded: STT → LLM → TTS

Audio → transcript → reasoning/tools/guardrails on text → spoken reply.

| Dimension | Cascaded |
|-----------|----------|
| Latency | Structurally higher; well-tuned streaming stacks hit ~600–1200ms TTFA; production totals often 1.5–3s end-to-end without aggressive overlap ([LiveKit](https://livekit.com/blog/realtime-vs-cascade), [Gradium 2026](https://gradium.ai/content/cascaded-voice-agent-vs-speech-to-speech-2026), [FutureAGI 2026](https://futureagi.com/blog/cascaded-voice-ai-vs-speech-to-speech-2026/)) |
| Cost | Optimizable per layer (cheap STT + strong LLM + flash TTS) |
| Controllability | **Best.** Text at every boundary → same prompts, classifiers, redaction, audit logs as chat |
| Tool calls | Mature text function-calling; filler phrases (“checking that…”) while tools run |
| Guardrails | Gate on transcript before TTS; refuse/rewrite in text; never speak ungated audio |
| Observability | Attribute failures to STT vs LLM vs TTS |

Industry consensus for production / regulated / tool-heavy agents in 2026 still favors cascade as the default ([LiveKit](https://livekit.com/blog/realtime-vs-cascade), [Context Studios](https://www.contextstudios.ai/comparisons/gpt-live-vs-cascaded-voice-pipeline), [AGI House brief](https://blog.agihouse.org/posts/voice-agents-research-brief)).

### 2.2 Speech-to-speech / realtime

Single multimodal model: audio in → audio out (optional parallel transcription).

| Dimension | S2S / Realtime |
|-----------|----------------|
| Latency | Structural win: ~300–500ms TTFA typical when warm ([FutureAGI](https://futureagi.com/blog/cascaded-voice-ai-vs-speech-to-speech-2026/)) |
| Cost | Audio-token pricing; session re-billing (esp. Gemini Live) can make long sessions expensive |
| Controllability | **Weakest for us.** Output is audio; intermediate text is secondary/sampled; harder to run claim classifiers before speech |
| Tool calls | Supported on OpenAI gpt-realtime-2.1 and Gemini Live, but less mature than text LLMs; mid-tool barge-in still rough |
| Guardrails | Must rely on model instruction-following + post-hoc transcript sampling; cannot cheaply “rewrite then speak” |
| Observability | Black-box failures; need sidecar STT for audit |

**Why controllability dominates for PPD:** medical/coaching claim safety and minor-data caution require a text gate. An S2S model that “sounds careful” is not a substitute for the same structured refusal path as chat. Cascaded (or hybrid with text output from realtime + separate TTS) preserves the control plane.

### 2.3 Hybrid patterns worth knowing

- **Realtime + sidecar STT** for mandatory transcripts ([LiveKit](https://livekit.com/blog/realtime-vs-cascade)).
- **Half-cascade:** realtime for understanding / text out → brand TTS.
- **Speculative filler:** speak acknowledgment while tools run.

For PPD, the only hybrid that respects safety is: **any reasoning path that can emit coaching claims must emit text first, then TTS.**

---

## 3. Realtime / S2S APIs (mid-2026)

### 3.1 OpenAI Realtime (`gpt-realtime-2.1` / mini)

| Item | Detail |
|------|--------|
| Models | `gpt-realtime-2.1` (July 2026), `gpt-realtime-2.1-mini`; improved noise/silence/interruption vs prior ([model page](https://developers.openai.com/api/docs/models/gpt-realtime-2.1), [changelog synthesis](https://rohitai.com/blog/openai-gpt-realtime-2-1-voice-agents)) |
| Pricing (official) | Flagship audio: **$32 / 1M in**, **$64 / 1M out**; text $4 / $24; mini audio **$10 / $20** ([OpenAI pricing](https://developers.openai.com/api/docs/pricing)) |
| Derived $/min | ~**$0.06–0.11/min** flagship with caching; ~**$0.02–0.05/min** mini; worse without cache ([Forasoft analysis](https://www.forasoft.com/blog/article/openai-realtime-api-pricing)) |
| Transcription add-on | `gpt-realtime-whisper` / live-transcribe **$0.017/min** |
| Tools | Native tool use + reasoning effort on 2.1 |
| Languages | Conversational realtime lists Catalan, Spanish, Chinese among supported langs (Azure Voice Live docs mirror OpenAI list including Catalan) ([Azure language support](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live-language-support)); translation model: 70+ in / 13 out (Catalan as *input*, not always as spoken output) ([cookbook](https://github.com/openai/openai-cookbook/blob/main/examples/voice_solutions/realtime_translation_guide.mdx)) |
| Fit for PPD | Strongest S2S product; still wrong primary architecture for gated coaching |

Cost management: [OpenAI Realtime costs guide](https://developers.openai.com/api/docs/guides/realtime-costs).

### 3.2 Google Gemini Live

| Item | Detail |
|------|--------|
| Models | Gemini **3.1 Flash Live** preview; Gemini **2.5 Flash Native Audio** Live API ([Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing)) |
| Pricing | 2.5 Flash Native Audio: audio in **$3/1M**, audio out **$12/1M**, text in $0.50 / out $2.00. 3.1 Flash Live: audio ~**$0.005/min in**, ~**$0.018/min out** (25 tokens/sec convention) |
| Caveat | Stateful sessions **re-bill accumulated audio tokens each turn** until context compression — long coaching chats get expensive ([Google forum](https://discuss.ai.google.dev/t/pricing-of-speech-to-speech-live-model/140340/3), [Vertex pricing notes](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing)) |
| Features | Native audio S2S, barge-in, tool calling, affective/proactive audio; ~70 languages claimed in Live writeups ([Ry Walker research](https://rywalker.com/research/gemini-live-api)) |
| Telephony | No first-party PSTN; bridge via Twilio/LiveKit/Pipecat |
| Fit for PPD | Cheaper headline than OpenAI Realtime; session re-billing + weaker text gate = same architectural mismatch |

### 3.3 Others (short)

| Vendor | Notes |
|--------|-------|
| **AssemblyAI Voice Agent API** | Cascaded under the hood; flat **$0.075/min** all-in ([pricing](https://www.assemblyai.com/pricing)) — managed convenience, not control |
| **Deepgram Voice Agent API** | ~**$0.07–0.08/min** platform bundling ([Gladia/Deepgram pricing roundup](https://www.gladia.io/blog/deepgram-pricing)) |
| **Amazon / Azure Voice Live** | Enterprise wrappers around OpenAI realtime or own stacks; useful if already locked to that cloud |
| **Grok Voice / others** | Mentioned in research briefs; not a primary vendor recommendation for EU youth sports compliance |

---

## 4. Best STT options (2026)

### 4.1 Comparison snapshot

| Provider | Model | Approx. price | Latency | EN/ES/ZH | Catalan | Noise / accents | Notes |
|----------|-------|---------------|---------|----------|---------|-----------------|-------|
| **Groq Whisper** | large-v3-turbo | **$0.04/hr** (~$0.00067/min) | Batch-fast (not true duplex) | Strong (Whisper 99 langs) | Yes (`ca`) | Moderate; degrades outdoors | **Current stack.** Cheapest Whisper host ([Groq pricing](https://groq.com/pricing)) |
| **Groq Whisper** | large-v3 | **$0.111/hr** | Similar | Better accuracy than turbo | Yes | Better than turbo | Use if WER matters more than $ |
| **Deepgram** | Nova-3 / Flux | Batch ~**$0.0043–0.0052/min**; stream ~**$0.0077–0.011/min**; Flux agent-oriented | Stream sub-300ms; Flux EOT ~300ms | Strong; Flux multilingual May 2026 | **Native Catalan pages** | **Excellent** noisy / distant mic claims | Best production streaming candidate ([Deepgram Catalan](https://deepgram.com/product/speech-to-text/catalan), [Coval 2026](https://www.coval.ai/blog/best-speech-to-text-providers-in-2026-independent-benchmarks-and-how-to-choose/)) |
| **ElevenLabs Scribe** | Scribe v2 / Realtime | Batch ~**$0.22/hr**; RT ~**$0.39/hr** (post May 2026 cuts) | RT sub-150ms claimed | 90+ langs; strong multilingual | **Strong Catalan WER claims** (marketing: ~2.5–3.1% FLEURS vs Whisper ~6%) | Good general; less “sports noise” proof | Best multilingual accuracy narrative ([ElevenLabs Catalan](https://elevenlabs.io/speech-to-text/catalan), [API pricing](https://elevenlabs.io/pricing/api)) |
| **AssemblyAI** | Universal-3.5 Pro RT | Stream base **$0.45/hr** ($0.0075/min) | 300–600ms median class | Strong EN; multilingual improving | Check current lang matrix | Strong for agent EOT | Voice Agent API $0.075/min all-in ([AssemblyAI pricing](https://www.assemblyai.com/pricing)) |
| **OpenAI** | gpt-4o-transcribe / whisper | ~**$0.003–0.006/min** transcribe; whisper API historically ~$0.006/min | Batch / live variants | Excellent EN; broad Whisper set | Catalan via Whisper codes | Good clean audio; Deepgram often preferred for noise | Realtime-whisper $0.017/min streaming |
| **Google Chirp 3** | Cloud STT v2 | Higher (~$0.016–0.024/min class) | Solid | **Widest** language net | Supported in Google ecosystem | Good; ecosystem lock-in | Prefer if already on GCP |

Independent synthesis: Deepgram leads latency/cost for agents; ElevenLabs Scribe leads multilingual accuracy; Groq wins raw Whisper batch cost ([Coval](https://www.coval.ai/blog/best-speech-to-text-providers-in-2026-independent-benchmarks-and-how-to-choose/), [FutureAGI STT 2026](https://futureagi.substack.com/p/speech-to-text-apis-in-2026-benchmarks), [VexaScribe compare](https://novascribe.ai/compare/best-transcription-api-for-developers)).

### 4.2 Catalan specifically

- Whisper family (incl. Groq): `ca` supported — quality mid-tier vs specialized ASR.
- Deepgram: productized Catalan STT (Nova / Flux path).
- ElevenLabs Scribe: strongest public Catalan WER marketing numbers on FLEURS/Common Voice — treat as vendor-reported; validate on academy audio.
- Projecte Aina / open Catalan ASR exists for self-host if privacy demands EU-local processing (see multilingual dossier #62).

**Catalan is table-stakes for Barcelona/Spain academies — do not pick an STT that is English-only streaming.**

### 4.3 Sports / physiological terminology

Generic WER understates domain error. Expect failures on: *HRV, RPE, VO₂, topspin, break point, drop shot, load, readiness, creatine kinase,* Spanish/Catalan coaching slang, Chinese sports-science calques.

Mitigations (cascaded only):
1. Keyword / keyterm boosting (Deepgram, ElevenLabs keyterm add-ons).
2. Post-STT glossary correction before the LLM (same glossary as multilingual agents).
3. Custom model / fine-tune only if volume justifies (usually not yet).

### 4.4 Recommendation for STT

| Use | Pick |
|-----|------|
| Keep dictation cheap | Stay on **Groq whisper-large-v3-turbo**; bump to large-v3 for Catalan/noise complaints |
| Court / noisy streaming later | **Deepgram Flux/Nova-3** primary; A/B **Scribe v2 RT** for Catalan quality |
| Do not switch solely for “best WER on clean podcasts” | OpenAI gpt-4o-transcribe — excellent but costlier and not the noise winner |

---

## 5. Best TTS options (2026)

| Provider | Latency | Cost (approx.) | Multilingual / Catalan | Fit |
|----------|---------|----------------|------------------------|-----|
| **ElevenLabs Flash v2.5** | ~75ms model; ~200ms first audio streaming | **$0.05 / 1K chars** Flash; **$0.10** Multilingual v2/v3 ([API pricing](https://elevenlabs.io/pricing/api)) | Flash/Multilingual: 32 langs incl. **Catalan** ([models docs](https://elevenlabs.io/docs/overview/models)) | Best quality/brand voice for product TTS |
| **Cartesia Sonic 3.5 / Turbo** | **~40–90ms TTFA** (fastest commercial class) | ~1 credit/char; Scale ~$37/1M chars equiv.; ~**$0.03/min** spoken ([docs](https://docs.cartesia.ai/pricing), [reviews](https://texttolab.com/blog/cartesia-pricing)) | 42 langs — verify Catalan quality before commit; multilingual still maturing vs ElevenLabs | Best if cascade voice agent latency is the goal |
| **OpenAI** | tts-1 lower latency; gpt-4o-mini-tts steerable | tts-1 **$15/1M chars**; hd **$30**; mini-tts ~**$0.015/min** audio ([OpenAI TTS guide](https://developers.openai.com/api/docs/guides/text-to-speech)) | Whisper language set incl. **Catalan**; voices EN-optimized | Fine for MVP readback; weaker brand voice |
| **Google Cloud TTS / Gemini TTS** | Chirp 3 / Gemini Flash TTS competitive | Standard **$4/1M** → HD **~$30/1M** chars | Strong locale coverage; Catalan available in Google TTS family | Good if GCP; Chirp for quality |
| **Open / self-host** | Variable | GPU cost only | Aina Matxa-TTS etc. for Catalan | Only if data residency forces it |

**For a future PPD cascade:** Cartesia or ElevenLabs Flash for spoken agent replies; OpenAI mini-TTS for cheap “read the last message” MVP.

---

## 6. Orchestration frameworks

| Framework | Type | Cost | Complexity | Verdict for PPD |
|-----------|------|------|------------|-----------------|
| **LiveKit Agents** | OSS + optional Cloud (~$0.01/agent-min) | Infra + STT/LLM/TTS; cheapest at >~50K min/mo | High (WebRTC, workers) | Best if you eventually self-host a real voice product ([comparison](https://alatirok.com/best-voice-ai-agent-framework-2026/)) |
| **Pipecat** (Daily) | OSS Python pipelines | Infra + vendors | High modularity | Best for custom cascade control |
| **Vapi** | Managed | Headline ~$0.05–0.13/min; BYOK often **$0.23–0.33/min** all-in | Low | Fast prototype; expensive at scale; telephony-first |
| **Retell** | Managed | ~**$0.07/min** flatter; HIPAA story | Low | Support-line use cases; not our court UX |
| **AssemblyAI / Deepgram Voice Agent APIs** | Managed E2E | $0.07–0.08/min | Lowest | Skip for gated coaching — too little control |

Sources: [Hamming stack guide](https://hamming.ai/resources/best-voice-agent-stack), [Inworld Vapi vs Pipecat vs LiveKit](https://inworld.ai/resources/vapi-vs-pipecat-vs-livekit), [Particula comparison](https://particula.tech/blog/vapi-vs-retell-vs-livekit-vs-pipecat-voice-agent-platform).

**Recommendation:** Do not adopt Vapi/Retell for the core product. If/when building cascade voice, use **LiveKit Agents or Pipecat** wired to the *same* Next.js/Python agent tools — not a second agent brain.

---

## 7. Hard problems (why “just add voice” fails)

### 7.1 Latency budgets

Human turn gaps median ~200ms; delays >~800ms feel awkward; >1.5s feels broken ([Twig 800ms rule](https://www.twig.so/blog/voice-ai-agents-latency-budget-800ms), [Soniox wiki](https://soniox.com/wiki/voice-agent-latency-budget)).

Illustrative budget to first audio:

| Stage | p50 target |
|-------|------------|
| End-of-turn detection | 200–400ms |
| STT finalize | 50–150ms (streaming overlap) |
| LLM TTFT | 200–400ms |
| Tool calls | 0 if overlapped; else destroy feel |
| TTS first chunk | 40–200ms |
| Network | 50–150ms |
| **Total** | **~600–850ms aspirational; <800ms P95 “good”** |

2026 bar is tightening toward 300–650ms routine ([Genαi](https://genalphai.com/voice-agent-latency-designing-beyond-the-800ms-wall/)).

### 7.2 Turn detection / endpointing

Silence timers either cut coaches mid-thought or add 500–800ms dead air every turn. Model-based / semantic EOT (Deepgram Flux, AssemblyAI Universal-3.x, LiveKit turn detector) is required for agent feel ([Hackernoon latency playbook](https://hackernoon.com/the-voice-agent-latency-playbook-stt-turn-detection-and-the-tradeoffs-nobody-talks-about)).

Court noise makes VAD worse — wind, balls, yelling, other courts.

### 7.3 Interruptions (barge-in)

Must cancel LLM + flush TTS within ~200ms of user speech onset. Pipelines need explicit cancellation wiring; S2S has native advantage but still imperfect.

### 7.4 Tool calls that take 2 seconds

A 2s CRM/ClickHouse/tool round-trip **blows the conversational budget**. Patterns that work:
- Speak a short filler while tools run.
- Speculative parallel tool start from partial transcripts.
- Prefer precomputed cards/insights over live heavy queries on the voice path.
- Restrict voice to “readiness snapshot / today’s plan” tools with p95 <500ms.

Your existing agent tool surface (wearables, tennis evolution, training) is **exactly** the kind of stack that makes naive voice agents feel broken.

---

## 8. Noise: tennis court reality

Outdoor tennis: ball impact, squeaks, wind, PA, other courts, coach shouting, phone in pocket (muffled, movement noise).

Evidence:
- Clean-benchmark WER is misleading; real noisy WER can jump into mid-20s% for generic models ([Deepgram on-prem guide](https://deepgram.com/learn/speech-to-text-on-premise-production-deployment)).
- Deepgram Nova-3 marketed for overlapping speech, background noise, distant mics; often preferred over Whisper for noisy realtime ([APIScout 2026](https://apiscout.dev/guides/deepgram-vs-openai-whisper-2026)).
- Whisper (incl. Groq) is acceptable for **close-mic push-to-talk dictation** after the coach finishes a phrase; weak for always-on pocket duplex.
- gpt-realtime-2.1 explicitly improved silence/noise handling — still not “pocket on clay court” certified.

**Practical implication:** Court voice UX should be **push-to-talk / hold-to-dictate**, not always-listening agent. Earpiece + unidirectional mic helps; open-air always-on S2S will frustrate coaches and burn tokens on noise.

---

## 9. Privacy & GDPR (voice, biometrics, minors)

### 9.1 Voice is personal data

A voice recording relating to an identifiable person is **personal data** under GDPR Art. 4(1) almost always ([LexisNexis guidance](https://www.lexisnexis.co.uk/legal/guidance/is-someones-voice-personal-identifiable-information-under-gdpr-if-someone-is-to-do-a-voice-over-for)).

### 9.2 When is voice Article 9 special category biometric data?

ICO (UK GDPR, aligned with EU concepts): biometric data requires specific technical processing of physical/behavioural characteristics that **allow unique identification**. It becomes **special category** under Art. 9 **when used for the purpose of uniquely identifying** someone ([ICO key concepts](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/biometric-data-guidance-biometric-recognition/key-data-protection-concepts/)).

**Implication for PPD dictation/STT:**
- Transcribing coach speech to drive a chat agent, **without** speaker recognition / voiceprints → generally **not** Art. 9 biometric processing *for identification*, but still Art. 6 personal data processing.
- Building voiceprints, “voice match,” speaker ID, or persistent biometric templates → **Art. 9** → explicit consent (or other Art. 9(2) condition) + DPIA.

EDPB/commentary: voice is “inherently biometric” in character, but Art. 9 triggers on **identification purpose** ([analysis](https://www.linkedin.com/pulse/when-voice-special-category-personal-data-under-gdpr-janvier-parewyck); [Ailance 2026](https://2b-advice.com/en/2026/04/17/transcription-and-speaker-identification-data-protection-voice-match/)).

### 9.3 Minors

Academies involve under-16 athletes. Even if the *speaker* is a coach:
- Recordings may capture **child voices in the background** on court → personal data of minors; heightened care, minimization, DPIA appetite.
- Art. 8 parental consent rules apply to information-society services offered to children (age 13–16 by member state).
- Prefer: process coach mic only, short retention, no training on customer audio, EU region processing, no speaker ID.

### 9.4 Product rules that follow

1. **No voice biometrics / speaker ID** unless product-critical (it is not).
2. **Ephemeral audio:** stream → transcribe → discard audio; retain text under existing chat retention.
3. **DPIA** before always-on court recording or any voiceprint feature.
4. Vendor DPAs: Groq/Deepgram/ElevenLabs/OpenAI/Google — confirm subprocessors, retention, “used to improve products” toggles (Gemini free tier often trains; paid often not — verify current terms).
5. Prefer cascade with text logs for accountability over opaque S2S retention of raw audio context.

---

## 10. Cost models for PPD

Assumptions: coach dictation 20 utterances/day × 5s = ~100s STT/day; or “full voice agent” 10 min/day continuous.

### 10.1 Dictation-only (recommended near-term)

| Stack | Cost |
|-------|------|
| Groq turbo 100s/day | ~**$0.001/day** / coach (~$0.03/mo) |
| Deepgram stream 100s/day | ~**$0.01–0.02/day** |
| Optional OpenAI TTS readback 30s reply audio | ~**$0.007–0.015/reply** |

Negligible vs LLM chat costs.

### 10.2 Full cascade voice agent (illustrative)

Per minute all-in self-hosted LiveKit/Pipecat: often cited **~$0.08–0.15/min** (STT+LLM+TTS) when tuned; managed Vapi/Retell **~$0.07–0.30/min** ([framework comparisons](https://alatirok.com/best-voice-ai-agent-framework-2026/)).

10 min/coach/day × 100 coaches × 20 days = 20,000 min/mo → **~$1.6K–$3K/mo** self-host components, or **~$1.4K–$6K/mo** managed — before eng cost.

### 10.3 Full S2S (OpenAI Realtime 2.1)

~**$0.06–0.11/min** → same 20K min → **~$1.2K–$2.2K/mo** API alone, with weaker safety story. Gemini Live can undercut per-minute *if* sessions stay short; long sessions re-bill context.

**Eng cost dominates:** production barge-in, EOT, tool fillers, court noise hardening, multilingual eval → **months**, not a sprint.

---

## 11. Blunt recommendations

### 11.1 Build real voice agent / improve dictation / leave alone?

| Option | Verdict |
|--------|---------|
| Real duplex voice agent | **No — not now.** Distraction from core multi-agent work; safety + noise + tool latency fight you. |
| Improve existing dictation | **Yes — small investment.** Highest ROI for court-side coaches. |
| Leave voice alone | Acceptable if eng is fully consumed by agent reliability; dictation already covers “hands busy → text.” |

### 11.2 If we do voice later: architecture & vendors

1. **Architecture:** Cascaded only for anything that can give coaching advice. S2S demos OK; S2S production for PPD **no**.
2. **Brain:** Existing text agent + guardrails (do not fork a second voice brain).
3. **STT:** Deepgram Flux/Nova-3 (noise + Catalan) or ElevenLabs Scribe RT (Catalan quality); keep Groq for cheap offline/dictation.
4. **TTS:** ElevenLabs Flash or Cartesia Sonic for latency; OpenAI mini-TTS for MVP.
5. **Orchestration:** LiveKit Agents or Pipecat when volume justifies; not Vapi as system of record.
6. **UX:** Push-to-talk on court; optional earpiece; never always-listen by default (privacy + noise).

### 11.3 Minimum viable dictation improvement

Ship in order:
1. **Reliable push-to-talk** (hold to speak; visual waveform; cancel).
2. **Language hint** from UI locale (`en`/`es`/`ca`/`zh`) into Groq/Whisper.
3. **Streaming partials** (Deepgram or Scribe) only if coaches hate wait-after-release latency.
4. **Keyword glossary** post-process for tennis/physio terms.
5. **Optional “speak reply”** button → TTS of *already rendered* assistant text (gated).
6. **No audio retention** beyond processing window; document in privacy policy.

**Cost:** pennies per coach per month. **Eng:** ~3–10 days for (1)(2)(5)(6); +1–2 weeks for streaming STT swap.

### 11.4 Phase placement

| Phase | Voice work |
|-------|------------|
| **Now / Phase of core agents** | Dictation polish only. Do not staff a voice agent workstream. |
| **After** text tools, safety multilingual parity, observability | Revisit cascade voice for “coach pocket mode” as a **beta** for 1–2 academies. |
| **Never (unless product asks)** | Voice biometrics, always-on court mics, S2S as sole brain |

**Honesty check:** Full voice agents are a glamorous distraction. Your differentiation is tennis/wearable intelligence and safe multi-agent coaching — not becoming a LiveKit shop. Dictation that works on clay is enough to prove the use case; duplex voice is a 2027 product bet, not a 2026 foundation bet.

---

## 12. Source index (primary URLs)

**Architecture**
- https://livekit.com/blog/realtime-vs-cascade
- https://futureagi.com/blog/cascaded-voice-ai-vs-speech-to-speech-2026/
- https://gradium.ai/content/cascaded-voice-agent-vs-speech-to-speech-2026
- https://www.contextstudios.ai/comparisons/gpt-live-vs-cascaded-voice-pipeline
- https://blog.agihouse.org/posts/voice-agents-research-brief

**Realtime APIs & pricing**
- https://developers.openai.com/api/docs/pricing
- https://developers.openai.com/api/docs/guides/realtime-costs
- https://developers.openai.com/api/docs/models/gpt-realtime-2.1
- https://www.forasoft.com/blog/article/openai-realtime-api-pricing
- https://ai.google.dev/gemini-api/docs/pricing
- https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing
- https://rywalker.com/research/gemini-live-api
- https://discuss.ai.google.dev/t/pricing-of-speech-to-speech-live-model/140340/3

**STT**
- https://groq.com/pricing
- https://www.coval.ai/blog/best-speech-to-text-providers-in-2026-independent-benchmarks-and-how-to-choose/
- https://deepgram.com/product/speech-to-text/catalan
- https://elevenlabs.io/speech-to-text/catalan
- https://elevenlabs.io/pricing/api
- https://www.assemblyai.com/pricing
- https://futureagi.substack.com/p/speech-to-text-apis-in-2026-benchmarks
- https://apiscout.dev/guides/deepgram-vs-openai-whisper-2026

**TTS**
- https://elevenlabs.io/docs/overview/models
- https://docs.cartesia.ai/pricing
- https://developers.openai.com/api/docs/guides/text-to-speech
- https://texttolab.com/blog/cartesia-pricing

**Frameworks**
- https://alatirok.com/best-voice-ai-agent-framework-2026/
- https://hamming.ai/resources/best-voice-agent-stack
- https://inworld.ai/resources/vapi-vs-pipecat-vs-livekit
- https://particula.tech/blog/vapi-vs-retell-vs-livekit-vs-pipecat-voice-agent-platform

**Latency / UX hard problems**
- https://www.twig.so/blog/voice-ai-agents-latency-budget-800ms
- https://genalphai.com/voice-agent-latency-designing-beyond-the-800ms-wall/
- https://soniox.com/wiki/voice-agent-latency-budget
- https://hackernoon.com/the-voice-agent-latency-playbook-stt-turn-detection-and-the-tradeoffs-nobody-talks-about
- https://hamming.ai/resources/voice-ai-latency-whats-fast-whats-slow-how-to-fix-it

**GDPR / biometrics**
- https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/biometric-data-guidance-biometric-recognition/key-data-protection-concepts/
- https://2b-advice.com/en/2026/04/17/transcription-and-speaker-identification-data-protection-voice-match/
- https://www.dilr.ai/blog/ai-voice-biometric-data-security-enterprise
- https://www.lexisnexis.co.uk/legal/guidance/is-someones-voice-personal-identifiable-information-under-gdpr-if-someone-is-to-do-a-voice-over-for
