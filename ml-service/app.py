import joblib
import numpy as np
from fastapi import FastAPI
from pydantic import BaseModel
import uvicorn
import os

MODEL_PATH = os.environ.get('MODEL_PATH', 'saved_model/xgb_ev_model.pkl')
if not os.path.exists(MODEL_PATH):
    raise RuntimeError(f'Model not found at {MODEL_PATH}. Run train_xgb.py first.')
model = joblib.load(MODEL_PATH)

app = FastAPI()

class RouteItem(BaseModel):
    id: int
    features: list

class PredictionRequest(BaseModel):
    routes: list[RouteItem]

@app.post('/predict')
def predict(data: PredictionRequest):
    ids = []
    feats = []
    for r in data.routes:
        ids.append(r.id)
        feats.append(r.features)
    feats = np.array(feats, dtype=float)
    preds = model.predict(feats)
    preds = np.round(preds, 2)
    out = []
    for i,p in zip(ids, preds):
        traffic = 'Low'
        if p >= 80: traffic = 'High'
        elif p >= 50: traffic = 'Medium'
        out.append({'id': int(i), 'battery_usage_percent': float(p), 'traffic': traffic})
    return {'predictions': out}

if __name__ == '__main__':
    uvicorn.run(app, host='0.0.0.0', port=int(os.environ.get('PORT', 8000)))
