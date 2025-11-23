import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
dotenv.config();

cloudinary.config({

  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Check Cloudinary connection by pinging the API
cloudinary.api.ping((error, result) => {
  if (error) {
    console.error('Cloudinary connection failed:', error.message);
  } else {
    console.log('Cloudinary connected:', result.status);
  }
});

export default cloudinary;
