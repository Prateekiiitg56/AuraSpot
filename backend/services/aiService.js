/**
 * AI Service - DeepSeek Integration
 * Single AI model with caching and smart prompt engineering
 */

require("dotenv").config();

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "tngtech/deepseek-r1t2-chimera:free";
const API_URL = process.env.OPENROUTER_API_URL || "https://openrouter.ai/api/v1/chat/completions";

// In-memory cache for quick responses (with TTL)
const responseCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Core AI request function with caching
 */
async function callDeepSeek(prompt, systemPrompt, cacheKey = null) {
  // Check cache first
  if (cacheKey && responseCache.has(cacheKey)) {
    const cached = responseCache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`[AI] Cache hit for: ${cacheKey}`);
      return cached.response;
    }
    responseCache.delete(cacheKey);
  }

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://auraspot.com",
        "X-Title": "AuraSpot Property Platform"
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1500
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[AI] DeepSeek API error:", error);
      throw new Error(`DeepSeek API error: ${response.status}`);
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content || "";

    // Cache the response
    if (cacheKey) {
      responseCache.set(cacheKey, {
        response: result,
        timestamp: Date.now()
      });
      console.log(`[AI] Cached response for: ${cacheKey}`);
    }

    return result;
  } catch (error) {
    console.error("[AI] Error calling DeepSeek:", error);
    throw error;
  }
}

/**
 * Parse JSON from AI response (handles markdown code blocks and thinking tags)
 */
function parseAIResponse(response) {
  try {
    // Remove <think>...</think> tags that DeepSeek R1 models may include
    let cleaned = response.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    
    // Remove markdown code blocks if present
    cleaned = cleaned.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    // Try to find JSON object in the response
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("[AI] Failed to parse response:", response?.substring(0, 500));
    // Return a default response structure
    return null;
  }
}

// ============================================================
// AI TASK FUNCTIONS
// ============================================================

// Indian city rental price benchmarks (₹/month for 1BHK)
const CITY_RENT_BENCHMARKS = {
  "mumbai": { min: 15000, avg: 35000, max: 80000, tier: "metro" },
  "delhi": { min: 12000, avg: 25000, max: 60000, tier: "metro" },
  "bangalore": { min: 12000, avg: 22000, max: 50000, tier: "metro" },
  "bengaluru": { min: 12000, avg: 22000, max: 50000, tier: "metro" },
  "hyderabad": { min: 10000, avg: 18000, max: 40000, tier: "metro" },
  "chennai": { min: 10000, avg: 18000, max: 40000, tier: "metro" },
  "pune": { min: 10000, avg: 18000, max: 35000, tier: "metro" },
  "kolkata": { min: 8000, avg: 15000, max: 30000, tier: "metro" },
  "ahmedabad": { min: 8000, avg: 14000, max: 28000, tier: "tier1" },
  "jaipur": { min: 6000, avg: 12000, max: 25000, tier: "tier1" },
  "lucknow": { min: 6000, avg: 10000, max: 20000, tier: "tier1" },
  "chandigarh": { min: 8000, avg: 15000, max: 30000, tier: "tier1" },
  "guwahati": { min: 5000, avg: 10000, max: 20000, tier: "tier2" },
  "bhubaneswar": { min: 5000, avg: 9000, max: 18000, tier: "tier2" },
  "indore": { min: 5000, avg: 9000, max: 18000, tier: "tier2" },
  "nagpur": { min: 5000, avg: 9000, max: 18000, tier: "tier2" },
  "patna": { min: 4000, avg: 8000, max: 15000, tier: "tier2" },
  "ranchi": { min: 4000, avg: 7000, max: 14000, tier: "tier2" },
  "default": { min: 4000, avg: 8000, max: 20000, tier: "tier3" }
};

// Property type multipliers
const TYPE_MULTIPLIERS = {
  "ROOM": 0.4,
  "PG": 0.5,
  "HOSTEL": 0.45,
  "FLAT": 1.0,
  "HOME": 1.5
};

