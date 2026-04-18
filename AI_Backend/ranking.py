import json
from datetime import datetime
from langchain_core.documents import Document

CURRENT_YEAR = datetime.now().year

STATUS_PRIORITY = {
    "RECRUITING": 1.00,
    "ACTIVE_NOT_RECRUITING": 0.85,
    "ENROLLING_BY_INVITATION": 0.75,
    "NOT_YET_RECRUITING": 0.60,
    "COMPLETED": 0.50,
    "TERMINATED": 0.20,
    "SUSPENDED": 0.10,
    "WITHDRAWN": 0.00,
    "UNKNOWN": 0.30,
}


def _semantic_score(faiss_distance: float) -> float:
    """Convert FAISS L2 distance (lower = better) to [0, 1] similarity."""
    return 1.0 / (1.0 + faiss_distance)


def _recency_score(year, min_year: int = 2010) -> float:
    """Linearly normalise publication year to [0, 1].  Unknown year → 0.3."""
    try:
        year = int(year)
    except (TypeError, ValueError):
        return 0.3
    year = max(min_year, min(CURRENT_YEAR, year))
    span = CURRENT_YEAR - min_year or 1
    return (year - min_year) / span


def _credibility_score(source: str) -> float:
    """PubMed is peer-reviewed and curated; OpenAlex is broader but less filtered."""
    source = (source or "").lower()
    if "pubmed" in source:
        return 1.0
    if "openalex" in source:
        return 0.8
    return 0.6


def _abstract_quality_score(abstract: str) -> float:
    """Score based on abstract length as a proxy for information richness."""
    if not abstract or abstract.strip() in ("", "No abstract available"):
        return 0.0
    length = len(abstract.strip())
    if length >= 500:
        return 1.0
    if length >= 200:
        return 0.7
    if length >= 50:
        return 0.4
    return 0.1


def _status_score(status: str) -> float:
    return STATUS_PRIORITY.get((status or "").upper(), 0.3)


def _parse(doc: Document) -> dict:
    try:
        return json.loads(doc.page_content)
    except Exception:
        return {}


PUB_WEIGHTS = {
    "semantic": 0.50,
    "recency": 0.25,
    "credibility": 0.15,
    "abstract": 0.10,
}

CT_WEIGHTS = {
    "semantic": 0.50,
    "status": 0.30,
    "contacts": 0.10,
    "location": 0.10,
}


def rank_publications(
    docs_with_scores: list[tuple[Document, float]],
    top_k: int = 8,
) -> list[dict]:
    """
    Rank a broad candidate pool of publications and return the top_k.

    Parameters
    ----------
    docs_with_scores : list of (Document, faiss_l2_distance) tuples
                       from FAISS.similarity_search_with_score()
    top_k            : how many to return (spec says 6–8)

    Returns
    -------
    list of dicts, each containing:
      - "data"            : original publication dict
      - "composite_score" : float
      - "breakdown"       : per-dimension scores for transparency
    """
    ranked = []

    for doc, distance in docs_with_scores:
        data = _parse(doc)

        sem = _semantic_score(distance)
        rec = _recency_score(data.get("pub_year") or data.get("year"))
        cred = _credibility_score(data.get("source", ""))
        abst = _abstract_quality_score(data.get("abstract", ""))

        composite = (
            PUB_WEIGHTS["semantic"] * sem
            + PUB_WEIGHTS["recency"] * rec
            + PUB_WEIGHTS["credibility"] * cred
            + PUB_WEIGHTS["abstract"] * abst
        )

        ranked.append(
            {
                "data": data,
                "composite_score": round(composite, 4),
                "breakdown": {
                    "semantic": round(sem, 3),
                    "recency": round(rec, 3),
                    "credibility": round(cred, 3),
                    "abstract": round(abst, 3),
                },
            }
        )

    ranked.sort(key=lambda x: x["composite_score"], reverse=True)
    return ranked[:top_k]


def rank_clinical_trials(
    docs_with_scores: list[tuple[Document, float]],
    top_k: int = 6,
) -> list[dict]:
    """
    Rank a broad candidate pool of clinical trials and return the top_k.

    Parameters
    ----------
    docs_with_scores : list of (Document, faiss_l2_distance) tuples
    top_k            : how many to return

    Returns
    -------
    list of dicts, each containing:
      - "data"            : original trial dict
      - "composite_score" : float
      - "breakdown"       : per-dimension scores
    """
    ranked = []

    for doc, distance in docs_with_scores:
        data = _parse(doc)

        sem = _semantic_score(distance)
        status = _status_score(data.get("Status", ""))
        contacts = 1.0 if data.get("Contacts") else 0.0
        location = 1.0 if data.get("Location") else 0.0

        composite = (
            CT_WEIGHTS["semantic"] * sem
            + CT_WEIGHTS["status"] * status
            + CT_WEIGHTS["contacts"] * contacts
            + CT_WEIGHTS["location"] * location
        )

        ranked.append(
            {
                "data": data,
                "composite_score": round(composite, 4),
                "breakdown": {
                    "semantic": round(sem, 3),
                    "status": round(status, 3),
                    "contacts": round(contacts, 3),
                    "location": round(location, 3),
                },
            }
        )

    ranked.sort(key=lambda x: x["composite_score"], reverse=True)
    return ranked[:top_k]
