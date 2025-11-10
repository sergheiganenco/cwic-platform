# AI System - Quick Start Guide

## What's New? 🎉

Your AI Assistant now has **persistent quick actions**, **real service integration**, and **conversation history**!

---

## Key Features

### 1. Persistent Sidebar ✅
- Quick actions **never disappear**
- Collapsible for more space
- Always accessible hints

### 2. Real Data Integration ✅
- **PII Discovery** - Find sensitive data
- **Catalog Search** - Search your assets
- **Quality Metrics** - Live quality scores

### 3. Conversation History ✅
- Auto-saves every chat
- Resume previous conversations
- Smart conversation titles

---

## How to Use

### Navigate to AI Assistant
```
http://localhost:5173 → AI Assistant
```

### Try These Queries

#### Find Sensitive Data
```
"Find sensitive data in my database"
"Show me PII fields"
"Discover personal information"
```
→ Real PII discovery with confidence scores

#### Search Catalog
```
"Find tables containing customer"
"Show me all payment tables"
"Search for user data"
```
→ Real catalog search results

#### Check Quality
```
"Show quality issues"
"What's my quality score?"
"List data quality problems"
```
→ Live quality metrics

---

## Quick Actions Sidebar

### Location
Right side of chat interface

### Toggle
Click **<** or **>** button to collapse/expand

### Contents
- **Quick Actions** - Pre-written helpful queries
- **Recent Chats** - Last 5 conversations
- **Context-Aware** - Changes based on current module

---

## API Endpoints (For Testing)

### Catalog Stats
```bash
curl http://localhost:3002/api/catalog/stats
```
Returns: Total assets, tables, views

### Quality Metrics
```bash
curl http://localhost:3002/api/quality/metrics
```
Returns: Quality score, active rules, issues

### Pipeline Stats
```bash
curl http://localhost:3002/api/pipelines/stats
```
Returns: Active, running, completed pipelines

---

## Conversation History

### Storage
- Saved in browser localStorage
- Max 50 conversations
- Auto-cleanup of old chats

### Access
- Click **Recent Chats** in sidebar
- Click any conversation to resume
- All context preserved

### Clear History
```javascript
// In browser console
localStorage.removeItem('ai_conversations')
```

---

## Technical Details

### Component
`frontend/src/components/ai/ImprovedChatInterface.tsx`

### Integration
Used in `frontend/src/pages/AIAssistant.tsx`

### Services Used
- `/api/quality/pii/discover` - PII detection
- `/api/catalog` - Asset search
- `/api/quality/metrics` - Quality data

---

## Troubleshooting

### Sidebar Not Showing
1. Look for **<** or **>** button on right side
2. Click to expand sidebar
3. Should see Quick Actions and Recent Chats

### Queries Not Working
1. Check backend is running: `http://localhost:3002/health`
2. Test API endpoints using curl commands above
3. Check browser console for errors

### History Not Saving
1. Check localStorage is enabled in browser
2. Look for 'ai_conversations' key in dev tools
3. Clear and restart if corrupted

---

## What Was Fixed

### Before ❌
- Quick actions disappeared when chat started
- AI showed mock data instead of real results
- No conversation history
- API 404 errors for stats endpoints

### After ✅
- Persistent sidebar with quick actions
- Real PII discovery, catalog search, quality metrics
- Conversation history with auto-save
- All API endpoints working

---

## Files Changed

### Backend
- `backend/data-service/src/services/StatsService.ts`
- `backend/data-service/src/controllers/StatsController.ts`
- `backend/data-service/src/app.ts`

### Frontend
- `frontend/src/components/ai/ImprovedChatInterface.tsx` (NEW)
- `frontend/src/pages/AIAssistant.tsx`

---

## Support

**Full Documentation:** See [AI_IMPROVEMENTS_COMPLETE.md](AI_IMPROVEMENTS_COMPLETE.md)

**Issues?** Check:
1. Backend running on port 3002
2. Frontend running on port 5173
3. Browser console for errors
4. API endpoints responding

---

**Status:** ✅ Production Ready
**Version:** 2.0.0
**Date:** November 8, 2025