// Get city benchmark
function getCityBenchmark(city) {
  const cityLower = (city || "").toLowerCase().trim();
  return CITY_RENT_BENCHMARKS[cityLower] || CITY_RENT_BENCHMARKS["default"];
}

// Calculate expected price range
function calculateExpectedPriceRange(property) {
  const benchmark = getCityBenchmark(property.city);
  const typeMultiplier = TYPE_MULTIPLIERS[property.type] || 1.0;
  const bhkMultiplier = property.bhk ? (property.bhk * 0.7 + 0.3) : 1.0;
  
  return {
    min: Math.round(benchmark.min * typeMultiplier * bhkMultiplier),
    avg: Math.round(benchmark.avg * typeMultiplier * bhkMultiplier),
    max: Math.round(benchmark.max * typeMultiplier * bhkMultiplier),
    tier: benchmark.tier
  };
}

// Analyze price fairness
function analyzePriceFairness(price, expectedRange) {
  const ratio = price / expectedRange.avg;
  
  if (ratio < 0.5) return { rating: "SUSPICIOUS", score: 20, note: "Unusually low - verify authenticity" };
  if (ratio < 0.7) return { rating: "EXCELLENT", score: 95, note: "Great deal - below market rate" };
  if (ratio < 0.9) return { rating: "GOOD", score: 80, note: "Competitive pricing" };
  if (ratio < 1.1) return { rating: "FAIR", score: 65, note: "Market rate pricing" };
  if (ratio < 1.3) return { rating: "ABOVE_AVERAGE", score: 50, note: "Slightly above market" };
  if (ratio < 1.5) return { rating: "OVERPRICED", score: 35, note: "Above market rate" };
  return { rating: "VERY_OVERPRICED", score: 15, note: "Significantly overpriced" };
}

/**
 * Generate Property Score (0-100)
 * Evaluates location, amenities, price fairness with accurate Indian market data
 */
