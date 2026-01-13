import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";

const cwd = process.cwd();

// Full tool definitions
export const tools: Anthropic.Tool[] = [
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
    description: "Write content to a file. Both path and content parameters must be provided.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "File path to write" },
        content: { type: "string", description: "The full content to write to the file. This parameter is required and must not be empty." },
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
export async function executeTool(name: string, input: any): Promise<string> {
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
        if (input.content === undefined || input.content === null) {
          return `Error: content parameter is required but was not provided`;
        }
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