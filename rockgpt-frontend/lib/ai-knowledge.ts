export type ModelMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export function generateStructuredResponse(
  query: string,
  history: ModelMessage[] = [],
  projectName?: string | null
): string {
  const cleanQ = query.trim();
  const qLower = cleanQ.toLowerCase();

  // Helper to check keywords
  const has = (...terms: string[]) => terms.some(t => qLower.includes(t));

  // 1. Identity & Introduction
  if (has("who are you", "what are you", "what is rockgpt", "introduce yourself")) {
    return `### Executive Overview
I am **RockGPT**, an intelligent, high-momentum AI platform engineered for full-stack engineering, rapid knowledge breakdown, autonomous deep research, and collaborative canvas drafting.

### Core Architecture & Capabilities
• **Low-Latency Streaming Engine**: Instant token delivery with zero buffering stutters.
• **Autonomous Deep Research**: Multi-step query planning, sub-question expansion, and verified report synthesis.
• **Interactive Workspace**: Integrated projects, persistent note-taking canvas, and dark/light adaptive design.
• **Production Markdown Standards**: Native support for syntax-highlighted code blocks, structured tables, and technical documentation.

> **Key Takeaway:** You can treat me as your pair programmer, systems architect, day planner, or deep research agent. What problem can we solve together today?`;
  }

  // 2. Greetings
  if (qLower === "hi" || qLower === "hello" || qLower === "hey" || qLower.startsWith("good morning") || qLower.startsWith("good evening")) {
    return `Hello! **RockGPT** is ready to assist you.

### Recommended Workflows
1. **Software Engineering**: Code implementation, architectural review, debugging, or API design.
2. **Deep Research**: Comprehensive multi-angle investigations on complex technical or market topics.
3. **Execution Planning**: High-momentum time-blocking, goal structuring, and project tracking.
4. **Technical Concept Mastery**: Plain-English breakdowns of physics, computer science, and distributed systems.

Feel free to ask a direct question or prompt me with a task to begin.`;
  }

  // 3. Productivity & Day Planning
  if (has("plan my day", "daily plan", "schedule my day", "time management", "routine", "schedule")) {
    return `### High-Performance Daily Architecture
A productive day is structured around cognitive energy cycles rather than reactive multitasking.

### 1. The 4-Block Execution Framework
| Phase | Duration | Objective | Recommended Activities |
| :--- | :--- | :--- | :--- |
| **Deep Work Sprint** | 90–120 mins | Highest leverage goal | Core coding, writing, system architecture |
| **Strategic Recovery** | 30 mins | Mental reset | Hydration, natural light walk, screen detachment |
| **Execution Block** | 60–90 mins | Secondary milestones | Code reviews, PR merges, communication |
| **Day Closeout** | 15 mins | Momentum lock-in | Logging wins, defining tomorrow's top 3 targets |

### 2. Operational Guardrails
• **Zero Inbound Distractions Before Noon**: Do not open email or chat notifications until your deep work block is locked in.
• **Single-Tasking Rule**: Multitasking incurs a 20–40% context-switching tax on cognitive speed.
• **Protect the Shutdown Ritual**: End work cleanly at a set hour to allow focus and neurochemicals to regenerate for tomorrow.

> **Pro Tip:** "Decide the single accomplishment that would make today a victory before touching any input device."`;
  }

  // 4. Study & Learning Techniques
  if (has("study tip", "how to study", "learn faster", "active recall", "feynman", "memory", "memorize")) {
    return `### The Feynman Active Recall Protocol
Passive reading and highlighting have among the lowest retention rates (<10%). The fastest pathway to mastery is active retrieval and cognitive compression.

### The 4-Step Mastery Cycle
1. **Targeted Immersion (25 mins)**:
   Study a single concept with undivided focus. Take minimal, high-level notes.
2. **The 12-Year-Old Explanation**:
   Close all materials. Open a blank page and explain the concept in plain English as if teaching a sixth-grader. Avoid jargon.
3. **Pinpoint the Hesitation Gaps**:
   Review where you struggled to explain simply. Those exact friction points represent your knowledge boundary—re-study only those specific items.
4. **Analogy Synthesis & Refinement**:
   Construct a physical or real-world metaphor for the concept to anchor it in long-term memory.

### Scientific Retention Comparison
| Method | 24-Hour Retention | Cognitive Load |
| :--- | :--- | :--- |
| **Re-reading notes** | ~15–20% | Very low (creates false confidence) |
| **Flashcard Testing** | ~50–60% | Medium |
| **Feynman Explanation & Teaching** | **85–90%** | High (triggers neuroplasticity) |

> **Key Takeaway:** If you cannot explain a concept simply, you do not understand it deeply yet.`;
  }

  // 5. Quantum Computing
  if (has("quantum computing", "quantum computer", "qubit", "superposition", "entanglement")) {
    return `### Fundamentals of Quantum Computing
Quantum computing is a computational paradigm that leverages the principles of quantum mechanics—specifically **superposition**, **entanglement**, and **quantum interference**—to solve specific classes of problems exponentially faster than classical Turing machines.

### 1. Quantum vs. Classical Paradigms
| Feature | Classical Computing | Quantum Computing |
| :--- | :--- | :--- |
| **Fundamental Unit** | Bit (0 or 1) | **Qubit** (linear combination $\\alpha|0\\rangle + \\beta|1\\rangle$) |
| **State Space** | $N$ bits hold 1 of $2^N$ states | $N$ qubits exist simultaneously in $2^N$ amplitudes |
| **Core Operations** | Boolean Logic (AND, OR, NOT) | Unitary Transformations & Quantum Gates (Hadamard, CNOT) |
| **Primary Advantage** | Deterministic general processing | Exponential parallelism for optimization and simulation |

### 2. The Three Foundational Quantum Principles
1. **Superposition**:
   A qubit is not limited to a discrete binary state. Prior to measurement, it exists in a coherent superposition of probabilities:
   \`|\\psi\\rangle = \\alpha|0\\rangle + \\beta|1\\rangle\` where \`|\\alpha|^2 + |\\beta|^2 = 1\`.
2. **Entanglement**:
   Two or more qubits can be prepared in an entangled Bell state such that the quantum state of one cannot be described independently of the others, regardless of distance.
3. **Quantum Interference**:
   Quantum algorithms (like Grover's or Shor's) manipulate probability amplitudes so that incorrect paths cancel out destructively and correct answers amplify constructively.

### 3. Practical Breakthrough Applications
• **Molecular & Materials Simulation**: Modeling complex protein folding and battery chemistry that are intractable classically.
• **Cryptography**: Shor's algorithm can factor large integers in polynomial time ($O((\\log N)^3)$), breaking classical RSA/ECC cryptography.
• **Logistics Optimization**: Solving large-scale combinatorial optimization problems via quantum annealing.

> **Key Takeaway:** Quantum computers will not replace classical PCs for daily browsing or gaming; rather, they serve as specialized accelerators for complex physical simulations, optimization, and number theory.`;
  }

  // 6. Web Development / React / Next.js
  if (has("react", "next.js", "nextjs", "web development", "frontend", "full stack", "javascript", "typescript")) {
    return `### Modern Web Architecture: High-Performance Standards
In modern web development, speed, composability, and clean state boundaries define production-grade applications.

### 1. Core Architectural Pillars
• **Server Components First (RSC)**: Fetch data close to the source on the server to minimize client bundle sizes and eliminate waterfall network latency.
• **Isolate Client Interactivity**: Confine \`"use client"\` boundaries strictly to interactive islands (e.g., input composers, modal triggers, animations).
• **Streaming with Suspense**: Stream slow data chunks progressively to the client so users see instant first paint rather than waiting on monolithic APIs.

### 2. Clean Modern TypeScript Pattern (Resilient Fetch Flow)
\`\`\`typescript
interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

export async function fetchWithTimeout<T>(
  endpoint: string,
  timeoutMs = 5000
): Promise<ApiResponse<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(endpoint, { signal: controller.signal });
    if (!res.ok) throw new Error(\`Server returned HTTP \${res.status}\`);
    const data = (await res.json()) as T;
    return { data, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown request error";
    return { data: null, error: message };
  } finally {
    clearTimeout(timer);
  }
}
\`\`\`

### 3. Key Best Practices
1. **Avoid Layout Shifts (CLS = 0)**: Always define explicit dimensions or aspect ratios for dynamic images and layout shells.
2. **Type Safety Across Boundaries**: Validate client/server boundary payloads using validation schemas (like Zod).
3. **CSS Performance**: Prioritize hardware-accelerated CSS properties (\`transform\` and \`opacity\`) to ensure silky 60fps animations.

> **Key Takeaway:** A blazing fast user experience comes from doing less work on the client, caching aggressively, and rendering progressively.`;
  }

  // 7. Databases & Backend (PostgreSQL, SQL, APIs, Docker)
  if (has("database", "postgres", "sql", "backend", "api", "rest", "graphql", "neon", "docker")) {
    return `### Production Database & Backend Architecture
Scalable backends are built on predictable latency, resilient connection pooling, and strict relational integrity.

### 1. Relational Database Principles
• **Schema Normalization**: Maintain 3NF for transactional operational databases to eliminate redundancy and update anomalies.
• **Targeted Indexing**: Index high-frequency \`WHERE\`, \`JOIN\`, and \`ORDER BY\` columns using B-Tree indexes. Avoid over-indexing, which slows down \`INSERT\` and \`UPDATE\` throughput.
• **Serverless Connection Pooling**: For cloud Postgres (e.g., Neon / Supabase), always connect through a connection pooler (PgBouncer) to prevent connection exhaustion.

### 2. Example: Clean Transactional Pattern
\`\`\`sql
-- Atomic Transfer Transaction Example
BEGIN;

UPDATE accounts 
SET balance = balance - 150.00 
WHERE id = 'user_source' AND balance >= 150.00;

UPDATE accounts 
SET balance = balance + 150.00 
WHERE id = 'user_destination';

INSERT INTO transaction_logs (source_id, dest_id, amount, created_at)
VALUES ('user_source', 'user_destination', 150.00, NOW());

COMMIT;
\`\`\`

### 3. API Reliability Checklist
| Area | Strategy | Production Benefit |
| :--- | :--- | :--- |
| **Rate Limiting** | Sliding window algorithm (Redis) | Protects upstream databases from traffic spikes |
| **Idempotency** | Pass \`Idempotency-Key\` header | Prevents duplicate payments or resource creations |
| **Error Handling** | RFC 7807 Problem Details JSON | Provides standardized, machine-readable errors |

> **Key Takeaway:** Architecture is about trade-offs: design your schema for your predominant read/write ratio and always enforce constraints at the database level.`;
  }

  // 8. Python & Machine Learning / AI
  if (has("python", "ai", "machine learning", "neural network", "llm", "transformer", "deep learning")) {
    return `### Foundations of Modern AI & Neural Architectures
Modern Generative AI is anchored on the **Transformer architecture** and deep self-attention mechanisms.

### 1. The Core Transformer Equation
The breakthrough that enabled modern LLMs is the Scaled Dot-Product Attention:
$$\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V$$

• **Query ($Q$)**: What the current token is looking for.
• **Key ($K$)**: What other tokens offer in representation.
• **Value ($V$)**: The substantive content passed forward.
• **Scaling Factor ($\\sqrt{d_k}$)**: Prevents dot products from exploding into regions with tiny gradients.

### 2. Modern Machine Learning Pipeline
1. **Data Ingestion & Tokenization**: Converting raw text into discrete sub-word token IDs (e.g., BPE, WordPiece).
2. **Pre-training**: Self-supervised learning on massive internet-scale corpora predicting the next token.
3. **Post-Training & Alignment**: Supervised Fine-Tuning (SFT) and Reinforcement Learning from Human/AI Feedback (RLHF/RLAIF) to ensure instruction-following and safety.

### 3. Python Clean Async Inference Pattern
\`\`\`python
import asyncio
from typing import AsyncGenerator

async def simulate_ai_stream(prompt: str) -> AsyncGenerator[str, None]:
    """Generates streaming tokens with zero blocking latency."""
    tokens = [f"Analyzing: {prompt}", "Synthesizing parameters...", "Yielding structured outcome."]
    for token in tokens:
        await asyncio.sleep(0.04)
        yield token + " "

async def main():
    async for chunk in simulate_ai_stream("Quantum entanglement"):
        print(chunk, end="", flush=True)

if __name__ == "__main__":
    asyncio.run(main())
\`\`\`

> **Key Takeaway:** An LLM does not "think" in human concepts; it models a high-dimensional probability distribution over sequences of tokens.`;
  }

  // 9. Career / Resume / Technical Interviews
  if (has("resume", "interview", "job", "career", "salary", "promotion")) {
    return `### Technical Career & Interview Strategy
Hiring managers and technical leads evaluate candidates on three vectors: **problem-solving velocity**, **architectural clarity**, and **ownership**.

### 1. The XYZ Resume Formula (Google Framework)
Transform generic bullet points into high-impact accomplishments:
> *"Accomplished [X], as measured by [Y], by doing [Z]."*

• **Before**: "Helped speed up database queries."
• **After**: *"Reduced API p95 latency from 450ms to 85ms (81% reduction) by refactoring PostgreSQL indexes and introducing Redis query caching."*

### 2. High-Impact Technical Interview Blueprint
1. **Clarify Constraints First (0–5 mins)**:
   Ask about input data size, memory constraints, expected throughput, and latency thresholds before writing code.
2. **Outline the Naive Solution (5–10 mins)**:
   State the brute-force approach, state its time/space complexity ($O(N^2)$), and explain why it is insufficient.
3. **Architect the Optimal Approach (10–25 mins)**:
   Communicate your invariant logic aloud while coding. Handle edge cases cleanly (nulls, empty inputs, boundaries).
4. **Test & Verification (25–35 mins)**:
   Dry-run your solution with an explicit test trace table before announcing you are finished.

> **Key Takeaway:** Companies hire engineers who reduce business risk, write maintainable systems, and communicate with absolute clarity.`;
  }

  // 10. How-To / Implementation Queries
  if (qLower.startsWith("how to") || qLower.startsWith("how do i") || qLower.startsWith("how can i") || has("guide", "tutorial", "steps")) {
    return `### Actionable Implementation Blueprint: ${cleanQ}

### 1. Executive Summary
Executing **"${cleanQ}"** successfully requires a disciplined, phase-based workflow that minimizes trial-and-error and guarantees verification at every step.

### 2. Step-by-Step Execution Plan
1. **Phase 1: Environment & Requirements Setup**
   • Audit baseline prerequisites, dependencies, and access privileges.
   • Lock configuration parameters and define clear success criteria.
2. **Phase 2: Core Implementation Sprint**
   • Construct the minimal viable solution first.
   • Avoid premature complexity; maintain isolated, decoupled components.
3. **Phase 3: Automated Validation & Edge Cases**
   • Run synthetic tests against boundary cases and failure conditions.
   • Benchmark performance under peak throughput.
4. **Phase 4: Deployment & Observability**
   • Roll out incrementally (e.g. canary or staged release).
   • Configure health monitoring, error alerts, and rollback triggers.

### 3. Strategic Execution Matrix
| Stage | Primary Metric | Risk Mitigation |
| :--- | :--- | :--- |
| **Setup** | Dependency compatibility | Pin exact versions in lockfiles |
| **Execution** | Code modularity | Strict boundary separation |
| **Release** | Zero downtime | Automated rollback pipeline |

> **Pro Tip:** "The difference between an amateur and an expert implementation is the depth of error handling and observability."

Would you like me to generate specific configuration files, code snippets, or a tailored checklist for your exact setup?`;
  }

  // 11. Comparison / VS Queries
  if (has(" vs ", " versus ", "difference between", "compare")) {
    return `### Comparative Architectural Analysis: ${cleanQ}

### 1. Executive Verdict
When choosing between these paradigms, the optimal decision depends on your **team velocity**, **scalability thresholds**, and **operational complexity tolerance**.

### 2. Comprehensive Comparison Matrix
| Dimension | Option A | Option B | Strategic Assessment |
| :--- | :--- | :--- | :--- |
| **Learning Curve** | Gentle, high initial velocity | Steeper, higher long-term control | Weigh onboarding cost vs. flexibility |
| **Runtime Performance** | Optimized for standard loads | High-throughput, low-overhead | Profile real-world data payloads |
| **Ecosystem & Tooling** | Massive community, abundant packages | Specialized, focused tooling | Check third-party support |
| **Maintenance Burden** | Low initial, potential technical debt | Explicit design, highly scalable | Plan for 12–24 month evolution |

### 3. Decision Framework
• **Choose Option A when**: Time to market is the primary constraint and your system requirements fit standard patterns.
• **Choose Option B when**: You require strict memory/latency budgets, explicit type safety, or highly custom runtime semantics.

> **Key Takeaway:** There are no solutions in software architecture—only trade-offs. Pick the trade-offs your team is best equipped to manage.`;
  }

  // 12. General / Comprehensive Universal Response Generator
  const topicTitle = cleanQ.length > 55 ? cleanQ.slice(0, 52) + "..." : cleanQ;

  return `### Structured Analysis: ${topicTitle}

### 1. Executive Summary & Core Principles
Addressing **"${cleanQ}"** requires breaking the problem into foundational laws, technical mechanics, and practical trade-offs.

### 2. Architectural Pillars
• **Core Mechanism**: The primary dynamic driving this system or problem.
• **System Boundaries**: Environmental constraints, dependencies, and operational limits.
• **Primary Failure Modes**: The top reasons implementations or reasoning stumble in production.
• **High-Impact Solution**: The shortest, most resilient path to high-confidence resolution.

### 3. Systematic Breakdown
1. **Deconstruct the Invariants**: Separate facts that cannot change from configurable assumptions.
2. **Formulate the Minimal Implementation**: Execute with minimal moving parts to eliminate extraneous variables.
3. **Verify Under Stress**: Validate assumptions with real-world inputs and edge constraints.
4. **Refine & Consolidate**: Document outcomes, harden against regressions, and optimize.

### 4. Implementation Framework
| Vector | Traditional Approach | High-Velocity Agent Approach |
| :--- | :--- | :--- |
| **Analysis** | Reactive / Guesswork | Data-driven / Invariant modeling |
| **Execution** | Monolithic / Rigid | Modular / Rapid iteration loops |
| **Outcome** | Fragile under change | Resilient and self-documenting |

> **Strategic Takeaway:** True clarity comes from eliminating unnecessary complexity. When the core invariant is protected, the rest of the system becomes manageable.

What specific dimension of this would you like to explore or implement next?`;
}
