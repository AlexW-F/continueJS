# 🚀 Deployment Checklist for Continue.js

## Pre-Deployment Requirements

### ✅ Code & Configuration

#### 1. Environment Variables
- [ ] **Remove Railway API rewrites** from `vercel.json` (currently pointing to old backend)
- [ ] **Set up Vercel Environment Variables**:
  ```
  NEXT_PUBLIC_FIREBASE_API_KEY=...
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
  NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
  NEXT_PUBLIC_FIREBASE_APP_ID=...
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=...
  NEXT_PUBLIC_TMDB_API_KEY=...
  NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY=...
  FIREBASE_ADMIN_PROJECT_ID=...
  FIREBASE_ADMIN_CLIENT_EMAIL=...
  FIREBASE_ADMIN_PRIVATE_KEY=...
  ALLOWED_ORIGINS=https://your-app.vercel.app,https://www.your-app.vercel.app
  ```

#### 2. External API Configuration
- [ ] **TMDB API Key** - Add HTTP Referer Restrictions
  - Go to: https://www.themoviedb.org/settings/api
  - Add: `https://your-app.vercel.app/*`
  - Add: `https://*.vercel.app/*` (for preview deployments)
  
- [ ] **Google Books API Key** - Add HTTP Referer Restrictions
  - Go to: https://console.cloud.google.com/apis/credentials
  - Application restrictions → HTTP referrers
  - Add: `your-app.vercel.app/*`
  - Add: `*.vercel.app/*` (for preview deployments)

#### 3. Firebase Configuration
- [ ] **Firestore Rules** - Already secure ✅
  - Users can only access their own data
  - Authentication required
  
- [ ] **Firebase Authentication** - Configure authorized domains
  - Go to: Firebase Console → Authentication → Settings → Authorized domains
  - Add: `your-app.vercel.app`
  - Add: `*.vercel.app` (for preview deployments)
  
- [ ] **Firebase Admin SDK** - Verify service account has permissions
  - Should have Firestore read/write access
  - Check in Firebase Console → Project Settings → Service Accounts

#### 4. Fix `vercel.json` Configuration
Currently has Railway API rewrites that need to be removed:

```json
{
  "functions": {
    "app/**/*.tsx": {
      "maxDuration": 30
    }
  }
}
```

Remove the `env` and `rewrites` sections - they're pointing to old Railway backend.

---

## Deployment Steps

### Option A: Deploy to Vercel (Recommended)

#### 1. Connect Repository
```bash
# Install Vercel CLI (if not already)
npm i -g vercel

# Login to Vercel
vercel login

# Link project (from project root)
vercel link
```

#### 2. Configure Environment Variables
```bash
# Add all environment variables (do this in Vercel Dashboard for security)
# Settings → Environment Variables → Add each variable
```

