# 🎮 Tode the Frog — Shared Leaderboard Setup

## Overview

The leaderboard now uses **JSONBin.io** — a free cloud JSON storage service. No database, no backend server needed. Any device/browser can read and write scores in real-time.

## How It Works

1. **Read**: When the game loads, it fetches the leaderboard from JSONBin.io cloud
2. **Write**: When a player submits a score, it updates the cloud leaderboard
3. **Fallback**: If the network is unavailable, it automatically falls back to localStorage

## Setup Instructions (5 minutes)

### Step 1: Create a Free Account

1. Go to [https://jsonbin.io](https://jsonbin.io)
2. Click **"Create Account"** (you can use Google login)
3. Verify your email

### Step 2: Get Your API Key

1. Log in to your JSONBin.io dashboard
2. Go to **"API Keys"** page
3. Copy your **Master Key** (it looks like: `$2b$10$...`)

### Step 3: Create a New Bin

1. Go to **"Bins"** section
2. Click **"Create a Bin"**
3. Paste this JSON as the initial data:
   ```json
   {
     "leaderboard": []
   }
   ```
4. Click **"Save Bin"**
5. Copy the **Bin ID** from the URL (e.g., `6360e54a65b57a31e6a94a42`)

### Step 4: Configure the Game

1. Open `game/src/components/Leaderboard.js`
2. Replace these two values:
   ```javascript
   const JSONBIN_API_KEY = 'YOUR_JSONBIN_MASTER_KEY_HERE';
   const JSONBIN_BIN_ID = 'YOUR_JSONBIN_BIN_ID_HERE';
   ```
   With your actual values:
   ```javascript
   const JSONBIN_API_KEY = '$2b$10$your_actual_key_here';
   const JSONBIN_BIN_ID = '6360e54a65b57a31e6a94a42';
   ```

### Step 5: Test It

1. Run the game: `npm run dev`
2. Play a game and submit a score
3. Open the game from another device/browser
4. Check if the leaderboard shows the score from the first device

## Free Tier Limits

- **10,000 API requests per month** (plenty for a game)
- **1MB per bin** (leaderboard data is tiny)
- **10 bins per account**
- **Public read access** (anyone can read, only you can write with API key)

## Security Note

The API key is exposed in the frontend code. This is acceptable for this use case because:
- JSONBin.io free tier doesn't support server-side rendering
- The key only allows read/write to your specific bin
- Leaderboard data is public anyway

For production apps with sensitive data, use a backend proxy.

## Troubleshooting

### Leaderboard not updating?
- Check browser console for errors
- Verify API key and bin ID are correct
- Check if you've exceeded the 10,000 request limit

### Game not working offline?
- The game automatically falls back to localStorage
- Scores submitted offline will sync next time you're online

### CORS errors?
- JSONBin.io has CORS enabled by default
- Make sure you're using `https://api.jsonbin.io/v3` as the base URL
