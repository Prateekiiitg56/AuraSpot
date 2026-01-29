/**
 * AI Service - DeepSeek Integration
 * Single AI model with caching and smart prompt engineering
 */

const DEEPSEEK_API_KEY = "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";
const DEEPSEEK_MODEL = "tngtech/deepseek-r1t2-chimera:free";
const API_URL = "https://openrouter.ai/api/v1/chat/completions";

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
 * Enhanced with rule-based detection + AI
 */
async function calculateFraudRisk(property, ownerInfo = {}) {
  const cacheKey = `fraud_risk_${property._id}`;
  
  // === RULE-BASED FRAUD DETECTION ===
  const flags = [];
  let riskScore = 0;
  
  // 1. Price Analysis (30 points max)
  const expectedRange = calculateExpectedPriceRange(
    property.city, 
    property.type, 
    property.bhk || 1
  );
  
  const priceRatio = property.price / expectedRange.avg;
  
  if (priceRatio < 0.3) {
    flags.push("Price is suspiciously low (less than 30% of market rate)");
    riskScore += 30;
  } else if (priceRatio < 0.5) {
    flags.push("Price is significantly below market rate");
    riskScore += 15;
  } else if (priceRatio > 3) {
    flags.push("Price is unusually high for this area");
    riskScore += 10;
  }
  
  // 2. Image Analysis (20 points max)
  const imageCount = property.images?.length || 0;
  if (imageCount === 0) {
    flags.push("No property images provided");
    riskScore += 20;
  } else if (imageCount === 1) {
    flags.push("Only one image available");
    riskScore += 10;
  }
  
  // 3. Description Quality (20 points max)
  const description = property.description || "";
  const descLength = description.length;
  
  if (descLength < 20) {
    flags.push("Very short or missing description");
    riskScore += 15;
  } else if (descLength < 50) {
    flags.push("Brief description - lacks details");
    riskScore += 5;
  }
  
  // Check for suspicious keywords
  const suspiciousKeywords = [
    "urgent", "quickly", "today only", "limited time", 
    "act fast", "won't last", "immediate", "hurry",
    "western union", "wire transfer", "advance payment",
    "no verification", "no documents", "cash only"
  ];
  
  const lowerDesc = description.toLowerCase();
  const foundSuspicious = suspiciousKeywords.filter(kw => lowerDesc.includes(kw));
  if (foundSuspicious.length > 0) {
    flags.push(`Suspicious language: "${foundSuspicious.join(", ")}"`);
    riskScore += 10 * Math.min(foundSuspicious.length, 2);
  }
  
  // 4. Contact/Owner Info (15 points max)
  if (!ownerInfo.verified) {
    flags.push("Owner not verified");
    riskScore += 10;
  }
  
  if (!ownerInfo.phone && !ownerInfo.email) {
    flags.push("No contact information available");
    riskScore += 15;
  }
  
  // 5. Listing Age (10 points max)
  const listingAge = Date.now() - new Date(property.createdAt).getTime();
  const daysOld = listingAge / (1000 * 60 * 60 * 24);
  
  if (daysOld < 1 && priceRatio < 0.5) {
    flags.push("New listing with very low price");
    riskScore += 10;
  }
  
  // 6. Amenities vs Price Check (5 points max)
  const amenities = property.amenities || [];
  const premiumAmenities = ["AC", "Parking", "Gym", "Pool", "Security", "Power Backup"];
  const hasPremium = amenities.some(a => premiumAmenities.includes(a));
  
  if (hasPremium && priceRatio < 0.4) {
    flags.push("Premium amenities at suspiciously low price");
    riskScore += 5;
  }
  
  // Calculate risk level
  let riskLevel = "LOW";
  if (riskScore >= 40) riskLevel = "HIGH";
  else if (riskScore >= 20) riskLevel = "MEDIUM";
  
  // Cap risk score at 100
  riskScore = Math.min(riskScore, 100);
  
  // Reduce flags if risk is low
  const topFlags = flags.slice(0, 4);
  
  // === AI ENHANCEMENT ===
  const systemPrompt = `You are a fraud detection specialist for Indian real estate. 
Analyze the listing and provide additional insights. Be specific and practical.
Always respond with ONLY valid JSON.`;

  const prompt = `Analyze this property listing for fraud risk:

Property: ${property.title}
Type: ${property.type} | Location: ${property.city}, ${property.area || "N/A"}
Price: ₹${property.price.toLocaleString()}/month
Expected Market Price: ₹${expectedRange.min.toLocaleString()} - ₹${expectedRange.max.toLocaleString()}/month
Images: ${imageCount} photos
Description: "${description.substring(0, 200)}${description.length > 200 ? "..." : ""}"
Owner Verified: ${ownerInfo.verified ? "Yes" : "No"}

Pre-calculated Risk Score: ${riskScore}/100 (${riskLevel})
Detected Flags: ${topFlags.length > 0 ? topFlags.join("; ") : "None"}

Provide ONLY a JSON response with:
{
  "additionalFlags": [<any additional concerns we missed, max 2>],
  "recommendation": "<specific advice for potential tenants, 15-25 words>",
  "trustIndicators": [<positive signs if any, max 2>]
}`;

  try {
    const response = await callDeepSeek(prompt, systemPrompt, cacheKey);
    const aiInsights = parseAIResponse(response);
    
    // Merge AI insights
    if (aiInsights) {
      if (aiInsights.additionalFlags?.length > 0) {
        topFlags.push(...aiInsights.additionalFlags);
        riskScore = Math.min(riskScore + aiInsights.additionalFlags.length * 5, 100);
        // Recalculate level
        if (riskScore >= 40) riskLevel = "HIGH";
        else if (riskScore >= 20) riskLevel = "MEDIUM";
      }
      
      return {
        riskLevel,
        riskScore,
        flags: topFlags.slice(0, 5),
        recommendation: aiInsights.recommendation || getDefaultRecommendation(riskLevel),
        trustIndicators: aiInsights.trustIndicators || [],
        verified: riskScore < 30,
        priceComparison: {
          expected: expectedRange.avg,
          actual: property.price,
          deviation: Math.round((priceRatio - 1) * 100) + "%"
        }
      };
    }
  } catch (error) {
    console.error("[AI] Fraud detection AI enhancement failed:", error);
  }
  
  // Fallback without AI
  return {
    riskLevel,
    riskScore,
    flags: topFlags,
    recommendation: getDefaultRecommendation(riskLevel),
    trustIndicators: riskScore < 20 ? ["Listed on verified platform", "Standard pricing"] : [],
    verified: riskScore < 30,
    priceComparison: {
      expected: expectedRange.avg,
      actual: property.price,
      deviation: Math.round((priceRatio - 1) * 100) + "%"
    }
  };
}

