require("dotenv").config();
const express = require("express");
const app = express();
const cookieParser = require("cookie-parser");
const path = require('path');

// CORS added for Deployement purpose
const cors = require("cors");
app.use(cors({
  origin: "http://localhost:3000",  // Added URL to support cookies (replace with your frontend URL)
  credentials: true,  // Allow credentials (cookies)
}));
// CORS added for Deployement purpose

app.use(cookieParser());
app.use(express.json());

// With the help of below code we can access the images on the browser
// ex: http://localhost:5000/uploads/img1.png
app.use('/uploads', express.static(path.join(__dirname, 'resources')));

const HealthRoute = require("./routes/route");
const GoogleRoute = require("./routes/routeGoogle");

// Route for all 
app.use("/api/health", HealthRoute);

// Route for Google Drive API
app.use("/api/google", GoogleRoute);

const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log("Server running on port on port " + port);
});
