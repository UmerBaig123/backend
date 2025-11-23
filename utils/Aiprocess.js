import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

// Helper function to safely parse and validate JSON response
const safeParseJSON = (
  jsonString,
  fallback = { success: false, error: "Invalid JSON" }
) => {
  try {
    // Clean the JSON string - remove any extra text before/after JSON
    const cleaned = jsonString.trim();
    const jsonStart = cleaned.indexOf("{");
    const jsonEnd = cleaned.lastIndexOf("}") + 1;

    if (jsonStart === -1 || jsonEnd === 0) {
      console.error("❌ No valid JSON found in response");
      return fallback;
    }

    const jsonOnly = cleaned.substring(jsonStart, jsonEnd);
    const parsed = JSON.parse(jsonOnly);

    // Validate required structure
    if (
      !parsed.hasOwnProperty("success") ||
      !parsed.hasOwnProperty("demolitionItems")
    ) {
      console.error("❌ Invalid JSON structure - missing required fields");
      return {
        ...fallback,
        error: "Missing required fields: success, demolitionItems",
      };
    }

    // Ensure demolitionItems is an array
    if (!Array.isArray(parsed.demolitionItems)) {
      console.error("❌ demolitionItems is not an array");
      parsed.demolitionItems = [];
    }

    // Validate and clean each demolition item
    parsed.demolitionItems = parsed.demolitionItems
      .map((item, index) => {
        if (!item || typeof item !== "object") {
          console.error(`❌ Invalid item at index ${index}`);
          return null;
        }

        // Ensure required fields exist with safe defaults
        return {
          itemNumber: item.itemNumber || `item-${index + 1}`,
          name: item.name || `Unknown Item ${index + 1}`,
          description: item.description || "No description available",
          category: item.category || "other",
          action: item.action || "Remove",
          measurements: {
            quantity: parseFloat(item.measurements?.quantity) || null,
            unit: item.measurements?.unit || null,
            dimensions: item.measurements?.dimensions || null,
            squareFeet: parseFloat(item.measurements?.squareFeet) || null,
            linearFeet: parseFloat(item.measurements?.linearFeet) || null,
            count: parseFloat(item.measurements?.count) || null,
          },
          pricing: item.pricing || null,
          proposedBid: item.proposedBid || null,
          pricesheetMatch: {
            matched: Boolean(item.pricesheetMatch?.matched),
            itemName: item.pricesheetMatch?.itemName || null,
            itemPrice: parseFloat(item.pricesheetMatch?.itemPrice) || null,
            itemId: item.pricesheetMatch?.itemId || null,
          },
        };
      })
      .filter((item) => item !== null); // Remove null items

    // Update totalItems count
    parsed.totalItems = parsed.demolitionItems.length;

    console.log(
      `✅ Successfully parsed JSON with ${parsed.demolitionItems.length} demolition items`
    );
    return parsed;
  } catch (error) {
    console.error("❌ JSON parsing error:", error.message);
    console.error("Raw response:", jsonString.substring(0, 500) + "...");
    return { ...fallback, error: error.message };
  }
};

const genAI = new GoogleGenerativeAI("AIzaSyB8JtyzRzs1jytoApClLiC2erz6LQvSQn4");

// Phase 1 processing functions for different file types
async function processPhase1PDF(tempFilePath, prompt) {
  try {
    const fileData = fs.readFileSync(tempFilePath);
    const base64Data = fileData.toString("base64");
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    const filePart = {
      inlineData: {
        data: base64Data,
        mimeType: "application/pdf",
      },
    };

    const result = await model.generateContent([prompt, filePart]);
    const response = await result.response;
    const responseText = response.text();

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("Invalid JSON response from Phase 1 PDF processing");
    }
  } catch (error) {
    console.error("Phase 1 PDF processing failed:", error);
    return { success: false, error: error.message };
  }
}

async function processPhase1Image(tempFilePath, prompt) {
  try {
    const fileData = fs.readFileSync(tempFilePath);
    const base64Data = fileData.toString("base64");
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: "image/jpeg", // Adjust based on actual image type
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const responseText = response.text();

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("Invalid JSON response from Phase 1 image processing");
    }
  } catch (error) {
    console.error("Phase 1 image processing failed:", error);
    return { success: false, error: error.message };
  }
}

