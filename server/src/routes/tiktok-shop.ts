import express, { Request, Response } from 'express';

const router = express.Router();

const renderCallbackPage = (res: Response, status: number, title: string, message: string) => {
  res.status(status).type('html').send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title} | BT Music Drive</title>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <p>${message}</p>
    </main>
  </body>
</html>`);
};

// Registered only with TikTok Shop Partner Center. Keep this separate from the
// TikTok for Business / Marketing API callback because their OAuth credentials
// and token lifecycles are different.
router.get('/callback', (req: Request, res: Response) => {
  const providerError = typeof req.query.error === 'string' ? req.query.error : '';
  const authorizationCode = typeof req.query.auth_code === 'string' ? req.query.auth_code : '';

  // Authorization codes are short-lived credentials: never log or render them.
  if (providerError) {
    renderCallbackPage(
      res,
      400,
      'TikTok Shop authorization was not completed',
      'Return to TikTok Shop Partner Center and try the authorization again.',
    );
    return;
  }

  if (!authorizationCode) {
    renderCallbackPage(
      res,
      200,
      'TikTok Shop callback is ready',
      'This endpoint is ready to receive an authorization response from TikTok Shop.',
    );
    return;
  }

  renderCallbackPage(
    res,
    200,
    'TikTok Shop authorization received',
    'The authorization response was received securely. Configure the TikTok Shop app credentials and secure token storage before making API requests.',
  );
});

export default router;