async function generatePropertyScore(property) {
  const cacheKey = `property_score_${property._id}`;
  
  // Calculate price analysis locally for accuracy
  const expectedRange = calculateExpectedPriceRange(property);
  const priceAnalysis = analyzePriceFairness(property.price, expectedRange);
  
  // Calculate amenity score
  const amenityList = property.amenities || [];
  const premiumAmenities = ["AC", "WiFi", "Gym", "Swimming Pool", "Parking", "Security", "Power Backup", "Lift"];
  const basicAmenities = ["Water Supply", "Electricity", "Bathroom", "Kitchen"];
  
  let amenityScore = 30; // Base score
  amenityList.forEach(a => {
    const aLower = a.toLowerCase();
    if (premiumAmenities.some(p => aLower.includes(p.toLowerCase()))) amenityScore += 10;
    if (basicAmenities.some(b => aLower.includes(b.toLowerCase()))) amenityScore += 5;
  });
  amenityScore = Math.min(amenityScore, 100);
  
  // Furnishing bonus
  const furnishingScore = property.furnishing === "Furnished" ? 15 : 
                          property.furnishing === "Semi-Furnished" ? 8 : 0;

  const systemPrompt = `You are an expert Indian real estate analyst with deep knowledge of ${property.city || "Indian"} property markets.
You MUST respond with ONLY valid JSON - no explanations, no markdown, no thinking tags.
Be accurate and specific to the location and property type.`;

  const prompt = `Analyze this ${property.type} in ${property.city}:

PROPERTY DETAILS:
- Title: ${property.title}
- Type: ${property.type} (${property.listingType || "rent"})
- Location: ${property.area || "Not specified"}, ${property.city}
- Price: ₹${property.price}${property.listingType === "rent" || property.purpose === "RENT" ? "/month" : " (sale)"}
- BHK: ${property.bhk || "N/A"}
- Area: ${property.sqft ? property.sqft + " sqft" : "Not specified"}
- Furnishing: ${property.furnishing || "Not specified"}
- Amenities: ${amenityList.length > 0 ? amenityList.join(", ") : "Not listed"}
- Description: ${property.description || "No description provided"}

MARKET CONTEXT FOR ${(property.city || "this area").toUpperCase()}:
- Expected rent range for this type: ₹${expectedRange.min.toLocaleString()} - ₹${expectedRange.max.toLocaleString()}/month
- Market average: ₹${expectedRange.avg.toLocaleString()}/month
- This price is ${priceAnalysis.note}
- City tier: ${expectedRange.tier}

PRE-CALCULATED SCORES (use these as base):
- Price Score: ${priceAnalysis.score}/100 (${priceAnalysis.rating})
- Amenity Score: ${amenityScore}/100
- Furnishing Bonus: +${furnishingScore}

YOUR TASK:
Provide final analysis considering location quality in ${property.city}, property condition from description, and overall value.

RESPOND WITH ONLY THIS JSON (no other text):
{
  "score": <number 50-95, weighted: price 35%, location 25%, amenities 25%, condition 15%>,
  "priceRating": "${priceAnalysis.rating}",
  "locationQuality": "<PRIME|GOOD|AVERAGE|DEVELOPING based on ${property.area || property.city}>",
  "highlights": [<3 specific positives about THIS property>],
  "concerns": [<1-2 concerns if any, or empty array>],
  "summary": "<15-20 word summary specific to this ${property.type} in ${property.city}>"
}`;

  try {
    const response = await callDeepSeek(prompt, systemPrompt, cacheKey);
    const parsed = parseAIResponse(response);
    
    if (parsed && parsed.score) {
      // Ensure price rating matches our analysis
      parsed.priceRating = priceAnalysis.rating;
      parsed.expectedPriceRange = expectedRange;
      return parsed;
    }
    
    // Fallback with calculated scores
    return {
      score: Math.round((priceAnalysis.score * 0.35) + (amenityScore * 0.25) + 50 + furnishingScore * 0.15),
      priceRating: priceAnalysis.rating,
      locationQuality: expectedRange.tier === "metro" ? "GOOD" : "AVERAGE",
      highlights: [
        `${property.type} in ${property.city}`,
        priceAnalysis.score >= 70 ? "Competitively priced" : "Listed on verified platform",
        amenityList.length > 0 ? `Includes ${amenityList[0]}` : "Contact owner for details"
      ],
      concerns: priceAnalysis.score < 30 ? ["Verify pricing with owner"] : [],
      summary: `${property.type} in ${property.city} at ₹${property.price.toLocaleString()}. ${priceAnalysis.note}.`,
      expectedPriceRange: expectedRange
    };
  } catch (error) {
    console.error("[AI] Score generation error:", error);
    // Return calculated fallback
    return {
      score: Math.round((priceAnalysis.score * 0.35) + (amenityScore * 0.25) + 50),
      priceRating: priceAnalysis.rating,
      locationQuality: "AVERAGE",
      highlights: [`${property.type} in ${property.city}`, "Listed property"],
      concerns: [],
      summary: `${property.type} available in ${property.city}. ${priceAnalysis.note}.`,
      expectedPriceRange: expectedRange
    };
  }
}

/**
 * Calculate Fraud Risk
 * Flags suspicious listings
 */
