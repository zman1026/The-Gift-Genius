import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendInviteEmailParams {
  to: string;
  familyName: string;
  inviterName: string;
  inviteCode: string;
  inviteLink: string;
}

export async function sendInviteEmail({
  to,
  familyName,
  inviterName,
  inviteCode,
  inviteLink,
}: SendInviteEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    const { data, error } = await resend.emails.send({
      from: 'The Gift Genius <onboarding@resend.dev>',
      to: [to],
      subject: `You're invited to join ${familyName} on The Gift Genius!`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .header {
                background: linear-gradient(135deg, #c73a3a 0%, #8b2525 100%);
                color: white;
                padding: 30px;
                text-align: center;
                border-radius: 8px 8px 0 0;
              }
              .content {
                background: #ffffff;
                padding: 30px;
                border: 1px solid #e5e5e5;
                border-top: none;
              }
              .invite-code {
                background: #f8f9fa;
                border: 2px solid #e5e5e5;
                border-radius: 8px;
                padding: 20px;
                text-align: center;
                margin: 20px 0;
              }
              .code {
                font-family: 'Courier New', monospace;
                font-size: 24px;
                font-weight: bold;
                color: #c73a3a;
                letter-spacing: 2px;
              }
              .button {
                display: inline-block;
                background: #c73a3a;
                color: white;
                padding: 12px 30px;
                text-decoration: none;
                border-radius: 6px;
                margin: 20px 0;
                font-weight: 600;
              }
              .footer {
                text-align: center;
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #e5e5e5;
                color: #666;
                font-size: 14px;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1 style="margin: 0; font-size: 28px;">Christmas Wishlist Invitation</h1>
            </div>
            <div class="content">
              <p><strong>${inviterName}</strong> has invited you to join <strong>${familyName}</strong> on Christmas Wishlist!</p>
              
              <p>Christmas Wishlist makes it easy to coordinate gift-giving with your family. Share your wishes, see what others want, and secretly mark gifts as purchased.</p>
              
              <div class="invite-code">
                <p style="margin: 0 0 10px 0; color: #666;">Your Invite Code:</p>
                <div class="code">${inviteCode}</div>
              </div>
              
              <p style="text-align: center;">
                <a href="${inviteLink}" class="button">Join ${familyName}</a>
              </p>
              
              <p style="font-size: 14px; color: #666;">
                Or copy and paste this link into your browser:<br>
                <a href="${inviteLink}" style="color: #c73a3a;">${inviteLink}</a>
              </p>
            </div>
            <div class="footer">
              <p>Happy holidays!</p>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('Resend API error:', error);
      return { success: false, error: error.message };
    }

    console.log('Invite email sent successfully:', data);
    return { success: true };
  } catch (error) {
    console.error('Failed to send invite email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    };
  }
}