async function processPhase1Text(tempFilePath, prompt) {
  try {
    const documentContent = fs.readFileSync(tempFilePath, "utf8");
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    const fullPrompt = `${prompt}\n\nDOCUMENT CONTENT:\n${documentContent}`;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const responseText = response.text();

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("Invalid JSON response from Phase 1 text processing");
    }
  } catch (error) {
    console.error("Phase 1 text processing failed:", error);
    return { success: false, error: error.message };
  }
}

// Phase 2 processing functions for detailed demolition items
async function processPhase2PDF(tempFilePath, prompt) {
  try {
    const fileData = fs.readFileSync(tempFilePath);
    const base64Data = fileData.toString("base64");
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    const filePart = {
      inlineData: {
        data: base64Data,
        mimeType: "application/pdf",
      },
    };

    const result = await model.generateContent([prompt, filePart]);
    const response = await result.response;
    const responseText = response.text();
    console.log(response);
    // Use safe JSON parsing with comprehensive error handling
    const fallback = {
      success: false,
      error: "Invalid JSON response from Phase 2 PDF processing",
      demolitionItems: [],
      totalItems: 0,
    };
    return safeParseJSON(responseText, fallback);
  } catch (error) {
    console.error("Phase 2 PDF processing failed:", error);
    return {
      success: false,
      error: error.message,
      demolitionItems: [],
      totalItems: 0,
    };
  }
}

async function processPhase2Image(tempFilePath, prompt) {
  try {
    const fileData = fs.readFileSync(tempFilePath);
    const base64Data = fileData.toString("base64");
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: "image/jpeg",
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const responseText = response.text();

    // Use safe JSON parsing with comprehensive error handling
    const fallback = {
      success: false,
      error: "Invalid JSON response from Phase 2 image processing",
      demolitionItems: [],
      totalItems: 0,
    };
    return safeParseJSON(responseText, fallback);
  } catch (error) {
    console.error("Phase 2 image processing failed:", error);
    return {
      success: false,
      error: error.message,
      demolitionItems: [],
      totalItems: 0,
    };
  }
}

async function processPhase2Text(tempFilePath, prompt) {
  try {
    const documentContent = fs.readFileSync(tempFilePath, "utf8");
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    const fullPrompt = `${prompt}\n\nDOCUMENT CONTENT:\n${documentContent}`;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const responseText = response.text();

    // Use safe JSON parsing with comprehensive error handling
    const fallback = {
      success: false,
      error: "Invalid JSON response from Phase 2 text processing",
      demolitionItems: [],
      totalItems: 0,
    };
    return safeParseJSON(responseText, fallback);
  } catch (error) {
    console.error("Phase 2 text processing failed:", error);
    return {
      success: false,
      error: error.message,
      demolitionItems: [],
      totalItems: 0,
    };
  }
}

// Phase 2A processing functions for different file types
async function processPhase2APDF(tempFilePath, prompt) {
  try {
    const fileData = fs.readFileSync(tempFilePath);
    const base64Data = fileData.toString("base64");
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    const filePart = {
      inlineData: {
        data: base64Data,
        mimeType: "application/pdf",
      },
    };

    const result = await model.generateContent([prompt, filePart]);
    const response = await result.response;
    const responseText = response.text();
    console.log("Phase 2A PDF response", response);
    // Use safe JSON parsing with comprehensive error handling
    const fallback = {
      success: false,
      error: "Invalid JSON response from Phase 2A PDF processing",
      demolitionItems: [],
      totalItems: 0,
    };
    return safeParseJSON(responseText, fallback);
  } catch (error) {
    console.error("Phase 2A PDF processing failed:", error);
    return {
      success: false,
      error: error.message,
      demolitionItems: [],
      totalItems: 0,
    };
  }
}

async function processPhase2AImage(tempFilePath, prompt) {
  try {
    const fileData = fs.readFileSync(tempFilePath);
    const base64Data = fileData.toString("base64");
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: "image/jpeg",
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const responseText = response.text();

    // Use safe JSON parsing with comprehensive error handling
    const fallback = {
      success: false,
      error: "Invalid JSON response from Phase 2A image processing",
      demolitionItems: [],
      totalItems: 0,
    };
    return safeParseJSON(responseText, fallback);
  } catch (error) {
    console.error("Phase 2A image processing failed:", error);
    return {
      success: false,
      error: error.message,
      demolitionItems: [],
      totalItems: 0,
    };
  }
}

