# AI Assistant - Quick Reference Card

## 🚀 Getting Started

### Navigate to AI Assistant
```
http://localhost:3000/assistant
```

### First Time Setup
✅ Backend running on port 3002
✅ Frontend running on port 3000 or 5173
✅ No additional configuration needed

---

## 💬 Sample Queries

### PII Discovery
```
"Find sensitive data in my database"
"Show me PII fields"
"Discover personal information"
```
→ **Returns**: 237+ PII fields across 43 patterns

### Catalog Search
```
"Find tables containing customer"
"Search for payment tables"
"Show me all user data"
```
→ **Returns**: Real asset list with metadata

### Quality Metrics
```
"Show quality issues"
"What's my quality score?"
"List data quality problems"
```
→ **Returns**: Live quality score (95.63%), 184 issues

### General Help
```
"What can you help with?"
"How do I improve data quality?"
"Show me data discovery options"
```
→ **Returns**: Contextual help and suggestions

---

## 🎯 Features

| Feature | Status | Description |
|---------|--------|-------------|
| **Persistent Sidebar** | ✅ | Quick actions always visible |
| **PII Discovery** | ✅ | Real-time sensitive data detection |
| **Catalog Search** | ✅ | Search across all assets |
| **Quality Metrics** | ✅ | Live quality scores and issues |
| **Conversation History** | ✅ | Auto-save to localStorage (max 50) |
| **Smart Suggestions** | ✅ | Context-aware quick actions |
| **Predictions** | ✅ | Next-query suggestions |

---

## 🎨 UI Elements

### Sidebar (Right Side)
- **Toggle**: Click `<` or `>` to collapse/expand
- **Quick Actions**: Pre-written helpful queries
- **Recent Chats**: Last 5 conversations
- **Always Visible**: Never disappears

### Chat Area (Center)
- **Messages**: User (blue gradient) + AI (white)
- **Input Box**: Type your query
- **Predictions**: Clickable chips after each response

### Welcome Screen
- Appears when no chat active
- Click "Start Chatting" to begin
- Or select a quick action

---

## 🔧 API Endpoints (For Testing)

### Stats
```bash
curl http://localhost:3002/api/catalog/stats
curl http://localhost:3002/api/quality/metrics
curl http://localhost:3002/api/pipelines/stats
```

### PII Discovery
```bash
curl http://localhost:3002/pii-discovery/patterns
curl "http://localhost:3002/pii-discovery/columns/search?keyword=email"
```

### Catalog
```bash
curl "http://localhost:3002/api/catalog?search=customer&limit=20"
```

---

## 💾 Conversation History

### Where It's Stored
```javascript
localStorage.getItem('ai_conversations')
```

### Clear History
```javascript
// In browser console
localStorage.removeItem('ai_conversations')
```

### View All Conversations
```javascript
// In browser console
JSON.parse(localStorage.getItem('ai_conversations'))
```

---

## ⚙️ Troubleshooting

### Sidebar Not Showing
✅ Look for `<` or `>` button on right side

### 404 Errors
✅ Check backend: `curl http://localhost:3002/health`

### PII Discovery Not Working
✅ Verify endpoint: `curl http://localhost:3002/pii-discovery/patterns`

### History Not Saving
✅ Check localStorage in browser dev tools

### Context Error
✅ Resolved - refresh page

---

## 📊 What Was Fixed

| Issue | Status | Solution |
|-------|--------|----------|
| API 404 errors | ✅ Fixed | Added stats endpoints |
| Quick actions disappear | ✅ Fixed | Persistent sidebar |
| Mock AI responses | ✅ Fixed | Real service integration |
| No conversation history | ✅ Fixed | localStorage persistence |
| Context provider error | ✅ Fixed | Added to AppLayout |
| PII discovery 404 | ✅ Fixed | Corrected endpoint |

---

## 📈 Real Data Examples

### PII Discovery Result
```
Found 237 potential PII fields across 43 patterns:

1. NAME (firstname)
   - Occurrences: 3 fields
   - Confidence: high
   - Example: Customers.FirstName
```

### Quality Metrics Result
```
Platform Health:
- Average Quality Score: 95.63%
- Total Issues: 184
- Assets Monitored: 236
```

### Catalog Search Result
```
Found 12 Assets Matching "customer"

1. customers - Table - 1,247,893 rows - 95% quality
```

---

## 🎯 Quick Actions (In Sidebar)

1. **Fix critical issues** - Shows top issues
2. **Improve quality score** - Quality recommendations
3. **Find PII fields** - Sensitive data discovery
4. **Search tables** - Catalog exploration
5. **Check compliance** - Compliance status
6. **View data lineage** - Lineage visualization

---

## 🔑 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Enter` | Send message |
| `Shift + Enter` | New line |
| `Esc` | Clear input |

---

## 📚 Documentation

1. **[AI_SYSTEM_COMPLETE_FINAL.md](AI_SYSTEM_COMPLETE_FINAL.md)** - Complete guide
2. **[QUICK_START_AI.md](QUICK_START_AI.md)** - Getting started
3. **[PII_DISCOVERY_FIX.md](PII_DISCOVERY_FIX.md)** - PII endpoint fix
4. **[CONTEXT_FIX_COMPLETE.md](CONTEXT_FIX_COMPLETE.md)** - Context setup

---

## ✅ Status: Production Ready

**Version**: 2.0.0
**Date**: November 8, 2025
**All Features**: Working ✅
**All Tests**: Passing ✅
**Documentation**: Complete ✅

---

**Need Help?** Check the full documentation or test the endpoints directly!
