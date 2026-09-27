# English Bible data pack

**Source:** Berean Standard Bible (2022), [berean.bible](https://berean.bible) — formally dedicated to the public domain by the rights-holder on April 30, 2023.

This pack contains the full 66-book Protestant canon (Old Testament:
Genesis–Malachi; New Testament: Matthew–Revelation) as
`bible.json`, in the same shape as the other language packs:

```json
{"Testaments": [{"Books": [{"Text": "<book name>",
  "Chapters": [{"Verses": [{"ID": 1, "Text": "..."}]}]}]}]}
```

## Translation

The **Berean Standard Bible** is a modern-English translation (final text
2022) by the Berean Bible Translation Committee, formally dedicated to the
public domain on April 30, 2023. It uses natural contemporary English with
no archaic pronouns (no thee/thou/thy).

**Attribution:** English: Berean Standard Bible — public domain (2022).

## Build notes

- Built 2026-09-27 from the official USFM
  (`https://ebible.org/Scriptures/engbsb_usfm.zip`, mirrored from
  bereanbible.com). Verse text is plain text: `\w` Strong's word markup,
  footnotes, cross-references, section headers, and paragraph/poetry markers
  were stripped; `\nd` (LORD) and `\wj` (words of Jesus) spans were kept as
  plain text.
- Verse numbering follows the previous World English Bible pack exactly
  (31,103 verses) so all navigation and references stay intact:
  - 31,084 verses are BSB text.
  - 19 verses the BSB omits as footnotes (the classic disputed verses:
    Matthew 17:21, 18:11, 23:14; Mark 7:16, 9:44, 9:46, 11:26, 15:28;
    Luke 17:36, 23:17; John 5:4; Acts 8:37, 15:34, 24:7, 28:29;
    Romans 16:24; plus the Romans 14:24–26 doxology placement) keep their
    WEB wording.
  - BSB's Romans 16:26–27 (the doxology's 2nd half, which WEB places at
    14:24–26) is merged into Romans 16:25 so no text is lost.
