import { Bid } from '../models/bid.js';
import PDFDocument from 'pdfkit';

// Generate and download PDF document with all bid details
export const downloadBidDocument = async (req, res) => {
    try {
        const { id } = req.params;
        console.log('=== DOWNLOAD BID DOCUMENT API CALLED ===');
        console.log('User ID:', req.session.userId);
        console.log('Bid ID:', id);
        console.log('Timestamp:', new Date().toISOString());

        // Validate ObjectId
        const mongoose = await import('mongoose');
        if (!mongoose.default.Types.ObjectId.isValid(id)) {
            console.log('VALIDATION ERROR: Invalid ObjectId format');
            return res.status(400).json({
                success: false,
                message: 'Invalid bid ID format'
            });
        }

        const bid = await Bid.findOne({ 
            _id: id, 
            user: req.session.userId 
        }).populate('user', 'firstName lastName email');

        if (!bid) {
            console.log('BID NOT FOUND or ACCESS DENIED');
            return res.status(404).json({
                success: false,
                message: 'Bid not found or access denied'
            });
        }

        console.log('Generating PDF document for bid:', bid.projectName);
        
        // Recalculate prices to ensure we have the most up-to-date information
        try {
            console.log('Recalculating prices before PDF generation...');
            await bid.calculateAllPrices();
            await bid.save();
            console.log('Prices recalculated successfully');
        } catch (priceError) {
            console.warn('Warning: Could not recalculate prices:', priceError.message);
        }

        // Helper function to safely parse numeric values
        const safeParseFloat = (value, defaultValue = 0) => {
            if (value === null || value === undefined || value === '') return defaultValue;
            if (typeof value === 'number') return isNaN(value) ? defaultValue : value;
            if (typeof value === 'string') {
                const cleaned = value.toString().replace(/[$,]/g, '').trim();
                const parsed = parseFloat(cleaned);
                return isNaN(parsed) ? defaultValue : parsed;
            }
            return defaultValue;
        };

        // Helper function to format values
        const formatValue = (value, fallback = 'Not Specified') => {
            if (!value || value === 'undefined' || value === 'null') return fallback;
            if (typeof value === 'object' && value !== null) {
                return JSON.stringify(value) === '{}' ? fallback : 'Complex Data';
            }
            return String(value).trim() || fallback;
        };

        // Helper function to format currency values safely
        const formatCurrency = (value, fallback = '$0.00') => {
            const numericValue = safeParseFloat(value);
            return `$${numericValue.toFixed(2)}`;
        };

        // Helper function to format currency with internationalization
        const formatCurrencyIntl = (amount) => {
            const num = safeParseFloat(amount);
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD'
            }).format(num);
        };

        // Helper function to add section header
        const addSectionHeader = (title, marginTop = 1.5) => {
            doc.moveDown(marginTop);
            doc.fontSize(16)
               .fillColor('#2c3e50')
               .text(title, { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(12).fillColor('#34495e');
        };

        // Create PDF document with better margins
        const doc = new PDFDocument({ 
            margin: 60,
            size: 'A4',
            info: {
                Title: `Demolition Bid - ${bid.projectName || 'Project'}`,
                Author: 'BidPro System',
                Subject: 'Demolition Bid Proposal',
                Keywords: 'demolition, bid, proposal'
            }
        });
        
        // Set response headers for PDF download
        const safeProjectName = (bid.projectName || 'Project').replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Bid_Proposal_${safeProjectName}_${new Date().toISOString().split('T')[0]}.pdf"`);

        // Pipe the PDF to response
        doc.pipe(res);

        // Professional Header
        doc.fontSize(28)
           .fillColor('#1a365d')
           .text('DEMOLITION BID PROPOSAL', { align: 'center' });
        
        doc.fontSize(14)
           .fillColor('#4a5568')
           .text('Professional Demolition Services', { align: 'center' });
           
        doc.fontSize(10)
           .fillColor('#718096')
           .text(`Proposal Date: ${new Date().toLocaleDateString('en-US', { 
               year: 'numeric', 
               month: 'long', 
               day: 'numeric' 
           })}`, { align: 'center' });
        
        // Add a professional line separator
        doc.moveDown(1);
        doc.moveTo(80, doc.y)
           .lineTo(530, doc.y)
           .strokeColor('#e2e8f0')
           .lineWidth(2)
           .stroke();
        
        doc.moveDown(2);

        // Project Overview Section
        addSectionHeader('PROJECT OVERVIEW');
        
        // Project details in a professional format
        const projectData = {
            'Project Name': formatValue(bid.projectName || bid.projectDetails?.projectName),
            'Client Company': formatValue(bid.client || bid.clientInfo?.companyName),
            'Project Type': formatValue(bid.projectType || bid.projectDetails?.projectType, 'Demolition Project'),
            'Location': formatValue(bid.projectDetails?.location || bid.projectLocation),
            'Proposal Date': bid.projectDetails?.bidDate 
                ? new Date(bid.projectDetails.bidDate).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                }) 
                : new Date().toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                }),
            'Project Status': formatValue(bid.status, 'Under Review')
        };

        // Display project information in a clean table format
        Object.entries(projectData).forEach(([label, value]) => {
            if (value !== 'Not Specified') {
                doc.fontSize(11)
                   .fillColor('#2d3748')
                   .text(label, 70, doc.y, { width: 150, continued: true })
                   .text(': ', { continued: true })
                   .fillColor('#1a202c')
                   .text(value, { width: 300 });
                doc.moveDown(0.3);
            }
        });

        // Project Description/Scope with new structure
        const description = formatValue(
            bid.projectDescription || 
            bid.projectDetails?.description
        );
        
        // Handle new scopeOfWork structure
        const scopeOfWork = bid.scopeOfWork;
        let scopeText = '';
        
        if (scopeOfWork && typeof scopeOfWork === 'object') {
            const itemsToRemove = scopeOfWork.itemsToRemove || [];
            const itemsToRemain = scopeOfWork.itemsToRemain || [];
            
            if (itemsToRemove.length > 0) {
                scopeText += 'Items to Remove: ' + itemsToRemove.join(', ') + '. ';
            }
            if (itemsToRemain.length > 0) {
                scopeText += 'Items to Remain: ' + itemsToRemain.join(', ') + '. ';
            }
        } else if (typeof scopeOfWork === 'string') {
            scopeText = scopeOfWork;
        }
        
        const fullDescription = [description, scopeText].filter(text => 
            text && formatValue(text) !== 'Not Specified'
        ).join(' ');
        
        if (fullDescription) {
            addSectionHeader('PROJECT SCOPE & DESCRIPTION');
            
            // Clean up description text
            const cleanDescription = fullDescription
                .replace(/[\{\}]/g, '')
                .replace(/['"]/g, '')
                .replace(/,\s*/g, '. ')
                .replace(/\.\s*\./g, '.')
                .trim();
            
            doc.fontSize(11)
               .fillColor('#2d3748')
               .text(cleanDescription, { 
                   align: 'justify', 
                   lineGap: 4,
                   width: 480
               });
        }

        // Add Section Headers if available
        // if (bid.sectionHeaders && bid.sectionHeaders.length > 0) {
        //     addSectionHeader('DOCUMENT SECTIONS IDENTIFIED');
            
        //     bid.sectionHeaders.forEach((header, index) => {
        //         doc.fontSize(10)
        //            .fillColor('#2d3748')
        //            .text(`${index + 1}. ${formatValue(header)}`, 70, doc.y, { width: 480 });
        //         doc.moveDown(0.2);
        //     });
        // }

        // Add Basic Item Count from AI Processing
        // if (bid.basicItemCount && bid.basicItemCount > 0) {
        //     addSectionHeader('AI PROCESSING SUMMARY');
            
        //     doc.fontSize(11)
        //        .fillColor('#2d3748')
        //        .text('Items Identified in Phase 1 Processing: ', 70, doc.y, { width: 250, continued: true })
        //        .fillColor('#1a202c')
        //        .text(`${bid.basicItemCount} items`, { width: 230 });
        //     doc.moveDown(0.3);
        // }

        // Get the total proposed amount from the bid document (from API)
        const totalProposedAmount = safeParseFloat(bid.totalProposedAmount, 0);

        // Helper function to display contact information in a professional format
        const displayContactInfo = (title, info) => {
            const hasValidInfo = info && Object.keys(info).length > 0 && 
                Object.values(info).some(value => formatValue(value) !== 'Not Specified');
            
            if (!hasValidInfo) return;
            
            addSectionHeader(title);
            
            const contactData = {
                'Company Name': formatValue(info.companyName),
                'Contact Person': formatValue(info.contactPerson),
                'Address': formatValue(info.address),
                'Phone Number': formatValue(info.phone),
                'Email Address': formatValue(info.email)
            };
            
            if (info.license) contactData['License Number'] = formatValue(info.license);
            if (info.insurance) contactData['Insurance'] = formatValue(info.insurance);
            
            Object.entries(contactData).forEach(([label, value]) => {
                if (value !== 'Not Specified') {
                    doc.fontSize(11)
                       .fillColor('#2d3748')
                       .text(label, 70, doc.y, { width: 150, continued: true })
                       .text(': ', { continued: true })
                       .fillColor('#1a202c')
                       .text(value, { width: 300 });
                    doc.moveDown(0.3);
                }
            });
        };

        // Display contact information sections
        // if (bid.contractorInfo || bid.clientInfo) {
        //     // Add page break for contact info if needed
        //     if (doc.y > 600) doc.addPage();
            
        //     displayContactInfo('CONTRACTOR INFORMATION', bid.contractorInfo);
        //     displayContactInfo('CLIENT INFORMATION', bid.clientInfo);
        // }

        // Add Special Notes Section
        if (bid.specialNotes && bid.specialNotes.length > 0) {
            addSectionHeader('SPECIAL NOTES & CONSIDERATIONS');
            
            bid.specialNotes.forEach((note, index) => {
                doc.fontSize(10)
                   .fillColor('#2d3748')
                   .text(`• ${formatValue(note)}`, 70, doc.y, { width: 480 });
                doc.moveDown(0.3);
            });
        }

        // Add Total Price Section - Display total proposed amount from API
        if (totalProposedAmount > 0) {
            addSectionHeader('PROJECT PRICING');
            
            // Create a highlighted pricing box
            const pricingBoxTop = doc.y;
            const pricingBoxHeight = 80;
            
            // Draw pricing box background
            doc.rect(60, pricingBoxTop - 10, 520, pricingBoxHeight)
               .fillColor('#f0f9ff')
               .fill();
               
            doc.strokeColor('#0ea5e9')
               .lineWidth(2)
               .moveTo(60, pricingBoxTop - 10)
               .lineTo(580, pricingBoxTop - 10)
               .stroke();
            
            let currentY = pricingBoxTop + 5;
            
            // Display the total proposed amount prominently
            doc.fontSize(18)
               .fillColor('#1e3a8a')
               .font('Helvetica-Bold')
               .text('TOTAL PROJECT COST: ', 80, currentY, { width: 250, continued: true })
               .fillColor('#1e3a8a')
               .text(formatCurrency(totalProposedAmount), { width: 230 });
            
            currentY += 30;
            
            // Add pricing note
            // doc.fontSize(10)
            //    .fillColor('#374151')
            //    .font('Helvetica')
            //    .text('This amount represents the total proposed bid for the project.', 80, currentY, { width: 480 });
            
            doc.moveDown(2);
        }
        
        // Display original price info if available (as reference)
        const hasPriceInfo = bid.priceInfo && (bid.priceInfo.totalAmount || (bid.priceInfo.includes && bid.priceInfo.includes.length > 0));
        if (hasPriceInfo) {
            if (bid.priceInfo.totalAmount) {
                doc.fontSize(11)
                   .fillColor('#6b7280')
                   .font('Helvetica')
                //    .text('Original Document Total: ', 70, doc.y, { width: 200, continued: true })
                   .fillColor('#6b7280')
                //    .text(formatValue(bid.priceInfo.totalAmount), { width: 280 });
                doc.moveDown(0.3);
            }
            
            if (bid.priceInfo.includes && bid.priceInfo.includes.length > 0) {
                doc.fontSize(10)
                   .fillColor('#6b7280')
                   .text('Price Includes:', 70, doc.y, { width: 480 });
                doc.moveDown(0.2);
                
                bid.priceInfo.includes.forEach((item) => {
                    doc.fontSize(9)
                       .fillColor('#6b7280')
                       .text(`• ${formatValue(item)}`, 85, doc.y, { width: 465 });
                    doc.moveDown(0.1);
                });
            }
        }

        // Add Exclusions Section
        if (bid.exclusions && bid.exclusions.length > 0) {
            addSectionHeader('EXCLUSIONS');
            
            bid.exclusions.forEach((exclusion) => {
                doc.fontSize(10)
                   .fillColor('#e53e3e')
                   .text(`• ${formatValue(exclusion)}`, 70, doc.y, { width: 480 });
                doc.moveDown(0.3);
            });
        }

        // Add Additional Conditions Section
        if (bid.additionalConditions && bid.additionalConditions.length > 0) {
            addSectionHeader('TERMS & CONDITIONS');
            
            bid.additionalConditions.forEach((condition, index) => {
                doc.fontSize(10)
                   .fillColor('#2d3748')
                   .text(`${index + 1}. ${formatValue(condition)}`, 70, doc.y, { width: 480 });
                doc.moveDown(0.4);
            });
        }

        // Project Timeline and Additional Details (if available)
        const additionalDetails = bid.projectDetails;
        if (additionalDetails && Object.keys(additionalDetails).length > 0) {
            const hasRelevantDetails = Object.entries(additionalDetails).some(([key, value]) => {
                return !['documentType', 'bidDate', 'location', 'description'].includes(key) && 
                       formatValue(value) !== 'Not Specified';
            });
            
            // if (hasRelevantDetails) {
            //     addSectionHeader('ADDITIONAL PROJECT DETAILS');
                
            //     Object.entries(additionalDetails).forEach(([key, value]) => {
            //         if (!['documentType', 'bidDate', 'location', 'description'].includes(key)) {
            //             const formattedValue = formatValue(value);
            //             if (formattedValue !== 'Not Specified') {
            //                 const label = key.replace(/([A-Z])/g, ' $1')
            //                                .replace(/^./, str => str.toUpperCase());
                            
            //                 doc.fontSize(11)
            //                    .fillColor('#2d3748')
            //                    .text(label, 70, doc.y, { width: 150, continued: true })
            //                    .text(': ', { continued: true })
            //                    .fillColor('#1a202c')
            //                    .text(formattedValue, { width: 300 });
            //                 doc.moveDown(0.3);
            //             }
            //         }
            //     });
            // }
        }

        // Professional footer
        doc.moveDown(3);
        
        // Add a footer separator line
        doc.moveTo(80, doc.y)
           .lineTo(530, doc.y)
           .strokeColor('#e2e8f0')
           .lineWidth(1)
           .stroke();
        
        doc.moveDown(0.5);
        
        // Footer information
        doc.fontSize(8)
           .fillColor('#718096')
           .text('This proposal is valid for 30 days from the date of issuance.', { align: 'center' });
           
        doc.fontSize(7)
           .fillColor('#a0aec0')
           .text(
               `Document generated: ${new Date().toLocaleDateString('en-US', { 
                   year: 'numeric', 
                   month: 'long', 
                   day: 'numeric',
                   hour: '2-digit',
                   minute: '2-digit'
               })} | Proposal ID: ${id.substring(0, 8).toUpperCase()}`,
               { align: 'center' }
           );

        // Finalize PDF
        doc.end();

        console.log('PDF document generated and sent successfully');

    } catch (error) {
        console.error('=== DOWNLOAD BID DOCUMENT ERROR ===');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        
        // If headers haven't been sent yet, send JSON error
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: 'Error generating document',
                error: error.message
            });
        }
    }
};
