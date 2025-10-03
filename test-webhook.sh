#!/bin/bash

# Test script for JS Live Event Timeline webhook
# Usage: ./test-webhook.sh

# Load environment variables
source .env

SUPABASE_URL="${VITE_SUPABASE_URL}"
ANON_KEY="${VITE_SUPABASE_ANON_KEY}"

echo "🧪 Testing JS Live Event Timeline Webhook"
echo "=========================================="
echo ""

# Test 1: Seed Templates
echo "📦 Step 1: Seeding templates..."
SEED_RESPONSE=$(curl -s -X POST \
  "${SUPABASE_URL}/functions/v1/templates-seed" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d @seed-templates.json)

echo "Response: $SEED_RESPONSE"
echo ""

# Test 2: Create Wedding Timeline
echo "💒 Step 2: Creating wedding timeline..."
WEDDING_RESPONSE=$(curl -s -X POST \
  "${SUPABASE_URL}/functions/v1/timelines-create" \
  -H "Content-Type: application/json" \
  -d '{
    "event": {
      "code": "JS1234",
      "title": "Sarah & David'\''s Wedding",
      "date": "2025-06-15",
      "venue": "Grand Hotel Ballroom",
      "type": "wedding"
    }
  }')

echo "Response: $WEDDING_RESPONSE"
TIMELINE_ID=$(echo $WEDDING_RESPONSE | grep -o '"timelineId":"[^"]*' | cut -d'"' -f4)
SHARE_URL=$(echo $WEDDING_RESPONSE | grep -o '"shareUrl":"[^"]*' | cut -d'"' -f4)
echo ""

# Test 3: Create Bar Mitzvah Timeline
echo "🕍 Step 3: Creating Bar Mitzvah timeline..."
BAR_MITZVAH_RESPONSE=$(curl -s -X POST \
  "${SUPABASE_URL}/functions/v1/timelines-create" \
  -H "Content-Type: application/json" \
  -d '{
    "event": {
      "code": "JS5678",
      "title": "Jacob'\''s Bar Mitzvah",
      "date": "2025-08-22",
      "venue": "Temple Beth Shalom",
      "type": "bar_mitzvah"
    }
  }')

echo "Response: $BAR_MITZVAH_RESPONSE"
echo ""

echo "✅ Test Complete!"
echo "==================="
echo ""
echo "🔗 Wedding Timeline ID: $TIMELINE_ID"
echo "🔗 Client Share URL: $SHARE_URL"
echo ""
echo "Next steps:"
echo "1. Visit http://localhost:5173 to see the admin view"
echo "2. Open the client share URL to see the public view"
echo "3. Toggle some tasks and watch progress update!"
