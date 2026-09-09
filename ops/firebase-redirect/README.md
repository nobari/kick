# Legacy-domain redirect

This Firebase Hosting configuration permanently redirects requests for the legacy
`sadeandmoji.com` site to the canonical Vercel deployment at
`https://kick.bozmoz.com`.

Deploy it from this directory with:

```sh
pnpm dlx firebase-tools deploy --only hosting --project slack-manage
```
