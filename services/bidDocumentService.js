import { Bid } from '../models/bid.js';
import cloudinary from '../utils/cloudinary.js';
import { extractBidDataFromDocument } from '../utils/ai.js';

// Create a new bid with document upload and AI processing
export const createBidWithDocument = async (req, res) => {
    try {
        console.log('Creating new bid with document for user:', req.session.userId);
        
        if (!req.file) {
            return res.status(400).json({ message: 'No document uploaded.' });
        }

        const fileSize = req.file.size;
        console.log(`File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

        // Upload document to Cloudinary
        const uploadResult = await new Promise((resolve, reject) => {
            const uploadOptions = {
                folder: 'bid-documents',
                use_filename: true,
                unique_filename: false,
                resource_type: 'auto' // Always use auto resource type
            };

            cloudinary.uploader.upload_stream(
                uploadOptions,
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            ).end(req.file.buffer);
        });

        console.log('Document uploaded to Cloudinary:', uploadResult.secure_url);

        // Process document with Gemini AI (comprehensive extraction)
        console.log('🤖 Processing document with Gemini AI...');
        console.log('📁 File Details:', {
            originalName: req.file.originalname,
            mimeType: req.file.mimetype,
            size: `${(req.file.size / 1024).toFixed(2)} KB`,
            bufferLength: req.file.buffer.length
        });
        
        const aiResult = await extractBidDataFromDocument(
            req.file.buffer, 
            req.file.originalname, 
            req.file.mimetype,
            req.session.userId
        );
        
        console.log('✅ Gemini processing completed:', {
            success: aiResult.success,
            method: aiResult.method,
            hasData: !!aiResult.data
        });

        console.log("✅ Gemini Full AI Result JSON:");
console.log(JSON.stringify(aiResult, null, 2));


        console.log("📊 Extracted Data:", aiResult.data);
console.log("⚙️ Processing Method:", aiResult.method);
console.log("✅ Success:", aiResult.success);





        // // 🔍 DETAILED GEMINI AI EXTRACTION RESULTS
        // console.log('='.repeat(80));
        // console.log('🤖 GEMINI AI EXTRACTION RESULTS:');
        // console.log('='.repeat(80));
        // console.log('📋 Full AI Result Object:');
        // console.log(JSON.stringify(aiResult, null, 2));
        // console.log('='.repeat(80));
        





        // Extract data from Gemini response (handle both old and new structure)
        const extractedData = aiResult.data || aiResult || {};
        const contractorInfo = extractedData.contractorInfo || aiResult.contractorInfo || {};
        const clientInfo = extractedData.clientInfo || aiResult.clientInfo || {};
        const projectDetails = extractedData.projectDetails || aiResult.projectDetails || {};
        const demolitionItems = extractedData.demolitionItems || aiResult.demolitionItems || [];
        
        // Extract new fields from the updated JSON structure
        const basicItemCount = extractedData.basicItemCount || aiResult.basicItemCount || 0;
        const sectionHeaders = extractedData.sectionHeaders || aiResult.sectionHeaders || [];
        const specialNotes = extractedData.specialNotes || aiResult.specialNotes || [];
        const priceInfo = extractedData.priceInfo || aiResult.priceInfo || {};
        const additionalConditions = extractedData.additionalConditions || aiResult.additionalConditions || [];
        
        // Handle scopeOfWork structure (new format with itemsToRemove and itemsToRemain)
        const scopeOfWorkData = extractedData.scopeOfWork || aiResult.scopeOfWork || {};
        const scopeOfWork = typeof scopeOfWorkData === 'string' ? {
            itemsToRemove: [scopeOfWorkData],
            itemsToRemain: []
        } : {
            itemsToRemove: scopeOfWorkData.itemsToRemove || [],
            itemsToRemain: scopeOfWorkData.itemsToRemain || []
        };
        

        // Create bid data combining form data and Gemini extracted data
        const bidData = {
            user: req.session.userId,
            
            // Project Details (structured schema)
            projectDetails: {
                documentType: projectDetails.documentType || 'Bid Document',
                bidDate: projectDetails.bidDate ? (() => {
                    try {
                        // Handle various date formats from AI extraction
                        const dateStr = projectDetails.bidDate;
                        if (dateStr.includes('/')) {
                            // Handle formats like "4/20/22"
                            const parts = dateStr.split('/');
                            const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
                            return new Date(`${parts[0]}/${parts[1]}/${year}`);
                        }
                        return new Date(dateStr);
                    } catch (e) {
                        return new Date();
                    }
                })() : new Date(),
                projectName: req.body.projectName || projectDetails.projectName || 'Untitled Project',
                projectType: req.body.projectType || projectDetails.projectType || 'Not specified',
                location: projectDetails.location || 'Not specified',
                scopeSummary: (() => {
                    // Convert scopeOfWork object to string for scopeSummary
                    const scopeData = extractedData.scopeOfWork || aiResult.scopeOfWork;
                    if (typeof scopeData === 'object' && scopeData !== null) {
                        const removeItems = scopeData.itemsToRemove || [];
                        const remainItems = scopeData.itemsToRemain || [];
                        let summary = '';
                        if (removeItems.length > 0) {
                            summary += 'Remove: ' + removeItems.join(', ');
                        }
                        if (remainItems.length > 0) {
                            if (summary) summary += '; ';
                            summary += 'Remain: ' + remainItems.join(', ');
                        }
                        return summary || 'To be determined';
                    }
                    return String(scopeData || 'To be determined');
                })(),
                description: projectDetails.description || req.body.additionalNotes || ''
            },
            
            // Contractor Information (structured schema)
            contractorInfo: {
                companyName: contractorInfo.companyName || 'Not specified',
                address: contractorInfo.address || 'Not specified',
                phone: contractorInfo.phone || 'Not specified',
                contactPerson: contractorInfo.contactPerson || 'Not specified',
                email: contractorInfo.email || 'Not specified',
                license: contractorInfo.license || 'Not specified',
                insurance: contractorInfo.insurance || 'Not specified'
            },
            
            // Client Information (structured schema)
            clientInfo: {
                companyName: clientInfo.companyName || clientInfo.clientName || 'Not specified',
                address: clientInfo.address || clientInfo.clientAddress || 'Not specified',
                contactPerson: clientInfo.contactPerson || 'Not specified',
                clientName: clientInfo.clientName || 'Not specified',
                clientAddress: clientInfo.clientAddress || 'Not specified'
            },
            
            // Document information
            documents: [{
                public_id: uploadResult.public_id,
                url: uploadResult.secure_url,
                originalName: req.file.originalname,
                mimeType: req.file.mimetype,
                size: fileSize
            }],
            
            // Demolition items from AI (properly structured)
            demolitionItems: demolitionItems.map(item => {
                // Handle mixed categories like "electrical, mechanical, plumbing"
                let category = item.category || 'other';
                if (category.includes(',')) {
                    // If multiple categories, take the first one
                    category = category.split(',')[0].trim();
                }
                
                // Map category variations to model enum values
                const categoryMap = {
                    'HVAC': 'hvac',
                    'MEP': 'electrical',
                    'Storefront': 'storefront',
                    'signage': 'signage'
                };
                
                category = categoryMap[category] || category.toLowerCase();
                
                // Ensure category is in allowed enum, fallback to 'other'
                const allowedCategories = [
                    'wall', 'ceiling', 'floor', 'electrical', 'plumbing', 
                    'cleanup', 'door', 'window', 'fixture', 'hvac', 
                    'structural', 'interior', 'exterior', 'other',
                    'HVAC', 'signage', 'storefront', 'MEP', 'fire protection',
                    'Storefront', 'mechanical'
                ];
                
                if (!allowedCategories.includes(category)) {
                    category = 'other';
                }
                
                // Use the action from AI extraction directly as string
                let action = item.action || 'Remove';
                
                return {
                    itemNumber: item.itemNumber || null,
                    name: item.name || item.description || 'Unnamed Item', // Add name field
                    description: item.description || 'No description',
                    category: category,
                    action: action,
                    measurements: {
                        quantity: item.measurements?.quantity || null,
                        unit: item.measurements?.unit || null,
                        dimensions: item.measurements?.dimensions || null,
                        // New measurement fields from AI extraction
                        squareFeet: item.measurements?.squareFeet || null,
                        linearFeet: item.measurements?.linearFeet || null,
                        count: item.measurements?.count || null
                    },
                    pricing: item.pricing || item.totalPrice || null,
                    // Add pricesheet matching information
                    pricesheetMatch: {
                        matched: item.pricesheetMatch?.matched || false,
                        itemName: item.pricesheetMatch?.itemName || null,
                        itemPrice: item.pricesheetMatch?.itemPrice || null,
                        itemId: item.pricesheetMatch?.itemId || null
                    },
                    location: item.location || null,
                    specifications: item.specifications || null,
                    notes: item.notes || null,
                    unitPrice: item.pricing?.unitPrice || item.unitPrice || null,
                    totalPrice: item.pricing?.totalPrice || item.totalPrice || null,
                    // New calculated pricing fields from AI extraction
                    calculatedUnitPrice: item.calculatedUnitPrice || null,
                    calculatedTotalPrice: item.calculatedTotalPrice || null,
                    proposedBid: item.proposedBid || null,
                    priceCalculation: item.priceCalculation || null,
                    isActive: true
                };
            }),
            
            // Work scope and exclusions
            scopeOfWork: scopeOfWork,
            workItems: (extractedData.workItems || aiResult.workItems || []).map(item => ({
                itemNumber: item.itemNumber || null,
                description: item.description || '',
                category: item.category || '',
                location: item.location || '',
                specifications: item.specifications || ''
            })),
            exclusions: extractedData.exclusions || aiResult.exclusions || [],
            specialRequirements: extractedData.specialRequirements || aiResult.specialRequirements || '',
            
            // New fields from updated model
            basicItemCount: basicItemCount,
            sectionHeaders: sectionHeaders,
            specialNotes: specialNotes,
            priceInfo: {
                totalAmount: priceInfo.totalAmount || null,
                includes: priceInfo.includes || []
            },
            additionalConditions: additionalConditions,
            
            // Measurement summaries (structured schema)
            measurementSummary: {
                totalArea: (extractedData.measurementSummary || aiResult.measurementSummary || {}).totalArea || null,
                totalVolume: (extractedData.measurementSummary || aiResult.measurementSummary || {}).totalVolume || null,
                totalLinearFeet: (extractedData.measurementSummary || aiResult.measurementSummary || {}).totalLinearFeet || null,
                squareFootage: (extractedData.measurementSummary || aiResult.measurementSummary || {}).squareFootage || null,
                linearFootage: (extractedData.measurementSummary || aiResult.measurementSummary || {}).linearFootage || null,
                itemCount: demolitionItems.length || 0
            },
            
            // Pricing summaries (structured schema)
            pricingSummary: {
                subtotal: (extractedData.pricingSummary || aiResult.pricingSummary || {}).subtotal || null,
                laborTotal: (extractedData.pricingSummary || aiResult.pricingSummary || {}).laborTotal || null,
                materialTotal: (extractedData.pricingSummary || aiResult.pricingSummary || {}).materialTotal || null,
                grandTotal: (extractedData.pricingSummary || aiResult.pricingSummary || {}).grandTotal || null,
                totalProjectCost: extractedData.totalProjectCost || aiResult.totalProjectCost || null
            },
            
            // Cost calculations (legacy field)
            totalProjectCost: extractedData.totalProjectCost || aiResult.totalProjectCost || null,
            
            // AI processing metadata (structured schema)
            aiProcessing: {
                method: aiResult.method || 'gemini-two-phase',
                success: aiResult.success || false,
                phase1Success: (aiResult.processingPhases || aiResult.data?.processingPhases || {}).phase1Success || false,
                phase2Success: (aiResult.processingPhases || aiResult.data?.processingPhases || {}).phase2Success || false,
                extractedItemCount: demolitionItems.length || 0,
                processingTime: null, // Could be added if needed
                extractionNotes: extractedData.extractionNotes || aiResult.extractionNotes || '',
                lastProcessedAt: new Date()
            },
            
            // Complete AI extracted data (for reference)
            aiExtractedData: aiResult,
            processingMethod: aiResult.method || 'gemini-comprehensive-extraction',
            aiProcessingSuccess: aiResult.success,
            extractionNotes: extractedData.extractionNotes || aiResult.extractionNotes || '',
            
            // Legacy compatibility fields
            projectName: req.body.projectName || projectDetails.projectName || 'Untitled Project',
            projectType: req.body.projectType || projectDetails.projectType || 'Not specified',
            client: req.body.client || clientInfo.clientName || clientInfo.companyName || 'Not specified',
            clientAddress: clientInfo.clientAddress || clientInfo.address || 'Not specified',
            projectLocation: projectDetails.location || 'Not specified',
            projectDescription: projectDetails.description || req.body.additionalNotes || '',
            bidItems: req.body.bidItems || [],
            
            // Status
            status: 'Pending'
        };
        
        const bid = new Bid(bidData);
        await bid.save();
        
        console.log('✅ Bid created successfully with Gemini AI processing:', bid._id);
        console.log('📊 Extracted demolition items:', demolitionItems.length);
        
        // 📤 PREPARE API RESPONSE
        const apiResponse = {
            message: 'Bid created successfully with document analysis',
            bid,
            // Enhanced response with Gemini extracted data
            aiExtraction: {
                success: aiResult.success,
                method: aiResult.method,
                contractorInfo: contractorInfo,
                clientInfo: clientInfo,
                projectDetails: projectDetails,
                demolitionItems: demolitionItems,
                totalItems: demolitionItems.length,
                scopeOfWork: scopeOfWork,
                exclusions: extractedData.exclusions || aiResult.exclusions,
                costSummary: extractedData.pricingSummary || aiResult.pricingSummary,
                extractionNotes: extractedData.extractionNotes || aiResult.extractionNotes,
                // New fields from updated model
                basicItemCount: basicItemCount,
                sectionHeaders: sectionHeaders,
                specialNotes: specialNotes,
                priceInfo: {
                    totalAmount: priceInfo.totalAmount || null,
                    includes: priceInfo.includes || []
                },
                additionalConditions: additionalConditions,
                // Additional processing info
                processingPhases: aiResult.processingPhases || { phase1Success: false, phase2Success: false }
            },
            documentUrl: uploadResult.secure_url,
            processingMethod: aiResult.method,
            aiProcessingSuccess: aiResult.success
        };


        res.status(201).json(apiResponse);
    } catch (error) {
        console.error('Create bid with document error:', error);
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
};
