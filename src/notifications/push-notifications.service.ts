import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, readFileSync } from 'fs';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

@Injectable()
export class PushNotificationsService implements OnModuleInit {
  private readonly logger = new Logger(PushNotificationsService.name);
  private enabled = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    if (getApps().length > 0) {
      this.enabled = true;
      return;
    }

    const inlineJson = this.config.get<string>('firebase.serviceAccountJson');
    const filePath = this.config.get<string>('firebase.serviceAccountPath');

    let raw: string | null = null;
    if (inlineJson) {
      raw = inlineJson;
    } else if (filePath && existsSync(filePath)) {
      raw = readFileSync(filePath, 'utf-8');
    }

    if (!raw) {
      this.logger.warn(
        'Firebase credentials not configured — push notifications are disabled. ' +
          'Dispatch will still work over Socket.IO for foregrounded/connected apps.',
      );
      return;
    }

    try {
      const serviceAccount = JSON.parse(raw);
      initializeApp({ credential: cert(serviceAccount) });
      this.enabled = true;
      this.logger.log('Firebase Admin initialized — push notifications enabled.');
    } catch (err) {
      this.logger.error(
        `Failed to initialize Firebase Admin, push notifications disabled: ${(err as Error).message}`,
      );
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async sendToToken(
    token: string | null | undefined,
    notification: { title: string; body: string },
    data: Record<string, string> = {},
  ): Promise<void> {
    if (!this.enabled || !token) return;
    try {
      await getMessaging().send({
        token,
        notification,
        data,
        android: { priority: 'high', notification: { channelId: 'jobs', sound: 'default' } },
        apns: { payload: { aps: { sound: 'default' } } },
      });
    } catch (err) {
      this.logger.warn(`Failed to send push notification: ${(err as Error).message}`);
    }
  }
}
