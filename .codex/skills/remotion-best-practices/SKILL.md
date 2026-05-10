---
name: remotion-best-practices
description: |
  Domain-specific guidance for Remotion video work in this repository. Use when
  creating, editing, or reviewing Remotion compositions, animations, captions,
  audio handling, transitions, or media-processing workflows.
---

# Remotion Best Practices

Load targeted rule files for Remotion work instead of relying on generic React assumptions.

## Use When

- Working on Remotion compositions or render pipelines
- Designing animation timing, transitions, captions, or audio behavior
- Implementing video utilities such as trimming, metadata analysis, or asset handling

## Rule Loading Guide

- For captions or subtitles, read `rules/subtitles.md`
- For FFmpeg-backed workflows, read `rules/ffmpeg.md`
- For audio visualization, read `rules/audio-visualization.md`
- For sound effects, read `rules/sound-effects.md`

## Core Rule Files

Read only the files relevant to the task from `rules/`, including:

- `animations.md`
- `audio.md`
- `compositions.md`
- `fonts.md`
- `sequencing.md`
- `text-animations.md`
- `timing.md`
- `transitions.md`
- `videos.md`

## Notes

- Prefer targeted rule loading over bulk-reading the entire rules directory.
- Treat these rule files as Remotion-specific constraints and idioms for implementation and review.
