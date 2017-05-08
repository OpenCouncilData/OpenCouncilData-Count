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

    
function getCkanOrgs() {
    return Promise.map(
        requestp({
            url: 'https://opencouncildata.cloudant.com/councils/_design/platforms/_view/ckan',
            json: true
        }).then(results => results.rows),
        row => {
            orgInfo[row.id] = row.key;
            orgInfo[row.id].name = row.id.replace(/^.*\//, '');
            return row.id;
        }
    ).tap(orgs => { console.log(`Scanning ${orgs.length} CKAN organisations.`); });
}

//getCouncilOrgs();
var todo;



function writeCsvRow(vals) {
    out.write(vals.map(val => typeof val === 'string' ? '"' + val.replace('"', '""') + '"' : val).join() + '\n');
}

function listCkanPackages(orgInfo) {
    var url = new URI(orgInfo.api + 'action/package_search')
        .query({
            fq: orgInfo.name ? `organization:${orgInfo.name}`: undefined, // another Brisbane case.
            rows: 1000
        }).toString();
    console.log(url);
    return sleep(Math.round(Math.random()*2000)) // try not to slam data.gov.au too hard all at once
        .then(() => requestp({ uri: url, json: true }))
        .then(response => {
            if (!response.success) {
                console.error('Fail');
                return;
            }
            if (response.result.results.length) {
                response.result.results//.filter(result => result.activity_type === 'new package')
                .filter(result => !(orgInfo.api.match('data.sa') && result.harvest_source_title)) // data.sa has some dodgy records showing up under 5 SA organisations that are actually harvested from Vic
                .forEach(result => {
                    totalCkanPackages ++;
                    var orgOut = orgInfo.api.match(/brisbane/) ? 'brisbane' : orgInfo.name;
                    var url = orgInfo.api.replace(/api.*/, 'dataset/' + result.name);
                    var spatial = !!JSON.stringify(result).match(/"(wms|shp|kml|kmz|geojson)"/i) ? 'Spatial' : 'Non-spatial';
                    writeCsvRow([orgOut, orgInfo.title, orgInfo.shortTitle, result.metadata_created, 'metadata_created', orgInfo.state, result.title, orgInfo.url, result.resources.length, spatial]);
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

var out = require('fs').createWriteStream('out.csv');
var totalCkanPackages = 0;
out.once('open', () => {
    // Get a list of all the organisations across all the CKANs to query, then grab lists of datasets for each of them, then add Socrata lists.
    getCkanOrgs().then(() => {
        var orgs = Object.keys(orgInfo);
        //console.log(orgInfo[orgs[0]]);
        todo = orgs.length;
        //console.log('Council,Title,Created,Type');
        out.write('Council,LGA_Name,ShortName,Date,Type,State,Title,URL,Resources,Spatial\n');

        //fetchNewPackages(org, orgInfo[org].api, 0);
        return Promise
            .map(orgs, org => listCkanPackages(orgInfo[org]))
            .tap(() => { console.log(`Found ${totalCkanPackages} CKAN packages.`); });
    }).then( () => Promise.all([
        getSocrataDatasets('http://data.melbourne.vic.gov.au/data.json', 'cityofmelbourne','City of Melbourne','Melbourne','Victoria'),
        getSocrataDatasets('http://data.act.gov.au/data.json', 'act-government','ACT Government','ACT','ACT'),
        getSocrataDatasets('https://data.sunshinecoast.qld.gov.au/data.json','sunshine','Sunshine Coast Council','Sunshine Coast','Queensland')
    ]));
});