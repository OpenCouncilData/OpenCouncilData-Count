/* jshint esnext:true */
var requestp = require('request-promise');
var URI = require('urijs');
var Promise = require('bluebird');
var sleep = require('sleep-promise');
//var orgs = ['city-of-boroondara'];
var orgInfo = {};


function cleanCouncilName(name) {
    var re = /\s*(^City of|^Shire of|\(Local Council\)|City|Shire|Rural|Municipal|Council)\s*/;
    return name.replace(re, '').replace(re, '').replace(re, '');
}

/* Connect  to a CKAN endpoint and build a list of councils that have organisations within that portal. */
function getCouncilOrgs(api) {
    
    //console.log('Short name,Date,LGA_Name');
    return requestp({
        url: api + 'action/organization_list?all_fields=true', // all_fields gets us the title (and a million things we don't need)
        json: true
    }).then(results => results.result
        // we have to be careful not to double count sites that get federated to data.gov.au
        .filter(org => api.match('brisbane') ? true : (!org.title.match(/Brisbane/) && org.title.match(/city|shire|municipal/i)))
        //.filter(org => org.name === 'city-of-greater-geelong')
        .filter(org => { 
            //console.log(`${org.name},${org.created},${org.title}`);
            // Remove Socrata sites that are federated to data.gov.au.
            return org.name !== 'act-government' && org.name !== 'cityofmelbourne';  
            //return true;
            })
        .map(org => {
            orgInfo[org.name] = {
                packages: [],
                api: api,
                title: api.match('brisbane') ? 'Brisbane City Council' : org.title,
                shortTitle: api.match('brisbane') ? 'Brisbane' : cleanCouncilName(org.title)
            };
            // There is no explicit state metadata, so we have to generate that here.
            if (api.match('brisbane') || org.title.match(/gold coast|logan|sunshine coast|noosa/i))
                orgInfo[org.name].state = 'Queensland';
            else if (api.match('data.sa'))
                orgInfo[org.name].state = 'South Australia';
            else if (api.match('data.nsw') || org.title.match('Mosman'))
                orgInfo[org.name].state = 'New South Wales';
            else if (org.title.match(/launceston|hobart|glenorchy/i))
                orgInfo[org.name].state = 'Tasmania';
            else if (org.title.match(/act government/i))
                orgInfo[org.name].state = 'ACT';
            else
                orgInfo[org.name].state = 'Victoria';

            return org.name;
        })

    );
}
//getCouncilOrgs();
var todo;


// Used for getting a list of every package update. Not currently used.
function fetchNewPackages(org, api, offset) {
    var limit = 100;
    //console.log('Page ' + offset);
    var url = new URI(api + 'action/organization_activity_list')
        .query({
            id: org,
            limit: limit,
            offset: offset,
        }).toString();
    requestp({ uri: url, json: true })
        .then(response => {
            if (!response.success) {
                console.error('Fail');
                return;
            }
            if (response.result.length) {
                response.result//.filter(result => result.activity_type === 'new package')
                .forEach(result => {
                    orgInfo[org].packages.push(result.timestamp);
                    orgInfo[org].firstPackage = result.timestamp;
                    if (!orgInfo[org].lastPackage) {
                        orgInfo[org].lastPackage = result.timestamp;
                    }
                    var orgOut = api.match(/brisbane/) ? 'brisbane' : org;
                    if (result.activity_type.match(/new package|changed package/)) {
                        console.log(`${orgOut},${orgInfo[org].title},${result.timestamp},${result.activity_type}`);
                    }
                });
                return fetchNewPackages(org, api, offset + limit);
            } else {
                // This is the only way we know that we don't need to request the next page.
                if (--todo === 0) {
                    //printResults();
                }
            }
        });

}

function writeCsvRow(vals) {
    console.log(vals.map(val => typeof val === 'string' ? '"' + val.replace('"', '""') + '"' : val).join());
}

function listPackages(org, api, offset) {
    var url = new URI(api + 'action/package_search')
        .query({
            fq: `organization:${org}`,
            rows: 1000
        }).toString();
    
    return sleep(Math.round(Math.random()*2000)) // try not to slam data.gov.au too hard all at once
        .then(() => requestp({ uri: url, json: true }))
        .then(response => {
            if (!response.success) {
                console.error('Fail');
                return;
            }
            if (response.result.results.length) {
                response.result.results//.filter(result => result.activity_type === 'new package')
                .filter(result => !(api.match('data.sa') && result.harvest_source_title)) // data.sa has some dodgy records showing up under 5 SA organisations that are actually harvested from Vic
                .forEach(result => {
                    var orgOut = api.match(/brisbane/) ? 'brisbane' : org;
                    var oi = orgInfo[org];
                    var url = api.replace(/api.*/, 'dataset/' + result.name);
                    var spatial = !!JSON.stringify(result).match(/"(wms|shp|kml|kmz|geojson)"/i) ? 'Spatial' : 'Non-spatial';
                    writeCsvRow([orgOut, oi.title, oi.shortTitle, result.metadata_created, 'metadata_created', oi.state, result.title, url, result.resources.length, spatial]);
                    //console.log(`${orgOut},${oi.title},${oi.shortTitle},${result.metadata_created},metadata_created,${oi.state},${result.title},${url},${result.resources.length},${spatial}`);
                });
                //return fetchNewPackages(org, api, offset + limit);
            } else {
                // This is the only way we know that we don't need to request the next page.
                if (--todo === 0) {
                    //printResults();
                }
            }
        });
}

var offset = 10000; // For zero padding
function getSocrataDatasets(url, slugname, name, shortname, state) {
    function getOffset() { // Tableau incorrectly merges rows that have the exact same timestamp, so we keep them separated by adding random milliseconds.
        return (offset++ + '').substring(1,5);
    }

    //data = require('./melbournedata.json');
    requestp({ uri: url, json: true }).then(data => {
        data.dataset.forEach(dataset => {
            var spatial = dataset.distribution.filter(d => d.mediaType && d.mediaType.match(/kml/)).length > 0 ? 'Spatial' : 'Non-spatial';
            writeCsvRow([slugname, name, shortname,dataset.issued+'T09:00:00.' + getOffset(), 'metadata_created',state,dataset.title, url, 1, spatial]);
        });
    });
}

// Get a list of all the organisations across all the CKANs to query, then grab lists of datasets for each of them, then add Socrata lists.

Promise.all([
    getCouncilOrgs('https://data.gov.au/api/3/'),
    getCouncilOrgs('https://data.sa.gov.au/data/api/3/'),
    getCouncilOrgs('http://data.nsw.gov.au/data/api/3/'),
    getCouncilOrgs('https://data.brisbane.qld.gov.au/data/api/3/')
]).then(() => {
    var orgs = Object.keys(orgInfo);
    todo = orgs.length;
    //console.log('Council,Title,Created,Type');
    console.log('Council,LGA_Name,ShortName,Date,Type,State,Title,URL,Resources,Spatial');

    //fetchNewPackages(org, orgInfo[org].api, 0);
    return Promise.map(orgs, org => listPackages(org, orgInfo[org].api));
}).then( () => Promise.all([
    getSocrataDatasets('http://data.melbourne.vic.gov.au/data.json', 'cityofmelbourne','City of Melbourne','Melbourne','Victoria'),
    getSocrataDatasets('http://data.act.gov.au/data.json', 'act-government','ACT Government','ACT','ACT'),
    getSocrataDatasets('https://data.sunshinecoast.qld.gov.au/data.json','sunshine','Sunshine Coast Council','Sunshine Coast','Queensland')
]));