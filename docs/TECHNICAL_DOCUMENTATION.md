# Trento Smart Tricycle Dispatch System - Technical Documentation

## 1. System Architecture
The system follows a **Modern Distributed Web Architecture** designed for high availability and real-time responsiveness.

*   **Frontend (UI/UX)**: React.js SPA (Single Page Application) using Tailwind CSS for a premium "Glassmorphism" aesthetic.
*   **Backend (Core Logic)**: Django (Python) REST Framework (DRF) for secure, scalable API delivery.
*   **Real-time Engine**: Django Channels (WebSockets) for live trip tracking and admin alerts.
*   **Database**: PostgreSQL/MySQL (Production) or SQLite (Development) with structured ERD for data integrity.
*   **Mapping**: Google Maps JavaScript API with Visualization Library for heatmaps and GPS routing.

---

## 2. Database Schema (ERD)
The system utilizes a relational schema to ensure strict data validation and audit trails.

*   **User**: `id, username, email, password, role (Passenger, Driver, Admin), is_verified_driver, license_data, wallet_balance, average_rating`
*   **Ride**: `id, passenger_id, driver_id, pickup_address, destination_address, fare, status (Requested, Accepted, Ongoing, Completed, Cancelled), timestamps`
*   **Payment**: `id, ride_id, method (Cash, Wallet, GCash), amount, status, transaction_reference`
*   **WalletTransaction**: `id, user_id, amount, type (Top-up, Payment), reference_id`
*   **Review**: `id, ride_id, rating (1-5), comment, created_at`
*   **Incident/SOS**: `id, ride_id, user_id, lat/lng, description, status`
*   **Complaint**: `id, user_id, subject, description, status`
*   **SystemConfig**: `key, value, description` (Dynamic LGU fare control)

---

## 3. Core API Endpoints
| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/auth/register/` | POST | User registration (Passenger/Driver) |
| `/api/auth/login/` | POST | Secure JWT authentication |
| `/api/rides/` | POST | Request a new ride in Trento |
| `/api/rides/estimate_fare/` | GET | AI Surge Pricing & Fare Estimation |
| `/api/wallet/pay/` | POST | Deduct fare from Smart Wallet |
| `/api/incidents/` | POST | Trigger SOS Emergency Alert |
| `/api/complaints/` | POST | File a formal complaint |
| `/api/driver/accept/` | POST | Dispatcher: Accept nearby request |

---

## 4. Smart Dispatch Algorithm (Nearest Driver)
The system employs a **Geospatial Proximity Matcher** to minimize passenger wait times and driver fuel consumption:

1.  **Request Initiation**: Passenger selects a destination.
2.  **Distance Calculation**: The system calculates the haul distance using Google Maps Directions API.
3.  **Surge Evaluation**: AI Fare Elasticity engine checks driver-to-rider ratio.
4.  **Nearest Neighbor Search**: The backend queries active drivers within a 3km radius of the pickup point.
5.  **Broadcast**: A WebSocket notification is sent to the Top 3 nearest available drivers simultaneously.
6.  **First-to-Accept**: The first driver to respond via the `driver/accept/` endpoint is assigned the ride.

---

## 5. ISO 25010 Quality Standards Alignment
*   **Reliability**: Automated failovers and transaction logging for wallet payments.
*   **Efficiency**: Fare Elasticity (Surge) ensures the network remains available even during peak demand.
*   **Security**: Role-based access control (RBAC) and JWT token encryption.
*   **Usability**: Premium dark-mode UI with intuitive "one-tap" SOS functionality.

---

## 6. Implementation Summary
*   **LGU Focused**: Designed specifically for the tricycle ordinance of Trento.
*   **Cashless Ready**: Integrated "Smart Wallet" and simulated GCash/PayMaya gateways.
*   **Authority Oversight**: Real-time Admin Dashboard for incident management and fare configuration.
