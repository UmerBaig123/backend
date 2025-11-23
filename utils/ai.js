import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PriceSheet from '../models/pricesheet.js';
import {
  processPhase1PDF,
  processPhase1Image,
  processPhase1Text,
  processPhase2PDF,
  processPhase2Image,
  processPhase2Text,
  processPhase2APDF,
  processPhase2AImage,
  processPhase2AText,
  processPhase2BPDF,
  processPhase2BImage,
  processPhase2BText,
  processRawMeasurementPDF,
  processRawMeasurementImage,
  processRawMeasurementText
} from './Aiprocess.js';

dotenv.config();

// Initialize Google Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Add region check function
async function checkGeminiRegion() {
  try {
    // console.log('🌍 Checking Gemini API region routing...');
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
    const result = await model.generateContent("Test connection - what region am I hitting?");
    if (result && result.response) {
      console.log('✅ Gemini API connection successful.');
      // console.log('📍 Response received - region routing working correctly.');
    }
  } catch (error) {
    if (error.message.includes('europe-west1')) {
      // console.error('❌ API is routing to europe-west1 - free keys only work in us-central1');
      console.error('💡 Solution: Regenerate your API key at https://makersuite.google.com/app/apikey');
      console.error('💡 Make sure you are accessing from a US-based IP or VPN');
    } else if (error.message.includes('quota')) {
      console.error('❌ Quota exceeded - daily limit reached');
      console.error('💡 Wait 24 hours or upgrade to paid plan');
    } else {
      console.error('❌ Gemini connection error:', error.message);
    }
  }
}

checkGeminiRegion();

// Function to fetch pricesheet items from database
async function fetchPricesheetItems(userId) {
  try {
    console.log('📋 Fetching pricesheet items for user:', userId);
    const pricesheetItems = await PriceSheet.find({ createdBy: userId }).sort({ category: 1, name: 1 });
    console.log(`✅ Found ${pricesheetItems.length} pricesheet items`);
    return pricesheetItems;
  } catch (error) {
    console.error('❌ Error fetching pricesheet items:', error);
    return [];
  }
}

// Three-Phase Gemini processing - Phase 1: Basic info, Phase 2A: Item names & pricesheet matching, Phase 2B: Measurements
async function performGeminiDocumentProcessing(tempFilePath, fileName, mimeType, userId = null) {
  try {
    console.log('=== GEMINI THREE-PHASE DOCUMENT PROCESSING START ===');
    console.log(`Processing file: ${fileName} (${mimeType})`);
    
    // PHASE 1: Extract basic document information
    console.log('🔄 PHASE 1: Extracting basic document information...');
    const phase1Result = await performPhase1Processing(tempFilePath, fileName, mimeType);
    
    // PHASE 2A: Extract demolition item names and match with pricesheet
    console.log('🔄 PHASE 2A: Extracting demolition item names and pricesheet matching...');
    const phase2AResult = await performPhase2AProcessing(tempFilePath, fileName, mimeType, phase1Result, userId);
    
    // PHASE 2B: Extract specific measurements for each found item
    console.log('🔄 PHASE 2B: Extracting measurements for each demolition item...');
    const phase2BResult = await performPhase2BProcessing(tempFilePath, fileName, mimeType, phase2AResult, userId);
    
    // Combine results
    const combinedResult = {
      ...phase1Result,
      demolitionItems: phase2BResult.demolitionItems,
      totalItems: phase2BResult.totalItems,
      pricingSummary: phase2BResult.pricingSummary,
      processingPhases: {
        phase1Success: phase1Result.success,
        phase2ASuccess: phase2AResult.success,
        phase2BSuccess: phase2BResult.success
      }
    };
    
    console.log('✅============= THREE-PHASE PROCESSING COMPLETED');
    console.log(`📊 Phase 1 Items: ${phase1Result.basicItemCount || 0}`);
    console.log(`📊 Phase 2A Items: ${phase2AResult.totalItems || 0}`);
    console.log(`📊 Phase 2B Items: ${phase2BResult.totalItems || 0}`);

    return combinedResult;
    
  } catch (error) {
    console.error('❌ Three-phase processing failed:', error);
    return {
      success: false,
      error: error.message,
      method: 'gemini-three-phase-failed'
    };
  }
}

// PHASE 1: Extract basic document information
async function performPhase1Processing(tempFilePath, fileName, mimeType) {
  try {
    const phase1Prompt = `You are an expert document analyst. Extract ONLY the relevant demolition/construction bid details from this document. The document may be long and contain unnecessary text — ignore anything not directly relevant.

EXTRACT ONLY:

1. CONTRACTOR INFORMATION:
- Company name exactly as written
- Complete address 
- Phone number
- Contact person name
- Email address
- License information

2. CLIENT INFORMATION:
- Client company name
- Client address
- Contact details if available

3. PROJECT DETAILS:
- Document type (bid, proposal, etc.)
- Date of document
- Project name/description
- Project location

4. DOCUMENT STRUCTURE:
- Count how many numbered/lettered items are in the document (for Phase 2 reference)
- Note any section headers like "Demolition Plan Keynotes"

5. SCOPE OF WORK (Demolition Tasks):
- A numbered or bulleted list of all demolition/removal tasks
- Clearly separate "Items to Remain" vs "Items to Remove"

6. SPECIAL NOTES/KEYNOTES:
- Any mentions of "remain," "excluded," or "retain" should be listed here

7. PRICE INFORMATION:
- Total Amount (with currency)
- Any mention of broom sweep, dumpsters, labor, or equipment included

8. EXCLUSIONS:
- A clear list of everything excluded (e.g., MEP, sawcutting, roof work, permits, etc.)

9. ADDITIONAL CONDITIONS:
- Any disclaimers, abatement notes, safety barriers, protection, permits, or patch/paint details

Return ONLY this JSON structure:
{
  "success": true,
  "contractorInfo": {
    "companyName": "exact company name",
    "address": "full address",
    "phone": "phone number", 
    "contactPerson": "contact name",
    "email": "email address",
    "license": "license info"
  },
  "clientInfo": {
    "companyName": "client company name",
    "address": "client address"
  },
  "projectDetails": {
    "documentType": "document type",
    "bidDate": "document date",
    "projectName": "project name",
    "location": "project location"
  },
  "basicItemCount": "number of items found for Phase 2",
  "sectionHeaders": ["list of section headers found"],
  "scopeOfWork": {
    "itemsToRemove": ["list of removal tasks"],
    "itemsToRemain": ["list of items to remain"]
  },
  "specialNotes": ["list of remain/excluded/retain notes"],
  "priceInfo": {
    "totalAmount": "amount with currency",
    "includes": ["list of included items like broom sweep, dumpsters, labor, equipment"]
  },
  "exclusions": ["list of excluded work items"],
  "additionalConditions": ["list of disclaimers, safety, abatement, permits, patch/paint details"]
}`;

    // Process based on file type
    let phase1Response;
    if (mimeType.includes('pdf')) {
      phase1Response = await processPhase1PDF(tempFilePath, phase1Prompt);
    } else if (mimeType.includes('image')) {
      phase1Response = await processPhase1Image(tempFilePath, phase1Prompt);
    } else {
      phase1Response = await processPhase1Text(tempFilePath, phase1Prompt);
    }

    return phase1Response;

  } catch (error) {
    console.error(' Phase 1 processing failed:', error);
    return {
      success: false,
      error: error.message,
      method: 'gemini-phase1-failed'
    };
  }
}

