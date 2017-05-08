This script generates a CSV, where each row is one dataset uploaded by an Australian council to an open data platform.

To refresh the visualisation here: https://public.tableau.com/profile/steve.bennett#!/vizhome/Opencouncildatagrowth/Councilopendatajourneys

1. First rerun [FindPortals](https://github.com/OpenCouncilData/FindPortals) to ensure the online list is up to date.
2. Run index.js, which writes to out.csv.

In Tableau:

3. Load the Councilopendatajourneys Tableau workbook from Tableau Public.
4. "Add Data Source", point to new out.csv.
5. Drag out.csv over the current file.
6. Upload!