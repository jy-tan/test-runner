import axios from "axios";
import * as core from "@actions/core";
import { Command, FileCommandResult } from "./types.js";

const serverUrl = core.getInput("tuskUrl", { required: true });
const authToken = core.getInput("authToken", { required: true });
const timeoutMs = 5_000;

const headers = {
  Authorization: `Bearer ${authToken}`,
  "Content-Type": "application/json",
};

export const pollCommands = async ({
  runId,
  runnerMetadata,
}: {
  runId: string;
  runnerMetadata: Record<string, string | undefined>;
}): Promise<Command[]> => {
  const response = await axios.get(`${serverUrl}/poll-commands`, {
    params: {
      runId,
      runnerMetadata,
    },
    timeout: timeoutMs,
    signal: AbortSignal.timeout(5_000),
    headers,
  });

  return response.data.commands as Command[];
};

export const ackCommand = async ({
  runId,
  commandId,
}: {
  runId: string;
  commandId: string;
}): Promise<Command> => {
  const response = await axios.post(
    `${serverUrl}/ack-command`,
    {
      runId,
      commandId,
    },
    {
      headers,
      timeout: timeoutMs,
      signal: AbortSignal.timeout(5_000),
    },
  );

  if (response.status !== 200) {
    core.warning(`Failed to ack command ${commandId}, server is probably not running`);
  }

  return response.data as Command;
};

export const sendCommandResult = async ({
  runId,
  result,
}: {
  runId: string;
  result: FileCommandResult;
}): Promise<void> => {
  const response = await axios.post(
    `${serverUrl}/command-result`,
    {
      runId,
      result,
    },
    {
      headers,
      timeout: timeoutMs,
      signal: AbortSignal.timeout(5_000),
    },
  );

  if (response.status !== 200) {
    core.warning(
      `Failed to send result for command ${result.commandId}, server is probably not running`,
    );
  }
};
