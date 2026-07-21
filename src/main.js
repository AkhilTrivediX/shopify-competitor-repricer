import { Actor } from 'apify';
import axios from 'axios';
import { OpenAI } from 'openai';

async function main() {
    await Actor.init();

    // 1. Retrieve inputs
    const input = await Actor.getInput();
    if (!input) {
        throw new Error('Input is missing.');
    }

    const {
        competitorUrl,
        shopifyStoreDomain,
        shopifyAdminAccessToken,
        openaiApiKey,
        undercutPercentage = 2.0,
        maxDiscountPercentage = 15.0,
        dryRun = true,
    } = input;

    // Validate inputs
    if (!competitorUrl) {
        throw new Error('ValidationError: competitorUrl is required.');
    }
    if (!shopifyStoreDomain) {
        throw new Error('ValidationError: shopifyStoreDomain is required.');
    }
    if (!shopifyAdminAccessToken) {
        throw new Error('ValidationError: shopifyAdminAccessToken is required.');
    }

    // 2. Resolve OpenAI Key
    const apiKey = openaiApiKey || process.env.OPENAI_API_KEY;
    let openai = null;
    const isMockRun = apiKey === 'MOCK_KEY_FOR_TESTING';

    if (!isMockRun) {
        if (!apiKey) {
            throw new Error('ValidationError: OpenAI API Key (openaiApiKey) is missing. Since this Actor performs semantic catalog matching using LLMs, you must provide your own OpenAI API Key (Bring Your Own Key).');
        }
        openai = new OpenAI({ apiKey });
    }

    // Clean competitor URL to fetch its products.json feed
    let cleanCompetitorUrl = competitorUrl.replace(/\/$/, '');
    if (!cleanCompetitorUrl.endsWith('products.json')) {
        cleanCompetitorUrl = `${cleanCompetitorUrl}/products.json?limit=250`;
    }

    console.log(`\n--- Shopify Competitor Repricer Initiated ---`);
    console.log(`Competitor Feed: ${cleanCompetitorUrl}`);
    console.log(`User Shop Domain: ${shopifyStoreDomain}`);
    console.log(`Dry Run Mode: ${dryRun ? 'ENABLED' : 'DISABLED'}`);

    try {
        // 3. Scrape Competitor Products JSON Feed
        console.log('\nFetching competitor catalog...');
        const competitorResponse = await axios.get(cleanCompetitorUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const competitorProducts = competitorResponse.data.products;
        if (!competitorProducts || !Array.isArray(competitorProducts)) {
            throw new Error('Invalid competitor catalog structure. Could not find "products" array.');
        }
        console.log(`Successfully scraped ${competitorProducts.length} competitor products.`);

        // 4. Retrieve User's Shopify Catalog
        let userProducts = [];
        const isDemoMode = shopifyAdminAccessToken.toLowerCase().includes('demo') || shopifyAdminAccessToken.toLowerCase().includes('mock');

        if (isDemoMode) {
            console.log('\n[DEMO MODE] Detected demo credentials. Emulating user store products from competitor catalog...');
            // Generate user products slightly higher priced than competitor to demonstrate pricing cuts
            userProducts = competitorProducts.slice(0, 3).map((cp, idx) => ({
                id: 9000 + idx,
                title: cp.title,
                variants: cp.variants.map((cv, vidx) => ({
                    id: 90000 + idx * 10 + vidx,
                    title: cv.title,
                    sku: `DEMO-SKU-${idx}-${vidx}`,
                    price: (parseFloat(cv.price) * 1.15).toFixed(2) // 15% more expensive
                }))
            }));
        } else {
            console.log('\nFetching user Shopify catalog...');
            const userProductsUrl = `https://${shopifyStoreDomain}/admin/api/2024-04/products.json?limit=250`;
            const userResponse = await axios.get(userProductsUrl, {
                headers: {
                    'X-Shopify-Access-Token': shopifyAdminAccessToken,
                    'Content-Type': 'application/json'
                }
            });
            userProducts = userResponse.data.products;
            if (!userProducts || !Array.isArray(userProducts)) {
                throw new Error('Invalid user Shopify catalog response.');
            }
        }
        console.log(`Successfully retrieved ${userProducts.length} user products.`);

        // 5. Product Matching and Pricing Calculation Loop
        console.log('\nInitiating product matching and price calculations...');
        const adjustments = [];

        for (const userProduct of userProducts) {
            console.log(`\nProcessing user product: "${userProduct.title}"`);

            for (const userVariant of userProduct.variants) {
                const userPrice = parseFloat(userVariant.price);
                const sku = userVariant.sku || 'N/A';
                console.log(`- Variant: "${userVariant.title}" (SKU: ${sku}, Current Price: $${userPrice})`);

                // Filter candidates from competitor to check
                const matchQuery = `${userProduct.title} ${userVariant.title}`;
                let matchedCompetitorProduct = null;
                let matchedCompetitorVariant = null;

                // Semantic Match
                if (isMockRun) {
                    // String fallback matching for local tests
                    console.log('Using fallback string-matching algorithm (Mock Key)...');
                    matchedCompetitorProduct = competitorProducts.find(cp => 
                        cp.title.toLowerCase().includes(userProduct.title.toLowerCase())
                    );
                    if (matchedCompetitorProduct) {
                        matchedCompetitorVariant = matchedCompetitorProduct.variants[0]; // Match first variant
                    }
                } else {
                    // OpenAI Semantic variant mapping
                    console.log('Querying OpenAI for semantic matching...');
                    const candidatesList = competitorProducts.map(cp => ({
                        id: cp.id,
                        title: cp.title,
                        variants: cp.variants.map(cv => ({ id: cv.id, title: cv.title, price: cv.price }))
                    }));

                    const prompt = `You are a product matching engine. Match the user product variant to the exact competitor product variant from the candidate list.

User Product Name: "${userProduct.title}"
User Variant Name: "${userVariant.title}"

Competitor Candidate List:
${JSON.stringify(candidatesList)}

Instructions:
1. Find if there is an exact match or extremely close substitute.
2. Return a JSON object with:
   - matchedProductId: number/string (the matched competitor's productId, null if no match)
   - matchedVariantId: number/string (the matched competitor's variantId, null if no match)
   - confidenceScore: number (0.0 to 1.0, 1.0 being exact SKU match)
Return strictly valid JSON: {"matchedProductId": null, "matchedVariantId": null, "confidenceScore": 0.0}`;

                    try {
                        const completion = await openai.chat.completions.create({
                            model: 'gpt-4o-mini',
                            messages: [
                                { role: 'system', content: 'You are a database key mapper returning valid JSON.' },
                                { role: 'user', content: prompt }
                            ],
                            response_format: { type: 'json_object' }
                        });

                        const parsed = JSON.parse(completion.choices[0].message.content);
                        if (parsed.matchedProductId && parsed.matchedVariantId && parsed.confidenceScore > 0.7) {
                            matchedCompetitorProduct = competitorProducts.find(cp => cp.id == parsed.matchedProductId);
                            if (matchedCompetitorProduct) {
                                matchedCompetitorVariant = matchedCompetitorProduct.variants.find(cv => cv.id == parsed.matchedVariantId);
                            }
                        }
                    } catch (err) {
                        console.error('OpenAI matching query error:', err.message);
                    }
                }

                if (matchedCompetitorProduct && matchedCompetitorVariant) {
                    const competitorPrice = parseFloat(matchedCompetitorVariant.price);
                    console.log(`  Match found: "${matchedCompetitorProduct.title}" - "${matchedCompetitorVariant.title}" (Price: $${competitorPrice})`);

                    // 6. Pricing Engine Rule Calculations
                    let targetPrice = competitorPrice * (1 - undercutPercentage / 100);
                    let status = 'CALCULATED';

                    // Verify against safety boundary rules (max discount cap)
                    const minAllowedPrice = userPrice * (1 - maxDiscountPercentage / 100);
                    if (targetPrice < minAllowedPrice) {
                        targetPrice = minAllowedPrice;
                        status = 'CAPPED_BY_MARGIN_LIMIT';
                        console.log(`  ⚠️ Price capped at minimum safety limit of $${targetPrice.toFixed(2)} (Max discount: ${maxDiscountPercentage}%)`);
                    }

                    // Rounded target price
                    const finalTargetPrice = parseFloat(targetPrice.toFixed(2));
                    console.log(`  Calculated price: $${finalTargetPrice} (Status: ${status})`);

                    // 7. Write back to User's Shopify API
                    if (finalTargetPrice !== userPrice) {
                        if (dryRun) {
                            console.log(`  [DRY RUN] Would have updated SKU ${sku} price from $${userPrice} to $${finalTargetPrice}`);
                            adjustments.push({
                                variantId: userVariant.id,
                                title: `${userProduct.title} - ${userVariant.title}`,
                                sku,
                                oldPrice: userPrice,
                                competitorPrice,
                                newPrice: finalTargetPrice,
                                status: 'DRY_RUN'
                            });
                        } else {
                            console.log(`  [API UPDATE] Updating SKU ${sku} price to $${finalTargetPrice}...`);
                            const updateUrl = `https://${shopifyStoreDomain}/admin/api/2024-04/variants/${userVariant.id}.json`;
                            await axios.put(updateUrl, {
                                variant: {
                                    id: userVariant.id,
                                    price: finalTargetPrice.toString()
                                }
                            }, {
                                headers: {
                                    'X-Shopify-Access-Token': shopifyAdminAccessToken,
                                    'Content-Type': 'application/json'
                                }
                            });
                            console.log('  Successfully updated price on Shopify.');
                            adjustments.push({
                                variantId: userVariant.id,
                                title: `${userProduct.title} - ${userVariant.title}`,
                                sku,
                                oldPrice: userPrice,
                                competitorPrice,
                                newPrice: finalTargetPrice,
                                status: 'UPDATED'
                            });
                        }
                    } else {
                        console.log('  Price already matches rule calculation. No update needed.');
                        adjustments.push({
                            variantId: userVariant.id,
                            title: `${userProduct.title} - ${userVariant.title}`,
                            sku,
                            oldPrice: userPrice,
                            competitorPrice,
                            newPrice: finalTargetPrice,
                            status: 'NO_CHANGE'
                        });
                    }
                } else {
                    console.log('  No competitor product variant match found.');
                    adjustments.push({
                        variantId: userVariant.id,
                        title: `${userProduct.title} - ${userVariant.title}`,
                        sku,
                        oldPrice: userPrice,
                        competitorPrice: null,
                        newPrice: null,
                        status: 'NO_MATCH'
                    });
                }
            }
        }

        // 8. Save results to default dataset
        console.log('\nWriting price adjustment report to Apify Dataset...');
        await Actor.pushData(adjustments);
        console.log('Adjustment data push completed.');

    } catch (err) {
        console.error('Fatal execution error:', err.message);
        throw err;
    }

    console.log('\nShopify Competitor Repricer run completed successfully.');
    await Actor.exit();
}

main().catch(async (error) => {
    console.error('Fatal actor exception:', error);
    await Actor.fail(error.message);
});
