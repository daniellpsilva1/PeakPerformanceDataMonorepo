# 72 — Packaging, Metering & Protecting AI Features in Consumer and B2B Subscriptions

**Research date:** 2026-08-02  
**Scope:** External research only (web search + fetch). No local codebase exploration.  
**Unit-cost inputs (from prior internal research):** AI COGS ≈ **$0.67–$0.94 / athlete / month** at a balanced quality tier; up to **~$2.33** at a premium multi-agent tier.  
**Constraint:** Stripe is the planned payments stack.

---

## 1. Executive verdict

Consumer health/fitness products in 2025–2026 almost universally **bundle conversational AI into a flat subscription** in the **$6–$15/month** software band (Oura, Levels software, Google Health Premium, Strava), or into a **$20–$30/month** wearables membership (WHOOP). None of the major consumer wearables sell “AI coaching” as a transparent token meter to end users. Separately, the broader AI SaaS industry has **retreated from uncapped flat bundling**: GitHub Copilot moved to credit-based usage (June 2026), Notion added AI usage allowances (August 2026), and Character.AI capped free chat features after infra pain. The workable pattern for PPD is therefore:

1. **Sell a flat consumer subscription** that feels like Google Health / Strava / Levels (predictable, coach-branded).  
2. **Internally meter cost units** (weighted “coach credits”) so one power user cannot destroy margin.  
3. **Show soft, human limits** (conversations / deep analyses), not raw tokens.  
4. **B2B: price by athlete AI seats (or athlete-usage pool), not coach seats alone.**

---

## 2. Market price anchors — consumer health/fitness AI (2026)

### 2.1 Pricing table (USD, verified mid-2026 sources)

