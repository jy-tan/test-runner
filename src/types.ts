// export interface BaseCommand {
//   id: string;
//   type: string;
// }

// export interface RunScriptData {
//   filePath: string;
//   fileContents: string;
//   script: string;
//   originalFilePath?: string;
//   appDir?: string;
// }

// export interface RunScriptCommand extends BaseCommand {
//   id: string;
//   type: "run-script";
//   data: RunScriptData;
// }

// export interface TerminateCommand extends BaseCommand {
//   id: string;
//   type: "terminate";
// }

// export type Command = RunScriptCommand | TerminateCommand;

// export interface PollCommandsResponse {
//   commands: Command[];
// }

// export type CommandResult = {
//   exitCode: number;
//   error?: string;
//   stdout: string;
//   stderr: string;
// };

export interface BaseCommand {
  id: string;
  createdAt: Date;
}

export interface FileData {
  filePath: string;
  fileContents: string;
  originalFilePath?: string;
  appDir?: string;
}

export enum FileAction {
  LINT = "lint",
  TEST = "test",
  COVERAGE = "coverage",
}

export enum RunnerAction {
  TERMINATE = "terminate",
}

export interface FileCommand extends BaseCommand {
  type: "file";
  actions: FileAction[];
  data: FileData;
}

export interface RunnerCommand extends BaseCommand {
  type: "runner";
  actions: RunnerAction[];
}

export type Command = FileCommand | RunnerCommand;

export interface FileCommandResult {
  commandId: string;
  type: "file";
  exitCode: number;
  error?: string;
  stdout: string;
  stderr: string;
  completedAt: Date;
}

export interface RunnerCommandResult {
  commandId: string;
  type: "runner";
  completedAt: Date;
}

export type CommandResult = FileCommandResult | RunnerCommandResult;

export interface Scripts {
  test: string;
  lint: string;
  coverage: string;
}
