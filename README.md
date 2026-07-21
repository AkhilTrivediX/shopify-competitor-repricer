# Shopify Competitor Repricer (Closed-Loop AI Agent)

A closed-loop dynamic competitor price matching and repricing agent for Shopify. It crawls competitor Shopify stores using their public feeds, matches equivalent items, computes safety margins, and mutates prices in the user's Shopify Admin panel.

---

## 🚀 Why use the Shopify Competitor Repricer?

Managing prices across hundreds of products manually is a bottleneck. Standard scrapers only export competitor data to a spreadsheet, leaving you to do the heavy lifting of product matching, math, and manual catalog updates. 

This Actor closes the loop:
1. **Automates Competitor Scraping**: Hitting the public product feeds of competitor stores with 100% reliability (no proxy overhead).
2. **AI Semantic Matching**: Maps catalog items (even with mismatched names/SKUs) using GPT-4o-mini.
3. **Price Rules Engine**: Calculates price cuts under your custom undercut percentage and safety margins.
4. **Direct Write-Back**: Updates variants directly in your Shopify Admin dashboard via secure API mutations.

---

## ✨ Features

*   🔄 **Closed-Loop Automation**: Changes prices directly in your active Shopify store catalog.
*   ⚡ **Zero-Auth Crawler**: Fetches competitor data in milliseconds via native `/products.json` feeds.
*   🧠 **LLM Catalog Matching**: Uses `gpt-4o-mini` to resolve title differences (e.g. mapping competitor's *"Nike AF1 - Red"* to your *"Air Force 1 Crimson"*).
*   🛡️ **Safety Margin Guardrails**: Configurable percentage undercut rules and absolute price discounts limits.
*   🔍 **Dry Run Mode**: Test price adjustments in simulation mode to verify calculations before going live.
*   📊 **Clean Output Dashboard**: Generates structured table visualizations directly inside the Apify Console.

---

## 📖 How to Get Started (Shopify API Token Setup)

To allow the Actor to write updated prices back to your Shopify store, you must generate a secure Admin API Access Token:

1. Log in to your **Shopify Admin Panel**.
2. Navigate to **Settings > Apps and sales channels > Develop apps**.
3. Click **Create an app**, name it (e.g. `Apify Repricer`), and select your developer account.
4. Under **Configuration**, click **Configure Admin API integration**.
5. Enable the following scopes:
    *   `write_products` (Required to update variant prices)
    *   `read_products` (Required to fetch your catalog listings)
6. Click **Save** and then click **Install App** in the top right.
7. Copy the **Admin API access token** (starts with `shpat_`).

---

## 📥 Input Parameters

Configure the following inputs in the Apify Console when running the Actor:

| Field Name | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Competitor Store URL** | `string` | **Yes** | `https://allbirds.com` | The base domain of the competitor's Shopify store. |
| **Your Shopify Store Domain** | `string` | **Yes** | `demo-store.myshopify.com` | Your internal store domain (e.g. `your-store.myshopify.com`). |
| **Shopify Admin Access Token** | `string` | **Yes** | `shpat_demo_mock_token` | The secure access token (`shpat_...`) generated in your Shopify admin. |
| **OpenAI API Key (BYOK)** | `string` | No | `MOCK_KEY_FOR_TESTING` | Your OpenAI API Key for semantic matching. |
| **Undercut Percentage** | `number` | No | `2.0` | The percentage to price under the competitor (e.g. `2.0` for 2% cheaper). |
| **Maximum Discount Limit** | `number` | No | `15.0` | The max discount percentage allowed off your original price to protect margins. |
| **Dry Run Mode** | `boolean` | No | `true` | If enabled, calculates and logs adjustments without modifying your active store. |

---

## 📤 Output / Dataset Structure

Each run saves the pricing adjustments report to the default dataset. A sample output record looks like this:

```json
{
  "variantId": 90011,
  "title": "Adidas Gazelle - Classic White",
  "sku": "ADI-GAZ-WH",
  "oldPrice": 90.00,
  "competitorPrice": 75.00,
  "newPrice": 76.50,
  "status": "UPDATED"
}
```

### Output Field Descriptions
*   `variantId` (Integer): The unique variant identifier in your Shopify store.
*   `title` (String): The matched variant description.
*   `sku` (String): Your product SKU.
*   `oldPrice` (Number): The variant's starting price before the run.
*   `competitorPrice` (Number): The competitor's price extracted.
*   `newPrice` (Number): The newly computed price (either undercut or safety capped).
*   `status` (String): Can be `UPDATED` (price updated), `DRY_RUN` (calculations completed but not synced), `NO_CHANGE` (price already matches rule), or `NO_MATCH` (could not find variant in competitor catalog).
