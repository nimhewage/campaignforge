# Real-Time Trends Data Setup

CampaignForge uses **SerpApi** to fetch real-time Google Trends data, giving you access to:
- Live search interest trends
- Rising queries and breakout keywords
- Geographic distribution of searches
- Related search terms with actual search volumes

## Getting Your Free SerpApi Key

1. **Sign up at [serpapi.com](https://serpapi.com/users/sign_up)**
   - Free tier includes **100 searches per month**
   - No credit card required

2. **Get your API key**
   - After signing up, go to your [Dashboard](https://serpapi.com/manage-api-key)
   - Copy your API key

3. **Add to your environment variables**
   - Open `.env.local` in your project root
   - Add this line:
     ```
     SERPAPI_KEY=your_api_key_here
     ```

4. **Restart your dev server**
   ```bash
   npm run dev
   ```

## What You Get

### With SerpApi Key (Real Data)
- ✅ Real-time Google Trends data
- ✅ Actual search volumes and percentages
- ✅ Rising queries with growth metrics
- ✅ Geographic breakdown by region
- ✅ Related search terms from Google
- ✅ Data citations and sources

### Without SerpApi Key (Fallback)
- ⚠️ Simulated trend data for demo purposes
- ⚠️ Generic keyword suggestions
- ⚠️ Estimated percentages
- ⚠️ No real-time updates

## API Usage

Each campaign generation uses approximately **3-4 API calls**:
- 1 call for interest over time
- 1 call for related queries
- 1 call for geographic data

With the free tier (100 searches/month), you can generate **~25-30 campaigns per month** with real trends data.

## Upgrade Options

If you need more searches:
- **Starter**: $25/month - 1,000 searches
- **Developer**: $75/month - 5,000 searches
- **Production**: $150/month - 15,000 searches

See full pricing at [serpapi.com/pricing](https://serpapi.com/pricing)

## Alternative APIs

If you prefer other providers, you can modify `/src/app/api/trends/route.ts` to use:
- **DataForSEO** - $0.001 per keyword (very affordable for high volume)
- **Google Trends API** (official) - Requires Google Cloud setup
- **SearchApi.io** - 100 free requests, similar to SerpApi

## Vercel Deployment

When deploying to Vercel:
1. Go to your project settings
2. Navigate to Environment Variables
3. Add `SERPAPI_KEY` with your API key
4. Redeploy your application

The trends feature will automatically work in production!
