import "dotenv/config";

import app from "./app.js";
import connectDB from "./db/connect.js";

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    console.log("MongoDB Connected");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
    if (!process.env.MONGODB_URI) {
      console.error("Set MONGODB_URI in server/.env");
    }
    process.exit(1);
  });