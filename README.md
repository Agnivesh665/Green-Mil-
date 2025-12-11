Ased
Route Battery Optimization - Full project (backend Node.js + EJS + XGBoost ML service)

Structure:
- backend-node: Node.js + Express + EJS frontend
- ml-service: XGBoost training script + FastAPI inference

Quick start:
1) ML service
   cd ml-service
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   python train_xgb.py    # creates saved_model/xgb_ev_model.pkl
   python app.py          # starts FastAPI on port 8000

2) Backend
   cd backend-node
   npm install
   copy .env.example to .env and edit if needed
   npm run dev
   open http://localhost:3000

Notes:
- All external APIs used are free-tier / public:
  - Nominatim (OpenStreetMap) for geocoding
  - OSRM (router.project-osrm.org) for routing
  - OpenTopoData for elevation
  - Open-Meteo for weather
  - OpenChargeMap for charging POIs
- The ML model is trained on synthetic data. Replace with real telemetry for production.
