# Tusk Test Runner

<p align="center">
  <a href="https://usetusk.ai">
    <img src="./static/images/tusk.png" width="200" title="Tusk">
  </a>
</p>

Tusk is an AI testing platform that helps you catch blind spots, surface edge cases cases, and write verified tests for your commits.

This GitHub Action facilitates running Tusk-generated tests on Github runners.

## Usage

Log in to [Tusk](https://app.usetusk.ai/app) and auth your GitHub repo.

When you push new commits, Tusk runs against your commit changes and generates tests. To ensure that test scenarios are meaningful and verified, Tusk will start this workflow and provision a runner (with a unique `runId`), using it as an ephemeral sandbox, to run tests against your specific setup and dependencies. Essentially, this action polls for live commands emitted by Tusk based on the progress of the run, executes them, and sends the results back to Tusk for further processing.

Add the following workflow to your `.github/workflows` folder and adapt inputs accordingly. If your repo requires additional setup steps, add them before the `Start runner` step.

```
name: Tusk Test Runner

on:
  workflow_dispatch:
    inputs:
      runId:
        description: "Tusk Run ID"
        required: true

jobs:
  test-action:
    name: Tusk Test Runner
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        id: checkout
        uses: actions/checkout@v4

      - name: Start runner
        id: test-action
        uses: UseTusk/test-runner@v1
        with:
          runId: ${{ github.event.inputs.runId }}
          tuskUrl: <Tusk server URL>
          authToken: <Tusk auth token>
          lintScript: <your lint script>
          testScript: <your test script>
          coverageScript: <your coverage script>
```

## Contact

Need help? Drop us an email at founders@usetusk.ai.
