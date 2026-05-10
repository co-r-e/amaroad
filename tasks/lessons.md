# Lessons

- Verify the real runtime path before calling a rendering bug fixed. Static checks and partial progress signals are not enough when a production CSP or loader path can still blank the output.
- When an API is intentionally disabled in production, add the same production guard at its client callers. Otherwise the app stays functionally correct but still leaks noisy 4xx errors into the browser console.
- When verification is blocked by a known lint failure in touched code, fix the lint issue instead of classifying it as merely pre-existing and moving on.
- When replacing `react/jsx-runtime` with a custom wrapper, preserve child-array normalization semantics. Static MDX sibling arrays otherwise show up as missing-key warnings even when the author did not write a dynamic list.
- When the user explicitly wants their changes pushed and indicates direct `main` pushes are allowed, do not introduce a feature branch by default. Push the validated commit to `main` unless the user asks for a PR workflow.
