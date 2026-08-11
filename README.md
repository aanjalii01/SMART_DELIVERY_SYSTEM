# 🚁 Smart Delivery System

An autonomous drone-based logistics solution designed to optimize package delivery using real-time map data and intelligent routing algorithms.

## 📌 Project Overview

The Smart Delivery System is an AI-powered logistics solution using autonomous drones to deliver packages across Dehradun. It uses real-time map data, shortest path routing with Dijkstra’s algorithm, greedy drone allocation, and altitude-based flight planning. Features include emergency delivery prioritization, real-time delivery simulation, and role-based access for users and admins.

## 🛠️ Technologies Used

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Python (Flask)
- **Database**: SQLite
- **Algorithms**:
  - Dijkstra’s Algorithm for shortest path
  - Greedy approach for drone allocation
  - Sorting for altitude planning
- **Map Integration**: Real-time location input and simulation

## 🚀 Getting Started

### Prerequisites

- Python 3.x
- pip (Python package installer)

### Installation

```bash
git clone https://github.com/aanjalii01/SMART_DELIVERY_SYSTEM.git
cd SMART_DELIVERY_SYSTEM
python -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

Now open `http://localhost:5000` in your browser.

## 📂 Project Structure

```
SMART_DELIVERY_SYSTEM/
├── app/
│   ├── static/             # CSS and JS
│   ├── templates/          # HTML files
│   ├── __init__.py         # Flask app setup
│   ├── routes.py           # Main route handlers
│   ├── models.py           # User and order models
│   └── utils.py            # Dijkstra, sorting, allocation logic
├── instance/
│   └── database.db         # SQLite DB
├── run.py                  # Main entry file
├── requirements.txt        # Dependencies
└── README.md               # Project info
```

## ✅ Features

- Role-based user authentication (admin/user)
- Real-time delivery simulation interface
- Drone selection based on proximity (greedy)
- Dijkstra’s algorithm for pathfinding
- Altitude logic for flight height
- Emergency delivery prioritization
- Interactive frontend with live location input

## 🧪 Testing & Validation

- **Pathfinding Accuracy**: Verified multiple routes using Dijkstra’s algorithm
- **Drone Allocation**: Confirms closest drone assignment
- **Altitude Sorting**: Correct flight height calculated
- **User Access**: Admin/user access tested
- **UI & Backend Sync**: Simulation reflects live delivery progress

## 🔮 Future Enhancements

- Weather-based flight planning
- Obstacle avoidance using sensors
- Multi-drone delivery coordination
- Real-time GPS link sharing
- Email/SMS notifications
- Performance Optimization
- Integration with E-Commerce Platforms

## 👥 Contributors

- **Anjali Sinha** – Team Lead / Backend logic
- **Hitesh Kumar** – Backend & Altitude Logic
- **Anmol Kumar** – Frontend / Simulation UI
- **Vasu Singh** – Algorithms / Drone Allocation


---

*Developed for the Design and Analysis of Algorithms course (DAA-IV-T099) at Graphic Era University.*

## Troubleshooting

### Installation fails
- Ensure you are using the supported Node.js version.
- Run `npm install` or `npm ci`.
- Delete `node_modules` and reinstall dependencies if necessary.

### Environment variables not loading
- Verify that a `.env` file exists.
- Ensure all required variables are defined.
- Restart the development server after making changes.

## FAQ

### How do I start the project?
Run:

```bash
npm install
npm run dev
```

### How do I report a bug?
Please open a GitHub issue with reproduction steps and relevant logs.

