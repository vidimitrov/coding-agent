# Building a Coding Agent in Under 250 Lines

A hands-on tutorial to build a fully functional AI coding agent from scratch. By the end, you'll have an agent that can read files, write code, run commands—and even improve itself.

**Time:** 30-60 minutes

**Prerequisites:** Node.js/Bun installed, Anthropic API key

**Final result:** ~240 lines of TypeScript

---

## What We're Building

An agentic loop that:
1. Takes user input
2. Calls Claude with tool definitions
3. Executes tools when Claude requests them
4. Feeds results back to Claude
5. Repeats until the task is complete

This is the core pattern behind tools like Claude Code, Cursor, and other AI coding assistants.

---

## Setup

Create a new directory and initialize:

```bash
mkdir coding-agent && cd coding-agent
bun init -y
bun add @anthropic-ai/sdk
```

Set your API key:

```bash
export ANTHROPIC_API_KEY="your-key-here"
```

Create the file we'll be working in:

```bash
touch agent.ts
```

---

## Step 1: Hello Claude (~25 lines)

**Goal:** Make a simple API call and print the response.

```typescript
#!/usr/bin/env bun
/**
 * agent.ts - A stripped-down agentic loop in a single file
 * Run: bun agent.ts
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

async function main() {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [{ role: "user", content: "What is 2 + 2?" }],
  });

  // Response content is an array of blocks
  for (const block of response.content) {
    if (block.type === "text") {
      console.log(block.text);
    }
  }
}

main().catch(console.error);
```

### Run It

```bash
bun agent.ts
```

You should see Claude's response. Congratulations—you've made your first API call!

---

## Step 2: Add a Tool Definition (~60 lines)

**Goal:** Tell Claude about a tool it can use. Claude will request to use it, but we won't execute it yet.

```typescript
#!/usr/bin/env bun
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const cwd = process.cwd();

// Define a tool for Claude to use
const tools: Anthropic.Tool[] = [
  {
    name: "list_dir",
    description: "List directory contents",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Directory path" },
      },
      required: ["path"],
    },
  },
];

async function main() {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: `You are a coding assistant. Working directory: ${cwd}`,
    tools,  // Pass tools to Claude
    messages: [{ role: "user", content: "List files in the current directory" }],
  });

  // Now we need to handle both text AND tool_use blocks
  for (const block of response.content) {
    if (block.type === "text") {
      console.log(block.text);
    } else if (block.type === "tool_use") {
      console.log(`\n[Tool Request] ${block.name}`);
      console.log(`Arguments: ${JSON.stringify(block.input)}`);
      console.log(`(Tool execution not implemented yet)`);
    }
  }
}

main().catch(console.error);
```

### Run It

```bash
bun agent.ts
```

You'll see Claude request to use the `list_dir` tool. It knows *what* to do, but we haven't taught our agent *how* to do it yet.

---

## Step 3: Execute Tools & The Agentic Loop (~120 lines)

**Goal:** Actually execute tools and feed results back to Claude. This is the core "agentic loop."

```typescript
#!/usr/bin/env bun
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";

const client = new Anthropic();
const cwd = process.cwd();

// Tool definitions
const tools: Anthropic.Tool[] = [
  {
    name: "list_dir",
    description: "List directory contents",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Directory path" },
      },
      required: ["path"],
    },
  },
];

// Tool execution
async function executeTool(name: string, input: any): Promise<string> {
  const resolvePath = (p: string) => (path.isAbsolute(p) ? p : path.join(cwd, p));

  switch (name) {
    case "list_dir": {
      try {
        const entries = fs.readdirSync(resolvePath(input.path), { withFileTypes: true });
        return entries
          .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
          .join("\n");
      } catch (e: any) {
        return `Error: ${e.message}`;
      }
    }
    default:
      return `Unknown tool: ${name}`;
  }
}

// The agentic loop
async function runAgent(userMessage: string) {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userMessage }];
  const systemPrompt = `You are a coding assistant. Working directory: ${cwd}
Use tools to help the user. Be concise.`;

  // Keep looping until Claude stops calling tools
  while (true) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      messages,
    });

    let hasToolUse = false;
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        console.log("\n" + block.text);
      } else if (block.type === "tool_use") {
        hasToolUse = true;
        console.log(`\n[tool] ${block.name}(${JSON.stringify(block.input)})`);

        // Execute the tool
        const result = await executeTool(block.name, block.input);
        console.log(`[result] ${result.slice(0, 200)}${result.length > 200 ? "..." : ""}`);

        // Collect results to send back
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result
        });
      }
    }

    // Add assistant's response to history
    messages.push({ role: "assistant", content: response.content });

    // If there were tool calls, add results and continue the loop
    if (hasToolUse) {
      messages.push({ role: "user", content: toolResults });
    } else {
      // No tool calls = Claude is done
      break;
    }
  }
}

// Run it
runAgent("List files in the current directory").catch(console.error);
```