// PHASE 2A: Extract demolition item names and match with pricesheet
async function performPhase2AProcessing(tempFilePath, fileName, mimeType, phase1Data, userId = null) {
  try {
    console.log('🔍 Phase 2A: Extracting demolition item names and pricesheet matching...');
    console.log(`Phase 1 found ${phase1Data.basicItemCount || 'unknown'} items to analyze`);
    
    // Fetch pricesheet items from database if userId is provided
    let pricesheetItems = [];
    let pricesheetPromptSection = '';
    
    if (userId) {
      pricesheetItems = await fetchPricesheetItems(userId);
      
      if (pricesheetItems.length > 0) {
        // Group items by category for better organization
        const itemsByCategory = pricesheetItems.reduce((acc, item) => {
          const category = item.category || 'Uncategorized';
          if (!acc[category]) acc[category] = [];
          acc[category].push(item);
          return acc;
        }, {});
        
        pricesheetPromptSection = `

AVAILABLE PRICESHEET ITEMS FOR MATCHING:
When extracting items, try to match them with these pre-defined pricesheet items. If you find a match, use the exact name and include the price reference:

`;
        
        // Add each category and its items
        Object.entries(itemsByCategory).forEach(([category, items]) => {
          pricesheetPromptSection += `${category.toUpperCase()}:\n`;
          items.forEach(item => {
            pricesheetPromptSection += `- "${item.name}" (Price: $${item.price})\n`;
          });
          pricesheetPromptSection += '\n';
        });
        
        pricesheetPromptSection += `MATCHING INSTRUCTIONS:
- If you find an item in the document that closely matches a pricesheet item, use the exact pricesheet item name
- Include the pricesheet price in the "pricesheetMatch" field
- If no match found, use the original document description

- Be flexible with matching (e.g., "Wall Removal" could match "Remove Interior Wall") but ensure unit compatibility
- Example: "Doors/Frames - 3 EA" should only match pricesheet items with "EA" unit, not "SF" items

`;
      }
    }
    
    const phase2APrompt = `You are a demolition specialist. Extract demolition item names and match with pricesheet items.

CONTEXT:
- Contractor: ${phase1Data.contractorInfo?.companyName || 'Unknown'}
- Expected Items: ${phase1Data.basicItemCount || 'Multiple'}
${pricesheetPromptSection}

TASK: Extract demolition item names only. NO measurements.

LOOK FOR:
- Wall/partition removals
- Door and frame removals  
- Electrical work (panels, fixtures, outlets)
- Flooring removals
- Plumbing fixtures (sinks, water heaters, lavatories)
- Ceiling systems (ACT, grid, diffusers, lights)
- HVAC components
- Cleanup items (broomsweep, dumpsters)
- Items marked "Remain", "Excluded", or "Remove"

EXAMPLES:
- "Suspended Ceiling - SF" → name: "Suspended Ceiling"
- "Interior Walls - 2 x 4 x 14' height - SF" → name: "Interior Walls"
- "Cove base - LF" → name: "Cove base"
- "Doors/Frames" → name: "Doors/Frames"

RULES:
- Extract ONLY item names, NO measurements
- Match with pricesheet items when possible
- Use exact pricesheet names for matches
- Keep names short and descriptive
- If no match found, use document description

CRITICAL: Return ONLY valid JSON. Use null for missing values. No extra text.

{
  "success": true,
  "totalItems": 0,
  "demolitionItems": [
    {
      "itemNumber": "1",
      "name": "item name",
      "description": "full description",
      "category": "wall/ceiling/floor/electrical/plumbing/cleanup/other",
      "action": "Remove/Remain/Excluded",
      "pricesheetMatch": {
        "matched": false,
        "itemName": null,
        "itemPrice": null,
        "itemId": null
      }
    }
  ]
}`;

    // Process based on file type using Phase 1 context
    let phase2AResponse;
    if (mimeType.includes('pdf')) {
      phase2AResponse = await processPhase2APDF(tempFilePath, phase2APrompt);
    } else if (mimeType.includes('image')) {
      phase2AResponse = await processPhase2AImage(tempFilePath, phase2APrompt);
    } else {
      phase2AResponse = await processPhase2AText(tempFilePath, phase2APrompt);
    }

    // Post-process to enhance pricesheet matching
    if (phase2AResponse.success && pricesheetItems.length > 0) {
      phase2AResponse = enhancePricesheetMatching(phase2AResponse, pricesheetItems);
      // Calculate prices for matched items
      phase2AResponse = calculatePricesForMatchedItems(phase2AResponse, pricesheetItems);
    }

    return phase2AResponse;

  } catch (error) {
    console.error('❌ Phase 2A processing failed:', error);
    return {
      success: false,
      error: error.message,
      method: 'gemini-phase2a-failed',
      demolitionItems: [],
      totalItems: 0
    };
  }
}

// PHASE 2B: Extract specific measurements for each demolition item using multi-prompt approach
async function performPhase2BProcessing(tempFilePath, fileName, mimeType, phase2AData, userId = null) {
  try {
    console.log('📏 Phase 2B: Extracting measurements using multi-prompt approach...');
    console.log(`Phase 2A found ${phase2AData.totalItems || 0} items to measure`);
    
    if (!phase2AData.demolitionItems || phase2AData.demolitionItems.length === 0) {
      console.log('⚠️ No items found in Phase 2A, skipping measurement extraction');
      return {
        success: true,
        demolitionItems: [],
        totalItems: 0,
        pricingSummary: {
          totalCalculatedCost: 0,
          itemsWithCalculatedPrices: 0,
          itemsWithoutPrices: 0,
          itemsWithErrors: 0,
          totalItems: 0,
          calculationMethod: 'no_items_found'
        }
      };
    }

    // PROMPT 1: Extract raw measurement text without interpretation
    console.log('🔄 [PHASE 2B] Step 1: Extracting raw measurement text...');
    const rawMeasurementsResult = await performRawMeasurementExtraction(tempFilePath, mimeType, phase2AData);
    
    if (!rawMeasurementsResult.success) {
      console.log('[PHASE 2B] Raw measurement extraction failed, using fallback approach');
      console.log(' Raw measurement error:', rawMeasurementsResult.error);
      return await performFallbackMeasurementExtraction(tempFilePath, mimeType, phase2AData);
    }

    console.log('✅ [PHASE 2B] Step 1 completed successfully');
    console.log('📊 Raw measurements extracted:', rawMeasurementsResult.rawMeasurements?.length || 0);

    // PROMPT 2: Normalize measurements into count, linear feet, square feet format
    console.log('🔄 [PHASE 2B] Step 2: Normalizing measurements...');
    console.log('📊 Raw measurements to normalize:', rawMeasurementsResult.rawMeasurements?.length || 0);
    console.log('📋 Raw measurements data:');
    console.log(JSON.stringify(rawMeasurementsResult.rawMeasurements, null, 2));
    
    const normalizedMeasurementsResult = await performMeasurementNormalization(rawMeasurementsResult.rawMeasurements);
    
    if (!normalizedMeasurementsResult.success) {
      console.log('⚠️ [PHASE 2B] Measurement normalization failed, using fallback approach');
      console.log('❌ Normalization error:', normalizedMeasurementsResult.error);
      return await performFallbackMeasurementExtraction(tempFilePath, mimeType, phase2AData);
    }

    console.log('✅ [PHASE 2B] Step 2 completed successfully');
    console.log('📊 Normalized measurements:', normalizedMeasurementsResult.normalizedMeasurements?.length || 0);

    // PROMPT 3: Align measurements with pricesheet items for price calculation
    console.log('🔄 [PHASE 2B] Step 3: Aligning measurements with pricesheet items...');
    console.log('📊 Normalized measurements to align:', normalizedMeasurementsResult.normalizedMeasurements?.length || 0);
    console.log('📋 Normalized measurements data:');
    console.log(JSON.stringify(normalizedMeasurementsResult.normalizedMeasurements, null, 2));
    
    const finalResult = await performMeasurementAlignment(tempFilePath, mimeType, phase2AData, normalizedMeasurementsResult.normalizedMeasurements, userId);

    if (finalResult.success) {
      console.log('✅ [PHASE 2B] Step 3 completed successfully');
      console.log('📊 Final demolition items:', finalResult.demolitionItems?.length || 0);
    } else {
      console.log('❌ [PHASE 2B] Step 3 failed:', finalResult.error);
    }

    return finalResult;

  } catch (error) {
    console.error('❌ Phase 2B processing failed:', error);
    return {
      success: false,
      error: error.message,
      method: 'gemini-phase2b-failed',
      demolitionItems: phase2AData.demolitionItems || [],
      totalItems: phase2AData.totalItems || 0
    };
  }
}

