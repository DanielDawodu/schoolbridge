# SchoolBridge Deployment

## Required Environment Variables

Set these in Vercel project settings:

- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Secret key for JWT token signing (generate a random 64-byte hex value)
- `PORT` - Port number (default: 5000, can be omitted for serverless)
- `ENABLE_MIGRATIONS` - Set to "true" to enable migration routes (default: disabled in production)

## Vercel Project Settings

- **Framework Preset**: Other
- **Root Directory**: `./`
- **Build Command**: `cd frontend && npm run build`
- **Output Directory**: `frontend/dist`
- **Install Command**: `cd backend && npm install && cd ../frontend && npm install`
- **Environment Variables**: Set as listed above
- **Function maxDuration**: 60 seconds (configured in vercel.json)

## Routes

- API routes: `/api/*` → handled by serverless function
- Client routes: `/*` → served as SPA (fallback to index.html)
- Health check: `/api/health` → returns `{"ok": true}`
- Database health: `/api/health/db` → returns `{"ok": true/false}`

## Notes

- Migration routes (`/api/migration`, `/api/migrations`) are disabled in production unless `ENABLE_MIGRATIONS=true`
- File uploads use memory storage (Multer) - max 1MB per file
- Request body limit: 1MB
- Database connection is cached for warm invocations
