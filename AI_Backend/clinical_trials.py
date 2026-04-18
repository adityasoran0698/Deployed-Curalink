import requests


def fetch_clinical_trials_data(disease):
    result = []
    url = f"https://clinicaltrials.gov/api/v2/studies?query.term={disease}&filter.overallStatus=RECRUITING,COMPLETED&pageSize=50&format=json"

    response = requests.get(url)
    data = response.json()

    for d in data["studies"]:

        required_data = {}

        # Title
        required_data["Title"] = d["protocolSection"]["identificationModule"][
            "briefTitle"
        ]

        # Status
        required_data["Status"] = d["protocolSection"]["statusModule"]["overallStatus"]

        # Eligibility
        required_data["Eligibility"] = d["protocolSection"]["eligibilityModule"][
            "eligibilityCriteria"
        ]

        # Location
        locations = []

        module = None
        if "contactsLocationsModule" in d["protocolSection"]:
            module = d["protocolSection"]["contactsLocationsModule"]

        if module and "locations" in module:
            for loc in module["locations"]:
                clean_location = {}

                if "city" in loc:
                    clean_location["city"] = loc["city"]

                if "state" in loc:
                    clean_location["state"] = loc["state"]

                if "country" in loc:
                    clean_location["country"] = loc["country"]

                if "zip" in loc:
                    clean_location["zip"] = loc["zip"]

                locations.append(clean_location)

        required_data["Location"] = locations

        # Contacts
        contacts = []
        if module and "centralContacts" in module:
            for c in module["centralContacts"]:
                contact_data = {}

                if "name" in c:
                    contact_data["name"] = c["name"]

                if "phone" in c:
                    contact_data["phone"] = c["phone"]

                if "email" in c:
                    contact_data["email"] = c["email"]

                contacts.append(contact_data)

        if not contacts and module and "locations" in module:
            for loc in module["locations"]:
                if "contacts" in loc:
                    for c in loc["contacts"]:
                        contact_data = {}

                        if "name" in c:
                            contact_data["name"] = c["name"]

                        if "phone" in c:
                            contact_data["phone"] = c["phone"]

                        if "email" in c:
                            contact_data["email"] = c["email"]

                        contacts.append(contact_data)

        required_data["Contacts"] = contacts
        result.append(required_data)

    return result

