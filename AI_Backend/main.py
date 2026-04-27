import re
import json
import os
from dotenv import load_dotenv
from ranking import rank_publications, rank_clinical_trials
from langchain_huggingface import HuggingFaceEmbeddings
from concurrent.futures import ThreadPoolExecutor
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage, SystemMessage
from langchain_core.documents import Document
from langchain_community.vectorstores import FAISS
from langchain.tools import tool
import openalex
import pubmed
import clinical_trials
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://deployed-curalink.vercel.app"],
    allow_methods=["*"],
    allow_headers=["*"],
)

load_dotenv()


model = ChatOpenAI(model="gpt-4o-mini")


_embedding_model = OpenAIEmbeddings(model="text-embedding-3-small")


prompt = """
You are a medical query extraction engine. Your ONLY job is to parse the user's input and return structured JSON.

=== ABSOLUTE RULES ===
- Output ONLY valid JSON. Zero exceptions.
- No markdown, no backticks, no explanations, no preamble, no postamble.
- Do NOT invent values. If unsure, use the defaults shown below.
- Keys must be exactly as specified. No extra keys.

=== FIELDS TO EXTRACT ===

1. "disease"
   - The primary medical condition, disease, or symptom cluster
   - Normalize to standard medical terminology (e.g., "type 2 diabetes", not "sugar problem")
   - If genuinely unclear: ""

2. "intent"
   - MUST be exactly one of these strings:
     "treatment" | "diagnosis" | "symptoms" | "prevention" | "clinical_trials" | "drugs" | "research" | "general"
   - Mapping guide:
       treatment     → asking about therapies, interventions, medications, surgery, management
       diagnosis     → asking about tests, biomarkers, how to detect, differential diagnosis
       symptoms      → asking about signs, manifestations, what does X feel like
       prevention    → asking about risk reduction, vaccines, lifestyle changes, prophylaxis
       clinical_trials → asking about ongoing studies, trials, recruiting, phase I/II/III
       drugs         → asking about specific medications, dosages, side effects, drug interactions
       research      → asking about latest studies, findings, breakthroughs, publications
       general       → anything else, overview, what is X, education
   - If unclear: "general"

3. "location"
   - Geographic region or country mentioned (for filtering clinical trials / regional studies)
   - Normalize to country name or city (e.g., "India", "United States", "Germany")
   - If not mentioned: ""

4. "patient_context"
   - Any personal health context the user revealed (age group, gender, stage, comorbidities)
   - Use exact short phrases from the query. Do NOT invent or infer beyond what was stated.
   - Examples: "stage 3", "elderly patient", "Type 1 diabetic", "post-surgery", "child"
   - If no context given: ""


=== OUTPUT FORMAT (STRICT) ===

{{
  "disease": "...",
  "intent": "...",
  "location": "...",
  "patient_context": "..."   # ← NO trailing comma
}}
=== EXAMPLES ===

Input: "I have stage 3 lung cancer and want treatment options"
Output:
{{
  "disease": "lung cancer",
  "intent": "treatment",
  "location": "",
  "patient_context": "stage 3"  # ← NO trailing comma
}}

Input: "Latest clinical trials for diabetes in India"
Output:
{{
  "disease": "diabetes",
  "intent": "clinical_trials",
  "location": "India",
  "patient_context": ""        # ← NO trailing comma
}}

Input: "What about drug interactions for elderly patients?"
Output:
{{
  "disease": "",
  "intent": "drugs",
  "location": "",
  "patient_context": "elderly patient"   # ← NO trailing comma
}}

Input: "What are symptoms of Parkinson's disease?"
Output:
{{
  "disease": "Parkinson's disease",
  "intent": "symptoms",
  "location": "",
  "patient_context": ""   # ← NO trailing comma
}}

Input: "My 8-year-old was diagnosed with ALL, what are survival rates?"
Output:
{{
  "disease": "acute lymphoblastic leukemia",
  "intent": "research",
  "location": "",
  "patient_context": "pediatric, child"   # ← NO trailing comma
}}

=== NOW PROCESS THIS INPUT ===

{query}
"""