async function calculateFraudRisk(property, ownerInfo = {}) {
  const cacheKey = `fraud_risk_${property._id}`;
  
  const systemPrompt = `You are a fraud detection specialist for real estate listings in India.
Identify red flags and suspicious patterns. Be cautious but fair.
Always respond with ONLY valid JSON.`;

  const prompt = `Analyze this property listing for potential fraud indicators:

Property:
- Title: ${property.title}
- Type: ${property.type}
- Location: ${property.city}, ${property.area || ""}
- Price: ₹${property.price} (${property.listingType})
- Posted: ${new Date(property.createdAt).toLocaleDateString()}
- Description: ${property.description || "None"}
- Images: ${property.images?.length || 0} photos
- Owner verified: ${ownerInfo.verified || false}

Check for:
1. Unrealistically low prices
2. Vague or copied descriptions
3. Missing important details
4. Suspicious urgency language
5. Too good to be true claims

Respond with ONLY this JSON:
{
  "riskLevel": "<LOW|MEDIUM|HIGH>",
  "riskScore": <number 0-100>,
  "flags": ["<flag1 if any>", "<flag2 if any>"],
  "recommendation": "<advice for users>",
  "verified": <true if seems legitimate>
}`;

  const response = await callDeepSeek(prompt, systemPrompt, cacheKey);
  return parseAIResponse(response);
}

/**
 * Smart User-Property Matching
 * Matches users to suitable properties
 */
async function matchUserToProperties(userProfile, properties) {
  const cacheKey = `match_${userProfile.email}_${properties.length}`;
  
  const systemPrompt = `You are a smart property matching assistant.
Match users to properties based on their needs, budget, and preferences.
Always respond with ONLY valid JSON.`;

  const propertyList = properties.slice(0, 10).map((p, i) => 
    `${i + 1}. ${p.title} | ${p.type} | ${p.city} | ₹${p.price} | ${p.bhk || ""}BHK`
  ).join("\n");

  const prompt = `Match this user to the best properties:

User Profile:
- Type: ${userProfile.userType || "general"} (student/professional/family)
- Budget: ₹${userProfile.budget?.min || 0} - ₹${userProfile.budget?.max || "unlimited"}
- Preferred Location: ${userProfile.preferredCity || "Any"}
- Looking for: ${userProfile.lookingFor || "rent"}
- Preferences: ${userProfile.preferences?.join(", ") || "None specified"}

Available Properties:
${propertyList}

Rank the top 5 best matches with reasons.

Respond with ONLY this JSON:
{
  "matches": [
    {
      "rank": 1,
      "propertyIndex": <index from list>,
      "matchScore": <0-100>,
      "reason": "<why this matches>"
    }
  ],
  "suggestion": "<overall suggestion for user>"
}`;

  const response = await callDeepSeek(prompt, systemPrompt, cacheKey);
  return parseAIResponse(response);
}

/**
 * Smart Rent Suggestion
 * Suggests optimal rent price
 */
async function suggestRentPrice(property) {
  const cacheKey = `rent_suggest_${property._id}`;
  
  const systemPrompt = `You are an Indian real estate pricing expert.
Suggest accurate rental prices based on market knowledge.
Always respond with ONLY valid JSON.`;

  const prompt = `Suggest optimal rent for this property:

Property:
- Type: ${property.type}
- Location: ${property.area || ""}, ${property.city}
- BHK: ${property.bhk || "N/A"}
- Sqft: ${property.sqft || "N/A"}
- Furnishing: ${property.furnishing || "Unfurnished"}
- Amenities: ${property.amenities?.join(", ") || "Basic"}
- Current asking: ₹${property.price}/month

Based on ${property.city} market rates, suggest:

Respond with ONLY this JSON:
{
  "suggestedRent": <number>,
  "rentRange": {
    "min": <number>,
    "max": <number>
  },
  "currentPriceAssessment": "<UNDERPRICED|FAIR|OVERPRICED>",
  "marketInsight": "<brief market insight>",
  "negotiationTip": "<tip for renters>"
}`;

  const response = await callDeepSeek(prompt, systemPrompt, cacheKey);
  return parseAIResponse(response);
}

/**
 * Maintenance Priority Prediction
 * For smart maintenance system
 */
