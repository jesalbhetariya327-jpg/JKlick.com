# Checkout reliability + customer-only shop pages

## 1. Checkout timeout and error handling
- Wrap the order submission in `src/routes/_authenticated/checkout.$shopId.tsx` with try/catch so a failure never leaves the button stuck on "Placing your order...".
- Add a client-side deadline (about 60s) on the order call; on timeout show "Your order is taking too long — please check My Orders before retrying" instead of hanging forever.
- Always reset the busy state in a `finally` block and surface the real error text via toast.

## 2. Screenshot compression before upload
- Add a small image helper that draws the chosen payment screenshot to a canvas, scales the longest side down to ~1400px, and re-encodes as JPEG (~0.75 quality).
- Use it in checkout in place of the raw `FileReader` data URL, so the payload sent to the server shrinks dramatically (typically 3–6 MB down to a few hundred KB) — this is the main cause of the slow/hanging order submit.
- Keep the existing 8 MB input guard as a pre-check.

## 3. Shop pages become customer-only
- Remove `<OwnerLoginButton />` from `src/routes/$shopSlug.tsx` and `src/routes/product.$productId.tsx` (it stays on the homepage `src/routes/index.tsx`, which is the general landing page).
- Remove the "Shop owner? Sign in here" link at the bottom of the customer gate card in `src/components/CustomerAuthGate.tsx`.
- Result: a shop link shows only customer signup/login; owners reach `/auth` from the homepage or a direct link.

## Notes
- No database or RLS changes; order/try-on scoping per shop already works as intended.
- On git: commits happen automatically for every change I make — you never need to ask.
