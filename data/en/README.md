# English Bible data pack

**Source:** World English Bible (Classic edition), [eBible.org](https://eBible.org/eng-web/)
— public domain.

This pack contains the full 66-book Protestant canon (Old Testament:
Genesis–Malachi; New Testament: Matthew–Revelation) as
`bible.json`, in the same shape as the other language packs:

```json
{"Testaments": [{"Books": [{"Text": "<book name>",
  "Chapters": [{"Verses": [{"ID": 1, "Text": "..."}]}]}]}]}
```

## Translation

The **World English Bible** is a modern-English update of the American
Standard Version (1901), dedicated to the public domain by its translators.
The Classic edition renders God's proper name in the Old Testament as
"Yahweh". This pack was built from eBible.org's current WEB Classic HTML
edition (chapter pages under `https://eBible.org/eng-web/`); 264 of the
1,189 chapters could not be fetched from eBible.org (the network persistently
blackholed those chapter URLs) and were filled from the same translation via
the `world-english-bible` npm snapshot (parsed from eBible.org's WEB HTML,
November 2025).

**Attribution:** English: World English Bible — public domain.

## Build notes

- Verse text is plain text: footnotes, cross-references, and all markup
  (including *words-of-Jesus* spans) were stripped; paragraph and poetry
  breaks were normalized to single spaces. Psalm titles and Hebrew stanza
  letters (e.g. "BETH" in Psalm 119) are omitted so each verse starts with
  its own words.
- Five verses are empty strings in the WEB itself (omitted verses with no
  text: Acts 8:37, Acts 15:34, Acts 24:7, Luke 17:36, Romans 16:25); they are
  kept with empty text so verse numbering stays intact.
- Chapter/verse counts were validated against the French reference pack
  (`../bible.json`). The only mismatch in the 12-chapter validation sample
  is on the French side: the French pack's Numbers 1 is missing verses
  21–43 (its verse IDs jump from 20 to 44).