### Run It

```bash
bun agent.ts
```

Now Claude calls `list_dir`, gets real results, and responds with actual file names!

### Key Insight: The Loop

```
User Input → Claude → Tool Request → Execute → Results → Claude → ... → Final Response
                ↑                                           |
                └───────────────────────────────────────────┘
```

This loop is the heart of every AI agent. Claude keeps calling tools until it has enough information to answer.

---

## Step 4: More Tools + Interactive REPL (~180 lines)

**Goal:** Add more useful tools and make it interactive.

```typescript
#!/usr/bin/env bun
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { spawn } from "child_process";

const client = new Anthropic();
const cwd = process.cwd();

// Full tool definitions
const tools: Anthropic.Tool[] = [
  {
    name: "read_file",
    description: "Read contents of a file",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "File path to read" },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Write content to a file",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "File path to write" },
        content: { type: "string", description: "Content to write" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "list_dir",
    description: "List directory contents",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Directory path" },
      },
      required: ["path"],
    },
  },
  {
    name: "bash",
    description: "Run a shell command",
    input_schema: {
      type: "object" as const,
      properties: {
        command: { type: "string", description: "Command to run" },
      },
      required: ["command"],
    },
  },
];

// Tool execution
async function executeTool(name: string, input: any): Promise<string> {
  const resolvePath = (p: string) => (path.isAbsolute(p) ? p : path.join(cwd, p));

  switch (name) {
    case "read_file": {
      try {
        return fs.readFileSync(resolvePath(input.path), "utf-8");
      } catch (e: any) {
        return `Error: ${e.message}`;
      }
    }
    case "write_file": {
      try {
        fs.writeFileSync(resolvePath(input.path), input.content);
        return `Written to ${input.path}`;
      } catch (e: any) {
        return `Error: ${e.message}`;
      }
    }
    case "list_dir": {
      try {
        const entries = fs.readdirSync(resolvePath(input.path), { withFileTypes: true });
        return entries
          .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
          .join("\n");
      } catch (e: any) {
        return `Error: ${e.message}`;
      }
    }
    case "bash": {
      return new Promise((resolve) => {
        const proc = spawn("bash", ["-c", input.command], { cwd });
        let stdout = "", stderr = "";
        proc.stdout.on("data", (d) => (stdout += d));
        proc.stderr.on("data", (d) => (stderr += d));
        proc.on("close", (code) => {
          resolve(`Exit code: ${code}\n${stdout}${stderr ? `\nStderr: ${stderr}` : ""}`);
        });
        proc.on("error", (e) => resolve(`Error: ${e.message}`));
      });
    }
    default:
      return `Unknown tool: ${name}`;
  }
}

// The agentic loop
async function runAgent(userMessage: string) {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userMessage }];
  const systemPrompt = `You are a coding assistant. Working directory: ${cwd}
Use tools to help the user. Be concise.`;

  while (true) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      messages,
    });

    let hasToolUse = false;
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        console.log("\n" + block.text);
      } else if (block.type === "tool_use") {
        hasToolUse = true;
        console.log(`\n[tool] ${block.name}(${JSON.stringify(block.input)})`);
        const result = await executeTool(block.name, block.input);
        console.log(`[result] ${result.slice(0, 200)}${result.length > 200 ? "..." : ""}`);
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
      }
    }

    messages.push({ role: "assistant", content: response.content });

    if (hasToolUse) {
      messages.push({ role: "user", content: toolResults });
    } else {
      break;
    }
  }
}

// Interactive REPL
async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("Coding Agent (type 'exit' to quit)");
  console.log(`Working directory: ${cwd}\n`);

  const prompt = () => {
    rl.question("> ", async (input) => {
      if (input.toLowerCase() === "exit") {
        rl.close();
        return;
      }
      if (input.trim()) {
        await runAgent(input);
      }
      prompt();
    });
  };

  prompt();
}

main().catch(console.error);
```

### Run It

```bash
bun agent.ts
```

