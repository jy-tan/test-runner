import axios from "axios";
import * as core from "@actions/core";
import { FileAction, FileCommand, FileCommandResult, Scripts } from "./types.js";
import { exec } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import Handlebars from "handlebars";

export async function processCommand({
  command,
  runId,
  serverUrl,
  authToken,
  scripts,
}: {
  command: FileCommand;
  runId: string;
  serverUrl: string;
  authToken: string;
  scripts: Scripts;
}): Promise<void> {
  const { data, actions } = command;

  // Ack the command
  const ackResponse = await axios.post(
    `${serverUrl}/ack-command`,
    {
      runId,
      commandId: command.id,
    },
    {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    },
  );

  if (ackResponse.status !== 200) {
    core.warning(`Failed to acknowledge command ${command.id}, server is probably not running`);
    return;
  }

  // Write the file first
  // Use appDir if provided, otherwise use repo root
  const baseDir = data.appDir || process.env.GITHUB_WORKSPACE || process.cwd();

  // Create full path for the script file (relative to appDir)
  const fullFilePath = path.relative(baseDir, data.filePath);
  const fullOriginalFilePath = data.originalFilePath
    ? path.relative(baseDir, data.originalFilePath)
    : data.originalFilePath;

  core.info(`Full file path: ${fullFilePath}`);
  core.info(`Full original file path: ${fullOriginalFilePath}`);

  // Ensure directory exists
  await fs.mkdir(path.dirname(fullFilePath), { recursive: true });

  core.info(`Writing file to ${fullFilePath}`);
  await fs.writeFile(fullFilePath, data.fileContents, { encoding: "utf8" });

  let lastCommandStdout = "";
  let lastCommandStderr = "";
  let lastCommandExitCode = 0;

  if (actions.includes(FileAction.LINT)) {
    core.info("Linting file");
    const lintTemplate = Handlebars.compile(scripts.lint);
    const processedLintScript = lintTemplate({
      file: fullFilePath,
    });

    try {
      const result = await executeScript(processedLintScript, baseDir, "Lint");
      lastCommandStdout = result.stdout;
      lastCommandStderr = result.stderr;
      lastCommandExitCode = result.exitCode;
    } catch (err) {
      core.error(`Failed to execute lint command: ${err}`);
      lastCommandStdout = "";
      lastCommandStderr = String(err);
      lastCommandExitCode = 1;
    }
  }

  if (actions.includes(FileAction.TEST)) {
    core.info("Testing file");
    const testTemplate = Handlebars.compile(scripts.test);
    const processedTestScript = testTemplate({
      file: fullFilePath,
    });

    try {
      const result = await executeScript(processedTestScript, baseDir, "Test");
      lastCommandStdout = result.stdout;
      lastCommandStderr = result.stderr;
      lastCommandExitCode = result.exitCode;
    } catch (err) {
      core.error(`Failed to execute test command: ${err}`);
      lastCommandStdout = "";
      lastCommandStderr = String(err);
      lastCommandExitCode = 1;
    }
  }

  const commandResult: FileCommandResult = {
    commandId: command.id,
    type: "file",
    completedAt: new Date(),
    stdout: lastCommandStdout,
    stderr: lastCommandStderr,
    exitCode: lastCommandExitCode,
    error: lastCommandExitCode !== 0 ? lastCommandStderr : undefined,
  };

  // Send the result back to the server
  const resultResponse = await axios.post(
    `${serverUrl}/command-result`,
    {
      runId,
      result: commandResult,
    },
    {
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (resultResponse.status !== 200) {
    core.warning(`Failed to send result for command ${command.id}, server is probably not running`);
  }
}

// async function executeScript(
//   script: string,
//   cwd: string,
//   commandType: string,
// ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
//   core.info(`Executing ${commandType.toLowerCase()} script: ${script}`);

//   return new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve) => {
//     let stdout = "";
//     let stderr = "";
//     let exitCode = 0;

//     const childProcess = exec(script, { cwd }, (error, stdoutResult, stderrResult) => {
//       stdout = stdoutResult;
//       stderr = stderrResult;

//       if (stdout) core.info(`${commandType} stdout: ${stdout}`);
//       if (stderr) core.warning(`${commandType} stderr: ${stderr}`);

//       if (error) {
//         core.warning(`${commandType} error: ${error.message}`);
//       }
//     });

//     childProcess.on("exit", (code) => {
//       exitCode = code || 0;
//       core.info(`${commandType} command exited with code ${exitCode}`);
//       resolve({ stdout, stderr, exitCode });
//     });
//   });
// }

async function executeScript(
  script: string,
  cwd: string,
  commandType: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  core.info(`Executing ${commandType.toLowerCase()} script: ${script}`);

  return new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve) => {
    exec(script, { cwd }, (error, stdout, stderr) => {
      const exitCode = error ? (error.code ?? 1) : 0;
      if (stdout) core.info(`${commandType} stdout: ${stdout}`);
      if (stderr) core.warning(`${commandType} stderr: ${stderr}`);
      if (error) {
        core.warning(`${commandType} error: ${error.message}`);
      }
      core.info(`${commandType} command exited with code ${exitCode}`);
      resolve({ stdout, stderr, exitCode });
    });
  });
}
