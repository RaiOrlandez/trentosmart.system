---
description: Deploy system changes to Railway live environment
---

# Deploy to Live (Railway)

This workflow guides you through deploying your Transmart system changes to the live Railway environment.

## Prerequisites
- Your Railway project is already connected to GitHub repository `RaiOrlandez/trentosmart.system`
- Railway auto-deploys on push to `main` branch

## Deployment Steps

1. **Review your changes**
   ```bash
   git status
   git diff
   ```

2. **Stage and commit your changes**
   ```bash
   git add .
   git commit -m "Describe your changes"
   ```

3. **Push to GitHub**
   ```bash
   git push origin main
   ```

4. **Monitor Railway deployment**
   - Go to your Railway dashboard
   - Watch the build logs for your backend service
   - Railway will automatically deploy when it detects the push

5. **Verify deployment**
   - Check your Railway backend URL is accessible
   - Test the frontend (if also deployed on Vercel, it will need a redeploy if backend URL changed)

## Important Notes

- **Backend (Railway)**: Auto-deploys from `server/` directory using `Procfile`
- **Frontend (Vercel)**: If you need to redeploy frontend, go to Vercel dashboard and trigger redeploy
- **Environment Variables**: Ensure Railway has the correct env vars (DATABASE_URL, DJANGO_SECRET_KEY, etc.)
- **Database Migrations**: The `Procfile` runs migrations automatically on deploy

## Troubleshooting

- If deployment fails, check Railway build logs
- Common issues: missing dependencies, database connection errors, migration failures
- For database issues, check Railway PostgreSQL service is running