// PROMPT 1: Extract raw measurement text without interpretation
async function performRawMeasurementExtraction(tempFilePath, mimeType, phase2AData) {
  try {
    console.log('🔍 [RAW MEASUREMENT EXTRACTION] Starting raw measurement extraction...');
    console.log('📄 File type:', mimeType);
    console.log('📊 Phase 2A items count:', phase2AData.demolitionItems?.length || 0);
    
    const rawMeasurementPrompt = `You are a document analysis specialist. Extract every line that mentions an item and its measurement (count, length, area) exactly as written, without interpretation.

TASK: Find ALL lines in the document that contain:
- Item names/descriptions
- Measurement values (numbers with units like SF, LF, EA, etc.)
- Quantities, dimensions, areas, counts

EXTRACT EXACTLY AS WRITTEN:
- Do NOT interpret or convert measurements
- Do NOT calculate or estimate
- Do NOT modify the text
- Include the complete line containing both item and measurement

CRITICAL JSON REQUIREMENTS:
- Return ONLY valid JSON - no markdown, no explanations, no extra text
- Start with { and end with }
- Ensure all arrays are properly closed with ]
- Ensure all objects are properly closed with }
- Use proper JSON syntax with commas between array elements
- Escape any quotes in the text properly
- DO NOT include separators like "---" or "---" between JSON objects
- DO NOT include any text outside the JSON structure



EXAMPLES:
- Item: "Suspended Ceiling", measurementText: "3,550 SF"
- Item: "Cove base", measurementText: "75 LF" 
- Item: "Doors/Frames", measurementText: "3 EA"
- Item: "Interior Walls", measurementText: "2 x 4 x 14' height - 1,200 SF"

IMPORTANT: Make sure your JSON is complete and valid. Check that all brackets and braces are properly closed.

REQUIRED JSON STRUCTURE - YOU MUST RETURN EXACTLY THIS FORMAT:
{
  "success": true,
  "rawMeasurements": [
    {
      "item": "exact item name as written",
      "measurementText": "exact measurement text as written"
    }
  ]
}

EXAMPLE ARRAY STRUCTURE:
[
  {
    "item": "Suspended Ceiling System",
    "measurementText": "3,550 SF"
  },
  {
    "item": "Interior Partition Walls", 
    "measurementText": "2 x 4 x 14' height - 1,200 SF"
  },
  {
    "item": "Cove Base Molding",
    "measurementText": "75 LF"
  },
  {
    "item": "Doors and Frames",
    "measurementText": "3 EA"
  },
  {
    "item": "VCT Flooring",
    "measurementText": "800 SF"
  }
]

CRITICAL REQUIREMENTS:
- Return ONLY valid JSON - no markdown, no explanations, no extra text
- Start with { and end with }
- Ensure all arrays are properly closed with ]
- Ensure all objects are properly closed with }
- Use proper JSON syntax with commas between array elements
- Escape any quotes in the text properly
- DO NOT include separators like "---" between JSON objects
- DO NOT include any text outside the JSON structure
- Make sure your JSON is complete and valid before returning

IMPORTANT: Check that all brackets and braces are properly closed. Return ONLY the JSON above.`;

    console.log('🤖 [RAW MEASUREMENT EXTRACTION] Sending prompt to AI...');
    let rawMeasurementResponse;
    
    // Use specialized raw measurement extraction instead of standard Phase 2B processing
    if (mimeType.includes('pdf')) {
      rawMeasurementResponse = await processRawMeasurementPDF(tempFilePath, rawMeasurementPrompt);
    } else if (mimeType.includes('image')) {
      rawMeasurementResponse = await processRawMeasurementImage(tempFilePath, rawMeasurementPrompt);
    } else {
      rawMeasurementResponse = await processRawMeasurementText(tempFilePath, rawMeasurementPrompt);
    }

    console.log('📥 [RAW MEASUREMENT EXTRACTION] Received response from AI');
    console.log('📥 Response type:', typeof rawMeasurementResponse);
    console.log('📥 Response success:', rawMeasurementResponse?.success);
    
    if (typeof rawMeasurementResponse === 'string') {
      console.log('📥 Raw response length:', rawMeasurementResponse.length);
      console.log('📥 Raw response preview:', rawMeasurementResponse.substring(0, 500) + '...');
      console.log('📥 Raw response ending:', '...' + rawMeasurementResponse.substring(rawMeasurementResponse.length - 200));
      console.log('📥 FULL RAW RESPONSE:');
      console.log('='.repeat(80));
      console.log(rawMeasurementResponse);
      console.log('='.repeat(80));
    } else {
      console.log('📥 Full response:', JSON.stringify(rawMeasurementResponse, null, 2));
    }

    // Enhanced JSON parsing to handle markdown code blocks and incomplete JSON
    if (rawMeasurementResponse && typeof rawMeasurementResponse === 'object' && rawMeasurementResponse.success) {
      console.log('✅ [RAW MEASUREMENT EXTRACTION] Response is already parsed object');
      console.log('📊 Raw measurements count:', rawMeasurementResponse.rawMeasurements?.length || 0);
      return rawMeasurementResponse;
    }

    // If response is a string, try to extract and fix JSON from it
    if (typeof rawMeasurementResponse === 'string') {
      console.log('🔧 [RAW MEASUREMENT EXTRACTION] Processing string response...');
      let cleanedResponse = rawMeasurementResponse;
      
      // Remove markdown code blocks if present
      if (cleanedResponse.includes('```json')) {
        console.log('🧹 [RAW MEASUREMENT EXTRACTION] Removing ```json markdown blocks');
        cleanedResponse = cleanedResponse.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
      } else if (cleanedResponse.includes('```')) {
        console.log('🧹 [RAW MEASUREMENT EXTRACTION] Removing ``` markdown blocks');
        cleanedResponse = cleanedResponse.replace(/```\s*/g, '').replace(/```\s*$/g, '');
      }
      
      // Remove separators and other problematic text
      console.log('🧹 [RAW MEASUREMENT EXTRACTION] Cleaning separators and extra text...');
      cleanedResponse = cleanedResponse
        .replace(/---+/g, '') // Remove --- separators
        .replace(/\n\s*\n/g, '\n') // Remove extra blank lines
        .replace(/^\s*[\d]+\.\s*/gm, '') // Remove numbered list items
        .trim();
      
      // Try to find and fix incomplete JSON
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        console.log('🔍 [RAW MEASUREMENT EXTRACTION] Found JSON match in response');
        let jsonStr = jsonMatch[0];
        console.log('📝 JSON string length:', jsonStr.length);
        console.log('📝 JSON preview:', jsonStr.substring(0, 300) + '...');
        
        // Check if JSON is incomplete (missing closing brackets)
        const openBraces = (jsonStr.match(/\{/g) || []).length;
        const closeBraces = (jsonStr.match(/\}/g) || []).length;
        const openBrackets = (jsonStr.match(/\[/g) || []).length;
        const closeBrackets = (jsonStr.match(/\]/g) || []).length;
        
        console.log('🔍 [RAW MEASUREMENT EXTRACTION] JSON structure check:');
        console.log('  - Open braces: {', openBraces, 'Close braces: }', closeBraces);
        console.log('  - Open brackets: [', openBrackets, 'Close brackets: ]', closeBrackets);
        
        // If JSON is incomplete, try to fix it
        if (openBraces > closeBraces || openBrackets > closeBrackets) {
          console.log('⚠️ [RAW MEASUREMENT EXTRACTION] Detected incomplete JSON, attempting to fix...');
          
          // Add missing closing brackets
          while (openBraces > closeBraces) {
            jsonStr += '}';
            closeBraces++;
          }
          while (openBrackets > closeBrackets) {
            jsonStr += ']';
            closeBrackets++;
          }
          console.log('🔧 [RAW MEASUREMENT EXTRACTION] Fixed JSON structure');
        }
        
        try {
          const parsed = JSON.parse(jsonStr);
          console.log('✅ [RAW MEASUREMENT EXTRACTION] Successfully parsed JSON');
          console.log('📊 Parsed raw measurements count:', parsed.rawMeasurements?.length || 0);
          if (parsed.rawMeasurements && parsed.rawMeasurements.length > 0) {
            console.log('📋 Sample raw measurements:');
            parsed.rawMeasurements.slice(0, 3).forEach((item, index) => {
              console.log(`  ${index + 1}. Item: "${item.item}", Measurement: "${item.measurementText}"`);
            });
          }
          return parsed;
        } catch (parseError) {
          console.error('❌ [RAW MEASUREMENT EXTRACTION] JSON parsing failed:', parseError.message);
          console.error('📝 Error position:', parseError.message.match(/position (\d+)/)?.[1] || 'unknown');
          console.error('📝 JSON string length:', jsonStr.length);
          console.error('📝 JSON string around error:');
          
          // Show context around the error position
          const errorPos = parseInt(parseError.message.match(/position (\d+)/)?.[1]) || 0;
          const start = Math.max(0, errorPos - 100);
          const end = Math.min(jsonStr.length, errorPos + 100);
          console.error('📝 Context:', jsonStr.substring(start, end));
          console.error('📝 Full JSON string:', jsonStr);
          
          // Try to fix common JSON issues
          console.log('🔧 [RAW MEASUREMENT EXTRACTION] Attempting to fix JSON...');
          let fixedJson = jsonStr;
          
          // Fix common issues
          fixedJson = fixedJson
            .replace(/,\s*}/g, '}') // Remove trailing commas before }
            .replace(/,\s*]/g, ']') // Remove trailing commas before ]
            .replace(/([^\\])\\([^"\\\/bfnrt])/g, '$1\\\\$2') // Fix unescaped backslashes
            .replace(/([^\\])\\([^"\\\/bfnrt])/g, '$1\\\\$2'); // Fix unescaped backslashes again
          
          try {
            const fixedParsed = JSON.parse(fixedJson);
            console.log('✅ [RAW MEASUREMENT EXTRACTION] Successfully fixed and parsed JSON');
            return fixedParsed;
          } catch (fixError) {
            console.error('❌ [RAW MEASUREMENT EXTRACTION] JSON fix failed:', fixError.message);
            return { success: false, error: 'Invalid JSON response - could not parse or fix' };
          }
        }
      } else {
        console.log('❌ [RAW MEASUREMENT EXTRACTION] No JSON match found in response');
      }
    }

    console.log('⚠️ [RAW MEASUREMENT EXTRACTION] Returning original response');
    return rawMeasurementResponse;

  } catch (error) {
    console.error('❌ [RAW MEASUREMENT EXTRACTION] Raw measurement extraction failed:', error);
    return { success: false, error: error.message };
  }
}

// PROMPT 2: Normalize measurements into count, linear feet, square feet format
async function performMeasurementNormalization(rawMeasurements) {
  try {
    console.log('🔧 [MEASUREMENT NORMALIZATION] Starting measurement normalization...');
    console.log('📊 Raw measurements count:', rawMeasurements?.length || 0);
    
    if (rawMeasurements && rawMeasurements.length > 0) {
      console.log('📋 Sample raw measurements to normalize:');
      rawMeasurements.slice(0, 3).forEach((item, index) => {
        console.log(`  ${index + 1}. Item: "${item.item}", Measurement: "${item.measurementText}"`);
      });
      console.log('📋 FULL RAW MEASUREMENTS DATA:');
      console.log('='.repeat(80));
      console.log(JSON.stringify(rawMeasurements, null, 2));
      console.log('='.repeat(80));
    }
    
    const normalizationPrompt = `You are a measurement normalization specialist. Convert the raw measurement text into standardized count, linear feet, and square feet format.

RAW MEASUREMENTS TO NORMALIZE:
${JSON.stringify(rawMeasurements, null, 2)}

NORMALIZATION RULES:

AREA ITEMS (SF - Square Feet):
- Look for: SF, sq ft, square feet, sq.ft., sqft
- Convert to: squareFeet (numeric value)
- Examples: "3,550 SF" → squareFeet: 3550, unit: "SF"

LINEAR ITEMS (LF - Linear Feet):
- Look for: LF, linear feet, linear ft, lf
- Convert to: linearFeet (numeric value)
- Examples: "75 LF" → linearFeet: 75, unit: "LF"

COUNT ITEMS (EA - Each):
- Look for: EA, each, units, pieces, count
- Convert to: count (numeric value)
- Examples: "3 EA" → count: 3, unit: "EA"

DIMENSIONS:
- Extract specific dimensions like "2 x 4 x 14' height"
- Keep as text in dimensions field

IMPORTANT: Return ONLY valid JSON. Do NOT include markdown code blocks, explanations, or any other text. Start with { and end with }.
- DO NOT include separators like "---" or "---" between JSON objects
- DO NOT include any text outside the JSON structure

{
  "success": true,
  "normalizedMeasurements": [
    {
      "item": "item name",
      "measurements": {
        "quantity": 0,
        "unit": "SF/LF/EA",
        "squareFeet": 0,
        "linearFeet": 0,
        "count": 0,
        "dimensions": "dimensions if available"
      }
    }
  ]
}

CRITICAL: Return ONLY valid JSON. Use null for missing values.`;

    console.log('🤖 [MEASUREMENT NORMALIZATION] Sending normalization prompt to AI...');
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
    const result = await model.generateContent(normalizationPrompt);
    const response = await result.response;
    const responseText = response.text();
    
    console.log('📥 [MEASUREMENT NORMALIZATION] Received response from AI');
    console.log('📥 Response length:', responseText.length);
    console.log('📥 Response preview:', responseText.substring(0, 200) + '...');
    
    // Enhanced JSON parsing to handle markdown code blocks
    let cleanedResponse = responseText;
    
    // Remove markdown code blocks if present
    if (cleanedResponse.includes('```json')) {
      console.log('🧹 [MEASUREMENT NORMALIZATION] Removing ```json markdown blocks');
      cleanedResponse = cleanedResponse.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
    } else if (cleanedResponse.includes('```')) {
      console.log('🧹 [MEASUREMENT NORMALIZATION] Removing ``` markdown blocks');
      cleanedResponse = cleanedResponse.replace(/```\s*/g, '').replace(/```\s*$/g, '');
    }
    
    // Remove separators and other problematic text
    console.log('🧹 [MEASUREMENT NORMALIZATION] Cleaning separators and extra text...');
    cleanedResponse = cleanedResponse
      .replace(/---+/g, '') // Remove --- separators
      .replace(/\n\s*\n/g, '\n') // Remove extra blank lines
      .replace(/^\s*[\d]+\.\s*/gm, '') // Remove numbered list items
      .trim();
    
    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      console.log('🔍 [MEASUREMENT NORMALIZATION] Found JSON match in response');
      console.log('📝 NORMALIZATION RESPONSE JSON:');
      console.log('='.repeat(80));
      console.log(jsonMatch[0]);
      console.log('='.repeat(80));
      
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('✅ [MEASUREMENT NORMALIZATION] Successfully parsed JSON');
        console.log('📊 Normalized measurements count:', parsed.normalizedMeasurements?.length || 0);
        if (parsed.normalizedMeasurements && parsed.normalizedMeasurements.length > 0) {
          console.log('📋 Sample normalized measurements:');
          parsed.normalizedMeasurements.slice(0, 3).forEach((item, index) => {
            console.log(`  ${index + 1}. Item: "${item.item}"`);
            console.log(`     Measurements:`, item.measurements);
          });
          console.log('📋 FULL NORMALIZED MEASUREMENTS:');
          console.log('='.repeat(80));
          console.log(JSON.stringify(parsed.normalizedMeasurements, null, 2));
          console.log('='.repeat(80));
        }
        return parsed;
      } catch (parseError) {
        console.error('❌ [MEASUREMENT NORMALIZATION] JSON parsing failed:', parseError.message);
        console.error('📝 Raw JSON string:', jsonMatch[0].substring(0, 500) + '...');
        return { success: false, error: 'Invalid JSON response from measurement normalization' };
      }
    } else {
      console.log('❌ [MEASUREMENT NORMALIZATION] No JSON match found in response');
      throw new Error('Invalid JSON response from measurement normalization');
    }

  } catch (error) {
    console.error('❌ [MEASUREMENT NORMALIZATION] Measurement normalization failed:', error);
    return { success: false, error: error.message };
  }
}

// PROMPT 3: Align measurements with pricesheet items for price calculation
async function performMeasurementAlignment(tempFilePath, mimeType, phase2AData, normalizedMeasurements, userId) {
  try {
    console.log('🎯 [MEASUREMENT ALIGNMENT] Starting measurement alignment...');
    console.log('📊 Phase 2A items count:', phase2AData.demolitionItems?.length || 0);
    console.log('📊 Normalized measurements count:', normalizedMeasurements?.length || 0);
    console.log('👤 User ID provided:', !!userId);
    
    console.log('📋 PHASE 2A DATA:');
    console.log('='.repeat(80));
    console.log(JSON.stringify(phase2AData, null, 2));
    console.log('='.repeat(80));
    
    console.log('📋 NORMALIZED MEASUREMENTS FOR ALIGNMENT:');
    console.log('='.repeat(80));
    console.log(JSON.stringify(normalizedMeasurements, null, 2));
    console.log('='.repeat(80));
    
    // Fetch pricesheet items if userId is provided
    let pricesheetItems = [];
    let pricesheetPromptSection = '';
    
    if (userId) {
      console.log('📋 [MEASUREMENT ALIGNMENT] Fetching pricesheet items...');
      pricesheetItems = await fetchPricesheetItems(userId);
      console.log('📋 Pricesheet items found:', pricesheetItems.length);
      
      if (pricesheetItems.length > 0) {
        const itemsByCategory = pricesheetItems.reduce((acc, item) => {
          const category = item.category || 'Uncategorized';
          if (!acc[category]) acc[category] = [];
          acc[category].push(item);
          return acc;
        }, {});
        
        console.log('📋 Pricesheet categories:', Object.keys(itemsByCategory));
        
        pricesheetPromptSection = `

AVAILABLE PRICESHEET ITEMS FOR ALIGNMENT:
When aligning measurements, try to match them with these pre-defined pricesheet items:

`;
        
        Object.entries(itemsByCategory).forEach(([category, items]) => {
          pricesheetPromptSection += `${category.toUpperCase()}:\n`;
          items.forEach(item => {
            pricesheetPromptSection += `- "${item.name}" (Price: $${item.price})\n`;
          });
          pricesheetPromptSection += '\n';
        });
      }
    }

    console.log('🤖 [MEASUREMENT ALIGNMENT] Creating alignment prompt...');
    const alignmentPrompt = `You are a measurement alignment specialist. Align the normalized measurements with the demolition items from Phase 2A and match with pricesheet items for price calculation.

PHASE 2A ITEMS:
${phase2AData.demolitionItems.map((item, index) => 
  `${index + 1}. ${item.name} (${item.category}) - ${item.description}`
).join('\n')}

NORMALIZED MEASUREMENTS:
${JSON.stringify(normalizedMeasurements, null, 2)}
${pricesheetPromptSection}

ALIGNMENT TASK:
1. Match each Phase 2A item with its corresponding normalized measurement
2. If pricesheet items are available, try to match with them for pricing
3. Calculate total prices based on measurements and unit prices
4. Maintain the exact same structure as the current system

IMPORTANT: Return ONLY valid JSON. Do NOT include markdown code blocks, explanations, or any other text. Start with { and end with }.
- DO NOT include separators like "---" or "---" between JSON objects
- DO NOT include any text outside the JSON structure

{
  "success": true,
  "totalItems": ${phase2AData.totalItems},
  "demolitionItems": [
    {
      "itemNumber": "1",
      "name": "item name from Phase 2A",
      "description": "description from Phase 2A",
      "category": "category from Phase 2A",
      "action": "action from Phase 2A",
      "measurements": {
        "quantity": 0,
        "unit": "SF/LF/EA",
        "squareFeet": 0,
        "linearFeet": 0,
        "count": 0,
        "dimensions": "dimensions if available"
      },
      "pricing": "unit price if found",
      "proposedBid": null,
      "pricesheetMatch": {
        "matched": false,
        "itemName": "matched pricesheet item name",
        "itemPrice": 0,
        "itemId": "matched pricesheet item id"
      },
      "calculatedUnitPrice": 0,
      "calculatedTotalPrice": 0,
      "priceCalculation": {
        "quantity": 0,
        "unitPrice": 0,
        "totalPrice": 0,
        "calculationMethod": "pricesheet/ai_extracted/manual",
        "lastCalculated": "${new Date().toISOString()}",
        "hasValidPrice": true,
        "measurementType": "area/linear/count/unknown"
      }
    }
  ]
}

CRITICAL: Return ONLY valid JSON. Use the exact same structure as the current system.`;

    console.log('🤖 [MEASUREMENT ALIGNMENT] Sending alignment prompt to AI...');
    console.log('📄 File type:', mimeType);
    let alignmentResponse;
    if (mimeType.includes('pdf')) {
      alignmentResponse = await processPhase2BPDF(tempFilePath, alignmentPrompt);
    } else if (mimeType.includes('image')) {
      alignmentResponse = await processPhase2BImage(tempFilePath, alignmentPrompt);
    } else {
      alignmentResponse = await processPhase2BText(tempFilePath, alignmentPrompt);
    }

    console.log('📥 [MEASUREMENT ALIGNMENT] Received response from AI');
    console.log('📥 Response success:', alignmentResponse?.success);
    console.log('📥 Response type:', typeof alignmentResponse);
    
    if (alignmentResponse && alignmentResponse.demolitionItems) {
      console.log('📊 Aligned demolition items count:', alignmentResponse.demolitionItems.length);
    }
    
    console.log('📋 ALIGNMENT RESPONSE:');
    console.log('='.repeat(80));
    console.log(JSON.stringify(alignmentResponse, null, 2));
    console.log('='.repeat(80));

    // Calculate final prices if alignment was successful
    if (alignmentResponse.success) {
      console.log('💰 [MEASUREMENT ALIGNMENT] Calculating final prices...');
      alignmentResponse = calculatePricesForMatchedItems(alignmentResponse, pricesheetItems);
      console.log('✅ [MEASUREMENT ALIGNMENT] Price calculation completed');
    } else {
      console.log('⚠️ [MEASUREMENT ALIGNMENT] Alignment failed, skipping price calculation');
    }

    return alignmentResponse;

  } catch (error) {
    console.error('❌ Measurement alignment failed:', error);
    return {
      success: false,
      error: error.message,
      demolitionItems: phase2AData.demolitionItems || [],
      totalItems: phase2AData.totalItems || 0
    };
  }
}

// Fallback measurement extraction using the original approach
async function performFallbackMeasurementExtraction(tempFilePath, mimeType, phase2AData) {
  try {
    console.log('Using fallback measurement extraction...');
    
    // Create item list for measurement extraction
    const itemList = phase2AData.demolitionItems.map((item, index) => 
      `${index + 1}. ${item.name} (${item.category}) - ${item.description}`
    ).join('\n');

    const fallbackPrompt = `You are a demolition measurement specialist. Extract measurements for each item.

ITEMS TO MEASURE:
${itemList}

MEASUREMENT RULES:

AREA ITEMS (SF):
- Suspended Ceiling, Sheetrock Ceiling, Interior Walls, VCT Flooring, Ceramic Tile Flooring, Storefront, Windows
- Extract: squareFeet value, unit: "SF"

LINEAR ITEMS (LF):
- Cove base, Millwork, Trim, Molding
- Extract: linearFeet value, unit: "LF"

COUNT ITEMS (EA):
- Doors/Frames, Light fixtures, Diffusers, Bathroom Partitions, Plumbing fixtures
- Extract: count value, unit: "EA"

EXAMPLES:
- "Suspended Ceiling" with "3,550" → squareFeet: 3550, unit: "SF"
- "Cove base" with "75" → linearFeet: 75, unit: "LF"
- "Doors/Frames" with "3" → count: 3, unit: "EA"

RULES:
- Match measurements to items even if elsewhere in document
- Extract ONLY numeric values
- Assign correct unit based on item type
- Use null if no measurement found
- Better to have null than wrong values

CRITICAL: Return ONLY valid JSON. Use null for missing values. No extra text.

{
  "success": true,
  "totalItems": ${phase2AData.totalItems},
  "demolitionItems": [
    {
      "itemNumber": "1",
      "name": "item name from Phase 2A",
      "description": "description from Phase 2A",
      "category": "category from Phase 2A",
      "action": "action from Phase 2A",
      "measurements": {
        "quantity": 0,
        "unit": "SF/LF/EA",
        "squareFeet": 0,
        "linearFeet": 0,
        "count": 0,
        "dimensions": "dimensions if available"
      },
      "pricing": "unit price if found",
      "proposedBid": null,
      "pricesheetMatch": {
        "matched": false,
        "itemName": "item name from Phase 2A",
        "itemPrice": 0,
        "itemId": "id from Phase 2A"
      }
    }
  ]
}`;

    // Process based on file type
    let fallbackResponse;
    if (mimeType.includes('pdf')) {
      fallbackResponse = await processPhase2BPDF(tempFilePath, fallbackPrompt);
    } else if (mimeType.includes('image')) {
      fallbackResponse = await processPhase2BImage(tempFilePath, fallbackPrompt);
    } else {
      fallbackResponse = await processPhase2BText(tempFilePath, fallbackPrompt);
    }

    // Merge Phase 2A data with fallback measurements
    if (fallbackResponse.success && fallbackResponse.demolitionItems) {
      fallbackResponse.demolitionItems = fallbackResponse.demolitionItems.map((item, index) => {
        const phase2AItem = phase2AData.demolitionItems[index];
        if (phase2AItem) {
          return {
            ...phase2AItem,
            measurements: item.measurements,
            pricing: item.pricing || phase2AItem.pricing
          };
        }
        return item;
      });
    }

    // Calculate final prices
    if (fallbackResponse.success) {
      fallbackResponse = calculatePricesForMatchedItems(fallbackResponse, []);
    }

    return fallbackResponse;

  } catch (error) {
    console.error('Fallback measurement extraction :', error);
    return {
      success: false,
      error: error.message,
      demolitionItems: phase2AData.demolitionItems || [],
      totalItems: phase2AData.totalItems || 0
    };
  }
}

// PHASE 2: Extract detailed demolition items (DEPRECATED - keeping for backward compatibility)
async function performPhase2Processing(tempFilePath, fileName, mimeType, phase1Data, userId = null) {
  try {
    console.log(' Using Phase 1 context for detailed item extraction...');
    console.log(` Phase 1 found ${phase1Data.basicItemCount || 'unknown'} items to analyze`);
    
    // Fetch pricesheet items from database if userId is provided
    let pricesheetItems = [];
    let pricesheetPromptSection = '';
    
    if (userId) {
      pricesheetItems = await fetchPricesheetItems(userId);
      
      if (pricesheetItems.length > 0) {
        // Group items by category for better organization
        const itemsByCategory = pricesheetItems.reduce((acc, item) => {
          const category = item.category || 'Uncategorized';
          if (!acc[category]) acc[category] = [];
          acc[category].push(item);
          return acc;
        }, {});
        
        pricesheetPromptSection = `

AVAILABLE PRICESHEET ITEMS FOR MATCHING:
When extracting items, try to match them with these pre-defined pricesheet items. If you find a match, use the exact name and include the price reference:

`;
        
        // Add each category and its items
        Object.entries(itemsByCategory).forEach(([category, items]) => {
          pricesheetPromptSection += `${category.toUpperCase()}:\n`;
          items.forEach(item => {
            pricesheetPromptSection += `- "${item.name}" (Price: $${item.price})\n`;
          });
          pricesheetPromptSection += '\n';
        });
        
        pricesheetPromptSection += `MATCHING INSTRUCTIONS:
- If you find an item in the document that closely matches a pricesheet item, use the exact pricesheet item name
- Include the pricesheet price in the "pricesheetMatch" field
- If no match found, use the original document description
- Be flexible with matching (e.g., "Wall Removal" could match "Remove Interior Wall")

`;
      }
    }
    
    const phase2Prompt = `You are a demolition specialist. Using the document context from Phase 1, extract EVERY demolition item with extreme detail.

PHASE 1 CONTEXT:
- Contractor: ${phase1Data.contractorInfo?.companyName || 'Unknown'}
- Expected Items: ${phase1Data.basicItemCount || 'Multiple'}
${pricesheetPromptSection}

NOW EXTRACT EVERY DEMOLITION ITEM WITH EXTREME DETAIL:

Look for ALL numbered items, keynotes, work items including:
- Wall/partition removals
- Door and frame removals  
- Electrical work (panels, fixtures, outlets)
- Flooring removals
- Plumbing fixtures (sinks, water heaters, lavatories)
- Ceiling systems (ACT, grid, diffusers, lights)
- HVAC components
- Cleanup items (broomsweep, dumpsters)
- Items marked "Remain", "Excluded", or "Remove"

CRITICAL MEASUREMENT EXTRACTION RULES:
1. Match measurements to items even if they appear elsewhere in the document
2. Extract ALL measurement values for each item found
3. Look for quantities, dimensions, areas, volumes, linear feet, counts
4. Common measurement units: SF (sq ft), LF (linear ft), EA (each), CY (cubic yards), SY (sq yards)
5. Extract specific dimensions like "2 x 4 x 14' height", "10 ft surface", etc.
6. If no measurements found, use null for all measurement fields

MEASUREMENT EXAMPLES TO LOOK FOR:
- Area measurements: "3,550 SF", "700 sq ft", "1,200 square feet"
- Linear measurements: "75 LF", "25 linear feet", "100 lf"
- Count measurements: "3 each", "8 units", "12 pieces"
- Volume measurements: "50 CY", "25 cubic yards"
- Dimensional measurements: "2 x 4 x 14' height", "10 ft surface", "8' x 10'"

ITEM NAME EXTRACTION EXAMPLES:
- "Suspended Ceiling - SF" → name: "Suspended Ceiling", unit: "SF"
- "Interior Walls - 2 x 4 x 14' height - SF" → name: "Interior Walls", dimensions: "2 x 4 x 14' height", unit: "SF"
- "Sheetrock on CMU Wall (10- ft height)" → name: "Sheetrock on CMU Wall", dimensions: "10-ft height"
- "Cove base - LF" → name: "Cove base", unit: "LF"
- "VCT Flooring" → name: "VCT Flooring"
- "Doors/Frames" → name: "Doors/Frames"
- "Light fixtures" → name: "Light fixtures"

IMPORTANT JSON STRUCTURE REQUIREMENTS:
- ALWAYS return valid JSON - no extra text before or after
- Use null for missing values, never omit fields
- Ensure all strings are properly quoted
- Use consistent boolean values (true/false, not True/False)
- Numbers should be actual numbers, not strings (except for itemNumber which can be string)

Return ONLY this JSON structure:
{
  "success": true,
  "totalItems": 0,
  "demolitionItems": [
    {
      "itemNumber": "1",
      "name": "standard name from PRICESHEET ITEMS FOR MATCHING OR (ANY SHORT) ITEM NAME if the item is not from PRICESHEET ITEMS FOR MATCHING",
      "description": "exact description from document", 
      "category": "wall/ceiling/floor/electrical/plumbing/cleanup/etc",
      "action": "Remove/Remain/Excluded",
      "measurements": {
        "quantity": 0,
        "unit": "sq ft/linear ft/each/cubic yards",
        "dimensions": "specific dimensions like 2 x 4 x 14' height",
        "area": 0,
        "linearFeet": 0,
        "count": 0,
        "volume": 0,
        "height": 0,
        "width": 0,
        "length": 0
      },
      "pricing": "unit price and/or total price or null",
      "proposedBid": null,
      "pricesheetMatch": {
        "matched": false,
        "itemName": null,
        "itemPrice": null,
        "itemId": null
      }
    }
  ]
}`;

    // Process based on file type using Phase 1 context
    let phase2Response;
    if (mimeType.includes('pdf')) {
      phase2Response = await processPhase2PDF(tempFilePath, phase2Prompt);
    } else if (mimeType.includes('image')) {
      phase2Response = await processPhase2Image(tempFilePath, phase2Prompt);
    } else {
      phase2Response = await processPhase2Text(tempFilePath, phase2Prompt);
    }

    // Post-process to enhance pricesheet matching
    if (phase2Response.success && pricesheetItems.length > 0) {
      phase2Response = enhancePricesheetMatching(phase2Response, pricesheetItems);
      // Calculate prices for matched items
      phase2Response = calculatePricesForMatchedItems(phase2Response, pricesheetItems);
    }

    return phase2Response;

  } catch (error) {
    console.error(' Phase 2 processing failed:', error);
    return {
      success: false,
      error: error.message,
      method: 'gemini-phase2-failed',
      demolitionItems: [],
      totalItems: 0
    };
  }
}

// Helper function to enhance pricesheet matching using fuzzy logic
function enhancePricesheetMatching(phase2Response, pricesheetItems) {
  try {
    console.log('🔍 Enhancing pricesheet matching...');
    
    if (!phase2Response.demolitionItems || !Array.isArray(phase2Response.demolitionItems)) {
      return phase2Response;
    }
    
    phase2Response.demolitionItems.forEach(item => {
      // If AI already found a match, skip
      if (item.pricesheetMatch && item.pricesheetMatch.matched) {
        return;
      }
      
      // Initialize pricesheetMatch if not present
      if (!item.pricesheetMatch) {
        item.pricesheetMatch = {
          matched: false,
          itemName: null,
          itemPrice: null,
          itemId: null
        };
      }
      
      // Try to find a match using simple string matching
      const itemDescription = item.description?.toLowerCase() || '';
      
      for (const pricesheetItem of pricesheetItems) {
        const pricesheetName = pricesheetItem.name.toLowerCase();
        
        // Check for direct substring matches or common terms
        if (itemDescription.includes(pricesheetName) || 
            pricesheetName.includes(itemDescription) ||
            findCommonTerms(itemDescription, pricesheetName)) {
          
          item.pricesheetMatch = {
            matched: true,
            itemName: pricesheetItem.name,
            itemPrice: pricesheetItem.price,
            itemId: pricesheetItem._id.toString()
          };
          console.log(`✅ Enhanced match: "${item.description}" → "${pricesheetItem.name}"`);
          break;
        }
      }
    });
    
    return phase2Response;
    
  } catch (error) {
    console.error('❌ Error enhancing pricesheet matching:', error);
    return phase2Response;
  }
}

// Helper function to find common terms between two strings
function findCommonTerms(str1, str2) {
  const commonTerms = ['wall', 'door', 'ceiling', 'floor', 'electrical', 'plumbing', 'removal', 'remove', 'demolition', 'demo'];
  const str1Words = str1.split(' ').filter(word => word.length > 2);
  const str2Words = str2.split(' ').filter(word => word.length > 2);
  
  // Check if both strings contain any common demolition terms
  for (const term of commonTerms) {
    if (str1.includes(term) && str2.includes(term)) {
      return true;
    }
  }
  
  // Check for exact word matches
  return str1Words.some(word => str2Words.includes(word));
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

// Helper function to safely get quantity from simplified measurements
const safeGetQuantity = (measurements) => {
  if (!measurements || typeof measurements !== 'object') return 0;
  
  // Try different quantity fields in priority order
  if (measurements.quantity !== null && measurements.quantity !== undefined) {
    return safeParseFloat(measurements.quantity, 0);
  }
  if (measurements.squareFeet !== null && measurements.squareFeet !== undefined) {
    return safeParseFloat(measurements.squareFeet, 0);
  }
  if (measurements.linearFeet !== null && measurements.linearFeet !== undefined) {
    return safeParseFloat(measurements.linearFeet, 0);
  }
  if (measurements.count !== null && measurements.count !== undefined) {
    return safeParseFloat(measurements.count, 0);
  }
  
  return 0;
};

// Helper function to safely parse and validate JSON response
const safeParseJSON = (jsonString, fallback = { success: false, error: 'Invalid JSON' }) => {
  try {
    // Clean the JSON string - remove any extra text before/after JSON
    let cleaned = jsonString.trim();
    
    // Remove markdown code blocks if present
    if (cleaned.includes('```json')) {
      cleaned = cleaned.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
    } else if (cleaned.includes('```')) {
      cleaned = cleaned.replace(/```\s*/g, '').replace(/```\s*$/g, '');
    }
    
    // Remove separators and other problematic text
    cleaned = cleaned
      .replace(/---+/g, '') // Remove --- separators
      .replace(/\n\s*\n/g, '\n') // Remove extra blank lines
      .replace(/^\s*[\d]+\.\s*/gm, '') // Remove numbered list items
      .trim();
    
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}') + 1;
    
    if (jsonStart === -1 || jsonEnd === 0) {
      console.error('❌ No valid JSON found in response');
      return fallback;
    }
    
    let jsonOnly = cleaned.substring(jsonStart, jsonEnd);
    
    // Try to fix incomplete JSON
    const openBraces = (jsonOnly.match(/\{/g) || []).length;
    const closeBraces = (jsonOnly.match(/\}/g) || []).length;
    const openBrackets = (jsonOnly.match(/\[/g) || []).length;
    const closeBrackets = (jsonOnly.match(/\]/g) || []).length;
    
    // If JSON is incomplete, try to fix it
    if (openBraces > closeBraces || openBrackets > closeBrackets) {
      console.log('⚠️ Detected incomplete JSON, attempting to fix...');
      
      // Add missing closing brackets
      while (openBraces > closeBraces) {
        jsonOnly += '}';
        closeBraces++;
      }
      while (openBrackets > closeBrackets) {
        jsonOnly += ']';
        closeBrackets++;
      }
    }
    
    try {
      const parsed = JSON.parse(jsonOnly);
      
      // For raw measurements, we expect a different structure
      if (parsed.hasOwnProperty('rawMeasurements')) {
        return parsed;
      }
      
      // For normalized measurements, we expect a different structure
      if (parsed.hasOwnProperty('normalizedMeasurements')) {
        return parsed;
      }
      
      // For demolition items, validate required structure
      if (!parsed.hasOwnProperty('success') || !parsed.hasOwnProperty('demolitionItems')) {
        console.error('❌ Invalid JSON structure - missing required fields');
        return { ...fallback, error: 'Missing required fields: success, demolitionItems' };
      }
      
      // Ensure demolitionItems is an array
      if (!Array.isArray(parsed.demolitionItems)) {
        console.error('❌ demolitionItems is not an array');
        parsed.demolitionItems = [];
      }
      
      // Validate and clean each demolition item
      parsed.demolitionItems = parsed.demolitionItems.map((item, index) => {
        if (!item || typeof item !== 'object') {
          console.error(`❌ Invalid item at index ${index}`);
          return null;
        }
        
        // Ensure required fields exist with safe defaults
        return {
          itemNumber: item.itemNumber || `item-${index + 1}`,
          name: item.name || `Unknown Item ${index + 1}`,
          description: item.description || 'No description available',
          category: item.category || 'other',
          action: item.action || 'Remove',
          measurements: {
            quantity: safeParseFloat(item.measurements?.quantity),
            unit: item.measurements?.unit || null,
            dimensions: item.measurements?.dimensions || null,
            squareFeet: safeParseFloat(item.measurements?.squareFeet),
            linearFeet: safeParseFloat(item.measurements?.linearFeet),
            count: safeParseFloat(item.measurements?.count)
          },
          pricing: item.pricing || null,
          proposedBid: item.proposedBid || null,
          pricesheetMatch: item.pricesheetMatch || {
            matched: false,
            itemName: null,
            itemPrice: 0,
            itemId: null
          },
          calculatedUnitPrice: item.calculatedUnitPrice || 0,
          calculatedTotalPrice: item.calculatedTotalPrice || 0,
          priceCalculation: item.priceCalculation || {
            quantity: 0,
            unitPrice: 0,
            totalPrice: 0,
            calculationMethod: 'no_price',
            lastCalculated: new Date(),
            hasValidPrice: false,
            measurementType: 'unknown'
          }
        };
      }).filter(item => item !== null);
      
      return parsed;
    } catch (parseError) {
      console.error('❌ JSON parsing failed in safeParseJSON:', parseError.message);
      console.error('📝 Error position:', parseError.message.match(/position (\d+)/)?.[1] || 'unknown');
      console.error('📝 JSON string length:', jsonOnly.length);
      console.error('📝 JSON around error:');
      
      // Show context around the error position
      const errorPos = parseInt(parseError.message.match(/position (\d+)/)?.[1]) || 0;
      const start = Math.max(0, errorPos - 100);
      const end = Math.min(jsonOnly.length, errorPos + 100);
      console.error('📝 Context:', jsonOnly.substring(start, end));
      
      // Try to fix common JSON issues
      console.log('🔧 Attempting to fix JSON in safeParseJSON...');
      let fixedJson = jsonOnly;
      
      // Fix common issues
      fixedJson = fixedJson
        .replace(/,\s*}/g, '}') // Remove trailing commas before }
        .replace(/,\s*]/g, ']') // Remove trailing commas before ]
        .replace(/([^\\])\\([^"\\\/bfnrt])/g, '$1\\\\$2') // Fix unescaped backslashes
        .replace(/([^\\])\\([^"\\\/bfnrt])/g, '$1\\\\$2'); // Fix unescaped backslashes again
      
      try {
        const fixedParsed = JSON.parse(fixedJson);
        console.log('✅ Successfully fixed and parsed JSON in safeParseJSON');
        return fixedParsed;
      } catch (fixError) {
        console.error('❌ JSON fix failed in safeParseJSON:', fixError.message);
        return { ...fallback, error: 'Invalid JSON response - could not parse or fix' };
      }
    }
    
  } catch (error) {
    console.error('❌ JSON parsing error:', error.message);
    console.error('Raw response:', jsonString.substring(0, 500) + '...');
    return { ...fallback, error: error.message };
  }
};

// Helper function to calculate prices for matched items with new measurement structure
function calculatePricesForMatchedItems(phase2Response, pricesheetItems) {
  try {
    console.log('💰 Calculating prices for matched items...');
    
    if (!phase2Response.demolitionItems || !Array.isArray(phase2Response.demolitionItems)) {
      return phase2Response;
    }
    
    let totalCalculatedCost = 0;
    let itemsWithCalculatedPrices = 0;
    let itemsWithErrors = 0;
    let itemsWithoutPrices = 0;
    
    phase2Response.demolitionItems.forEach((item, index) => {
      try {
        // Get quantity from new measurement structure
        const quantity = safeGetQuantity(item.measurements);
        
        // Determine unit price with comprehensive null handling
        let unitPrice = 0;
        let calculationMethod = 'manual';
        let hasValidPrice = false;
        
        // Priority 1: Use pricesheet match
        if (item.pricesheetMatch?.matched && item.pricesheetMatch?.itemPrice) {
          const matchedPrice = safeParseFloat(item.pricesheetMatch.itemPrice);
          if (matchedPrice > 0) {
            unitPrice = matchedPrice;
            calculationMethod = 'pricesheet';
            hasValidPrice = true;
          }
        }
        
        // Priority 2: Use AI extracted unit price from pricing field
        if (!hasValidPrice && item.pricing) {
          const parsedUnitPrice = safeParseFloat(item.pricing);
          if (parsedUnitPrice > 0) {
            unitPrice = parsedUnitPrice;
            calculationMethod = 'ai_extracted';
            hasValidPrice = true;
          }
        }
        
        // Calculate total price only if we have both quantity and unit price
        const totalPrice = (quantity > 0 && unitPrice > 0) ? quantity * unitPrice : 0;
        
        // Add calculated pricing fields
        item.calculatedUnitPrice = unitPrice;
        item.calculatedTotalPrice = totalPrice;
        item.proposedBid = null; // Initialize proposed bid field for user input
        item.priceCalculation = {
          quantity: quantity,
          unitPrice: unitPrice,
          totalPrice: totalPrice,
          calculationMethod: calculationMethod,
          lastCalculated: new Date(),
          hasValidPrice: hasValidPrice,
          measurementType: getMeasurementType(item.measurements)
        };
        
        if (hasValidPrice && quantity > 0) {
          totalCalculatedCost += totalPrice;
          itemsWithCalculatedPrices++;
          console.log(`✅ Price calculated: ${item.name || `Item ${index + 1}`} - Qty: ${quantity} ${item.measurements.unit || ''} × $${unitPrice} = $${totalPrice.toFixed(2)}`);
        } else {
          itemsWithoutPrices++;
          const reason = !hasValidPrice ? 'No valid price' : 'No quantity';
          console.log(`⚠️ ${reason} for: ${item.name || `Item ${index + 1}`} - Qty: ${quantity}, Price: $${unitPrice}`);
        }
        
      } catch (itemError) {
        itemsWithErrors++;
        console.error(`❌ Error calculating price for item ${index + 1}:`, itemError);
        
        // Set safe defaults on error
        item.calculatedUnitPrice = 0;
        item.calculatedTotalPrice = 0;
        item.proposedBid = null;
        item.priceCalculation = {
          quantity: safeGetQuantity(item.measurements),
          unitPrice: 0,
          totalPrice: 0,
          calculationMethod: 'error',
          lastCalculated: new Date(),
          hasValidPrice: false,
          error: itemError.message
        };
      }
    });
    
    // Add pricing summary to the response
    phase2Response.pricingSummary = {
      totalCalculatedCost: totalCalculatedCost,
      itemsWithCalculatedPrices: itemsWithCalculatedPrices,
      itemsWithoutPrices: itemsWithoutPrices,
      itemsWithErrors: itemsWithErrors,
      totalItems: phase2Response.demolitionItems.length,
      calculationMethod: 'pricesheet_matching'
    };
    
    console.log(`💰 Price calculation summary:`);
    console.log(`   - Total calculated cost: $${totalCalculatedCost.toFixed(2)}`);
    console.log(`   - Items with calculated prices: ${itemsWithCalculatedPrices}`);
    console.log(`   - Items without prices: ${itemsWithoutPrices}`);
    console.log(`   - Items with errors: ${itemsWithErrors}`);
    console.log(`   - Total items processed: ${phase2Response.demolitionItems.length}`);
    
    return phase2Response;
    
  } catch (error) {
    console.error('❌ Error calculating prices for matched items:', error);
    return phase2Response;
  }
}

// Helper function to determine measurement type
function getMeasurementType(measurements) {
  if (!measurements) return 'unknown';
  
  if (measurements.squareFeet && measurements.squareFeet > 0) return 'area';
  if (measurements.linearFeet && measurements.linearFeet > 0) return 'linear';
  if (measurements.count && measurements.count > 0) return 'count';
  
  return 'unknown';
}

// Export function for extracting bid data from documents
export async function extractBidDataFromDocument(documentBuffer, fileName, mimeType, userId = null) {
  try {
    console.log(`Processing document with Gemini: ${fileName} (${mimeType})`);
    if (userId) {
      console.log(`User ID provided for pricesheet matching: ${userId}`);
    }
    
    // Create a temporary file for upload to Gemini
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const tempDir = path.join(__dirname, '../temp');
    
    // Ensure temp directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const tempFilePath = path.join(tempDir, fileName);
    
    try {
      // Write buffer to temporary file
      fs.writeFileSync(tempFilePath, documentBuffer);
      console.log(`Temporary file created: ${tempFilePath}`);
      
      // Use the unified Gemini processing function with userId
      const result = await performGeminiDocumentProcessing(tempFilePath, fileName, mimeType, userId);
      
      // Clean up temporary file
      try {
        fs.unlinkSync(tempFilePath);
        console.log(`Temporary file cleaned up: ${tempFilePath}`);
      } catch (cleanupError) {
        console.warn(`Could not clean up temporary file: ${cleanupError.message}`);
      }
      
      return result;
      
    } catch (fileError) {
      console.error('File processing error:', fileError);
      throw fileError;
    }
    
  } catch (error) {
    console.error('Document extraction error:', error);
    
    // Return fallback data structure
    return {
      success: false,
      data: {
        contractorInfo: {
          companyName: fileName ? fileName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, ' ') : "Unknown Company",
          address: "To be determined",
          phone: "To be determined",
          contactPerson: "To be determined", 
          email: "To be determined",
          license: "To be determined",
          insurance: "To be determined"
        },
        clientInfo: {
          clientName: "To be determined",
          clientAddress: "To be determined",
          contactPerson: "To be determined"
        },
        projectDetails: {
          projectName: "To be determined",
          projectType: "To be determined", 
          location: "To be determined",
          bidDate: null,
          description: "To be determined"
        },
        demolitionItems: [],
        scopeOfWork: "To be determined",
        workItems: [],
        exclusions: [],
        specialRequirements: "To be determined",
        totalProjectCost: null,
        measurementSummary: {
          totalArea: null,
          totalVolume: null,
          totalLinearFeet: null
        },
        pricingSummary: {
          totalProjectCost: null
        },
        extractionNotes: `Failed to extract data from ${fileName} - manual review required. Error: ${error.message}`
      },
      method: 'fallback-document-extraction'
    };
  }
}

// Additional utility function to handle file uploads (if needed)
export async function processUploadedFile(fileBuffer, fileName, mimeType, userId = null) {
  return await extractBidDataFromDocument(fileBuffer, fileName, mimeType, userId);
}

