Smart Tricycle Dispatch System — Frontend (React)

Overview
This workspace contains a React frontend scaffold for the Trento, Agusan del Sur Smart Tricycle Dispatch System. The frontend demonstrates:
- Role-based UI (Passenger / Driver / Admin)
- Google Maps integration (client-side)
- Axios API helper with JWT attachment
- Simple Auth Context and Protected routes
- Sample pages for booking, accepting rides, and admin dashboard

Quick setup
1. Install dependencies:

   npm install

2. Add environment variables in a `.env` file at project root:

   REACT_APP_API_BASE=http://localhost:4000/api
   REACT_APP_GOOGLE_MAPS_KEY=YOUR_GOOGLE_MAPS_API_KEY

3. Start the app:

   npm start

Notes
- The frontend expects a REST backend with endpoints like `/auth/login`, `/auth/register`, `/rides`, `/driver/requests`, `/driver/accept/:id`, `/admin/stats`.
- If the backend is not present, the UI contains fallback mock responses so you can explore the flows.
- For real-time updates, integrate a WebSocket or use polling (the driver page shows a polling example).

API Contract (short)
- POST /auth/login -> { token }
- POST /auth/register -> { success }
- POST /rides -> create ride request
- GET /driver/requests -> list pending requests
- POST /driver/accept/:id -> accept ride
- GET /admin/stats -> admin metrics

Next steps (suggested)
- Implement backend (Node.js + Express or Django REST) with JWT and MySQL
- Implement driver verification flow and document LGU fare rules
- Add WebSocket for position updates
- Integrate payment provider (mock GCash/PayMaya flows)
