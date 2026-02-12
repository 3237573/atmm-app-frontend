# Crypto Arbitrage Matrix (Frontend)

Professional dashboard for real-time cryptocurrency arbitrage monitoring.

## 🚀 Features
- **Real-time Monitoring**: Live price updates every 10 seconds.
- **Visual Matrix**: Easy-to-read comparison between 7+ major exchanges.
- **Smart Indicators**: 
  - Green/Red cells for profit/loss direction.
  - Price difference in both percentage (%) and absolute cash ($).
  - Trend arrows (▲/▼) for instant analysis.
- **Backend-Powered**: Aggregated data through Ktor backend to avoid CORS and rate limits.

## 🛠 Tech Stack
- **Angular 17+** (Signals, Standalone components)
- **RxJS** for reactive data streams
- **Tailwind/Custom CSS** for modern Dark Mode UI

## 📦 Installation
1. `npm install`
2. Ensure the [Ktor Backend](https://github.com/3237573/atmm-app-backend) is running on port 9083.
3. `npm start`