async function processPhase2AText(tempFilePath, prompt) {
  try {
    const documentContent = fs.readFileSync(tempFilePath, "utf8");
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    const fullPrompt = `${prompt}\n\nDOCUMENT CONTENT:\n${documentContent}`;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const responseText = response.text();

    // Use safe JSON parsing with comprehensive error handling
    const fallback = {
      success: false,
      error: "Invalid JSON response from Phase 2A text processing",
      demolitionItems: [],
      totalItems: 0,
    };
    return safeParseJSON(responseText, fallback);
  } catch (error) {
    console.error("Phase 2A text processing failed:", error);
    return {
      success: false,
      error: error.message,
      demolitionItems: [],
      totalItems: 0,
    };
  }
}

// Phase 2B processing functions for different file types
async function processPhase2BPDF(tempFilePath, prompt) {
  try {
    const fileData = fs.readFileSync(tempFilePath);
    const base64Data = fileData.toString("base64");
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    const filePart = {
      inlineData: {
        data: base64Data,
        mimeType: "application/pdf",
      },
    };

    const result = await model.generateContent([prompt, filePart]);
    const response = await result.response;
    const responseText = response.text();

    console.log("Phase 2b PDF response", response);

    // Enhanced JSON parsing to handle markdown code blocks
    let cleanedResponse = responseText;

    // Remove markdown code blocks if present
    if (cleanedResponse.includes("```json")) {
      cleanedResponse = cleanedResponse
        .replace(/```json\s*/g, "")
        .replace(/```\s*$/g, "");
    } else if (cleanedResponse.includes("```")) {
      cleanedResponse = cleanedResponse
        .replace(/```\s*/g, "")
        .replace(/```\s*$/g, "");
    }

    // Remove separators and other problematic text
    console.log("🧹 [AI RESPONSE] Cleaning separators and extra text...");
    cleanedResponse = cleanedResponse
      .replace(/---+/g, "") // Remove --- separators
      .replace(/\n\s*\n/g, "\n") // Remove extra blank lines
      .replace(/^\s*[\d]+\.\s*/gm, "") // Remove numbered list items
      .trim();

    console.log("🧹 [AI RESPONSE] Cleaned response:");
    console.log("=".repeat(80));
    console.log(cleanedResponse);
    console.log("=".repeat(80));

    // Use safe JSON parsing with comprehensive error handling
    const fallback = {
      success: false,
      error: "Invalid JSON response from Phase 2B PDF processing",
      demolitionItems: [],
      totalItems: 0,
    };
    return safeParseJSON(cleanedResponse, fallback);
  } catch (error) {
    console.error("Phase 2B PDF processing failed:", error);
    return {
      success: false,
      error: error.message,
      demolitionItems: [],
      totalItems: 0,
    };
  }
}

async function processPhase2BImage(tempFilePath, prompt) {
  try {
    const fileData = fs.readFileSync(tempFilePath);
    const base64Data = fileData.toString("base64");
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: "image/jpeg",
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const responseText = response.text();

    console.log("🤖 [AI RESPONSE] Raw response from Gemini:");
    console.log("=".repeat(80));
    console.log(responseText);
    console.log("=".repeat(80));

    // Enhanced JSON parsing to handle markdown code blocks
    let cleanedResponse = responseText;

    // Remove markdown code blocks if present
    if (cleanedResponse.includes("```json")) {
      console.log("🧹 [AI RESPONSE] Removing ```json markdown blocks");
      cleanedResponse = cleanedResponse
        .replace(/```json\s*/g, "")
        .replace(/```\s*$/g, "");
    } else if (cleanedResponse.includes("```")) {
      console.log("🧹 [AI RESPONSE] Removing ``` markdown blocks");
      cleanedResponse = cleanedResponse
        .replace(/```\s*/g, "")
        .replace(/```\s*$/g, "");
    }

    // Remove separators and other problematic text
    console.log("🧹 [AI RESPONSE] Cleaning separators and extra text...");
    cleanedResponse = cleanedResponse
      .replace(/---+/g, "") // Remove --- separators
      .replace(/\n\s*\n/g, "\n") // Remove extra blank lines
      .replace(/^\s*[\d]+\.\s*/gm, "") // Remove numbered list items
      .trim();

    console.log("🧹 [AI RESPONSE] Cleaned response:");
    console.log("=".repeat(80));
    console.log(cleanedResponse);
    console.log("=".repeat(80));

    // Use safe JSON parsing with comprehensive error handling
    const fallback = {
      success: false,
      error: "Invalid JSON response from Phase 2B image processing",
      demolitionItems: [],
      totalItems: 0,
    };
    return safeParseJSON(cleanedResponse, fallback);
  } catch (error) {
    console.error("Phase 2B image processing failed:", error);
    return {
      success: false,
      error: error.message,
      demolitionItems: [],
      totalItems: 0,
    };
  }
}

