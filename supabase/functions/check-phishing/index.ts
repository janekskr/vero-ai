import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenAI } from "npm:@google/genai";

import { corsHeaders } from "../_shared/cors.ts";

async function callGeminiEmailCheck(
  senderEmail: string,
  emailContent: string,
  apiKey: string
) {
  const ai = new GoogleGenAI({ apiKey });

  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const foundUrls = emailContent.match(urlRegex) || [];

  const prompt = `
Przeprowadź pełną analizę bezpieczeństwa e-maila.

Zwróć szczegółową ocenę dotyczącą:
1. WIARYGODNOŚCI NADAWCY (adres e-mail, domena, podobieństwo do firmowych domen).
2. TREŚCI (czy zawiera manipulację, phishing, groźby, prośby o hasła, pilne wezwania).
3. LINKÓW — przeanalizuj KAŻDY link osobno i oceń:
   - czy jest niebezpieczny,
   - czy podejrzany,
   - czy bezpieczny.

Wynik ma być w formacie JSON:

{
  "status": "phishing" | "safe" | "suspicious",
  "confidence": 0-100,
  "senderAnalysis": {
    "email": "${senderEmail}",
    "trustLevel": "low" | "medium" | "high",
    "reason": "wyjaśnienie po polsku"
  },
  "contentWarnings": ["ostrzeżenie1", "ostrzeżenie2"],
  "linkAnalysis": [
    {
      "url": "...",
      "status": "dangerous" | "suspicious" | "safe",
      "reason": "wyjaśnienie"
    }
  ],
  "recommendation": "zalecenie po polsku"
}

Treść e-maila:
"${emailContent.substring(0, 6000)}"

Linki znalezione:
${foundUrls.map((u) => "- " + u).join("\n")}
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    return response;
  } catch (error) {
    console.error("Gemini API error:", error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { senderEmail, emailContent } = await req.json();

    if (!senderEmail || !emailContent) {
      return new Response(JSON.stringify({ error: "Brak danych do analizy" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("GOOGLE_API_KEY");
    if (!apiKey) {
      throw new Error("GOOGLE_API_KEY env variable is not set");
    }

    const response = await callGeminiEmailCheck(
      senderEmail,
      emailContent,
      apiKey
    );

    const result = response.text;

    if (!result || result.trim().length === 0) {
      throw new Error("Pusta odpowiedź Gemini");
    }

    let data;

    try {
      data = JSON.parse(result);

      // walidacja minimalna
      if (
        typeof data.status !== "string" ||
        typeof data.confidence !== "number" ||
        typeof data.senderAnalysis !== "object" ||
        !Array.isArray(data.linkAnalysis)
      ) {
        throw new Error("Nieprawidłowy format odpowiedzi AI");
      }

      data.confidence = Math.max(0, Math.min(100, data.confidence));
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      console.error("Raw response:", result);

      data = {
        status: "suspicious",
        confidence: 40,
        senderAnalysis: {
          email: senderEmail,
          trustLevel: "low",
          reason: "Nie udało się przeprowadzić pełnej analizy AI",
        },
        contentWarnings: ["Błąd podczas analizy"],
        linkAnalysis: [],
        recommendation:
          "Nie udało się przeprowadzić pełnej analizy. Zachowaj ostrożność i zweryfikuj nadawcę.",
      };
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in check-email function:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Nieoczekiwany błąd";

    return new Response(
      JSON.stringify({
        status: "suspicious",
        confidence: 0,
        senderAnalysis: {
          email: "",
          trustLevel: "low",
          reason: "Błąd systemu",
        },
        contentWarnings: ["Błąd systemu"],
        linkAnalysis: [],
        recommendation: "Spróbuj ponownie później.",
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
