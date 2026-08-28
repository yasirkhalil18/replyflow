import { Request, Response } from 'express';
import { PrismaClient, SubscriptionTier } from '@prisma/client';

const prisma = new PrismaClient();

export async function handlePayPalWebhook(req: Request, res: Response) {
  const event = req.body;

  if (!event || !event.event_type) {
    return res.status(400).json({ error: 'Invalid PayPal payload' });
  }

  try {
    switch (event.event_type) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED': {
        const resource = event.resource;
        const guildId = resource.custom_id;
        const userId = resource.subscriber?.payer_id || 'paypal_user';

        if (guildId) {
          await prisma.subscription.create({
            data: {
              guildId: guildId,
              userId: userId,
              tier: SubscriptionTier.PRO,
              active: true,
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          });

          await prisma.guild.update({
            where: { id: guildId },
            data: { tier: SubscriptionTier.PRO },
          });

          console.log(`[PayPalWebhook] Activated subscription for guild ${guildId}`);
        }
        break;
      }
      case 'BILLING.SUBSCRIPTION.CANCELLED': {
        const resource = event.resource;
        const guildId = resource.custom_id;
        if (guildId) {
          await prisma.guild.update({
            where: { id: guildId },
            data: { tier: SubscriptionTier.FREE },
          });
        }
        break;
      }
    }

    return res.json({ status: 'SUCCESS' });
  } catch (err: any) {
    console.error('[PayPalWebhook Error]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