Now try:
- `> List files in src/`
- `> Create a file called hello.txt with "Hello World" and read it back`
- `> What's in package.json?`
- `> Run npm --version`

You have a working AI coding assistant!

---

## Step 5: Polish with Colors (~240 lines)

**Goal:** Make the output beautiful with ANSI colors—zero dependencies.

Add colors at the top of the file, right after the imports:

```typescript
// Simple ANSI colors - no dependencies
const c = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  gray: "\x1b[90m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
  bold: "\x1b[1m",
};
```

Update the output in the agentic loop:

```typescript
for (const block of response.content) {
  if (block.type === "text") {
    console.log(`\n${c.green}▌${c.reset} ${block.text}`);
  } else if (block.type === "tool_use") {
    hasToolUse = true;
    const args = JSON.stringify(block.input);
    console.log(`\n${c.dim}┌─ ${c.cyan}${block.name}${c.reset}${c.dim} ─────────────────────────${c.reset}`);
    console.log(`${c.dim}│${c.reset} ${c.gray}${args.length > 80 ? args.slice(0, 80) + "..." : args}${c.reset}`);
    const result = await executeTool(block.name, block.input);
    const preview = result.slice(0, 150).replace(/\n/g, " ");
    console.log(`${c.dim}│${c.reset} ${c.yellow}→${c.reset} ${preview}${result.length > 150 ? "..." : ""}`);
    console.log(`${c.dim}└────────────────────────────────────${c.reset}`);
    toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
  }
}
```

Update the REPL prompt:

```typescript
console.log(`${c.cyan}Coding Agent${c.reset} ${c.dim}(type 'exit' to quit)${c.reset}`);
console.log(`${c.dim}Working directory: ${cwd}${c.reset}\n`);

const prompt = () => {
  rl.question(`${c.yellow}› ${c.reset}`, async (input) => {
    if (input.toLowerCase() === "exit") {
        rl.close();
        return;
      }
      if (input.trim()) {
        await runAgent(input);
      }
      prompt();
  });
};
```

### Run It

```bash
bun agent.ts
```

Now you have:
- Green `▌` bar for agent responses
- Cyan tool names in dim boxes
- Yellow `→` arrows for results
- Professional-looking output!

---

## The Grand Finale: Self-Improvement

Here's where it gets mind-bending. Your agent can now modify its own code.

### Example 1: Add a Banner

```
› Read agent.ts and add a cool ASCII art banner that displays on startup
```

The agent will:
1. Read its own source code
2. Generate ASCII art
3. Add a `showBanner()` function
4. Modify `main()` to call it

---

## More Self-Improvement Ideas

Once you have the basic agent working, try these prompts to make it improve itself:

### Add New Tools

```
› Add a new tool called "grep_search" that searches for a pattern in files
```

```
› Add a "str_replace" tool that can find and replace text in files
```

### Improve Robustness

```
› Add a confirmation prompt before running bash commands
```

```
› Add timeout handling to the bash tool (kill after 30 seconds)
```

### Add Features

```
› Add support for one-shot mode: bun agent.ts "your prompt here"
```

```
› Add a --help flag that shows usage information
```

```
› Add token counting and display how many tokens each request uses
```

### Make It Smarter

```
› Update the system prompt to make the agent better at coding tasks
```

```
› Add a tool that lets the agent search the web for documentation
```

### Improve UX

```
› Add a spinner animation while waiting for Claude's response
```

```
› Add syntax highlighting when displaying code in results
```

```
› Show a progress indicator when reading large files
```

---

## What You've Built

In ~240 lines, you have:

| Component | Implementation |
|-----------|---------------|
| **Model Layer** | Anthropic SDK direct calls |
| **Tool System** | 4 tools: read, write, list, bash |
| **Agentic Loop** | While loop with tool detection |
| **UI** | Colored REPL with formatted output |
| **Self-Modifying** | Can read and edit its own code |

This is the same fundamental architecture as professional AI coding tools—just without the thousands of lines of edge case handling, sandboxing, and UI polish.

---

## Next Steps

1. **Add more tools** - grep, git operations, HTTP requests
2. **Add streaming** - Show responses as they arrive
3. **Add persistence** - Save conversation history
4. **Add safety** - Confirmation prompts, sandboxing
5. **Build a UI** - Try [Ink](https://github.com/vadimdemedes/ink) for a React-based terminal UI

The rabbit hole goes deep. Enjoy exploring!

---

## Full Final Code

See the [examples](./examples) in this repository for different complete working examples
