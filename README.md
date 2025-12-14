# Student Pickup System

A real-time web application to streamline school student pickup procedures, replacing WhatsApp-based notifications with targeted, instant alerts to classroom IFP displays.

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ ([Download here](https://nodejs.org/))

### Installation

```powershell
# Navigate to project directory
cd c:\Users\EzeanataMichael\.gemini\antigravity\scratch\student-pickup-system

# Install dependencies
npm install

# Start the server
npm start
```

The server will start on `http://localhost:3000`

## 📍 Access Points

- **Landing Page**: http://localhost:3000
- **Reception**: http://localhost:3000/reception.html
- **Classroom Display**: http://localhost:3000/display.html?year=7&class=blue
- **Admin Panel**: http://localhost:3000/admin.html

## 🎯 Features

- ✅ Real-time WebSocket notifications
- ✅ Class-specific filtering (17 classes)
- ✅ Visual & audio alerts
- ✅ Color-coded waiting times
- ✅ One-tap acknowledgment
- ✅ Student management (CRUD)
- ✅ Pickup history tracking
- ✅ IFP-optimized displays
- ✅ Modern, premium design

## 🏫 Class Structure

- **Year 7-11**: Blue, Green, Red (15 classes)
- **Year 12**: Blue, Red (2 classes)
- **Total**: 17 classes, ~280 mock students

## 🛠️ Tech Stack

- **Backend**: Node.js, Express, WebSocket (ws)
- **Database**: SQLite (better-sqlite3)
- **Frontend**: HTML, CSS, Vanilla JavaScript
- **Design**: Modern dark theme with gradients & animations

## 📖 Usage

### Reception (Duty Teachers)
1. Select Year → Class → Student
2. Click "Sign Out Student"
3. Notification sent instantly to classroom

### Classroom Display (Form Tutors)
1. Open display URL for your class
2. Receive real-time pickup notifications
3. Click "Student Sent Down" to acknowledge

### Admin Panel
1. Manage student database
2. View pickup history
3. Monitor system statistics

## 📄 License

MIT

## 👨‍💻 Author

Built with ❤️ for efficient school operations
