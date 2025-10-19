# OpenAI API Key Setup

## Quick Start (5 minutes)

### Step 1: Get Your OpenAI API Key

1. Go to **https://platform.openai.com/api-keys**
2. Sign in with your OpenAI account (or create one)
3. Click **"Create new secret key"**
4. Give it a name like "CWIC Platform"
5. Copy the key (it starts with `sk-...`)
   - ⚠️ **IMPORTANT**: Save it immediately - you won't be able to see it again!

### Step 2: Add the Key to Your Project

1. Open the file: **`.env`** (in the root of your project)
2. Find this line:
   ```
   OPENAI_API_KEY=your-openai-api-key-here
   ```
3. Replace `your-openai-api-key-here` with your actual key:
   ```
   OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxx
   ```
4. Save the file

### Step 3: Restart the AI Service

Run this command in your terminal:

```bash
docker-compose restart ai-service
```

Wait about 10 seconds for the service to restart.

### Step 4: Test It!

Try asking the AI a question:

```bash
curl -X POST http://localhost:3000/api/ai/discovery/enhanced-query \
  -H "Content-Type: application/json" \
  -d '{"query": "What tables do we have in the database?"}'
```

You should now get intelligent AI responses instead of generic messages!

---

## What This Enables

With the OpenAI API key configured, your AI Assistant can:

✅ **Smart Natural Language Queries**
- "Show me all tables related to customers"
- "What data quality issues do we have?"
- "Which tables contain financial information?"

✅ **Intelligent SQL Generation**
- Converts questions into optimized SQL queries
- Explains what the queries do
- Suggests improvements

✅ **Data Quality Insights**
- Analyzes data patterns
- Identifies potential issues
- Recommends quality rules

✅ **Field Classification**
- Detects PII (Personal Identifiable Information)
- Identifies sensitive data
- Suggests data governance policies

✅ **Documentation Generation**
- Auto-generates table descriptions
- Creates field documentation
- Suggests metadata improvements

---

## Pricing Info

OpenAI charges based on usage:
- **GPT-4 Turbo**: ~$0.01 per 1K tokens (recommended for best quality)
- **GPT-3.5 Turbo**: ~$0.002 per 1K tokens (faster, cheaper)

**Typical costs for this platform:**
- Simple query: ~$0.001 - $0.01
- Complex analysis: ~$0.01 - $0.05
- Daily usage (moderate): ~$1-5/day

💡 **Tip**: Start with GPT-3.5-Turbo for testing, upgrade to GPT-4 for production.

---

## Troubleshooting

### "Invalid API key" error
- Make sure you copied the entire key (starts with `sk-`)
- Check for extra spaces before/after the key in `.env`
- Verify your OpenAI account has billing enabled

### "Insufficient quota" error
- Add billing information to your OpenAI account
- Check your usage limits at https://platform.openai.com/usage

### AI still giving generic responses
- Restart the AI service: `docker-compose restart ai-service`
- Check the logs: `docker logs cwic-platform-ai-service-1`
- Verify the key is in `.env` file correctly

---

## Security Notes

⚠️ **IMPORTANT**:
- Never commit your `.env` file to Git (it's in `.gitignore`)
- Don't share your API key publicly
- Rotate your key periodically for security
- Monitor your OpenAI usage dashboard

---

## Need Help?

If you run into issues:
1. Check the AI service logs: `docker logs cwic-platform-ai-service-1 --tail 50`
2. Verify the key is loaded: Look for "OPENAI_API_KEY" in the logs
3. Test directly with curl (command shown in Step 4)

The platform works without OpenAI (basic keyword matching), but you'll get much better results with it!
