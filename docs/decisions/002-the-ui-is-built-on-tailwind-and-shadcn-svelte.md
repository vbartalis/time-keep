# 2. The UI is built on Tailwind and shadcn-svelte

- date: 2026-10-18
- status: active
- amends: —
- amended-by: —
- superseded-by: —

## Rule

Styling is Tailwind CSS, with design tokens defined as Tailwind theme values.
Components start from shadcn-svelte, copied into the repository and owned there,
not consumed as a dependency.

## Why

shadcn-svelte gives accessible, unstyled-by-default building blocks (dialogs,
pickers, tables) that the dense PC surface and the quick phone surface both need,
while leaving every component editable in the repo. Tailwind keeps the tokens in one
place. The pair is the one already proven in the weather-py hub.
