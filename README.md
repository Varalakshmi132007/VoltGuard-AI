# ⚡ VoltGuard AI – Smart Electricity Theft Detection & Grid Monitoring System

## 1. Project Overview

**VoltGuard AI** is an AI/ML-powered electricity monitoring and unauthorized electricity consumption detection system.

It monitors electricity consumption patterns at consumer, feeder, and transformer levels. It uses Machine Learning to identify abnormal consumption, detect suspicious usage patterns, and prioritize consumers for inspection.

The system helps electricity distribution companies improve energy accounting, reduce power losses, and identify possible electricity theft.

## 2. Key Features

- **Consumer Management:** Manage residential, commercial, and industrial consumers.
- **Energy Monitoring:** Monitor hourly and daily electricity consumption.
- **Feeder Monitoring:** Track feeder-level energy consumption and discrepancies.
- **Transformer Monitoring:** Monitor transformer loading and energy balance.
- **Dataset Upload:** Upload CSV electricity consumption datasets.
- **AI Anomaly Detection:** Identify unusual electricity consumption patterns using Isolation Forest.
- **Possible Theft Detection:** Identify suspicious consumers based on abnormal consumption.
- **Risk Prioritization:** Classify suspicious consumers according to their risk levels.
- **Alerts & Investigations:** Monitor and manage suspicious activity alerts.
- **ML Performance:** Monitor machine learning model performance.
- **Reports & Export:** Generate reports and export data as CSV.
- **Simulation:** Simulate normal and suspicious electricity consumption scenarios.

## 3. Technologies Used

### Frontend
- React.js
- Vite
- JavaScript
- Tailwind CSS
- Recharts
- Lucide React

### Backend
- Python
- FastAPI
- Uvicorn
- SQLite

### Machine Learning & Data Processing
- Scikit-learn
- Isolation Forest
- NumPy
- Pandas

## 4. Project Folder Structure

```text
VoltGuard-AI/
│
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── schemas.py
│   │
│   ├── routes/
│   ├── services/
│   └── machine_learning/
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── api/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   │
│   ├
