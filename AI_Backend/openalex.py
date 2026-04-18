import requests


def get_abstract(inverted_index):
    if not inverted_index:
        return "No abstract available"
    words = []
    for word, positions in inverted_index.items():
        for pos in positions:
            words.append((pos, word))
    words.sort()
    return " ".join(word for _, word in words)


def get_authors(authorships):
    authors = []
    for author in authorships:
        name = author["author"]["display_name"]
        authors.append(name)
    return authors


def fetch_openalex(query: str):
    url = f"https://api.openalex.org/works?search={query}+research&per-page=80&page=1&sort=publication_date:desc&filter=from_publication_date:2018-01-01"

    response = requests.get(url)

    data = response.json()
    papers = data["results"]
    result = []

    for paper in papers:

        title = paper.get("title")
        if not title:
            continue

        abstract = get_abstract(paper.get("abstract_inverted_index"))
        authors = get_authors(paper.get("authorships"))

        year = paper.get("publication_year")

        url_link = paper.get("doi", "")
        if not url_link:
            url_link = paper.get("id", "")

        final_data = {
            "title": title,
            "abstract": abstract,
            "authors": authors,
            "year": year,
            "source": "openalex",
            "url": url_link,
        }

        result.append(final_data)

    return result
