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


// Used for getting a list of every package update. Not currently used.
function fetchNewPackages(org, api, offset, outstream) {
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
                        outstream.write(`${orgOut},${orgInfo[org].title},${result.timestamp},${result.activity_type}\n`);
                    }
                });
                return fetchNewPackages(org, api, offset + limit, outstream);
            } else {
                // This is the only way we know that we don't need to request the next page.
                if (--todo === 0) {
                    //printResults();
                }
            }
        });

}


/*Promise.all([
    getCouncilOrgs('https://data.gov.au/api/3/'),
    getCouncilOrgs('https://data.sa.gov.au/data/api/3/'),
    getCouncilOrgs('http://data.nsw.gov.au/data/api/3/'),
    getCouncilOrgs('https://data.brisbane.qld.gov.au/data/api/3/')
])
*/
