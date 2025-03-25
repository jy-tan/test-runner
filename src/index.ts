import axios from "axios";
import * as core from "@actions/core";
import { Command, FileCommand, RunnerAction, Scripts } from "./types.js";
import { processCommand } from "./handleCommands.js";

async function run() {
  core.info("Starting runner...");

  try {
    const runId = core.getInput("runId", { required: true });

    core.info(`Run ID: ${runId}`);

    const testScript = core.getInput("testScript", { required: true });
    const lintScript = core.getInput("lintScript", { required: true });
    const coverageScript = core.getInput("coverageScript", { required: false });
    const scripts: Scripts = {
      test: testScript,
      lint: lintScript,
      coverage: coverageScript,
    };

    const serverUrl = core.getInput("tuskUrl", { required: true });
    const authToken = core.getInput("authToken", { required: true });
    const pollingDuration = parseInt(core.getInput("pollingDuration") || "1800", 10); // Default 30 minutes
    const pollingInterval = parseInt(core.getInput("pollingInterval") || "5", 10); // Default 5 seconds

    const headers = {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    };

    // Get GitHub context
    // Full list: https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/store-information-in-variables#default-environment-variables
    const runnerMetadata = {
      githubRepo: process.env.GITHUB_REPOSITORY,
      githubRef: process.env.GITHUB_REF,
      githubSha: process.env.GITHUB_SHA,
    };

    // Start polling for commands
    const startTime = Date.now();
    const endTime = startTime + pollingDuration * 1000;

    // let counter = 0; // For testing

    while (Date.now() < endTime) {
      try {
        // if (counter >= 1) {
        //   await new Promise((resolve) => setTimeout(resolve, 10_000));
        //   core.info("Stopping");
        //   break;
        // }

        // counter++;

        core.info(
          `Polling server for commands (${Math.round((endTime - Date.now()) / 1000)}s remaining)...`,
        );

        const response = await axios.get(`${serverUrl}/poll-commands`, {
          params: {
            runId,
            runnerMetadata,
          },
          timeout: (pollingInterval + 5) * 1000,
          headers,
        });

        const commands = response.data.commands as Command[];

        if (commands.length > 0) {
          core.info("Received commands from server");

          if (
            commands.some(
              (cmd) => cmd.type == "runner" && cmd.actions.includes(RunnerAction.TERMINATE),
            )
          ) {
            // Ack the terminate command before exiting?
            await axios.post(
              `${serverUrl}/ack-command`,
              {
                runId,
                commandId: commands.find(
                  (cmd) => cmd.type == "runner" && cmd.actions.includes(RunnerAction.TERMINATE),
                )?.id,
              },
              {
                headers,
              },
            );

            core.info("Terminate command received, exiting...");
            break;
          }

          const fileCommands = commands.filter((cmd) => cmd.type == "file") as FileCommand[];

          // Not awaiting here to avoid blocking the main thread
          Promise.all(
            fileCommands.map((command) =>
              processCommand({ runId, command, serverUrl, authToken, scripts }),
            ),
          ).catch((error) => {
            core.warning(`Error in command batch processing: ${error}`);
          });
        } else {
          core.debug("No commands received");
        }
      } catch (error) {
        // If this is just a timeout, it's expected behavior
        if (error instanceof Error && error.message.includes("ECONNABORTED")) {
          core.debug("Polling timeout (expected)");
        } else {
          core.warning(`Polling error: ${error}`);
          // Wait before retrying to avoid hammering the server
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }

      await new Promise((resolve) => setTimeout(resolve, pollingInterval * 1000));
    }

    // await new Promise((resolve) => setTimeout(resolve, 10_000));

    core.info("Long-polling completed successfully");
  } catch (error) {
    core.setFailed(`Action failed`);
    core.error(`Server response body: ${JSON.stringify(error)}`);
  }
}

run();
