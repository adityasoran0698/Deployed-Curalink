import requests
import xml.etree.ElementTree as ET


def fetch_pubmed(query: str):
    url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term={query}&retmax=80&sort=pub+date&retmode=json"
    response = requests.get(url)
    result = response.json()
    ids = result.get("esearchresult", {}).get("idlist", [])
    return fetch_pubmed_result(ids)


def fetch_pubmed_result(ids: list):
    if not ids:
        return []
    url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id={','.join(ids)}&retmode=xml"
    response = requests.get(url)
    fetched_result = parse_pubmed_xml(response.text)
    return fetched_result


def parse_pubmed_xml(xml_text: str) -> list[dict]:
    root = ET.fromstring(xml_text)
    articles = []

    for article in root.findall(".//PubmedArticle"):
        data = {}

        pmid = article.find(".//PMID")
        data["pmid"] = pmid.text if pmid is not None else ""

        title = article.find(".//ArticleTitle")
        data["title"] = "".join(title.itertext()) if title is not None else ""

        abstract_texts = article.findall(".//AbstractText")
        data["abstract"] = (
            " ".join("".join(a.itertext()) for a in abstract_texts)
            if abstract_texts
            else ""
        )

        authors = []
        for author in article.findall(".//Author"):
            last = author.findtext("LastName", "")
            fore = author.findtext("ForeName", "")
            if last or fore:
                authors.append(f"{fore} {last}".strip())
        data["authors"] = authors if authors else []

        pub_date = article.find(".//PubDate")
        year = ""
        if pub_date is not None:
            year_tag = pub_date.find("Year")
            medline_tag = pub_date.find("MedlineDate")
            if year_tag is not None:
                year = year_tag.text or ""
            elif medline_tag is not None:
                year = (medline_tag.text or "")[:4]
        data["pub_year"] = year

        data["source"] = "Pubmed"

        data["URL"] = (
            f"https://pubmed.ncbi.nlm.nih.gov/{data['pmid']}/" if data["pmid"] else ""
        )

        articles.append(data)

    return articles
