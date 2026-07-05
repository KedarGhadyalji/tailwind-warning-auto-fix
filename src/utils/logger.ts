import * as vscode from "vscode";

/**
 * Centralized logger backed by a VS Code OutputChannel.
 *
 * Using an OutputChannel (instead of console.log) means log output is
 * visible to end users via "View > Output > Tailwind Warning Auto-Fix"
 * without cluttering the Developer Tools console, and gives us a single
 * place to route future telemetry hooks (see roadmap) if ever added.
 *
 * This is a simple singleton-per-extension-instance, created once in
 * extension.ts and passed down — not a global import-anywhere singleton —
 * to keep dependencies explicit (see Step 1: manual DI reasoning).
 */
export class Logger {
  private readonly channel: vscode.OutputChannel;

  constructor(channelName: string) {
    this.channel = vscode.window.createOutputChannel(channelName);
  }

  public info(message: string): void {
    this.write("INFO", message);
  }

  public warn(message: string): void {
    this.write("WARN", message);
  }

  public error(message: string, error?: unknown): void {
    this.write("ERROR", message);
    if (error instanceof Error) {
      this.channel.appendLine(error.stack ?? error.message);
    } else if (error !== undefined) {
      this.channel.appendLine(String(error));
    }
  }

  public dispose(): void {
    this.channel.dispose();
  }

  private write(level: string, message: string): void {
    const timestamp = new Date().toISOString();
    this.channel.appendLine(`[${timestamp}] [${level}] ${message}`);
  }
}
