---
description: Find and cite the governing Comprehensive Rules text for a Magic rules question or a step note. Use whenever writing a rule citation, a "why" note in a playline, or checking an interaction.
allowed-tools: Read, Grep, Glob
argument-hint: [rule number or keyword]
---
Search `knowledge/mtg-rules/` — section map: S1 game concepts (100–122), S2 parts of a card, S3 card types, S4 zones (400–408), S5 turn structure (500–514), S6 spells/abilities/effects (600–616, layers 613), S7 additional rules incl. all keywords (700–730), S8 multiplayer (800–810), S9 casual variants incl. Commander (903), GLOSSARY.
1. `grep -n` the rule number or keyword; read the surrounding rule and sub-rules.
2. Quote the rule number exactly (`CR 603.6c`) and paraphrase the text; never invent a number.
3. If the CR does not cover it (tournament procedure, shortcuts, loops), check `MTR_*.txt` (loops: MTR 4.4) or `JAR_*.md`.
4. If nothing is found, say so explicitly — do not answer from memory.
