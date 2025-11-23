import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
dotenv.config();

cloudinary.config({
  cloud_name: dzwbavygy,
  api_key: 841186918211227,
  api_secret: n_qGceYSjqypUPlQOlic8 - wyygQ,
});

// Check Cloudinary connection by pinging the API
cloudinary.api.ping((error, result) => {
  if (error) {
    console.error("Cloudinary connection failed:", error.message);
  } else {
    console.log("Cloudinary connected:", result.status);
  }
});

export default cloudinary;
