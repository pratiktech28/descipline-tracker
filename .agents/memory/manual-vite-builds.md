---
name: Manual Vite builds
description: Environment requirements when building this Vite artifact directly from the shell.
---

When running the Daily Discipline production build directly in the shell, pass the `PORT` and `BASE_PATH` values declared in the artifact's service environment. The preview workflow receives them automatically, but standalone shell commands did not.

**Why:** The preview served successfully, while successive shell builds stopped at config loading until both required values were supplied.

**How to apply:** Check the current artifact service configuration before a manual build, then set those values inline. Do not change secrets or workflow configuration to work around this.