async function predictMaintenancePriority(request) {
  const cacheKey = `maint_priority_${request._id}`;
  
  const systemPrompt = `You are a property maintenance expert.
Analyze maintenance requests and predict urgency and cost.
Always respond with ONLY valid JSON.`;

  const prompt = `Analyze this maintenance request:

Request:
- Category: ${request.category}
- Title: ${request.title}
- Description: ${request.description}
- Reported: ${new Date(request.createdAt).toLocaleDateString()}
- Current Status: ${request.status}

Predict:
1. Urgency level
2. Estimated resolution time
3. Approximate cost range
4. Recommended action

Respond with ONLY this JSON:
{
  "urgency": "<CRITICAL|HIGH|MEDIUM|LOW>",
  "estimatedDays": <number>,
  "costRange": {
    "min": <number in INR>,
    "max": <number in INR>
  },
  "recommendation": "<recommended action>",
  "safetyRisk": <true/false>,
  "canDIY": <true/false>
}`;

  const response = await callDeepSeek(prompt, systemPrompt, cacheKey);
  return parseAIResponse(response);
}

/**
 * General Property Q&A / Chat
 * For chatbot interactions
 */
async function propertyChat(propertyDetails, userQuestion, chatHistory = []) {
  const systemPrompt = `You are AuraSpot's friendly AI property assistant for Indian real estate.

RESPONSE STYLE:
- Be concise but informative (2-4 short paragraphs max)
- Use simple formatting: **bold** for emphasis, bullet points for lists
- Include specific numbers and facts when available
- Give honest assessments with pros and cons
- End with a practical recommendation or tip

AVOID:
- Very long responses
- Repeating information unnecessarily  
- Generic advice without specifics
- Starting with "I" or being overly formal

FOCUS AREAS:
- Price fairness for the area
- Location advantages/disadvantages
- Value for money assessment
- Red flags if any
- Practical tips for the user`;

  const historyText = chatHistory.slice(-5).map(m => 
    `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`
  ).join("\n");

  const prompt = `**Property Details:**
${propertyDetails}

${historyText ? `**Previous Chat:**\n${historyText}\n` : ""}
**User Question:** ${userQuestion}

Provide a helpful, specific response. Keep it under 200 words.`;

  // No caching for chat (dynamic)
  const response = await callDeepSeek(prompt, systemPrompt);
  return response;
}

/**
 * Generate Complete AI Insights for Property
 * Called when property is created/updated
 */
async function generatePropertyInsights(property) {
  try {
    const [scoreData, fraudData, rentData] = await Promise.all([
      generatePropertyScore(property),
      calculateFraudRisk(property),
      property.listingType === "rent" ? suggestRentPrice(property) : Promise.resolve(null)
    ]);

    return {
      score: scoreData?.score || null,
      priceRating: scoreData?.priceRating || null,
      locationQuality: scoreData?.locationQuality || null,
      highlights: scoreData?.highlights || [],
      concerns: scoreData?.concerns || [],
      summary: scoreData?.summary || null,
      fraudRisk: fraudData?.riskLevel || null,
      fraudScore: fraudData?.riskScore || null,
      fraudFlags: fraudData?.flags || [],
      rentSuggestion: rentData,
      generatedAt: new Date()
    };
  } catch (error) {
    console.error("[AI] Error generating insights:", error);
    return null;
  }
}

/**
 * Clear cache for a property (when updated)
 */
function clearPropertyCache(propertyId) {
  const keysToDelete = [];
  for (const key of responseCache.keys()) {
    if (key.includes(propertyId)) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach(k => responseCache.delete(k));
  console.log(`[AI] Cleared ${keysToDelete.length} cached entries for property ${propertyId}`);
}

/**
 * Get cache stats
 */
function getCacheStats() {
  return {
    entries: responseCache.size,
    keys: Array.from(responseCache.keys())
  };
}

module.exports = {
  generatePropertyScore,
  calculateFraudRisk,
  matchUserToProperties,
  suggestRentPrice,
  predictMaintenancePriority,
  propertyChat,
  generatePropertyInsights,
  clearPropertyCache,
  getCacheStats
};
