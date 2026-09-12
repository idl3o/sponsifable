# Shop window board

Design sources for the creator's visible mark on clip previews: the board that advertises their shop window. Each `*.dc.html` file is one artboard on a design canvas, and `canvas.json` lays them out. The files are the source of truth; the published canvas is rebuilt from them.

## Decisions

- **Two marks, two jobs.** The invisible mark is forensic: a serial per licence, applied when the sponsor activates the licence, never before. The visible board appears on previews only. It advertises the shop and deters use of the preview. Visible-watermark removal tools are common, so it is deterrence, not protection.
- **The creator designs the board. The tool always adds the PREVIEW label and the link.** The mark can be a monogram, an uploaded logo, or a whole board image. An uploaded image sits beside the label and the link, and never replaces them.
- **Nothing in the pixels goes stale.** No price appears on the board, because prices change and pixels do not; the link shows the current price. The link points to the creator's own domain. There is no project-run shortener, which would count clicks. The link has to outlive any host the creator might leave.
- **The vertical board keeps clear of the app's own UI.** On 9:16 the board stays out of the top bar, the right-hand buttons and the caption area, and the editor flags a position that falls under them.
- **Sponsored moments go only to their sponsor.** They carry a private board, "Preview for [sponsor]", and are sent with the delivery report. Only moments with no sponsor in them are listed publicly.
- **The licensed copy is clean.** No board and no pattern, only the invisible serial.

## Checks the editor runs

- The PREVIEW label is present in every mode.
- No price appears in the pixels.
- The vertical placement is clear of the app UI.
- The tool can measure its own text, but not an uploaded image, so it asks the creator to judge that by eye.

## Open questions

- **Preview-class serials.** Once the video watermark passes the survival test, previews could carry an invisible serial of their own. An ad cut from a preview would then show that it came from a preview and not a licence.
- **QR codes on low-resolution previews.** A small, low-resolution preview protects the clip, while a QR code needs pixels to scan. At 720p the board's code is about 100 px, four pixels per module. Test that on real phones before relying on it.
