# Investigation results + fixes

## What I actually found

**1. Login hero image — the file is fine, nothing to re-upload.**
The logo is not stored in the backend at all. It lives on Lovable's asset CDN (`src/assets/jklick-logo-lockup.jpg.asset.json`), and I fetched it on both the preview and the published site — both returned HTTP 200. The app icons (`public/app-icon-192.png`, `512`, `apple-touch-icon.png`, `favicon.png`) are plain files in the repo, also serving 200. So the backend change could not have removed them. If it still looks blank for you, it is a cached page or a device-specific render issue, not a missing file. No re-upload needed.

**2. Ordering hang — the real cause is missing error handling, not missing storage.**
All three storage buckets exist on the current backend with the same private settings as before: `product-photos`, `customer-tryons`, `payment-screenshots`. The server credential for uploads is present. There are no Edge Functions in the checkout path — orders go through an in-app server function.

The actual bug is in the checkout screen: the "place order" call has no `try/catch` and no timeout. If the request fails (network drop, auth token expiry, large screenshot upload stalling), the button stays stuck on "Placing your order..." forever with no message. Large UPI screenshots are also sent as base64, which is slow on mobile data and makes stalls likely.

**3. Site-wide slowness — compute tier is "Tiny", but an upgrade is not clearly warranted yet.**
That is the standard tier and is normally fine for this app's traffic. I found no leftover pointer to any old backend: the app reads one URL/key pair, injected by Lovable, and every client goes through the generated client files. This app is hosted on Lovable, not Vercel, so there is no separate Vercel env to fix. My honest read: the perceived slowness is more likely the stuck checkout and unbounded image payloads than the database tier. I will measure before recommending you spend money on an upgrade.

**4. Storefront login — customer gate is in place, but the page still links to shop-owner login.**
`/[shop-slug]` is wrapped in the customer sign-up/login gate, and orders and saved try-ons are already scoped per user and per shop. However, the gate card shows a "Shop owner? Sign in here" link, and once logged in the storefront renders an owner-login button. That contradicts "only customer login on shop links".

## What I will change

1. **Checkout reliability** — wrap the order submission in error handling with a request timeout (about 45 seconds), always clear the busy state, and show a clear message such as "Your order could not be sent. Check your connection and try again." Add the same protection to the UPI screenshot read step.
2. **Screenshot size** — downscale/compress the payment screenshot in the browser before sending, so uploads finish fast on mobile data instead of stalling.
3. **Storefront is customer-only** — remove the "Shop owner? Sign in here" link from the customer gate and the owner-login button from shop storefront pages. Owners keep using `/auth` directly.
4. **Verification** — place a full test order end-to-end (both Cash on Delivery and UPI) in a fresh browser session, confirm it completes and lands in order history, and confirm a fresh shop link shows only customer signup/login. Time the storefront and dashboard loads and report whether the database tier is actually a bottleneck.

## Technical notes

- Files touched: `src/routes/_authenticated/checkout.$shopId.tsx` (try/catch, timeout via `Promise.race`, canvas-based image downscale), `src/components/CustomerAuthGate.tsx` (drop owner link), `src/routes/$shopSlug.tsx` (drop `OwnerLoginButton`).
- No schema migration, no bucket changes, no secret changes required.
