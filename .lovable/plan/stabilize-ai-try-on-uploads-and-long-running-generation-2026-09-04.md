# Stabilize AI try-on uploads and long-running generation

## Goal
Make normal phone-camera photos reliably reach the free `yisol/IDM-VTON` Space, keep customers informed during slow queue periods, and expose enough diagnostics to identify genuine live failures without changing the approved provider or consuming Lovable AI credits.

## Changes

1. **Compress shopper photos before try-on**
   - Reuse the existing browser image compressor in the try-on dialog.
   - Downscale the longest side to 1400 px and encode as JPEG at 0.75 quality before saving the photo in the tab session or calling the server function.
   - Replace the current raw 8 MB rejection with validation for unsupported/unreadable files and a clear error if compression itself cannot produce a request-safe image.
   - Keep the shopper photo in memory only; do not upload or persist it.

2. **Compress product photos at upload time**
   - Apply the same 1400 px / 0.75 JPEG compression when a shop owner adds or replaces a product photo.
   - Upload the compressed JPEG with the correct filename and content type.
   - Existing product photos remain usable; the server will continue loading them securely from the private product-photo bucket. This change prevents new oversized garment images rather than silently rewriting existing inventory.

3. **Allow genuinely slow free-Space requests**
   - Raise the provider cutoff from 90 to 120 seconds.
   - Update the progress calculation and duration copy to reflect the 120-second maximum.
   - Show “Creating your look... this can take up to a minute.” initially, then switch at 60 seconds to “Still working — busy right now, hang tight a little longer”.
   - Preserve distinct messages for cold start, free-service quota/rate limit, network failure, malformed response, missing image, and final timeout.

4. **Improve production diagnostics**
   - Add structured, privacy-safe server logs for each try-on stage: request accepted, compressed payload sizes, product fetch, Space connection, prediction, response parsing, elapsed time, and classified failure.
   - Never log shopper image data, tokens, personal details, or full provider payloads.
   - Re-check available production logs after exercising the deployed flow and report exact provider/runtime error text where logs exist.
   - Current evidence limitation: the available published logs contain no matching try-on entries in the last hour, and this workspace cannot read the separate Vercel deployment logs. Exact historical Vercel failures require logs supplied from that deployment or a new reproducible request after deployment.

## Validation

- Verify compression output dimensions, JPEG type, and reduced payload size using a large camera-style image.
- Run targeted checks for file decode failure and the 60-second message transition.
- Exercise the full try-on flow with a real product and an unedited camera-style person photo; confirm result index 0 displays and the mask is never shown.
- Test a mobile viewport with throttled mobile-data-like networking, confirming upload starts, progress changes after 60 seconds when applicable, busy state always clears, and the final result or precise failure message appears.
- Re-check server logs for the test request and correlate the exact stage, elapsed time, and provider error.

## Technical constraints

- Keep `yisol/IDM-VTON` through `@gradio/client`; do not introduce Lovable AI Gateway or another paid provider.
- Keep the fresh random seed on every generation.
- A sandbox can emulate a phone viewport and constrained mobile network, but it cannot truthfully certify a physical phone/carrier test. Final physical-device confirmation must be performed on the deployed site from an actual phone; the app-side behavior and diagnostics will be prepared for that check.
