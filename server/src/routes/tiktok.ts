import express, { Request, Response } from 'express';

const router = express.Router();

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const renderCallbackPage = (res: Response, status: number, title: string, message: string) => {
  res.status(status).type('html').send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)} | BT Music Drive</title>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
    </main>
  </body>
</html>`);
};

// This URL is registered in TikTok for Business as the advertiser redirect URL.
// Do not log or render auth_code values: they are short-lived OAuth credentials.
router.get('/callback', (req: Request, res: Response) => {
  const providerError = typeof req.query.error === 'string' ? req.query.error : '';
  const authCode = typeof req.query.auth_code === 'string' ? req.query.auth_code : '';

  if (providerError) {
    renderCallbackPage(
      res,
      400,
      'TikTok authorization was not completed',
      'Return to TikTok for Business and try the authorization again.',
    );
    return;
  }

  if (!authCode) {
    renderCallbackPage(
      res,
      200,
      'TikTok callback is ready',
      'This secure endpoint is ready to receive the authorization response from TikTok for Business.',
    );
    return;
  }

  renderCallbackPage(
    res,
    200,
    'TikTok authorization received',
    'The authorization response was received securely. Configure the TikTok app credentials and token storage before enabling API requests.',
  );
});

export default router;
