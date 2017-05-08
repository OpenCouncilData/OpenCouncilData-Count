# OpenCouncilData-Count
This NodeJS script generates a CSV, where each row is one dataset uploaded by an Australian council to an open data platform, by interrogating CKAN and Socrata portals. The output is unsorted and looks like this:

```
Council,LGA_Name,ShortName,Date,Type,State,Title,URL,Resources,Spatial
"horsham-rural-city-council","Horsham Rural City Council","Horsham","2016-05-25T00:03:55.832190","metadata_created","Victoria","HRCC Garbage Collection","https://data.gov.au/dataset/hrcc-garbage-collection",7,"Spatial"
"horsham-rural-city-council","Horsham Rural City Council","Horsham","2016-05-31T07:54:46.530426","metadata_created","Victoria","HRCC Dog Walking Zones","https://data.gov.au/dataset/hrcc-dog-walking-zones",5,"Spatial"
"horsham-rural-city-council","Horsham Rural City Council","Horsham","2016-04-06T02:59:41.772210","metadata_created","Victoria","HRCC Councillors 2016","https://data.gov.au/dataset/hrcc-councillors-2016",1,"Non-spatial"
"brisbane","Brisbane City Council","Brisbane","2015-06-23T00:15:46.287819","metadata_created","Queensland","Immunisation clinics, locations and times","https://data.brisbane.qld.gov.au/data/dataset/immunisation-clinic-locations-times",1,"Non-spatial"
"brisbane","Brisbane City Council","Brisbane","2015-06-18T07:23:53.187382","metadata_created","Queensland","Planned burns","https://data.brisbane.qld.gov.au/data/dataset/planned-burns",8,"Spatial"
...
```

It can then be loaded into Tableau to produce a nice graph of total number of datasets over time.

To refresh the visualisation here: https://public.tableau.com/profile/steve.bennett#!/vizhome/Opencouncildatagrowth/Councilopendatajourneys

1. First rerun [FindPortals](https://github.com/OpenCouncilData/FindPortals) to ensure the online list is up to date.
2. Run index.js, which writes to out.csv.

In Tableau:

3. Load the Councilopendatajourneys Tableau workbook from Tableau Public.
4. "Add Data Source", point to new out.csv.
5. Drag out.csv over the current file.
6. Upload!

