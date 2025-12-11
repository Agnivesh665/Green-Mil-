import numpy as np
from sklearn.model_selection import train_test_split
from xgboost import XGBRegressor
import joblib
import os

def generate_synthetic(n=6000, seed=42):
    np.random.seed(seed)
    distance = np.random.uniform(10, 600, n)
    duration = distance / np.random.uniform(40, 100, n) * 60
    elevation_gain = np.random.exponential(200, n)
    temp = np.random.normal(25, 8, n)
    wind = np.random.exponential(1.0, n)
    precip = np.random.choice([0, 1, 2, 5], size=n)
    num_chargers = np.random.poisson(1.2, n)
    battery_kWh = np.random.choice([30,40,50,60], size=n)
    range_km = battery_kWh * np.random.uniform(6.5, 8.5, n)

    base = (distance / range_km) * 100
    uphill_factor = 1 + (elevation_gain / 1000) * 0.15
    temp_factor = 1 + np.clip((20 - temp) / 40, 0, 0.2)
    weather_factor = 1 + precip * 0.02 + wind * 0.01
    noise = np.random.normal(0, 3, n)

    battery_usage = base * uphill_factor * temp_factor * weather_factor + noise
    battery_usage = np.clip(battery_usage, 1, 180)

    X = np.vstack([
        distance, duration, elevation_gain, temp, wind,
        precip, num_chargers, battery_kWh, range_km
    ]).T
    return X, battery_usage

if __name__ == '__main__':
    X, y = generate_synthetic(8000)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    model = XGBRegressor(n_estimators=250, max_depth=6, learning_rate=0.07, subsample=0.9, colsample_bytree=0.9, objective='reg:squarederror')
    model.fit(X_train, y_train)
    os.makedirs('saved_model', exist_ok=True)
    joblib.dump(model, 'saved_model/xgb_ev_model.pkl')
    print('Saved model to saved_model/xgb_ev_model.pkl')
