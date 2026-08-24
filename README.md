# Ethnic AI Style

# Master Prompt — Paste into Lovable as your first message



Build a mobile-friendly e-commerce web app called "Virar Ethnic Stock" for

garment shop owners who sell women's and girls' ethnic wear, with an AI

try-on feature for shoppers.



## PART 1 — SHOP OWNER SIDE (inventory management)



**AUTH (use Supabase Auth):**

- Shop owners sign up with owner name, shop name, and email.

- Login is passwordless: send a 6-digit OTP to their email, they enter it

  to verify (use Supabase's built-in email OTP, not a custom system).

- Once verified, keep them logged in (persistent session) — don't ask for

  OTP again unless they log out.

- Support unlimited separate shop owner accounts.



**DATABASE:**

- Table `shops`: id, owner_name, shop_name, email, whatsapp_number, created_at.

- Table `products`: id, shop_id (FK to shops), product_name, category,

  subcategory, size, color, fabric, quantity, cost_price, selling_price,

  sku, photo_url, notes, created_at, updated_at.

- `category` is a dropdown: Patiala Suit, Churidar, Plazo Set, Lehenga,

  Kurti, Dupatta, Saree, Other.

- Table `stock_log`: id, product_id, change_amount, reason

  (restock/sale/damage), created_at.

- **IMPORTANT:** enable Row Level Security on `products` and `stock_log` so

  each shop owner can only ever see, add, edit, or delete rows where

  shop_id matches their own logged-in account — never another shop's data.



**SHOP OWNER FEATURES:**

- Category tabs on the dashboard — tapping one shows only that category's

  products, nothing else.

- Add Product / Edit Product (same form, pre-filled) / Delete Product

  (confirm before removing).

- Quick +/- stock buttons on each product, logged automatically to

  `stock_log`.

- Search bar, low-stock badge under 3, dashboard showing total products

  and total stock value.



## PART 2 — SHOPPER SIDE (public storefront + AI try-on)



- A public storefront page (no login needed) where shoppers browse

  products by shop and by category, see photo, price, size, color.

- On each product page, a "Try It On" button.

- Tapping it lets the shopper upload their own photo. Show example

  guidance text above the upload box: "Upload a clear, front-facing,

  full-body photo with plain background and good light."

- Create a Supabase Edge Function called `generate-tryon` that:

  - receives the shopper's uploaded photo + the product's photo_url

  - calls the FASHN.ai try-on API with both images (swap in a different

    provider later if needed — keep this function isolated so swapping

    providers only means editing this one function)

  - stores the try-on API key in Supabase secrets — never in frontend code

  - returns the generated image URL to the app

  - does NOT save the shopper's uploaded selfie anywhere permanently —

    delete it immediately after the generated result is returned

- Show a loading state while waiting: "Creating your look... this can

  take up to a minute."

- Limit each shopper to 3 try-ons per day (track by browser session, no

  login required) to control API cost.

- Show the generated result with two buttons: "Try another outfit" and

  "Contact shop to buy" (opens WhatsApp chat using the shop's

  whatsapp_number).



## DESIGN

- Mobile-first, large tappable buttons, minimal clutter — both shop

  owners and shoppers will mostly use this on their phones.



Set up Supabase (auth +

 database + RLS policies + the edge function) as

part of this build.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://virar-style-magic.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/122ee57e-7b4b-4000-aa59-39bbffac7c7c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
