// import express from 'express';
// import multer from 'multer';
// import cloudinary from '../utils/cloudinary.js';
// import Document from '../models/document.js';
// import { extractRelevantDetails } from '../utils/ai.js';

// const router = express.Router();

// const storage = multer.memoryStorage();
// const upload = multer({ storage });

// // POST /api/documents/upload
// router.post('/upload', upload.single('file'), async (req, res) => {
//   try {
//     const { title, uploadedBy, detailsToExtract } = req.body;
//     const file = req.file;
//     if (!file) {
//       return res.status(400).json({ message: 'No file uploaded.' });
//     }

//     // Upload file to Cloudinary
//     const result = await cloudinary.uploader.upload_stream({ resource_type: 'auto' }, async (error, cloudinaryResult) => {
//       if (error) {
//         return res.status(500).json({ message: 'Cloudinary upload failed.', error });
//       }
//       // Save document info to DB
//       const document = new Document({
//         title,
//         fileUrl: cloudinaryResult.secure_url,
//         uploadedBy,
//       });
//       await document.save();

//       // AI: Extract relevant details from the file (stub)
//       const extractedDetails = await extractRelevantDetails(cloudinaryResult.secure_url, detailsToExtract);

//       res.status(201).json({
//         message: 'Document uploaded and processed successfully.',
//         document,
//         extractedDetails
//       });
//     });
//     result.end(file.buffer);
//   } catch (error) {
//     res.status(500).json({ message: 'Server error', error: error.message });
//   }
// });

// export default router;