#### 3. Deploy
```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### Option B: Deploy via Vercel Dashboard

1. Go to https://vercel.com/new
2. Import Git Repository
3. Select your GitHub/GitLab repo
4. Configure:
   - Framework Preset: Next.js
   - Build Command: `next build` (default)
   - Output Directory: `.next` (default)
5. Add all environment variables
6. Click "Deploy"

---

## Post-Deployment Tasks

### 1. Update Domain Configuration
- [ ] **Add custom domain** (optional)
  - Vercel Dashboard → Project → Settings → Domains
  - Add domain and configure DNS
  
- [ ] **Update `ALLOWED_ORIGINS`** with production domain
  ```
  ALLOWED_ORIGINS=https://your-production-domain.com
  ```

### 2. Test Critical Paths
- [ ] **Authentication Flow**
  - Sign in with Google
  - Sign out
  - Session persistence
  
- [ ] **Media Management**
  - Add media (search)
  - Add media (manual)
  - Edit media
  - Delete media
  - Mark as completed
  
- [ ] **Search Functionality**
  - Search anime (Jikan API)
  - Search manga (Jikan API)
  - Search TV shows (TMDB API)
  - Search books (Google Books API)
  
- [ ] **Drag & Drop**
  - Move cards between columns
  - Data persists after move
  
- [ ] **Season Tracking**
  - Add TV show with multiple seasons
  - Navigate between seasons
  - Progress calculation accurate

### 3. Monitor & Optimize
- [ ] **Check Vercel Analytics**
  - Page load times
  - Core Web Vitals
  - Error rates
  
- [ ] **Monitor API Usage**
  - TMDB API calls (limit: 40 req/10sec)
  - Google Books API calls (limit: 1000 req/day)
  - Jikan API calls (rate limit varies)
  
- [ ] **Check Rate Limiting**
  - Test with multiple requests
  - Verify 429 responses work
  - Check rate limit headers

### 4. Security Verification
- [ ] **Domain allowlist working**
  - Requests from other domains blocked (403)
  - Requests from your domain work
  
- [ ] **API keys protected**
  - Test TMDB key from different domain (should fail)
  - Test Google Books key from different domain (should fail)
  
- [ ] **Firebase rules enforced**
  - Users can't access other users' data
  - Unauthenticated users can't access any data
  
- [ ] **Rate limiting active**
  - Test exceeding limits (should get 429)
  - Check retry-after headers

---

## Performance Optimization (Optional but Recommended)

### 1. Image Optimization
- [ ] Configure Next.js Image domains in `next.config.ts`:
```typescript
images: {
  domains: ['image.tmdb.org', 'books.google.com', 'cdn.myanimelist.net'],
  formats: ['image/avif', 'image/webp'],
}
```

### 2. Caching Strategy
- [ ] Consider adding SWR revalidation times
- [ ] Add stale-while-revalidate headers for API routes
- [ ] Enable Vercel Edge Caching where appropriate

### 3. Bundle Size
```bash
# Analyze bundle size
npm run build
# Check output for large dependencies
```

### 4. Database Optimization
- [ ] **Firestore Indexes** - Already configured ✅
  - Check `firestore.indexes.json` is deployed
  - Monitor query performance in Firebase Console
  
- [ ] **Consider composite indexes** if queries are slow
  - Firebase will suggest these in console

---

## Known Issues & Limitations

### Current Setup
✅ **Ready for deployment** with these notes:

1. **Rate Limiting**
   - In-memory (resets on server restart)
   - Good for small-scale usage (<100 users)
   - Upgrade to Vercel KV/Redis for production scale

2. **External API Limits**
   - TMDB: 40 requests per 10 seconds
   - Google Books: 1000 requests per day
   - Jikan: Variable rate limits (community API)
   - Monitor usage and implement caching if needed

3. **Firestore Costs**
   - Free tier: 50k reads, 20k writes, 20k deletes per day
   - Monitor usage in Firebase Console
   - Optimize queries if approaching limits

4. **Vercel Limits (Free/Hobby)**
   - 100GB bandwidth per month
   - 100 deployments per day
   - Serverless function timeout: 10 seconds (or 30s with config)
   - Upgrade to Pro if needed

### Recommended Upgrades for Production

**High Priority:**
- [ ] Add error monitoring (Sentry, LogRocket)
- [ ] Add analytics (Vercel Analytics, Google Analytics)
- [ ] Add loading states for all async operations
- [ ] Add offline support / service worker

**Medium Priority:**
- [ ] Implement persistent rate limiting (Vercel KV)
- [ ] Add request caching for external APIs
- [ ] Add retry logic with exponential backoff
- [ ] Implement optimistic UI updates

**Low Priority:**
- [ ] Add PWA manifest
- [ ] Add dark mode toggle in settings
- [ ] Add export/backup functionality
- [ ] Add data migration tools

---

## Rollback Plan

If something goes wrong:

1. **Revert to previous deployment**
   ```bash
   vercel rollback
   ```

2. **Check Vercel deployment logs**
   - Dashboard → Deployments → Click deployment → Runtime Logs
   
3. **Check Firebase logs**
   - Firebase Console → Functions (if using) → Logs
   - Firestore → Usage tab
   
4. **Common issues:**
   - Environment variables not set → Add in Vercel Dashboard
   - API keys blocked → Check referer restrictions
   - Firestore rules blocking → Check Firebase Console → Rules
   - Rate limiting too strict → Adjust `RATE_LIMITS` in `api-security.ts`

---

## Quick Deployment Commands

```bash
# 1. Fix vercel.json
# Remove env and rewrites sections

# 2. Test build locally
npm run build
npm run start

# 3. Deploy preview
vercel

# 4. Test preview deployment
# (Vercel will give you a URL)

# 5. Deploy production
vercel --prod

# 6. Monitor
vercel logs --follow
```

---

## Checklist Summary

**Before Deployment:**
- [ ] Fix `vercel.json` (remove Railway config)
- [ ] Set up all environment variables in Vercel
- [ ] Configure TMDB HTTP referer restrictions
- [ ] Configure Google Books HTTP referer restrictions  
- [ ] Add authorized domains in Firebase Auth
- [ ] Test local build (`npm run build`)

**After Deployment:**
- [ ] Update `ALLOWED_ORIGINS` with production URL
- [ ] Test all features in production
- [ ] Verify security (domain allowlist, rate limiting)
- [ ] Monitor API usage and errors
- [ ] Set up analytics/monitoring

**Optional Enhancements:**
- [ ] Add custom domain
- [ ] Set up CI/CD pipeline
- [ ] Add error monitoring (Sentry)
- [ ] Implement persistent rate limiting (Vercel KV)
- [ ] Add automated testing

---

## Support & Resources

- **Next.js Deployment**: https://nextjs.org/docs/deployment
- **Vercel Documentation**: https://vercel.com/docs
- **Firebase Documentation**: https://firebase.google.com/docs
- **TMDB API Docs**: https://developers.themoviedb.org/3
- **Google Books API**: https://developers.google.com/books

**Need help?** Check the logs first:
- Vercel: Dashboard → Deployments → Runtime Logs
- Firebase: Console → Usage, Rules, Authentication
- Browser: DevTools → Console, Network tab
