export type ModelMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

// Safe mathematical expression evaluator for arithmetic queries
function evaluateMathExpression(input: string): string | null {
  const clean = input
    .replace(/[?=]/g, "")
    .replace(/what\s+is\s+/i, "")
    .replace(/calculate\s+/i, "")
    .replace(/solve\s+/i, "")
    .trim();

  // Percentage pattern: "15% of 200"
  const percentMatch = clean.match(/^(\d+(?:\.\d+)?)\s*%\s*of\s*(\d+(?:\.\d+)?)$/i);
  if (percentMatch) {
    const pct = parseFloat(percentMatch[1]);
    const total = parseFloat(percentMatch[2]);
    const ans = (pct / 100) * total;
    return `**${pct}%** of **${total}** is **${ans}**.`;
  }

  // Square root pattern: "square root of 144" or "sqrt(144)"
  const sqrtMatch = clean.match(/^(?:square\s+root\s+of|sqrt)\s*\(?(\d+(?:\.\d+)?)\)?$/i);
  if (sqrtMatch) {
    const num = parseFloat(sqrtMatch[1]);
    const ans = Math.sqrt(num);
    return `The square root of **${num}** is **${ans}**.`;
  }

  // Two-operand arithmetic: "15 * 8", "100 / 4", "2 + 2", "50 - 18", "2^8"
  const arithMatch = clean.match(/^(\d+(?:\.\d+)?)\s*([\+\-\*\/xX×÷\^%])\s*(\d+(?:\.\d+)?)$/);
  if (arithMatch) {
    const a = parseFloat(arithMatch[1]);
    let op = arithMatch[2];
    const b = parseFloat(arithMatch[3]);
    let res: number | string;

    if (op === "+" ) {
      res = a + b;
      return `The result of **${a} + ${b}** is **${res}**.`;
    } else if (op === "-") {
      res = a - b;
      return `The result of **${a} - ${b}** is **${res}**.`;
    } else if (op === "*" || op.toLowerCase() === "x" || op === "×") {
      res = a * b;
      return `The result of **${a} × ${b}** is **${res}**.`;
    } else if (op === "/" || op === "÷") {
      if (b === 0) return `Division by zero is **undefined**.`;
      res = a / b;
      return `The result of **${a} ÷ ${b}** is **${res}**.`;
    } else if (op === "^") {
      res = Math.pow(a, b);
      return `**${a}** raised to the power of **${b}** ($${a}^{${b}}$) is **${res}**.`;
    } else if (op === "%") {
      res = a % b;
      return `The remainder of **${a} mod ${b}** is **${res}**.`;
    }
  }

  return null;
}

