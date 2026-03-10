# Transmart - Smart Tricycle Dispatch System

This project is a full-stack application with a React frontend and a Django backend.

## 📁 System Structure
- `/` (Root): React Frontend.
- `/server`: Django Backend API.
- `/docs`: Documentation and Hosting guides.

## 🚀 Hosting Overview
This system is configured for a **Hybrid Hosting** setup:
1. **Frontend:** [Vercel](https://vercel.com) (Deploys from the root directory).
2. **Backend:** [Railway](https://railway.app) (Deploys from the `/server` directory).
3. **Database:** [Railway MySQL](https://railway.app).

## 🛠️ Preparation Checklist
1. **Repository:** Ensure the entire `Transmart` folder is pushed to a private GitHub repository.
2. **Environment Variables:**
   - Copy `.env.example` to `.env` in both the root and `/server`.
   - Update the variables with your production URLs.
3. **Frontend (Vercel):**
   - Connect your GitHub repo.
   - Set `REACT_APP_API_BASE` to your Railway backend URL.
4. **Backend (Railway):**
   - Point the "Root Directory" to `server`.
   - Railway will use the `Procfile` and `build.sh` automatically.

---
*For more detailed instructions, see [docs/hosting_guide.md](./docs/hosting_guide.md).*
