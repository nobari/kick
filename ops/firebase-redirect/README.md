# Legacy-domain redirect

This Firebase Hosting configuration keeps the expiring `sadeandmoji.com`
domain useful by permanently redirecting every request to the canonical Vercel
deployment at `https://slack-kickbot.vercel.app`.

Deploy it from this directory with:

```sh
pnpm dlx firebase-tools deploy --only hosting --project slack-manage
```