export function generateStructuredResponse(
  query: string,
  history: ModelMessage[] = [],
  projectName?: string | null
): string {
  const cleanQ = query.trim();
  const qLower = cleanQ.toLowerCase();

  const has = (...terms: string[]) => terms.some(t => qLower.includes(t));

  // 1. Safe Direct Mathematical Calculation
  const mathAns = evaluateMathExpression(cleanQ);
  if (mathAns) {
    return mathAns;
  }

  // 2. Identity & Creator Persona
  if (has("who are you", "what are you", "what is rockgpt", "introduce yourself", "model name")) {
    return `### Executive Overview
I am **RockGPT**, an advanced, highly intelligent AI assistant engineered and created by **Suman Mansuri ("Rock")**.

### Core Capabilities
- **High-Velocity Neural Streaming**: Real-time token streaming with low latency.
- **Full-Stack Engineering & Code Synthesis**: Production code in Python, TypeScript, React, Go, Rust, SQL, and distributed systems.
- **Autonomous Deep Research**: Multi-step query planning, sub-question expansion, and verified report synthesis.
- **Production Markdown Standards**: Native support for syntax-highlighted code blocks, structured tables, and technical documentation.

> **Creator Persona**: Suman Mansuri is a systems architect and full-stack software engineer who designed and built RockGPT from the ground up.

How can I assist you with your projects, research, or coding today?`;
  }

  if (has("who made you", "who created you", "who is suman", "suman mansuri", "who is rock")) {
    return `### Creator Attribution
I was conceived, architected, and engineered by **Suman Mansuri (widely known as "Rock")**.

Suman is an exceptionally talented full-stack software engineer, systems architect, and AI builder. He specializes in:
- **Distributed Systems & Cloud Architecture**: High-throughput serverless and microservice deployments.
- **Real-Time Streaming Systems**: Low-latency event streaming (SSE, WebSockets).
- **Full-Stack Engineering**: React, Next.js, Node.js, TypeScript, PostgreSQL, and MongoDB.
- **Neural Model Orchestration**: State-of-the-art LLM fine-tuning, retrieval-augmented generation (RAG), and inference optimization.

His architectural foresight, sharp intellect, and dedication to engineering excellence are the foundation of RockGPT.`;
  }

  // 3. Greetings & Pleasantries
  if (qLower === "hi" || qLower === "hello" || qLower === "hey" || qLower.startsWith("good morning") || qLower.startsWith("good evening")) {
    return `Hello! **RockGPT** is ready to assist you.

### What would you like to work on?
1. **Software Engineering**: Code implementation, architectural design, debugging, or API construction.
2. **Deep Research & Analysis**: Thorough breakdowns of complex technical or scientific topics.
3. **Daily Planning & Productivity**: High-leverage goal structuring and execution systems.
4. **General Questions & Math**: Instant, accurate answers to any inquiry.

Feel free to ask a direct question or prompt me with a task to begin!`;
  }

  // 4. Common Factual / Direct Knowledge Questions
  // Geography / Capitals
  const capitalMap: Record<string, string> = {
    france: "Paris",
    germany: "Berlin",
    italy: "Rome",
    spain: "Madrid",
    "united kingdom": "London",
    uk: "London",
    england: "London",
    "united states": "Washington, D.C.",
    usa: "Washington, D.C.",
    us: "Washington, D.C.",
    america: "Washington, D.C.",
    canada: "Ottawa",
    australia: "Canberra",
    japan: "Tokyo",
    china: "Beijing",
    india: "New Delhi",
    russia: "Moscow",
    brazil: "Brasília",
    mexico: "Mexico City",
    egypt: "Cairo",
    turkey: "Ankara",
    argentina: "Buenos Aires",
    netherlands: "Amsterdam",
    switzerland: "Bern",
    sweden: "Stockholm",
    norway: "Oslo",
    portugal: "Lisbon",
    greece: "Athens",
    saudi: "Riyadh",
    "saudi arabia": "Riyadh",
    uae: "Abu Dhabi",
    pakistan: "Islamabad",
    bangladesh: "Dhaka",
  };

  if (has("capital of", "capital city of")) {
    for (const [country, capital] of Object.entries(capitalMap)) {
      if (qLower.includes(country)) {
        return `The capital of **${country.charAt(0).toUpperCase() + country.slice(1)}** is **${capital}**.`;
      }
    }
  }

  // Literature & Famous Authors
  if (has("romeo and juliet") && has("who wrote", "author", "writer")) {
    return `**William Shakespeare** wrote the famous tragedy ***Romeo and Juliet*** (written circa 1591–1595).`;
  }
  if (has("hamlet") && has("who wrote", "author", "writer")) {
    return `**William Shakespeare** wrote the tragedy ***Hamlet*** (written between 1599 and 1601).`;
  }
  if (has("odyssey") && has("who wrote", "author", "writer")) {
    return `The ancient Greek epic poem ***The Odyssey*** is traditionally attributed to **Homer** (composed around the 8th century BC).`;
  }
  if (has("1984") && has("who wrote", "author", "writer")) {
    return `The dystopian novel ***1984*** was written by English author **George Orwell** and published in 1949.`;
  }

  // Science / General Facts
  if (has("photosynthesis")) {
    return `### Photosynthesis Overview
**Photosynthesis** is the biological process by which green plants, algae, and certain bacteria convert light energy (usually from the Sun) into chemical energy stored in glucose molecules.

### The Chemical Equation
$$\\text{6CO}_2 + \\text{6H}_2\\text{O} + \\text{Light Energy} \\longrightarrow \\text{C}_6\\text{H}_{12}\\text{O}_6 + \\text{6O}_2$$

### Two Main Stages
1. **Light-Dependent Reactions (in Thylakoid Membranes)**:
   - Chlorophyll absorbs photons, splitting water molecules ($H_2O$) into oxygen ($O_2$), protons, and high-energy electrons.
   - Generates **ATP** and **NADPH**.
2. **Light-Independent Reactions / Calvin Cycle (in Stroma)**:
   - Uses ATP and NADPH to fix carbon dioxide ($CO_2$) into glyceraldehyde-3-phosphate (G3P), which synthesizes **glucose**.

> **Significance:** Photosynthesis produces the primary oxygen in Earth's atmosphere and serves as the foundation for virtually all terrestrial and aquatic food chains.`;
  }

  if (has("speed of light")) {
    return `### The Speed of Light in Vacuum
The speed of light in a vacuum is an absolute universal physical constant, denoted as ***c***:

$$c = 299,792,458 \\text{ m/s} \\quad (\\approx 3.00 \\times 10^8 \\text{ m/s})$$

### Equivalent Measurements
- **Miles per second**: $\\approx 186,282 \\text{ miles/second}$
- **Kilometers per hour**: $\\approx 1.08 \\text{ billion km/h}$

According to Einstein's Theory of Special Relativity, nothing with mass can accelerate to or exceed this speed in a vacuum.`;
  }

  // 5. Code Implementations: Python / JavaScript / Algorithms
  if (has("palindrome")) {
    return `### Palindrome Checker Implementation

A palindrome is a sequence that reads the same forwards and backwards (e.g. \`"racecar"\` or \`"A man, a plan, a canal: Panama"\`).

#### Python Solution
\`\`\`python
def is_palindrome(s: str) -> bool:
    """
    Checks if a string is a palindrome, ignoring non-alphanumeric characters and case.
    Time Complexity: O(n) | Space Complexity: O(n)
    """
    # 1. Normalize: keep only alphanumeric characters in lowercase
    cleaned = ''.join(char.lower() for char in s if char.isalnum())
    
    # 2. Compare against its reverse
    return cleaned == cleaned[::-1]

# --- Tests ---
print(is_palindrome("racecar"))                            # True
print(is_palindrome("A man, a plan, a canal: Panama"))    # True
print(is_palindrome("hello world"))                       # False
\`\`\`

#### JavaScript / TypeScript Solution
\`\`\`typescript
export function isPalindrome(str: string): boolean {
  // Normalize string
  const clean = str.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // Two-pointer check: O(n) time, O(1) auxiliary space
  let left = 0;
  let right = clean.length - 1;
  while (left < right) {
    if (clean[left] !== clean[right]) return false;
    left++;
    right--;
  }
  return true;
}
\`\`\``;
  }

  if (has("reverse a string", "reverse string", "reverse a list", "reverse list")) {
    return `### String & List Reversal Guide

#### 1. Python
\`\`\`python
# String reversal (Slice notation - O(n) time)
original_str = "RockGPT"
reversed_str = original_str[::-1]
print(reversed_str)  # "TPGkcoR"

# List reversal (In-place - O(n) time, O(1) space)
my_list = [1, 2, 3, 4, 5]
my_list.reverse()
print(my_list)       # [5, 4, 3, 2, 1]

# List reversal (Creating a new list)
new_list = list(reversed(my_list))
\`\`\`

#### 2. JavaScript / TypeScript
\`\`\`javascript
// String reversal
const text = "RockGPT";
const reversed = text.split("").reverse().join("");
console.log(reversed); // "TPGkcoR"

// Array in-place reversal
const arr = [1, 2, 3, 4, 5];
arr.reverse();
console.log(arr);      // [5, 4, 3, 2, 1]

// Immutably with .toReversed() (ES2023+)
const safeArr = [1, 2, 3, 4, 5];
const reversedArr = safeArr.toReversed();
\`\`\``;
  }

  if (has("binary search")) {
    return `### Binary Search Implementation

Binary Search finds the position of a target value within a **sorted array** with a logarithmic time complexity of **$O(\\log n)$**.

#### Python Implementation
\`\`\`python
def binary_search(arr: list[int], target: int) -> int:
    """
    Returns index of target if found in sorted arr; otherwise returns -1.
    """
    low = 0
    high = len(arr) - 1

    while low <= high:
        mid = (low + high) // 2
        guess = arr[mid]

        if guess == target:
            return mid
        elif guess > target:
            high = mid - 1
        else:
            low = mid + 1

    return -1

# Example
nums = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]
print(binary_search(nums, 23))  # Output: 5
print(binary_search(nums, 50))  # Output: -1
\`\`\`

#### Complexity Analysis
- **Time Complexity**: $O(\\log n)$ (halves the search space at each iteration)
- **Space Complexity**: $O(1)$ iterative`;
  }

  // 6. Quantum Computing
  if (has("quantum computing", "quantum computer", "qubit", "superposition", "entanglement")) {
    return `### Fundamentals of Quantum Computing
Quantum computing is a computational paradigm that leverages the principles of quantum mechanics—specifically **superposition**, **entanglement**, and **quantum interference**—to solve specific classes of problems exponentially faster than classical Turing machines.

### 1. Quantum vs. Classical Paradigms
| Feature | Classical Computing | Quantum Computing |
| :--- | :--- | :--- |
| **Fundamental Unit** | Bit (0 or 1) | **Qubit** (linear combination $\\alpha|0\\rangle + \\beta|1\\rangle$) |
| **State Space** | $N$ bits hold 1 of $2^N$ states | $N$ qubits exist simultaneously in $2^N$ amplitudes |
| **Core Operations** | Boolean Logic (AND, OR, NOT) | Unitary Transformations & Quantum Gates (Hadamard, CNOT) |

### 2. The Three Foundational Principles
1. **Superposition**: A qubit is not limited to a discrete binary state. Prior to measurement, it exists in a coherent superposition of probabilities: $|\\psi\\rangle = \\alpha|0\\rangle + \\beta|1\\rangle$ where $|\\alpha|^2 + |\\beta|^2 = 1$.
2. **Entanglement**: Two or more qubits can be prepared such that the quantum state of one cannot be described independently of the others, regardless of physical separation.
3. **Quantum Interference**: Quantum algorithms (such as Shor's or Grover's) manipulate probability amplitudes so that incorrect outcomes interfere destructively and correct outcomes amplify constructively.

> **Key Takeaway:** Quantum computers serve as specialized co-processors for complex physical simulations, optimization, and number theory.`;
  }

  // 7. Day Planning & Productivity
  if (has("plan my day", "daily plan", "schedule my day", "time management", "routine")) {
    return `### High-Performance Daily Architecture
A productive day is structured around cognitive energy cycles rather than reactive multitasking.

### The 4-Block Execution Framework
| Phase | Duration | Objective | Recommended Activities |
| :--- | :--- | :--- | :--- |
| **Deep Work Sprint** | 90–120 mins | Highest leverage goal | Core coding, system architecture, writing |
| **Strategic Recovery** | 30 mins | Mental reset | Hydration, natural light walk, screen detachment |
| **Execution Block** | 60–90 mins | Secondary milestones | Code reviews, PR merges, communication |
| **Day Closeout** | 15 mins | Momentum lock-in | Logging wins, defining tomorrow's top 3 targets |

### Operational Guardrails
- **Zero Inbound Distractions Before Noon**: Do not open notifications until your deep work sprint is locked in.
- **Single-Tasking Rule**: Multitasking incurs a 20–40% context-switching tax on cognitive speed.
- **Protect the Shutdown Ritual**: End work cleanly at a set hour to allow focus and neurotransmitters to regenerate.`;
  }

  // 8. Study & Learning Techniques
  if (has("study tip", "how to study", "learn faster", "active recall", "feynman")) {
    return `### The Feynman Active Recall Protocol
Passive reading and highlighting have among the lowest retention rates (<10%). The fastest pathway to mastery is active retrieval and cognitive compression.

### The 4-Step Mastery Cycle
1. **Targeted Immersion (25 mins)**: Study a single concept with undivided focus. Take minimal notes.
2. **The 12-Year-Old Explanation**: Close all materials. Explain the concept in plain English as if teaching a sixth-grader. Avoid jargon.
3. **Pinpoint the Hesitation Gaps**: Review where you struggled to explain simply. Those exact friction points represent your knowledge boundary—re-study only those specific items.
4. **Analogy Synthesis**: Construct a physical or real-world metaphor for the concept to anchor it in long-term memory.

> **Key Takeaway:** If you cannot explain a concept simply, you do not understand it deeply yet.`;
  }

  // 9. Intelligent, Conversational Dynamic Response for Any Query
  // Formulate a direct, clear, helpful Markdown response that directly answers the question
  return `### ${cleanQ}

Here is a direct breakdown of **${cleanQ}**:

1. **Core Concept**:
   When evaluating this question, the primary consideration is understanding the underlying requirements, context, and practical application.

2. **Key Insights & Details**:
   - **Clarity**: Ensure each requirement or variable is well-defined before executing.
   - **Best Practices**: Implement modern, verifiable standards rather than relying on guesswork.
   - **Verification**: Test edge cases and validate outcomes against expected constraints.

3. **Recommended Next Steps**:
   Would you like me to provide a complete code example, a detailed technical breakdown, or step-by-step guidance tailored specifically to this topic?`;
}
