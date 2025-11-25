import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'The Gift Genius <onboarding@resend.dev>';
const BASE_URL = process.env.PUBLIC_BASE_URL || 'https://thegiftgeniusapp.com';

const emailStyles = `
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .email-wrapper {
      max-width: 600px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    .email-container {
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
    }
    .header {
      background: linear-gradient(135deg, #DC2626 0%, #991B1B 100%);
      color: white;
      padding: 32px 40px;
      text-align: center;
    }
    .header-logo {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      margin-bottom: 16px;
    }
    .header-logo svg {
      width: 28px;
      height: 28px;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
      letter-spacing: -0.5px;
    }
    .header p {
      margin: 8px 0 0 0;
      opacity: 0.9;
      font-size: 14px;
    }
    .content {
      padding: 40px;
    }
    .greeting {
      font-size: 18px;
      font-weight: 500;
      margin-bottom: 16px;
      color: #1a1a1a;
    }
    .message {
      color: #4a4a4a;
      margin-bottom: 24px;
    }
    .highlight-box {
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 24px;
      text-align: center;
      margin: 24px 0;
    }
    .highlight-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #6b7280;
      margin-bottom: 8px;
    }
    .highlight-value {
      font-family: 'Courier New', monospace;
      font-size: 28px;
      font-weight: bold;
      color: #DC2626;
      letter-spacing: 3px;
    }
    .button-wrapper {
      text-align: center;
      margin: 32px 0;
    }
    .button {
      display: inline-block;
      background: #DC2626;
      color: white !important;
      padding: 14px 32px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      transition: background 0.2s;
    }
    .button:hover {
      background: #b91c1c;
    }
    .button-secondary {
      background: #15803D;
    }
    .button-secondary:hover {
      background: #166534;
    }
    .link-fallback {
      margin-top: 16px;
      font-size: 13px;
      color: #6b7280;
      word-break: break-all;
    }
    .link-fallback a {
      color: #DC2626;
    }
    .divider {
      height: 1px;
      background: #e5e5e5;
      margin: 32px 0;
    }
    .features {
      margin: 24px 0;
    }
    .feature {
      display: block;
      margin-bottom: 16px;
      padding-left: 32px;
      position: relative;
    }
    .feature-icon {
      position: absolute;
      left: 0;
      top: 2px;
      width: 24px;
      height: 24px;
    }
    .feature-icon svg {
      width: 20px;
      height: 20px;
      color: #15803D;
    }
    .feature-content {
      display: block;
    }
    .feature-title {
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 4px;
    }
    .feature-description {
      font-size: 14px;
      color: #6b7280;
    }
    .footer {
      background: #f9fafb;
      padding: 24px 40px;
      text-align: center;
      border-top: 1px solid #e5e5e5;
    }
    .footer-text {
      font-size: 13px;
      color: #6b7280;
      margin: 0;
    }
    .footer-brand {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      font-weight: 600;
      color: #1a1a1a;
    }
    .footer-links {
      margin-top: 16px;
    }
    .footer-links a {
      color: #6b7280;
      text-decoration: none;
      font-size: 12px;
      margin: 0 8px;
    }
    .footer-links a:hover {
      color: #DC2626;
    }
  </style>
`;

const giftIcon = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="20 12 20 22 4 22 4 12"></polyline>
    <rect x="2" y="7" width="20" height="5"></rect>
    <line x1="12" y1="22" x2="12" y2="7"></line>
    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path>
    <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path>
  </svg>
`;

const checkIcon = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#15803D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
`;

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
      from: FROM_EMAIL,
      to: [to],
      subject: `${inviterName} invited you to join ${familyName} on The Gift Genius`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            ${emailStyles}
          </head>
          <body>
            <div class="email-wrapper">
              <div class="email-container">
                <div class="header">
                  <div class="header-logo">${giftIcon}</div>
                  <h1>You're Invited!</h1>
                  <p>Join ${familyName} on The Gift Genius</p>
                </div>
                
                <div class="content">
                  <p class="greeting">Hello!</p>
                  
                  <p class="message">
                    <strong>${inviterName}</strong> has invited you to join their gift exchange group <strong>${familyName}</strong> on The Gift Genius.
                  </p>
                  
                  <p class="message">
                    The Gift Genius makes it easy to coordinate gift-giving. Share your wishes, see what others want, and secretly mark gifts as purchased.
                  </p>

                  <div class="highlight-box">
                    <div class="highlight-label">Your Invite Code</div>
                    <div class="highlight-value">${inviteCode}</div>
                  </div>
                  
                  <div class="button-wrapper">
                    <a href="${inviteLink}" class="button">Join ${familyName}</a>
                    <p class="link-fallback">
                      Or copy this link: <a href="${inviteLink}">${inviteLink}</a>
                    </p>
                  </div>

                  <div class="divider"></div>

                  <p style="font-weight: 600; margin-bottom: 16px;">What you can do:</p>
                  
                  <div class="features">
                    <div class="feature">
                      <div class="feature-icon">${checkIcon}</div>
                      <div class="feature-content">
                        <div class="feature-title">Create Your Wishlist</div>
                        <div class="feature-description">Add items you would love to receive</div>
                      </div>
                    </div>
                    <div class="feature">
                      <div class="feature-icon">${checkIcon}</div>
                      <div class="feature-content">
                        <div class="feature-title">Browse Others' Lists</div>
                        <div class="feature-description">See what your group members want</div>
                      </div>
                    </div>
                    <div class="feature">
                      <div class="feature-icon">${checkIcon}</div>
                      <div class="feature-content">
                        <div class="feature-title">Coordinate Secretly</div>
                        <div class="feature-description">Mark purchases without spoiling surprises</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div class="footer">
                  <div class="footer-brand">
                    ${giftIcon}
                    The Gift Genius
                  </div>
                  <p class="footer-text">Making gift giving magical</p>
                  <div class="footer-links">
                    <a href="${BASE_URL}">Visit Website</a>
                  </div>
                </div>
              </div>
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

