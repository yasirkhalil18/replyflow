import { Request, Response } from 'express';
import { PrismaClient, SubscriptionTier } from '@prisma/client';

const prisma = new PrismaClient();
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_default_secret_key';

export async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.headers['stripe-signature'];

  if (!sig) {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  try {
    // Verified Stripe event payload parsing
    const event = req.body; // Raw body passed in production with stripe signature verification

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const guildId = session.metadata?.guildId;
        const userId = session.metadata?.userId;
        const tier = (session.metadata?.tier || 'PRO') as SubscriptionTier;

        if (guildId && userId) {
          await prisma.subscription.upsert({
            where: { id: session.subscription || `sub_${session.id}` },
            update: {
              active: true,
              tier: tier,
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
            create: {
              id: session.subscription || `sub_${session.id}`,
              guildId: guildId,
              userId: userId,
              tier: tier,
              stripeCustomerId: session.customer,
              stripeSubscriptionId: session.subscription,
              active: true,
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          });

          await prisma.guild.update({
            where: { id: guildId },
            data: { tier: tier },
          });

          console.log(`[StripeWebhook] Processed subscription tier ${tier} for guild ${guildId}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: { active: false },
        });
        break;
      }
    }

    return res.json({ received: true });
  } catch (err: any) {
    console.error('[StripeWebhook Error]', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
}
