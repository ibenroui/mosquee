const Stripe = require('stripe');

const EXCLUDE_DESCRIPTIONS = [];

exports.handler = async (event, context) => {
    try {
        const stripeSecret = process.env.STRIPE_SECRET_KEY;
        if (!stripeSecret) {
            throw new Error("Missing STRIPE_SECRET_KEY environment variable");
        }
        const secretKey = stripeSecret.trim();
        const stripe = Stripe(secretKey);

        const startDateString = process.env.STRIPE_START_DATE || "2026-02-17";
        const startDate = Math.floor(new Date(startDateString).getTime() / 1000);
        const TARGET_AMOUNT = parseInt(process.env.OBJECTIF_MONTANT || "250000", 10);

        let totalAmountCents = 0;
        let hasMore = true;
        let startingAfter = undefined;
        let chargeCount = 0;

        console.log(`Récupération de TOUTES les charges réussies depuis ${startDateString}...`);

        while (hasMore) {
            const params = {
                limit: 100,
                created: { gte: startDate },
            };

            if (startingAfter) {
                params.starting_after = startingAfter;
            }

            const charges = await stripe.charges.list(params);

            for (const charge of charges.data) {
                if (charge.status !== 'succeeded' || charge.refunded) continue;

                // Exclure si la description correspond à une entrée blacklistée
                const desc = charge.description ?? '';
                const excluded = EXCLUDE_DESCRIPTIONS.some(ex => desc.includes(ex));
                if (excluded) continue;

                totalAmountCents += charge.amount;
                chargeCount++;
                console.log(`  ✅ ${charge.amount / 100} € — ${desc || 'sans description'}`);
            }

            hasMore = charges.has_more;
            if (charges.data.length > 0) {
                startingAfter = charges.data[charges.data.length - 1]?.id;
            } else {
                break;
            }
        }

        // On récupère les dons externes depuis le fichier JSON injecté au build (ou env vars en fallback)
        let EXTERNAL_DONATIONS = 0;
        try {
            const extConfig = require('./external-donations.json');
            EXTERNAL_DONATIONS = parseInt(extConfig.amount || "0", 10);
        } catch (err) {
            EXTERNAL_DONATIONS = parseInt(process.env.EXTERNAL_DONATIONS || "0", 10);
        }

        // On calcul le total Stripe + Externe
        const stripeCollectedAmount = totalAmountCents / 100;
        const collectedAmount = stripeCollectedAmount + EXTERNAL_DONATIONS;
        const percentage = Math.min(100, Math.round((collectedAmount / TARGET_AMOUNT) * 100));

        console.log(`\n${chargeCount} charges Stripe, Stripe: ${stripeCollectedAmount} €, Externe: ${EXTERNAL_DONATIONS} €, Total: ${collectedAmount} €`);

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=300", // Cache for 5 mins for better reactivity
                "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({
                collected: collectedAmount,
                target: TARGET_AMOUNT,
                percentage: percentage,
                count: chargeCount
            })
        };
    } catch (error) {
        console.error("Erreur lors de la récupération des charges Stripe.", error);
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                error: "Erreur lors de la récupération des dons.",
                details: error.message,
                type: error.type
            })
        };
    }
};