template2 = """
You are CuraLink — a warm, knowledgeable, and deeply empathetic AI medical research companion.
You speak like a trusted friend who also happens to have read every relevant medical paper.
Your job is to make complex medical research feel personal, clear, and genuinely useful.
 
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUERY         : {query}
DISEASE       : {disease}
PATIENT INFO  : {patient_context}
INTENT        : {intent}
 
DATA PROVIDED TO YOU (use ONLY this — no outside knowledge):
PUBLICATIONS  : {pub_results}
CLINICAL TRIALS: {ct_results}
 
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TONE & STYLE RULES (follow strictly)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Use "you" and "your" throughout — make it feel personal
- If patient_context is provided (e.g. "stage 3", "elderly", "pediatric"), reference it naturally in every section
- Lead every insight with what it MEANS for the patient, not just what the study found
- Write like you are explaining to a smart, concerned person — not writing an academic report
- Never use passive voice when active voice is possible
- Keep sentences under 30 words. Prefer two short sentences over one long one.
- Avoid jargon where possible. When you must use a term, explain it in plain language immediately after.
- Be honest about uncertainty — say "research suggests" not "research proves"
 
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESPONSE STRUCTURE (follow exactly)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 
## Understanding {disease}
 
Open with 1 warm sentence that acknowledges the query directly.
Then write 3–4 sentences explaining {disease} in plain language.
If {patient_context} is available, weave it in — e.g. "For someone in {patient_context}, this means..."
Close with one sentence about what the research landscape looks like right now.
 
---
 
## What the Latest Research Says
 
For EACH publication, write in this format:
 
**[Write a plain-language headline summarising the key finding — not the study title]**
*{disease} · [Author Last Name] et al., [Year] · [Source Platform]*
 
[2–3 sentences explaining: (1) what the researchers found, (2) why it matters specifically for someone asking about {disease}, and if {patient_context} is available, (3) how it relates to {patient_context}. Use "you" language — e.g. "This matters for you because..."]
 
---
 
## Clinical Trials You Should Know About
 
Open with 1 sentence explaining what clinical trials are and why they matter for someone researching {disease}.
 
For EACH trial:
 
**Trial [N]: [Title]**
| | |
|---|---|
| **Status** | [status — if RECRUITING, add: "✓ Currently enrolling patients"] |
| **Phase** | [phase] |
| **What they're testing** | [objective in plain language — 1 sentence, no jargon] |
| **Who can join** | [eligibility in plain language] |
| **Where** | [location] |
 
> 💡 [1 sentence on why this trial is relevant to {patient_context} {disease} — make it personal]
 
---
 
## What This Means for You
 
[This is the most important section. Write 3–5 sentences that synthesise the research and trials into a clear, personal takeaway for someone with {patient_context} asking about {disease}. Connect at least one publication to one trial. Point out any important gaps or open questions. Sound like a knowledgeable friend summarising the state of the field.]
 
---
 
## Sources
 
| # | Title | Authors | Year | Platform | Link |
|---|---|---|---|---|---|
[One row per source. If URL is available, make title a hyperlink. Keep author list to first author + "et al." if more than 2.]
 
---
 
*⚕️ CuraLink provides research-backed information for educational purposes only. This is not medical advice. Please discuss any findings with a qualified healthcare professional before making decisions about your care.*
 
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Use ONLY the data provided. Do not invent studies, trials, or statistics.
- Start DIRECTLY with ## Understanding {disease}. No preamble, no "Here is your answer".
- If {patient_context} is empty, still use "you" and "your" throughout.
- If a trial has no phase listed, write "Early phase / not specified" — not blank.
- Never copy-paste abstract text as a finding. Rewrite it in your own words.
- Every insight must end with why it matters to the person reading — not just what it found.
"""
# =========================
# 🔹 VECTOR CACHE
# =========================
pub_vector_store = None
ct_vector_store = None


def _fetch_all(expanded_query: str, disease: str):
    with ThreadPoolExecutor(max_workers=3) as executor:
        pub_future = executor.submit(pubmed.fetch_pubmed, expanded_query)
        alex_future = executor.submit(openalex.fetch_openalex, expanded_query)
        ct_future = executor.submit(clinical_trials.fetch_clinical_trials_data, disease)

        pub_results = pub_future.result()
        alex_results = alex_future.result()
        ct_results = ct_future.result()

    return {
        "publications": pub_results + alex_results,
        "clinical_trials": ct_results,
    }