// Helper for default recommendations
function getDefaultRecommendation(riskLevel) {
  switch (riskLevel) {
    case "HIGH":
      return "Exercise extreme caution. Verify all details in person before any payment. Request official documents.";
    case "MEDIUM":
      return "Proceed with caution. Visit the property and verify owner identity before making any commitments.";
    default:
      return "Standard precautions apply. Visit property and verify documents before signing agreement.";
  }
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
 * Enhanced with real market data + AI
 */
async function suggestRentPrice(property) {
  const cacheKey = `rent_suggest_${property._id}`;
  
  // Use our market benchmark data
  const expectedRange = calculateExpectedPriceRange(
    property.city,
    property.type,
    property.bhk || 1
  );
  
  // Calculate furnishing premium
  const furnishingPremiums = {
    "Fully Furnished": 1.25,
    "Semi Furnished": 1.1,
    "Unfurnished": 1.0
  };
  const furnishingMultiplier = furnishingPremiums[property.furnishing] || 1.0;
  
  // Calculate amenity premium
  const premiumAmenities = ["AC", "Parking", "Gym", "Pool", "Security", "Power Backup", "Lift"];
  const amenityCount = (property.amenities || []).filter(a => 
    premiumAmenities.some(p => a.toLowerCase().includes(p.toLowerCase()))
  ).length;
  const amenityPremium = 1 + (amenityCount * 0.03); // 3% per premium amenity
  
  // Calculate suggested rent with adjustments
  const baseRent = expectedRange.avg;
  const adjustedMin = Math.round(expectedRange.min * furnishingMultiplier * amenityPremium);
  const adjustedAvg = Math.round(baseRent * furnishingMultiplier * amenityPremium);
  const adjustedMax = Math.round(expectedRange.max * furnishingMultiplier * amenityPremium);
  
  // Assess current price
  let currentAssessment = "FAIR";
  const priceRatio = property.price / adjustedAvg;
  if (priceRatio < 0.85) currentAssessment = "UNDERPRICED";
  else if (priceRatio > 1.15) currentAssessment = "OVERPRICED";
  
  const systemPrompt = `You are an Indian real estate pricing expert.
Provide market insights based on the data provided. Be specific and helpful.
Always respond with ONLY valid JSON.`;

  const prompt = `Analyze this rental property pricing:

Property: ${property.type} | ${property.bhk || 1}BHK | ${property.city}
Area: ${property.area || "Not specified"}
Sqft: ${property.sqft || "Not specified"}
Furnishing: ${property.furnishing || "Unfurnished"}
Amenities: ${property.amenities?.join(", ") || "Basic"}

Current Asking: ₹${property.price.toLocaleString()}/month
Market Benchmark: ₹${expectedRange.min.toLocaleString()} - ₹${expectedRange.max.toLocaleString()}/month
Adjusted for Furnishing/Amenities: ₹${adjustedMin.toLocaleString()} - ₹${adjustedMax.toLocaleString()}/month
Pre-calculated Assessment: ${currentAssessment}

Provide insights:
{
  "marketInsight": "<15-20 word insight about ${property.city} rental market for ${property.type}>",
  "negotiationTip": "<practical tip for renters negotiating this property>",
  "bestTimeToRent": "<when is the best time to rent in this area>",
  "demandLevel": "<HIGH|MODERATE|LOW - demand for this type in ${property.city}>"
}`;

  try {
    const response = await callDeepSeek(prompt, systemPrompt, cacheKey);
    const aiInsights = parseAIResponse(response);
    
    return {
      suggestedRent: adjustedAvg,
      rentRange: {
        min: adjustedMin,
        max: adjustedMax
      },
      currentPrice: property.price,
      currentPriceAssessment: currentAssessment,
      marketBenchmark: expectedRange,
      cityTier: expectedRange.tier,
      marketInsight: aiInsights?.marketInsight || `${property.city} has a ${expectedRange.tier === "metro" ? "competitive" : "moderate"} rental market.`,
      negotiationTip: aiInsights?.negotiationTip || (currentAssessment === "OVERPRICED" 
        ? "This property is above market rate. You can negotiate 10-15% reduction."
        : "Fair pricing. Check for hidden charges like maintenance fees."),
      bestTimeToRent: aiInsights?.bestTimeToRent || "Off-peak months (April-July) typically have better deals.",
      demandLevel: aiInsights?.demandLevel || (expectedRange.tier === "metro" ? "HIGH" : "MODERATE"),
      factors: {
        furnishingPremium: `+${Math.round((furnishingMultiplier - 1) * 100)}%`,
        amenityPremium: `+${Math.round((amenityPremium - 1) * 100)}%`
      }
    };
  } catch (error) {
    console.error("[AI] Rent suggestion AI enhancement failed:", error);
    
    // Return calculated data without AI insights
    return {
      suggestedRent: adjustedAvg,
      rentRange: {
        min: adjustedMin,
        max: adjustedMax
      },
      currentPrice: property.price,
      currentPriceAssessment: currentAssessment,
      marketBenchmark: expectedRange,
      cityTier: expectedRange.tier,
      marketInsight: `${property.type} in ${property.city} typically rents for ₹${expectedRange.min.toLocaleString()}-₹${expectedRange.max.toLocaleString()}/month.`,
      negotiationTip: currentAssessment === "OVERPRICED" 
        ? "This is above market rate. Consider negotiating or exploring other options."
        : "This is fairly priced for the area.",
      demandLevel: expectedRange.tier === "metro" ? "HIGH" : "MODERATE",
      factors: {
        furnishingPremium: `+${Math.round((furnishingMultiplier - 1) * 100)}%`,
        amenityPremium: `+${Math.round((amenityPremium - 1) * 100)}%`
      }
    };
  }
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
 * Enhanced with market data context
 */
async function propertyChat(propertyDetails, userQuestion, chatHistory = [], property = null) {
  // If we have the property object, add market context
  let marketContext = "";
  if (property) {
    const expectedRange = calculateExpectedPriceRange(
      property.city,
      property.type,
      property.bhk || 1
    );
    const priceAnalysis = analyzePriceFairness(property.price, expectedRange);
    
    marketContext = `
**Market Data for ${property.city}:**
- Expected rent for ${property.type} ${property.bhk || 1}BHK: ₹${expectedRange.min.toLocaleString()} - ₹${expectedRange.max.toLocaleString()}/month
- This property at ₹${property.price.toLocaleString()}: ${priceAnalysis.rating} (${priceAnalysis.note})
- City Tier: ${expectedRange.tier}
`;
  }

  const systemPrompt = `You are AuraSpot's AI property expert for Indian real estate.

YOUR KNOWLEDGE:
- Indian rental market rates across cities
- Property valuation factors
- Common scams and red flags
- Legal requirements (rent agreements, deposits)
- Negotiation tactics

RESPONSE RULES:
1. Be SPECIFIC - use actual numbers from the market data provided
2. Be CONCISE - max 3 short paragraphs or bullet points
3. Be HONEST - mention concerns if any
4. Be HELPFUL - give actionable advice
5. Use **bold** for key points, bullets for lists

AVOID:
- Generic responses without specifics
- Very long explanations
- Repeating the question
- Being overly cautious without reason`;

  const historyText = chatHistory.slice(-4).map(m => 
    `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`
  ).join("\n");

  const prompt = `**Property:**
${propertyDetails}
${marketContext}
${historyText ? `**Chat History:**\n${historyText}\n` : ""}
**Question:** ${userQuestion}

Give a specific, helpful response based on the data provided. Keep it under 150 words.`;

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