async function processPhase2BText(tempFilePath, prompt) {
  try {
    const documentContent = fs.readFileSync(tempFilePath, "utf8");
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    const fullPrompt = `${prompt}\n\nDOCUMENT CONTENT:\n${documentContent}`;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const responseText = response.text();

    console.log("🤖 [AI RESPONSE] Raw response from Gemini:");
    console.log("=".repeat(80));
    console.log(responseText);
    console.log("=".repeat(80));

    // Enhanced JSON parsing to handle markdown code blocks
    let cleanedResponse = responseText;

    // Remove markdown code blocks if present
    if (cleanedResponse.includes("```json")) {
      console.log("🧹 [AI RESPONSE] Removing ```json markdown blocks");
      cleanedResponse = cleanedResponse
        .replace(/```json\s*/g, "")
        .replace(/```\s*$/g, "");
    } else if (cleanedResponse.includes("```")) {
      console.log("🧹 [AI RESPONSE] Removing ``` markdown blocks");
      cleanedResponse = cleanedResponse
        .replace(/```\s*/g, "")
        .replace(/```\s*$/g, "");
    }

    // Remove separators and other problematic text
    console.log("🧹 [AI RESPONSE] Cleaning separators and extra text...");
    cleanedResponse = cleanedResponse
      .replace(/---+/g, "") // Remove --- separators
      .replace(/\n\s*\n/g, "\n") // Remove extra blank lines
      .replace(/^\s*[\d]+\.\s*/gm, "") // Remove numbered list items
      .trim();

    console.log("🧹 [AI RESPONSE] Cleaned response:");
    console.log("=".repeat(80));
    console.log(cleanedResponse);
    console.log("=".repeat(80));

    // Use safe JSON parsing with comprehensive error handling
    const fallback = {
      success: false,
      error: "Invalid JSON response from Phase 2B text processing",
      demolitionItems: [],
      totalItems: 0,
    };
    return safeParseJSON(cleanedResponse, fallback);
  } catch (error) {
    console.error("Phase 2B text processing failed:", error);
    return {
      success: false,
      error: error.message,
      demolitionItems: [],
      totalItems: 0,
    };
  }
}

// Specialized raw measurement extraction functions
async function processRawMeasurementPDF(tempFilePath, prompt) {
  try {
    const fileData = fs.readFileSync(tempFilePath);
    const base64Data = fileData.toString("base64");
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    const filePart = {
      inlineData: {
        data: base64Data,
        mimeType: "application/pdf",
      },
    };

    const result = await model.generateContent([prompt, filePart]);
    const response = await result.response;
    const responseText = response.text();

    console.log("find raw measurments response", response);
    // Enhanced JSON parsing to handle markdown code blocks
    let cleanedResponse = responseText;

    // Remove markdown code blocks if present
    if (cleanedResponse.includes("```json")) {
      cleanedResponse = cleanedResponse
        .replace(/```json\s*/g, "")
        .replace(/```\s*$/g, "");
    } else if (cleanedResponse.includes("```")) {
      cleanedResponse = cleanedResponse
        .replace(/```\s*/g, "")
        .replace(/```\s*$/g, "");
    }

    // Remove separators and other problematic text
    console.log("🧹 [AI RESPONSE] Cleaning separators and extra text...");
    cleanedResponse = cleanedResponse
      .replace(/---+/g, "") // Remove --- separators
      .replace(/\n\s*\n/g, "\n") // Remove extra blank lines
      .replace(/^\s*[\d]+\.\s*/gm, "") // Remove numbered list items
      .trim();

    console.log("🧹 [AI RESPONSE] Cleaned response:");
    console.log("=".repeat(80));
    console.log(cleanedResponse);
    console.log("=".repeat(80));

    // Use safe JSON parsing with raw measurement fallback
    const fallback = {
      success: false,
      error: "Invalid JSON response from raw measurement PDF processing",
      rawMeasurements: [],
    };
    return safeParseJSON(cleanedResponse, fallback);
  } catch (error) {
    console.error("Raw measurement PDF processing failed:", error);
    return { success: false, error: error.message, rawMeasurements: [] };
  }
}

