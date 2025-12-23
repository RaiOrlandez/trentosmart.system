# 🚀 Zero-Cost Deployment Guide

Your "Trento Smart Tricycle" system is split into two parts:
1.  **Frontend (React)**: The user interface. We will host this on **Vercel** (Best for React).
2.  **Backend (Django)**: The logic & database. We will host this on **Render** (Best for Python/WebSockets).

> **Why not Vercel for everything?**
> Vercel's "Serverless Functions" generally do not support the persistent WebSockets (Real-time tracking) that your app relies on. Render's free tier allows running a real Python server.

---

## ✅ Step 1: Pre-Deployment Check
I have already updated your code to be "Cloud Ready":
*   **Updated `requirements.txt`**: Added production libraries (`gunicorn`, `daphne`, `whitenoise`).
*   **Updated `settings.py`**: Configured to auto-detect the cloud database.
*   **Created `server/build.sh`**: A script to auto-generate the database on the cloud.

### Action Required:
1.  **Push your code to GitHub**.
    *   Create a new repository on GitHub.
    *   Push your `my-system` folder content to it.

---

## 🛠 Step 2: Deploy Backend (Render)
1.  Go to [dashboard.render.com](https://dashboard.render.com) and sign up (Free).
2.  Click **"New +"** -> **"Web Service"**.
3.  Connect your GitHub repository.
4.  **Configure the Service**:
    *   **Name**: `trento-api` (or similar).
    *   **Root Directory**: `server`
    *   **Runtime**: `Python 3`
    *   **Build Command**: `./build.sh`
    *   **Start Command**: `daphne -b 0.0.0.0 -p $PORT trike_server.asgi:application`
    *   **Instance Type**: `Free`
5.  **Environment Variables** (Scroll down to "Advanced"):
    *   `PYTHON_VERSION`: `3.9.0` (or similar)
    *   `DJANGO_SECRET_KEY`: (Generate a random string)
    *   `DJANGO_ALLOWED_HOSTS`: `*` (or your render URL)
    *   `DATABASE_URL`: **IMPORTANT**
        *   *Render creates a PostgreSQL DB for you automatically if you create a "PostgreSQL" service separately and link it. OR just use their "Internal DB" URL.*
        *   **Better Path**: Create a "New +" -> "PostgreSQL". Copy the `Internal Database URL`. Paste it here as `DATABASE_URL`.
6.  Click **"Deploy Web Service"**.
7.  **Copy your Backend URL**: e.g., `https://trento-api.onrender.com`.

---

## ⚡ Step 3: Deploy Frontend (Vercel)
1.  Go to [vercel.com](https://vercel.com) and sign up.
2.  Click **"Add New..."** -> **"Project"**.
3.  Import the **Same GitHub Repository**.
4.  **Configure Project**:
    *   **Framework Preset**: Create React App (should auto-detect).
    *   **Root Directory**: `.` (The root of your repo).
5.  **Environment Variables**:
    *   Name: `REACT_APP_API_BASE`
    *   Value: `https://trento-api.onrender.com/api` (The URL from Step 2 **plus** `/api`).
6.  Click **"Deploy"**.

---

## 🎉 Done!
*   Visit your Vercel URL (e.g., `https://trento-app.vercel.app`).
*   It should load and talk to your Render backend.
*   **Note**: On the Free Tier, Render spins down after 15 mins of inactivity. The first request might take 30-50 seconds to "wake up". This is normal for free hosting.