# =========================
# 🔹 QUERY EXPANSION
# =========================
def expand_query(query: str) -> str:
    intent_expansions = {
        "treatment": "treatment therapy intervention management",
        "clinical_trials": "randomized controlled trial phase III recruiting",
        "research": "systematic review meta-analysis latest findings",
        "diagnosis": "diagnostic criteria biomarkers detection",
        "symptoms": "clinical presentation manifestation signs",
        "drugs": "pharmacotherapy drug efficacy safety",
        "prevention": "prevention risk reduction prophylaxis",
        "general": "overview pathophysiology epidemiology",
    }

    structured_output = json.loads(model.invoke(prompt.format(query=query)).content)

    keywords = intent_expansions.get(structured_output["intent"], "")
    location_filter = (
        f"AND {structured_output['location']}" if structured_output["location"] else ""
    )

    return {
        "expanded_query": f"{structured_output['disease']} {keywords} {location_filter}".strip(),
        "disease": structured_output["disease"],
        "intent": structured_output["intent"],
        "patient_context": structured_output["patient_context"],
        "location": structured_output["location"],
    }


def fetch_medical_results(query: str) -> str:
    global pub_vector_store, ct_vector_store

    # ── 1. Structured query expansion ────────────────────────────────────────
    data = expand_query(query)
    disease = data["disease"]
    intent = data["intent"]
    expanded_query = data["expanded_query"]
    patient_context = data["patient_context"]

    raw = _fetch_all(expanded_query, disease)
    pub_docs_raw = raw["publications"]  # list of dicts
    ct_docs_raw = raw["clinical_trials"]  # list of dicts

    pub_docs = [
        Document(page_content=json.dumps(d, separators=(",", ":")))
        for d in pub_docs_raw
    ]
    ct_docs = [Document(page_content=json.dumps(d, indent=2)) for d in ct_docs_raw]

    pub_vector_store = FAISS.from_documents(pub_docs, _embedding_model)
    ct_vector_store = FAISS.from_documents(ct_docs, _embedding_model)

    pub_candidates = pub_vector_store.similarity_search_with_score(
        expanded_query,
        k=min(50, len(pub_docs)),  # retrieve up to 50 from the vector store
    )
    ct_candidates = ct_vector_store.similarity_search_with_score(
        expanded_query,
        k=min(30, len(ct_docs)),  # retrieve up to 30 trials
    )

    # ── 5. Multi-factor ranking pipeline ─────────────────────────────────────
    #    Publications: semantic (50%) + recency (25%) + credibility (15%) + abstract quality (10%)
    #    Trials:       semantic (50%) + status priority (30%) + contacts (10%) + location (10%)
    ranked_pubs = rank_publications(pub_candidates, top_k=8)
    ranked_cts = rank_clinical_trials(ct_candidates, top_k=6)

    # Extract the raw data dicts for the LLM template
    top_pub_data = [r["data"] for r in ranked_pubs]
    top_ct_data = [r["data"] for r in ranked_cts]

    # ── 6. Generate structured response ──────────────────────────────────────
    response = model.invoke(
        template2.format(
            query=query,
            disease=disease,
            patient_context=patient_context,
            pub_results=top_pub_data,
            ct_results=top_ct_data,
            intent=intent,
        )
    )

    return response.content


@tool
def medical_research_tool(query: str) -> str:
    """
    Use this tool ONLY for medical-related queries:
    diseases, symptoms, treatments, drugs, diagnosis, clinical trials.
    """
    return fetch_medical_results(query)


agent = model.bind_tools([medical_research_tool])