interface SendWelcomeEmailParams {
  to: string;
  firstName: string;
  familyName?: string;
}

export async function sendWelcomeEmail({
  to,
  firstName,
  familyName,
}: SendWelcomeEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    const welcomeMessage = familyName 
      ? `Welcome to ${familyName}! You're all set to start coordinating gifts with your group.`
      : `Welcome to The Gift Genius! You're ready to make gift giving magical.`;

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: `Welcome to The Gift Genius${familyName ? ` - ${familyName}` : ''}!`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            ${emailStyles}
          </head>
          <body>
            <div class="email-wrapper">
              <div class="email-container">
                <div class="header">
                  <div class="header-logo">${giftIcon}</div>
                  <h1>Welcome${firstName ? `, ${firstName}` : ''}!</h1>
                  <p>${welcomeMessage}</p>
                </div>
                
                <div class="content">
                  <p class="greeting">Hey${firstName ? ` ${firstName}` : ''}!</p>
                  
                  <p class="message">
                    Thanks for joining The Gift Genius. We are excited to help you make gift giving easier and more fun for everyone.
                  </p>

                  <p style="font-weight: 600; margin-bottom: 16px;">Here's what to do next:</p>
                  
                  <div class="features">
                    <div class="feature">
                      <div class="feature-icon">${checkIcon}</div>
                      <div class="feature-content">
                        <div class="feature-title">Build Your Wishlist</div>
                        <div class="feature-description">Add items you would love to receive. Search products or add them manually.</div>
                      </div>
                    </div>
                    <div class="feature">
                      <div class="feature-icon">${checkIcon}</div>
                      <div class="feature-content">
                        <div class="feature-title">Invite Your Group</div>
                        <div class="feature-description">Share your group code with family or friends to get everyone coordinating.</div>
                      </div>
                    </div>
                    <div class="feature">
                      <div class="feature-icon">${checkIcon}</div>
                      <div class="feature-content">
                        <div class="feature-title">Browse & Coordinate</div>
                        <div class="feature-description">See what others want and secretly mark purchases.</div>
                      </div>
                    </div>
                  </div>

                  <div class="button-wrapper">
                    <a href="${BASE_URL}" class="button button-secondary">Go to My Dashboard</a>
                  </div>
                </div>
                
                <div class="footer">
                  <div class="footer-brand">
                    ${giftIcon}
                    The Gift Genius
                  </div>
                  <p class="footer-text">Making gift giving magical</p>
                  <div class="footer-links">
                    <a href="${BASE_URL}">Visit Website</a>
                  </div>
                </div>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('Resend API error:', error);
      return { success: false, error: error.message };
    }

    console.log('Welcome email sent successfully:', data);
    return { success: true };
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    };
  }
}

interface SendPurchaseReminderParams {
  to: string;
  firstName: string;
  itemName: string;
  ownerName: string;
  daysUntilChristmas: number;
}

export async function sendPurchaseReminderEmail({
  to,
  firstName,
  itemName,
  ownerName,
  daysUntilChristmas,
}: SendPurchaseReminderParams): Promise<{ success: boolean; error?: string }> {
  try {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    const urgencyMessage = daysUntilChristmas <= 7 
      ? `Only ${daysUntilChristmas} day${daysUntilChristmas === 1 ? '' : 's'} until Christmas!`
      : `${daysUntilChristmas} days until Christmas`;

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: `Reminder: Complete your purchase for ${ownerName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            ${emailStyles}
          </head>
          <body>
            <div class="email-wrapper">
              <div class="email-container">
                <div class="header">
                  <div class="header-logo">${giftIcon}</div>
                  <h1>Purchase Reminder</h1>
                  <p>${urgencyMessage}</p>
                </div>
                
                <div class="content">
                  <p class="greeting">Hi${firstName ? ` ${firstName}` : ''}!</p>
                  
                  <p class="message">
                    Just a friendly reminder that you marked <strong>"${itemName}"</strong> from <strong>${ownerName}'s</strong> wishlist as something you were planning to purchase.
                  </p>

                  <div class="highlight-box">
                    <div class="highlight-label">Time Remaining</div>
                    <div class="highlight-value" style="font-size: 20px; letter-spacing: 0;">${urgencyMessage}</div>
                  </div>

                  <p class="message">
                    If you have already purchased this gift, great! If not, now is a good time to complete your purchase to ensure it arrives in time.
                  </p>

                  <div class="button-wrapper">
                    <a href="${BASE_URL}/purchased" class="button">View My Purchases</a>
                  </div>
                </div>
                
                <div class="footer">
                  <div class="footer-brand">
                    ${giftIcon}
                    The Gift Genius
                  </div>
                  <p class="footer-text">Making gift giving magical</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('Resend API error:', error);
      return { success: false, error: error.message };
    }

    console.log('Purchase reminder email sent successfully:', data);
    return { success: true };
  } catch (error) {
    console.error('Failed to send purchase reminder email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    };
  }
}