| Product | Headline price (US) | AI packaging | Usage-limited? | Notes / sources |
|---|---|---|---|---|
| **WHOOP** | One **$199/yr**; Peak **$239/yr** (~$20/mo); Life **$359/yr**; also ~**$30/mo** monthly Peak | AI coaching (**WHOOP Coach**) **bundled** in membership; hardware included | No public token meter; membership-gated | [whoop.com/membership](https://www.whoop.com/us/en/membership/), [TrackerVS WHOOP pricing](https://trackervs.com/pricing/whoop-pricing/), [TechSifted review 2026](https://techsifted.com/reviews/whoop-review-2026/) |
| **Oura** | **$5.99/mo** or **$69.99/yr** (+ ring hardware ~$349–$499) | **Oura Advisor** AI bundled in Membership | Membership vs basic scores; no public token meter | [ouraring.com/membership](https://ouraring.com/membership), [Oura Support Jul 2026](https://support.ouraring.com/hc/en-us/articles/4409086524819-Oura-Membership) |
| **Strava** | **$11.99/mo** or **$79.99/yr**; Family **$139.99/yr** (≤4); +Runna **$149.99/yr** | **Athlete Intelligence** AI insights **bundled** in paid sub | Free tier exists for tracking; AI/premium analytics paid | [strava.com/pricing](https://www.strava.com/pricing) (updated Jul 1, 2025), [strava.com/subscribe](https://www.strava.com/subscribe) |
| **Fitbit → Google Health Premium** | **$9.99/mo** or **$99–$99.99/yr** | **Google Health Coach** (Gemini) is the *headline* of Premium; also included with Google AI Pro/Ultra | Bundled; device-gated rollout | [TechCrunch May 7, 2026](https://techcrunch.com/2026/05/07/googles-9-99-per-month-ai-health-coach-launches-may-19/), [Google blog](https://blog.google/products-and-platforms/products/google-health/google-health-coach/), [Android Authority](https://www.androidauthority.com/google-health-premium-price-inclusions-features-3664507/) |
| **Ultrahuman** | Ring AIR **~$349** one-time; Ring PRO **~$479**; **no core subscription** | Core insights unlocked with hardware; optional **PowerPlugs** add-ons (~$3–$7/mo or ~$40/yr modules) | N/A for core; add-ons optional | [ultrahuman.com ring buy](https://www.ultrahuman.com/global/ring/buy/), [TrackerVS](https://trackervs.com/pricing/ultrahuman-ring-price/), [Recentic review](https://recentic.com/ultrahuman-ring-air-review/) |
| **Levels** | Software membership **$15/mo** or **$80/yr**; legacy Core **$499/yr**, Complete **$1,999/yr** | AI food logging, health insights, adaptive programs **bundled** in membership | No public conversation meter; CGM/labs are paid add-ons | [Levels Support Jun 18, 2026](https://support.levels.com/article/720-levels-pricing-and-plans), [levels.health](https://levels.health/) |
| **Function Health** | **$365/yr** (down from $499) | Private AI Chat + Protocols in **beta, bundled**; value is labs | Single tier; AI not separately priced | [functionhealth.com/pricing](https://www.functionhealth.com/pricing), [Function $365 article](https://www.functionhealth.com/article/function365) |

### 2.2 Established market anchor for “AI coaching”

| Anchor band | Monthly | What it buys | Relevance to PPD |
|---|---|---|---|
| **Low software AI** | **$6–$8** | Oura Advisor + insights (hardware already paid) | Floor for “nice AI explanations,” not multi-agent coaching |
| **Dedicated AI health coach** | **$10–$12** | Google Health Coach, Strava Premium (incl. Athlete Intelligence) | **Primary B2C anchor** for conversational coaching without clinical labs |
| **Athlete membership** | **$15–$30** | Levels software ($15), WHOOP Peak (~$20–$30) | Ceiling when coaching is the product identity |
| **Lab-heavy** | **$30+/mo effective** | Function $365/yr, Levels Complete | Not an AI-price signal; labs dominate COGS |

**Conclusion:** For a software-first sports AI coach (no ring/CGM/labs), the credible consumer price band is **$9.99–$19.99/month**, with **$12.99–$14.99** as the sweet spot that sits above Google Health Premium and Levels software, and below WHOOP’s membership psychology — while still covering $0.67–$0.94 balanced AI COGS with room for infra, support, and power-user buffers.

---

## 3. Pricing model patterns that are working in 2026

### 3.1 Pattern catalog

| Pattern | How it works | 2026 status | Fit for PPD |
|---|---|---|---|
| **Fully bundled flat sub** | AI included; no visible meter | Dominant in consumer health (WHOOP, Oura, Google, Strava, Levels) | **Yes for customer-facing packaging** |
| **Credits / tokens** | Included allowance + overage | Dominant in horizontal AI (Copilot AI Credits Jun 2026; Notion credits) | **Yes internally**; hide tokens from athletes |
| **Tiered usage limits** | Soft/hard caps by plan | ChatGPT Free/Plus, Claude Pro/Max, Character.AI free | **Yes** — conversations + deep analyses |
| **Hybrid seat + usage** | Base fee + metered overage | ~41% of AI vendors (2026 share, up from 27% in 2025) | **Yes for B2B and Pro B2C** |
| **Outcome-based** | Pay per resolved ticket / result | Growing but still frontier (~5%); hard when outcome complexity varies 10–50× | **Risky** for multi-agent coaching (investigation length varies wildly) |

Sources: [Bessemer AI Pricing Playbook](https://www.bvp.com/atlas/the-ai-pricing-and-monetization-playbook), [Zuora CFO Guide](https://www.zuora.com/guides/ai-monetization-strategy/), [Simon-Kucher](https://www.simon-kucher.com/index%2Ephp/en/insights/part-1-monetizing-ai-without-destroying-margins), [Zylos AI agent economics Mar 2026](https://zylos.ai/research/2026-03-29-ai-agent-platform-economics-pricing-unit-economics/), [Conception Labs 2026](https://conception-labs.com/blog/ai-saas-pricing-how-to-price-ai-features-without-killing-your-margins).

### 3.2 What is actually working

- **Hybrid (base + included usage + overage/upgrade)** is the industry default for products with real inference COGS.  
- **Consumer health still prefers flat psychological pricing** — customers buy “a coach,” not “tokens.” The companies that survive do both: flat exterior, metered interior.  
- **Lenny/Zuora “bundle trap”:** bundling AI into an existing seat with no meter is easy in year 1 and nearly impossible to unwind later. Start with entitlements even if you never charge overages in v1.  
- **Cost-aligned metrics win:** credits weighted by model/operation beat raw “messages” when one agent run costs 50× another ([Simon-Kucher](https://www.simon-kucher.com/index%2Ephp/en/insights/part-1-monetizing-ai-without-destroying-margins)).

---

## 4. The gross margin problem — real mispricing cases

| Company | What went wrong | What changed | Lesson |
|---|---|---|---|
| **GitHub Copilot** | Flat **$10/user/mo**; WSJ reported avg loss **>$20/user/mo**, heavy users up to **~$80** (2023) | Migrated to **GitHub AI Credits** usage-based billing (**Jun 1, 2026**); completions stay unlimited; chat/agents burn credits; Business/Enterprise pool credits | Never sell uncapped agentic compute at a flat seat without a credit ceiling |
| **Replit** | AI features drove gross margins from ~**36% → −14%**, later recovered toward **+36%** via optimization (2025 case studies) | Routing, limits, pricing discipline | Infra + packaging both required |
| **Character.AI** | Free unlimited-style chat burned infra; ads then **usage caps** on Swipes/Go-ons/Memos for free users (2026) | Meter free tier; push c.ai+ | Free open-ended chat is a margin trap |
| **Notion AI** | Bundled AI into Business; then imposed **usage allowances** (rolling window + monthly) starting **Aug 3, 2026**, with optional credit overage | Soft pause + credits | Even “included AI” needs a fair-use ceiling |
| **Industry (Bessemer/Zuora)** | AI apps run **50–60% GM** vs SaaS **80–90%**; Lenny sample: 59% bundled AI into existing packages | Hybrid / add-on / credits | Assume margin compression; price for p95 users, not averages |

Sources: [The Register on Copilot losses](https://www.theregister.com/2023/10/11/github_ai_copilot_microsoft/), [WSJ](https://www.wsj.com/tech/ai/ais-costly-buildup-could-make-early-products-a-hard-sell-bdd29b9f), [GitHub Blog Jun 2026](https://github.blog/news-insights/company-news/github-copilot-is-moving-to-usage-based-billing/), [GitHub Changelog](https://github.blog/changelog/2026-06-01-updates-to-github-copilot-billing-and-plans/), [Notion Help](https://www.notion.com/help/manage-your-usage-allowance-for-notion-ai), [Zuora](https://www.zuora.com/guides/ai-monetization-strategy/), [Zylos](https://zylos.ai/research/2026-03-29-ai-agent-platform-economics-pricing-unit-economics/).

**Implication for PPD:** At $0.67–$0.94 average AI COGS, a $14.99 plan looks fine — until a power user drives $8–$15 of agent runs. Design for **p95 ≤ 40–50% of subscription AI budget**, and hard-stop or overage beyond that.

---

## 5. Usage metering implementation

### 5.1 Stripe Billing Meters (baseline — use this)

**How it works (2025–2026 API):**

1. Create a **Meter** (`POST /v1/billing/meters`) with `event_name`, aggregation (`sum` / `count` / `last`), and customer mapping.  
2. Attach a **metered Price** to a Subscription (`usage_type: metered`, `meter: meter.id`).  
3. Emit **Meter Events** (`POST /v1/billing/meter_events`) with `payload[stripe_customer_id]` + `payload[value]`.  
4. High throughput: **API v2 Meter Event Streams** up to **~10,000 events/sec** (live); v1 Meter Events ~**1,000 calls/sec** account limit.  
5. Adjustments: cancel events within 24h via Meter Event Adjustments; negative quantities supported.

Docs: [Configure meters](https://docs.stripe.com/billing/subscriptions/usage-based/meters/configure), [Record usage](https://docs.stripe.com/billing/subscriptions/usage-based/recording-usage-api), [Pricing plans / advanced UBB](https://docs.stripe.com/billing/subscriptions/usage-based/pricing-plans).

**Token metering:** Stripe’s own examples use “Hypernian tokens” with `sum` aggregation — tokens are a first-class meter value. Package pricing via `transform_quantity` (e.g., bill per 100 units).

**High cardinality:** Stripe Meters aggregate by customer + meter; they are **not** designed as a full event warehouse. Do **not** send per-tool, per-prompt, per-athlete raw events as separate billable meters. Aggregate in your app to **coach_credits** or **ai_units**, then send one (or few) events per customer per interval.

### 5.2 Metronome (now a Stripe product)

- Stripe completed the **Metronome acquisition** (announced early 2026; powers OpenAI, Anthropic, NVIDIA metering).  
- Purpose-built for **high-cardinality ingestion**, commits/credits/drawdowns, multidimensional rate cards, enterprise contracts.  
- Available as **add-on to Stripe Billing**; pricing via sales.  
- **Recommendation:** stay on **Stripe Billing Meters** for B2C launch; evaluate Metronome when B2B contracts need commits, drawdowns, and multi-SKU agent rate cards.

Sources: [Stripe newsroom](https://stripe.com/newsroom/news/stripe-completes-metronome-acquisition), [Stripe + Metronome blog](https://stripe.com/blog/metronome-stripe-building-the-future-of-billing), [stripe.com/billing/usage-based-billing](https://stripe.com/billing/usage-based/billing).

### 5.3 Alternatives comparison

| Platform | High-cardinality ingestion | Token metering | Pricing (public) | Notes |
|---|---|---|---|---|
| **Stripe Billing Meters** | Medium — aggregate before send; v2 streams for volume | Yes (sum value) | Stripe Billing % of volume (standard Stripe Billing fees) | **Default for PPD** |
| **Metronome (Stripe)** | Excellent — event stream at AI infra scale | Yes; credits & rate cards | Sales / add-on | Use when enterprise complexity arrives |
| **Orb (Adyen, Jul 2026)** | Excellent — full event stream + SQL metrics + backtesting | Yes | Historically ~$720/mo entry; now sales | Avoid if committed to Stripe payments |
| **Lago** | Good — event-based; self-host or cloud | Yes | Self-host free (AGPL); cloud ~sales (~$3k/mo historically cited) | Best if data residency / no PSP lock-in |
| **OpenMeter (Kong)** | Excellent — Kafka → ClickHouse pre-aggregation | First-class LLM token meters + cost DB | Sales (Cloud = Konnect Metering & Billing) | Strong if you need real-time entitlement gating + Stripe invoice sync |

Sources: [dreaming.press comparison](https://dreaming.press/posts/usage-based-billing-metronome-vs-orb-vs-lago.html), [Lago vs Orb](https://getlago.com/blog/lago-vs-orb), [OpenMeter GitHub](https://github.com/openmeterio/openmeter), [OpenMeter metering challenge](https://openmeter.io/docs/metering/guides/the-metering-challenge), [OpenMeter pricing](https://openmeter.io/pricing).

### 5.4 Recommended metering architecture for PPD

```
Agent runtime completes turn
    → emit internal UsageEvent {
         org_id, user_id, athlete_id,
         op_class: quick|standard|deep,
         model, input_tokens, output_tokens,
         tool_calls, estimated_usd, coach_credits
       }
    → write to ClickHouse / analytics (high cardinality OK)
    → increment Redis entitlement counters (real-time gate)
    → asynchronously roll up to Stripe Meter Event:
         event_name = "coach_credits"
         value = coach_credits
         stripe_customer_id = billing customer
```

**What to count (customer-facing vs internal):**

| Layer | Unit | Why |
|---|---|---|
| **Internal cost** | Tokens + tool USD + model multiplier | True COGS, routing, margin dashboards |
| **Entitlement / UX** | **Coach credits** (weighted) | Fair across cheap vs expensive ops |
| **Stripe meter (v1)** | `coach_credits` sum | One meter; optional overage price |
| **UX copy** | “Deep analyses” / “Coach chats” | Never show tokens to athletes |

**Suggested credit weights (calibrated to ~50× deep vs cheap):**

| Operation class | Examples | Credits |
|---|---|---|
| **Quick (1)** | Score explanation, single-metric Q&A, cached insight fetch | 1 |
| **Standard (5)** | Session debrief, weekly summary, training suggestion | 5 |
| **Deep (50)** | Multi-agent investigation, cross-domain “why is recovery down,” roster analysis | 50 |

---

## 6. Rate limiting & abuse prevention

### 6.1 Principles (2026 consensus)

- Limit **cost**, not raw request count — LLM requests vary 100–2000× ([System Hardening](https://www.systemshardening.com/articles/kubernetes/llm-rate-limiting/), [CallMissed](https://www.callmissed.com/en/blog/ai-rate-limiting-strategies), [Zuplo](https://zuplo.com/learning-center/token-based-rate-limiting-ai-agents)).  
- Prefer **token bucket** (or sliding window on credits) over fixed-window request RPM.  
- **Pre-reserve** estimated credits (`input + expected_output` × op weight); reconcile after completion.  
- Separate **per-user** and **per-org** buckets so one coach cannot starve an academy.  
- Return **429** with `Retry-After` + remaining budget headers for API; friendly UI for app.

### 6.2 Recommended numeric limits (B2C)

Assume Coach plan includes **200 credits/month** (~$2.00–$3.00 of COGS headroom at balanced routing if 1 credit ≈ $0.01–$0.015 of expected cost — tune after 2 weeks of prod telemetry).

| Window | Quick | Standard | Deep | Combined credit budget |
|---|---|---|---|---|
| **Burst (token bucket)** | 20/min | 6/min | 1/min | 30 credits/min refill cap |
| **Hourly** | — | — | 3 deep/hour | 40 credits/hour |
| **Daily** | Soft | Soft | 6 deep/day | 40 credits/day soft warn |
| **Monthly (hard entitlement)** | — | — | — | **200 credits** (Coach); **500** (Pro) |

**B2B org pool (example 50 AI athlete seats):**

| Limit | Value |
|---|---|
| Org monthly credits | `seats × 180` (pooled) |
| Per-coach daily | 80 credits (anti-runaway) |
| Per-athlete monthly soft | 120 credits (fairness across roster) |
| Deep ops / org / hour | 20 |

### 6.3 Expensive vs cheap fairness

- Classify every agent entrypoint with `op_class` **before** orchestration.  
- UI: “Quick answer” vs “Full investigation” — deep requires explicit confirm when near budget.  
- Auto-route: default to cheap model; escalate only when tools/router demand it.  
- Cap concurrent deep jobs per user to **1**.

### 6.4 Abuse vectors & practical controls

| Abuse | Control |
|---|---|
| **Prompt-based cost attacks** (huge pasted context, “repeat 10k times”) | Max input chars; strip repeated padding; refuse non-sports jailbreaks; cap `max_tokens`; credit pre-reserve |
| **General-purpose chatbot use** | System prompt + classifier: out-of-domain → short refusal + 0–1 credit; no tools |
| **Scraping / automation** | Auth required; per-session CSRF; bot detection; anomaly on RPM; block API keys from consumer tiers |
| **Account sharing** | Device/session limits (e.g., 2 active sessions); impossible-travel alerts; B2B SSO + seat assignment |
| **Multi-account free trials** | Payment method / device fingerprint for trial; 1 trial per card; AI disabled or tiny on free |
| **Org credential stuffing** | Per-seat MFA for coaches; audit log of AI actions |

### 6.5 Graceful degradation messaging

| State | Still works | Stops | Message tone |
|---|---|---|---|
| **80% budget** | All AI | — | Soft banner: “You’ve used most of this month’s Coach analyses.” |
| **100% monthly credits** | Dashboards, scores, history, **cached** nightly insights, non-AI charts | Live agent, deep investigations, new generative plans | “You’ve reached this month’s Coach limit. Resets on {date}. Upgrade to Pro or wait — your data and insights stay available.” |
| **Burst / hourly** | Same + retry | New live turns for N minutes | “Coach is cooling down to keep quality high. Try again in {mm:ss}.” |
| **Out-of-domain** | App | Tool-using agent | “I’m your tennis performance coach — ask about training, recovery, or match data.” |
| **Provider outage** | Cached insights | Live LLM | “Live coaching is temporarily unavailable. Here are your latest insights.” |

Pattern mirrors ChatGPT free→mini fallback and Notion “pause until refresh” ([ChatGPT limits](https://chatai.guide/limits/chatgpt-message-limit/), [Notion](https://www.notion.com/help/manage-your-usage-allowance-for-notion-ai)).

---

## 7. Fair-use policy design

**Do:**

- Publish **human units**: e.g., “About 40 coach chats or 4 deep investigations per month on Coach.”  
- State that **automated / non-personal / resale use is prohibited**.  
- Reserve right to throttle abuse without calling out “tokens.”  
- Offer upgrade path before hard stop whenever possible.

**Don’t:**

- Promise “unlimited AI.”  
- Lead with token math in marketing.  
- Silently degrade quality without telling the user (trust killer).

**Sample fair-use clause (short):**

> Peak Performance Coach includes a monthly allowance of AI coaching appropriate for personal athletic use. Continuous automated querying, scraping, account sharing, or use as a general-purpose chatbot may result in temporary rate limits. Your training data, scores, and saved insights remain available even when the live Coach allowance is exhausted.

---

## 8. The free-tier question

| Product | Free AI? | Outcome |
|---|---|---|
| **ChatGPT Free** | Tiny flagship quota (~10 msgs / 5h) then cheaper model | Acquisition funnel; hard caps |
| **Character.AI** | Was generous → caps + ads (2026) | Infra forced retreat |
| **Duolingo** | Moved some AI (Explain My Answer) to free; Max keeps costly Roleplay/Video Call | Give away *cheap* AI; gate *expensive* conversational AI |
| **Strava / Oura / Google Health** | Free = non-AI or basic scores; AI in paid | Cleanest for COGS |
| **Ultrahuman** | No AI-sub model; hardware pays | Different economics |
| **Copilot Free** | Small AI credit allotment | Trial, not unlimited agents |

**Recommendation for PPD:** **No unlimited free live coach.** Offer:

- Free: dashboards, wearable sync, **precomputed** insights (batch, controllable COGS).  
- Free trial (7–14 days) of Coach with **tight credits** (e.g., 30 credits).  
- Optionally 3 free “Quick answers” / week forever as a tease (cheap ops only).

Evidence: products that tried open-ended free chat either capped it (Character.AI) or never offered it for the expensive surface (Google Health Coach is Premium-only).

---

## 9. B2B differences — academies

### 9.1 The 200 athletes / 5 coaches problem

| Pricing axis | If you charge… | Failure mode |
|---|---|---|
| **Per coach seat only** | 5 × seat | AI cost scales with **athletes queried**, not coaches; 5 coaches can burn 200 athletes of context |
| **Per athlete (platform)** without AI meter | 200 × seat | Fairer, but idle athletes subsidize; still need AI pool |
| **Per AI-enabled athlete** | N × AI seat | Best cost alignment; academy enables AI only for priority roster |
| **Pooled credits on org** | Flat platform + credit pool | Best for variable usage; needs admin UX |

**Recommendation:**

1. **Platform fee** (academy base) — roster, training, analytics.  
2. **AI Athlete seats** — billed per athlete with AI coaching enabled (not all 200).  
3. **Org credit pool** = `AI seats × monthly credits`; coaches draw from pool.  
4. Optional **Coach seats** for human workflow features (scheduling, messaging) **decoupled** from AI meters.

Example: Academy enables AI for 40 of 200 athletes × $8–$12/athlete AI add-on + platform fee. Five coaches share the pool; per-coach daily caps stop one power user.

### 9.2 B2B packaging sketch

| SKU | Price | Includes |
|---|---|---|
| Academy Platform | Custom / starting ~$299–$499/mo | Roster, training ops, analytics (existing B2B) |
| AI Athlete Seat | **$8–$12 / athlete / mo** | 180 coach credits / seat into org pool; athlete-facing + coach-facing AI on that athlete |
| AI Pro Pack | **+$4 / athlete / mo** | 400 credits / seat; deep investigations unlocked |
| Overage | **$0.02 / credit** (optional, admin opt-in) | Prevents hard stop during tournament week |

At $0.67–$0.94 balanced COGS and $10 AI seat: AI COGS is **~7–9% of AI SKU revenue** before power-user variance — healthy if credits cap p95.

---

## 10. Concrete recommendations

### 10.1 Packaging proposal (B2C)

| Plan | Price | AI | Credits / mo | Positioning |
|---|---|---|---|---|
| **Free** | $0 | Precomputed insights only; 3 Quick answers/week | ~3–5 | Acquisition; no live multi-agent |
| **Coach** | **$14.99/mo** or **$119/yr** (~$9.92/mo) | Live coach, weekly plans, standard debriefs | **200** (~40 standard or 4 deep) | Primary SKU — above Google Health ($9.99), near Levels software ($15) |
| **Pro** | **$24.99/mo** or **$199/yr** | Priority deep investigations, premium models, higher caps | **500** + 10 deep/mo soft | Power athletes; still under WHOOP Peak psychology |
| **Overage (optional)** | Off by default | — | **$0.03/credit** after cap, budget cap $10 | Prevents cliff without open-ended loss |

**Unit economics check (Coach @ $14.99):**

| Scenario | AI COGS | % of revenue |
|---|---|---|
| Average balanced | $0.67–$0.94 | 4.5–6.3% |
| Included credit ceiling (~$2.00–$3.00 intended COGS) | ~$2.50 | ~17% |
| Premium routing worst case if uncapped | $2.33+ | Unsustainable → credits prevent this |

**Justification:** Market AI-coach anchor is **$10** (Google Health Premium). PPD’s multi-agent tennis coach is more specialized than Fitbit-style coaching → **$14.99** is defensible. Annual at $119 undercuts WHOOP Peak ($239, but includes hardware) and beats Strava annual on coaching specificity.

### 10.2 Packaging proposal (B2B)

| Component | Price | Meter |
|---|---|---|
| Academy Platform | Existing / custom | Seats for coaches (workflow) |
| AI Athlete Seat | **$10/athlete/mo** (list) | 180 credits into org pool |
| Volume tiers | 50+ athletes **$8**; 150+ **$6.50** | Same credit ratio |
| Tournament burst | Optional overage budget | Admin-controlled |

For 200 athletes / 5 coaches: sell **AI seats for the active cohort** (e.g., 40) = **$400/mo** AI + platform, not 5 × unlimited org AI.

### 10.3 Metering architecture (what / where / Stripe)

1. **Count coach credits** at the agent gateway after each turn (and on cancel/error with partial debit).  
2. **Store raw tokens** in analytics for COGS; do not bill raw tokens to consumers.  
3. **Gate in Redis/Entitlements service** before expensive orchestration.  
4. **Stripe:** subscription item for plan (flat) + optional metered price on `coach_credits` for overage; emit rolled-up meter events hourly or at session end.  
5. Stay on **Stripe Billing Meters** at launch; revisit **Metronome** for enterprise commits.

### 10.4 Rate-limit design (summary numbers)

| Dimension | Free | Coach | Pro | B2B (per AI seat) |
|---|---|---|---|---|
| Monthly credits | 5 | 200 | 500 | 180 pooled |
| Deep ops / day | 0 | 4 | 10 | 6 / athlete soft |
| Concurrent deep | 0 | 1 | 2 | 1 / coach |
| Burst credits / min | 3 | 30 | 60 | 40 / coach |

Algorithm: **token bucket on credits** (not RPM), with separate **hourly deep-op counter**.

### 10.5 Degradation ladder

1. **Warn at 80%** — banner + email.  
2. **At 100%** — block new live agent turns; keep app + cached insights; CTA upgrade / wait for reset.  
3. **If overage enabled** — continue with spend cap; notify admin (B2B) or user (B2C).  
4. **Burst hit** — short cooldown message, not “upgrade.”  
5. **Abuse flag** — temporary 24h AI suspension + support path; data intact.

### 10.6 Entitlement model

```
Request → Auth (Supabase session)
       → EntitlementService.resolve(user_id, org_id)
            reads: Stripe subscription status (cached),
                   plan tier, credit balances (Redis),
                   feature flags (deep_agent, premium_model),
                   org policies (overage_enabled, athlete_ai_enabled)
       → if !allowed → return 402/429 + UX payload
       → AgentService.run(op_class, max_credits)
       → UsageLedger.record + Stripe meter enqueue
```

**Where the check lives:** a single **Entitlement/Quota middleware** in front of all AI routes (Next.js BFF + Python agent). The agent runtime must **not** trust the client; every tool loop re-checks remaining credits before spawning sub-agents.

**Cache:** subscription entitlements from Stripe webhooks → DB; hot counters in Redis with monthly TTL aligned to billing cycle.

---

## 11. Source index

### Competitor pricing
- https://www.whoop.com/us/en/membership/
- https://www.whoop.com/us/en/peak/
- https://trackervs.com/pricing/whoop-pricing/
- https://techsifted.com/reviews/whoop-review-2026/
- https://ouraring.com/membership
- https://support.ouraring.com/hc/en-us/articles/4409086524819-Oura-Membership
- https://www.strava.com/pricing
- https://www.strava.com/subscribe
- https://techcrunch.com/2026/05/07/googles-9-99-per-month-ai-health-coach-launches-may-19/
- https://blog.google/products-and-platforms/products/google-health/google-health-coach/
- https://www.androidauthority.com/google-health-premium-price-inclusions-features-3664507/
- https://store.google.com/product/google_health_premium?hl=en-US
- https://www.ultrahuman.com/global/ring/buy/
- https://trackervs.com/pricing/ultrahuman-ring-price/
- https://support.levels.com/article/720-levels-pricing-and-plans
- https://levels.health/
- https://www.functionhealth.com/pricing
- https://www.functionhealth.com/article/function365

### AI SaaS pricing / margins
- https://www.bvp.com/atlas/the-ai-pricing-and-monetization-playbook
- https://www.zuora.com/guides/ai-monetization-strategy/
- https://www.simon-kucher.com/index%2Ephp/en/insights/part-1-monetizing-ai-without-destroying-margins
- https://zylos.ai/research/2026-03-29-ai-agent-platform-economics-pricing-unit-economics/
- https://conception-labs.com/blog/ai-saas-pricing-how-to-price-ai-features-without-killing-your-margins
- https://www.theregister.com/2023/10/11/github_ai_copilot_microsoft/
- https://www.wsj.com/tech/ai/ais-costly-buildup-could-make-early-products-a-hard-sell-bdd29b9f
- https://github.blog/news-insights/company-news/github-copilot-is-moving-to-usage-based-billing/
- https://github.blog/changelog/2026-06-01-updates-to-github-copilot-billing-and-plans/
- https://docs.github.com/en/copilot/concepts/billing/usage-based-billing-for-individuals
- https://www.notion.com/help/manage-your-usage-allowance-for-notion-ai

### Metering platforms
- https://docs.stripe.com/billing/subscriptions/usage-based/meters/configure
- https://docs.stripe.com/billing/subscriptions/usage-based/recording-usage-api
- https://docs.stripe.com/billing/subscriptions/usage-based/pricing-plans
- https://stripe.com/newsroom/news/stripe-completes-metronome-acquisition
- https://stripe.com/blog/metronome-stripe-building-the-future-of-billing
- https://stripe.com/billing/usage-based-billing
- https://dreaming.press/posts/usage-based-billing-metronome-vs-orb-vs-lago.html
- https://getlago.com/blog/lago-vs-orb
- https://github.com/openmeterio/openmeter
- https://openmeter.io/docs/metering/guides/the-metering-challenge
- https://openmeter.io/pricing

### Rate limits / free tier behavior
- https://www.systemshardening.com/articles/kubernetes/llm-rate-limiting/
- https://www.callmissed.com/en/blog/ai-rate-limiting-strategies
- https://zuplo.com/learning-center/token-based-rate-limiting-ai-agents
- https://zylos.ai/research/2026-02-25-rate-limiting-backpressure-ai-agent-apis/
- https://chatai.guide/limits/chatgpt-message-limit/
- https://theaicareerlab.com/blog/ai-usage-limits-compared-2026
- https://piunikaweb.com/2026/03/11/character-ai-limits-swipes-go-ons-memos-free-users/
- https://isitstillworthit.com/duolingo-max-vs-super/

---

## 12. Open questions / validation next steps

1. Calibrate **credit → USD** from 2 weeks of shadow metering in staging/prod.  
2. Measure **p50 / p95 / p99** coach-credit consumption per active athlete before locking overage prices.  
3. A/B **$12.99 vs $14.99** on consumer landing for conversion vs LTV.  
4. Confirm HSA/FSA eligibility path (Oura/Levels/Function use it as a wedge).  
5. When first enterprise academy asks for commits, pilot **Metronome** without rewriting Stripe Checkout for B2C.

---

*End of dossier.*
