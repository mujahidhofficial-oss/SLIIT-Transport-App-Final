# Driver Account Creation Fix - TODO Steps

## Current Status
✅ Frontend code correct (DriverSignupScreen.js)
✅ Backend routes/controller/model correct
❌ Backend not starting (syntax + missing .env/DB)

## Step 1: Start Backend (PowerShell)
```
cd letgo-driver-module
npm start
```
Expected:
```
MongoDB Connected  
Server running on port 5000
```

## Step 2: If DB Error - Create .env
```
echo MONGO_URI=mongodb://localhost:27017/sliit-transport > .env
```
Or use MongoDB Atlas URI.

## Step 3: Test API
```
curl -X POST http://localhost:5000/api/drivers/register -H "Content-Type: application/json" -d \"{\\\"fullName\\\":\\\"Test\\\",\\\"email\\\":\\\"test@test.com\\\",\\\"phone\\\":\\\"94123456789\\\",\\\"licenseNumber\\\":\\\"B1234567\\\",\\\"vehicleNumber\\\":\\\"ABC-1234\\\",\\\"password\\\":\\\"password123\\\"}\"
```

## Step 4: Mobile Testing
- Emulator: Uses `http://10.0.2.2:5000` ✅
- Phone: Update api.ts to PC IP `http://192.168.x.x:5000`

## Progress
- [x] Backend syntax fixed
- [ ] Backend started + DB connected (run: cd letgo-driver-module; npm start)
- [x] .env created
- [ ] Driver account created from app

