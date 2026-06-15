export interface NotificationPayload {
  teamId?: string;
  recipientIds?: string[];
  title: string;
  body: string;
  data?: any;
  notificationType?: string;
}

export async function triggerNotification(payload: NotificationPayload) {
  try {
    const response = await fetch('/api/send-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('[Notification] Failed to trigger notification:', errorData);
    } else {
      const data = await response.json();
      console.log('[Notification] Notification triggered successfully:', data);
    }
  } catch (error) {
    console.error('[Notification] Error triggering notification:', error);
  }
}