async function processRawMeasurementImage(tempFilePath, prompt) {
  try {
    const fileData = fs.readFileSync(tempFilePath);
    const base64Data = fileData.toString("base64");
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: "image/jpeg",
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const responseText = response.text();

    console.log("🤖 [AI RESPONSE] Raw response from Gemini:");
    console.log("=".repeat(80));
    console.log(responseText);
    console.log("=".repeat(80));

    // Enhanced JSON parsing to handle markdown code blocks
    let cleanedResponse = responseText;

    // Remove markdown code blocks if present
    if (cleanedResponse.includes("```json")) {
      console.log("🧹 [AI RESPONSE] Removing ```json markdown blocks");
      cleanedResponse = cleanedResponse
        .replace(/```json\s*/g, "")
        .replace(/```\s*$/g, "");
    } else if (cleanedResponse.includes("```")) {
      console.log("🧹 [AI RESPONSE] Removing ``` markdown blocks");
      cleanedResponse = cleanedResponse
        .replace(/```\s*/g, "")
        .replace(/```\s*$/g, "");
    }

    // Remove separators and other problematic text
    console.log("🧹 [AI RESPONSE] Cleaning separators and extra text...");
    cleanedResponse = cleanedResponse
      .replace(/---+/g, "") // Remove --- separators
      .replace(/\n\s*\n/g, "\n") // Remove extra blank lines
      .replace(/^\s*[\d]+\.\s*/gm, "") // Remove numbered list items
      .trim();

    console.log("🧹 [AI RESPONSE] Cleaned response:");
    console.log("=".repeat(80));
    console.log(cleanedResponse);
    console.log("=".repeat(80));

    // Use safe JSON parsing with raw measurement fallback
    const fallback = {
      success: false,
      error: "Invalid JSON response from raw measurement image processing",
      rawMeasurements: [],
    };
    return safeParseJSON(cleanedResponse, fallback);
  } catch (error) {
    console.error("Raw measurement image processing failed:", error);
    return { success: false, error: error.message, rawMeasurements: [] };
  }
}

async function processRawMeasurementText(tempFilePath, prompt) {
  try {
    const documentContent = fs.readFileSync(tempFilePath, "utf8");
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    const fullPrompt = `${prompt}\n\nDOCUMENT CONTENT:\n${documentContent}`;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const responseText = response.text();

    console.log("🤖 [AI RESPONSE] Raw response from Gemini:");
    console.log("=".repeat(80));
    console.log(responseText);
    console.log("=".repeat(80));

    // Enhanced JSON parsing to handle markdown code blocks
    let cleanedResponse = responseText;

    // Remove markdown code blocks if present
    if (cleanedResponse.includes("```json")) {
      console.log("🧹 [AI RESPONSE] Removing ```json markdown blocks");
      cleanedResponse = cleanedResponse
        .replace(/```json\s*/g, "")
        .replace(/```\s*$/g, "");
    } else if (cleanedResponse.includes("```")) {
      console.log("🧹 [AI RESPONSE] Removing ``` markdown blocks");
      cleanedResponse = cleanedResponse
        .replace(/```\s*/g, "")
        .replace(/```\s*$/g, "");
    }

    // Remove separators and other problematic text
    console.log("🧹 [AI RESPONSE] Cleaning separators and extra text...");
    cleanedResponse = cleanedResponse
      .replace(/---+/g, "") // Remove --- separators
      .replace(/\n\s*\n/g, "\n") // Remove extra blank lines
      .replace(/^\s*[\d]+\.\s*/gm, "") // Remove numbered list items
      .trim();

    console.log("🧹 [AI RESPONSE] Cleaned response:");
    console.log("=".repeat(80));
    console.log(cleanedResponse);
    console.log("=".repeat(80));

    // Use safe JSON parsing with raw measurement fallback
    const fallback = {
      success: false,
      error: "Invalid JSON response from raw measurement text processing",
      rawMeasurements: [],
    };
    return safeParseJSON(cleanedResponse, fallback);
  } catch (error) {
    console.error("Raw measurement text processing failed:", error);
    return { success: false, error: error.message, rawMeasurements: [] };
  }
}

// Export all processing functions
export {
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
  processRawMeasurementText,
};
