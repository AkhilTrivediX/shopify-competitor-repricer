# Shopify Competitor Repricer (Apify Actor)

A closed-loop dynamic competitor price matching and repricing agent for Shopify. It crawls competitor Shopify stores using their public feeds, matches equivalent items, computes safety margins, and mutates prices in the user's Shopify Admin panel.

## Features
* **Closed-Loop Repricing**: Updates your store inventory pricing automatically.
* **Stable zero-auth Scraper**: Uses native Shopify `/products.json` feeds to extract competitor items with 100% reliability.
* **LLM Catalog Matching**: Uses `gpt-4o-mini` to map varying product names (e.g. matching competitor's *"Nike AF1 - Red"* to your *"Air Force 1 Crimson"*).
* **Safety Margin Guardrails**: Configurable percentage undercut rules and absolute price discounts limits.
* **Dry Run Mode**: Audits price adjustments without updating the active Shopify store.

## How to Obtain Shopify Access Token
1. Go to your Shopify Admin Panel.
2. Navigate to **Settings > Apps and sales channels > Develop apps**.
3. Click **Create an app**, name it (e.g. `Apify Repricer`), and select your developer account.
4. Under **Configuration**, click **Configure Admin API integration**.
5. Enable **Write Products** and **Read Products** scopes. Click Save.
6. Click **Install App**.
7. Copy the **Admin API access token** (starts with `shpat_`).

## Input Fields
* `competitorUrl` (String): The domain of the competitor (e.g. `https://competitor.com`).
* `shopifyStoreDomain` (String): Your store domain (e.g. `your-store.myshopify.com`).
* `shopifyAdminAccessToken` (String): Your secure Shopify token (`shpat_...`).
* `openaiApiKey` (String, Optional): OpenAI API Key for semantic matching.
* `undercutPercentage` (Number): Price discount percentage compared to competitor (default `2.0%`).
* `maxDiscountPercentage` (Number): Maximum discount permitted off your current price to safeguard profit margin (default `15.0%`).
* `dryRun` (Boolean): Set to `true` to run simulations without updating inventory (default `true`).

## Running Locally
1. Run:
   ```bash
   npm install
   ```
2. Run mock verification tests:
   ```bash
   npm run test
   ```