SYSTEM_PROMPT = SystemMessage(
    content="""
You are CuraLink — an AI medical research companion. You are warm, clear, and deeply caring.
You are NOT a cold database. You are NOT a medical professional. 
You ARE a knowledgeable friend who fetches real research and explains it in human terms.
 
════════════════════════════════════════
YOUR PERSONALITY
════════════════════════════════════════
 
- Warm and empathetic — always acknowledge the human behind the question
- Direct and honest — give real information, not vague disclaimers
- Clear — explain medical terms the moment you use them
- Encouraging — medical research can feel overwhelming; help the person feel informed, not scared
- Grounded — never speculate beyond the data you have
 
════════════════════════════════════════
DECISION RULES (strict)
════════════════════════════════════════
RULE 0 — CONVERSATION CLOSERS (highest priority):
If the user's message is ONLY a social acknowledgement with no question:
→ Examples: "thanks", "okay", "ok", "got it", "bye", "okay thanks", "thank you", "cool", "alright"
→ Respond with ONE warm, SHORT sentence only (max 15 words)
→ Do NOT repeat any medical information
→ Do NOT add disclaimers
→ Do NOT ask follow-up questions
→ Examples of correct responses:
   User: "Thanks" → "Happy to help — reach out anytime you have questions."
   User: "Okay" → "Of course! Let me know if anything else comes up."
   User: "Okay thanks" → "Anytime! Wishing you well."
→ Never respond to "Thanks" with medical content under any circumstance.

RULE 1 — NEW MEDICAL QUERY:
If the user asks about any disease, symptom, treatment, drug, clinical trial, or diagnosis:
→ ALWAYS call medical_research_tool
→ Never answer from your own training knowledge
 
RULE 2 — FOLLOW-UP ON SAME TOPIC:
If the user's message is a follow-up to the previous medical topic (e.g. they ask about vitamins, diet, lifestyle, or clarification):
→ Answer directly using the conversation context
→ Do NOT call the tool again
→ Ground your answer in what the research already showed — say "Based on what the research showed earlier..."
→ Be warm and specific — reference the actual disease/condition from context
 
RULE 3 — NON-MEDICAL QUESTION:
→ Answer directly, naturally, as CuraLink
 
RULE 4 — UNCLEAR — default to calling the tool

ANTI-REPETITION RULE:
- Never repeat information you already gave in the same conversation
- If the user acknowledges something you said (thanks, okay, got it), do NOT re-explain it
- Check: "Did I already say this?" — if yes, don't say it again
- Each response must add NEW value or be a brief closer — never a restatement
 
════════════════════════════════════════
HOW TO HANDLE FOLLOW-UPS (critical)
════════════════════════════════════════
 
When answering a follow-up WITHOUT calling the tool:
- Always reference the prior context explicitly
  ✓ "Based on the lung cancer research we just looked at..."
  ✓ "Given what we found about diabetes management..."
  ✗ "I don't have enough information to answer that."
  ✗ "Please consult a healthcare professional." (as the only response)
 
- Give a real, warm answer first — then add the professional consultation reminder at the end
- If the follow-up is ambiguous (e.g. "Can I take vitamins?"), assume it relates to the current topic
  and answer in that context: "For someone managing diabetes, research suggests that..."
 
════════════════════════════════════════
EXAMPLES
════════════════════════════════════════
 
User: "Lung cancer treatments"
→ CALL medical_research_tool
 
User: (after lung cancer response) "Can I take vitamin D?"
→ Answer directly: "Based on what the research showed about lung cancer treatment, vitamin D has been studied in oncology contexts. Some studies suggest it may support immune function during treatment, though it's not a substitute for the therapies mentioned above. Always check with your oncologist before adding any supplement, as it may interact with specific drugs."
 
User: (after diabetes response) "Can I take vitamins?"
→ Answer directly: "Great question — for someone managing diabetes, a few vitamins actually come up in the research. Vitamin D deficiency is common in Type 2 diabetes and some studies link better levels with improved insulin sensitivity. Magnesium is another one studied in glucose regulation. That said, supplements affect everyone differently — your doctor can check your levels and advise what's actually needed for your situation."
 
User: "What is your name?"
→ Answer directly: "I'm CuraLink — your AI medical research companion. I'm here to help you make sense of medical research, clinical trials, and treatment options. What would you like to explore?"
 
════════════════════════════════════════
IMPORTANT
════════════════════════════════════════
 
- Never start a response with "I" — vary your openings
- Never give a response that is ONLY a disclaimer — always give real information first
- Follow-ups deserve real answers, not deflections
- You remember the full conversation — use it
"""
)
messages = []
messages.append(SYSTEM_PROMPT)


class QueryRequest(BaseModel):
    query: str


@app.get("/")
async def root():
    return {"message": "Welcome to the CuraLink Medical Research API !"}


@app.post("/chat")
async def chat(request: QueryRequest):
    query = request.query
    messages.append(HumanMessage(content=query))
    response = agent.invoke(messages)

    if response.tool_calls:
        messages.append(response)
        tool_result = None

        for tool_call in response.tool_calls:
            if tool_call["name"] == "medical_research_tool":
                tool_result = medical_research_tool.invoke(tool_call["args"])
                messages.append(
                    ToolMessage(
                        content=tool_result,
                        tool_call_id=tool_call["id"],
                    )
                )
                messages.append(AIMessage(content=tool_result))

        if tool_result:
            return {"response": tool_result}

    return {"response": response.content}


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
